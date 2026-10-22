// Real main.js, Nest controllers/pipes/guards, PostgreSQL, and TCP HTTP. No mocks.
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });

const root = resolve(__dirname, '../..');
const runId = `http-e2e-${randomUUID()}`;
const secret = `e2e-only-${randomUUID()}`;
const password = 'E2ePassword123!';
let db, server, base, alice, bob;
let dbConnected = false;
let startupLogs = '';

async function http(path, { method = 'GET', body, token, headers = {}, status = 200, code } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text}`);
  assert.match(response.headers.get('x-request-id') || '', /^[0-9a-f-]{36}$/i);
  if (status === 204) {
    assert.equal(text, '');
    return;
  }
  assert.match(response.headers.get('content-type'), /application\/json/);
  const envelope = JSON.parse(text);
  assert.equal(envelope.success, status < 400);
  assert.equal(envelope.meta.requestId, response.headers.get('x-request-id'));
  if (status >= 400) {
    assert.equal(typeof envelope.error.message, 'string');
    assert.equal(typeof envelope.error.code, 'string');
    assert.equal(envelope.data, undefined);
    assert.equal(envelope.error.stack, undefined);
    if (code) assert.equal(envelope.error.code, code);
  } else {
    assert.ok(Object.hasOwn(envelope, 'data'));
    assert.equal(envelope.error, undefined);
  }
  return envelope;
}

async function register(name) {
  const email = `${runId}-${name}@example.test`;
  const body = { email, fullName: `E2E ${name}`, password, confirmPassword: password };
  const registered = await http('/auth/register', { method: 'POST', body, status: 201 });
  assert.equal(registered.data.email, email);
  assert.equal(registered.data.passwordHash, undefined);
  assert.equal(registered.data.password, undefined);
  const login = await http('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.data.user.id, registered.data.id);
  assert.equal(login.data.user.passwordHash, undefined);
  return { ...registered.data, token: login.data.accessToken, registration: body };
}

async function open(user, balance = '0') {
  return (await http('/accounts', {
    method: 'POST', token: user.token, status: 201,
    body: { accountName: 'HTTP E2E', accountType: 'PAYMENT', initialDeposit: balance },
  })).data;
}

before(async () => {
  const connectionString = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString || !decodeURIComponent(new URL(connectionString).pathname.slice(1)).endsWith('_test')) {
    throw new Error('Set E2E_DATABASE_URL to a dedicated PostgreSQL database ending in _test');
  }
  // Guard above runs BEFORE migrations or any database writes.
  // Check connectivity first so setup failures show the real PostgreSQL error.
  db = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await db.connect();
  dbConnected = true;
  try { execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: root, env: { ...process.env, DATABASE_URL: connectionString }, timeout: 60000, stdio: 'pipe',
  }); } catch (error) {
    throw new Error(`E2E migration failed: ${error.stderr?.toString() || error.message}`);
  }
  const socket = createServer();
  await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok); });
  const port = socket.address().port;
  await new Promise(ok => socket.close(ok));
  base = `http://127.0.0.1:${port}/api/v1`;
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: root, env: { ...process.env, DATABASE_URL: connectionString, NODE_ENV: 'test', PORT: String(port),
      JWT_ACCESS_SECRET: secret, JWT_ACCESS_TTL: '15m', BCRYPT_ROUNDS: '4' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let spawnError;
  server.on('error', error => { spawnError = error; });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', chunk => { startupLogs = (startupLogs + chunk).slice(-8000); });
  }
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) throw new Error(`App exited during startup:\n${startupLogs}`);
    try {
      const r = await fetch(`${base}/accounts`, { signal: AbortSignal.timeout(1000) });
      if (r.status === 401) { ready = true; break; }
    } catch { /* wait for the real listener */ }
    await new Promise(ok => setTimeout(ok, 150));
  }
  assert.ok(ready, `App did not become ready:\n${startupLogs}`);
  alice = await register('alice');
  bob = await register('bob');
}, { timeout: 100000 });

after(async () => {
  try {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
      try { await exited; } finally { clearTimeout(timer); }
    }
  } finally {
    if (dbConnected) {
      try {
        // Restrict cleanup to this run, including registrations from a failed assertion.
        await db.query('BEGIN');
        const ids = (await db.query('SELECT user_id FROM users WHERE email LIKE $1', [`${runId}-%`])).rows.map(r => r.user_id);
        const accounts = (await db.query('SELECT id FROM bank_accounts WHERE user_id = ANY($1::text[])', [ids])).rows.map(r => r.id);
        await db.query('DELETE FROM financial_transactions WHERE account_id = ANY($1::text[])', [accounts]);
        await db.query('DELETE FROM transfers WHERE initiated_by_user_id = ANY($1::text[])', [ids]);
        await db.query('DELETE FROM bank_accounts WHERE user_id = ANY($1::text[])', [ids]);
        await db.query('DELETE FROM users WHERE user_id = ANY($1::text[])', [ids]);
        await db.query('COMMIT');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { await db.end(); }
    } else if (db) await db.end();
  }
});

test('full lifecycle over HTTP: money, history, close, and replay after close', async () => {
  const a = await open(alice, '100000');
  const b = await open(bob);
  assert.equal(a.currency, 'VND');
  const tx = (type, amount) => http(`/accounts/${a.id}/transactions`, {
    method: 'POST', token: alice.token, body: { type, amount }, status: 201,
  });
  assert.equal((await tx('CREDIT', '400000')).data.balanceAfter, '500000');
  assert.equal((await tx('DEBIT', '100000')).data.balanceAfter, '400000');
  const transfer = { sourceAccountId: a.id, destinationAccountNumber: b.accountNumber, amount: '250000' };
  const headers = { 'Idempotency-Key': randomUUID() };
  const original = await http('/transfers', { method: 'POST', token: alice.token, body: transfer, headers, status: 201 });
  const replay = await http('/transfers', { method: 'POST', token: alice.token, body: transfer, headers });
  assert.deepEqual(replay.data, original.data);
  assert.equal((await http(`/accounts/${a.id}`, { token: alice.token })).data.currentBalance, '150000');
  assert.equal((await http(`/accounts/${b.id}`, { token: bob.token })).data.currentBalance, '250000');
  const history = await http(`/accounts/${a.id}/transactions?page=1&limit=10`, { token: alice.token });
  assert.deepEqual(history.pagination, { page: 1, limit: 10, total: 4, totalPages: 1 });
  assert.deepEqual(history.data.map(t => t.referenceType).sort(), ['OPENING_DEPOSIT', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'TRANSFER_OUT'].sort());
  const debits = await http(`/accounts/${a.id}/transactions?type=DEBIT`, { token: alice.token });
  assert.equal(debits.data.length, 2);
  assert.ok(debits.data.every(t => t.transactionType === 'DEBIT'));
  const incoming = await http(`/accounts/${b.id}/transactions`, { token: bob.token });
  assert.equal(incoming.data.length, 1);
  assert.equal(incoming.data[0].transferId, original.data.id);
  await http(`/accounts/${a.id}`, { method: 'DELETE', token: alice.token, status: 409, code: 'ACCOUNT_HAS_BALANCE' });
  await tx('DEBIT', '150000');
  await http(`/accounts/${a.id}`, { method: 'DELETE', token: alice.token, status: 204 });
  const closed = (await http(`/accounts/${a.id}`, { token: alice.token })).data;
  assert.equal(closed.status, 'CLOSED');
  assert.ok(closed.closedAt);
  assert.deepEqual((await http('/transfers', { method: 'POST', token: alice.token, body: transfer, headers })).data, original.data);
  assert.equal((await http(`/accounts/${a.id}/transactions`, { token: alice.token })).pagination.total, 5);
  const list = await http('/accounts?page=1&limit=1', { token: alice.token });
  assert.equal(list.pagination.limit, 1);
  assert.ok(list.data.every(account => account.id !== b.id));
});

test('guard rejects missing, invalid and expired bearer tokens', async () => {
  for (const token of [undefined, 'invalid-token', jwt.sign({ sub: alice.id }, secret, { expiresIn: -1 })]) {
    await http('/accounts', { token, status: 401, code: 'UNAUTHORIZED' });
    await http('/accounts', { method: 'POST', token, body: {}, status: 401 });
  }
});

test('identity rejects duplicate email, wrong password and malformed DTOs', async () => {
  await http('/auth/register', { method: 'POST', body: alice.registration, status: 409, code: 'EMAIL_EXISTS' });
  await http('/auth/login', { method: 'POST', body: { email: alice.email, password: 'wrong' }, status: 401, code: 'INVALID_CREDENTIALS' });
  const invalid = await http('/auth/register', { method: 'POST', body: { ...alice.registration, email: 'invalid', extra: true }, status: 400, code: 'VALIDATION_ERROR' });
  assert.ok(invalid.error.details.some(d => d.field === 'email'));
  assert.ok(invalid.error.details.some(d => d.field === 'extra'));
});

test('DTO validation rejects invalid UUIDs, pagination, body types and extra fields', async () => {
  await http('/accounts/not-a-uuid', { token: alice.token, status: 400, code: 'VALIDATION_ERROR' });
  await http('/accounts?page=0', { token: alice.token, status: 400, code: 'VALIDATION_ERROR' });
  await http('/accounts', { method: 'POST', token: alice.token, status: 400, code: 'VALIDATION_ERROR',
    body: { accountName: 'Invalid', accountType: 'UNKNOWN', initialDeposit: 123, userId: bob.id } });
  const a = await open(alice);
  await http(`/accounts/${a.id}/transactions?from=invalid`, { token: alice.token, status: 400, code: 'VALIDATION_ERROR' });
  for (const amount of ['-1', '0', '1.5', 100]) {
    await http(`/accounts/${a.id}/transactions`, { method: 'POST', token: alice.token,
      body: { type: 'CREDIT', amount }, status: 400 });
  }
  assert.equal((await http(`/accounts/${a.id}`, { token: alice.token })).data.currentBalance, '0');
});

test('ownership protects reads, history, writes, close and transfers with 404', async () => {
  const a = await open(alice, '1000');
  const b = await open(bob);
  for (const [path, method, body] of [
    [`/accounts/${a.id}`, 'GET'], [`/accounts/${a.id}/transactions`, 'GET'],
    [`/accounts/${a.id}`, 'DELETE'], [`/accounts/${a.id}/transactions`, 'POST', { type: 'DEBIT', amount: '1' }],
    ['/transfers', 'POST', { sourceAccountId: a.id, destinationAccountNumber: b.accountNumber, amount: '1' }],
  ]) await http(path, { method, body, token: bob.token, headers: { 'Idempotency-Key': randomUUID() }, status: 404, code: 'ACCOUNT_NOT_FOUND' });
  assert.equal((await http(`/accounts/${a.id}`, { token: alice.token })).data.currentBalance, '1000');
});

test('transfer header validation, insufficient funds and closed destination do not move money', async () => {
  const a = await open(alice, '100');
  const b = await open(bob);
  const body = { sourceAccountId: a.id, destinationAccountNumber: b.accountNumber, amount: '101' };
  for (const key of [undefined, 'short', 'x'.repeat(129)]) {
    await http('/transfers', { method: 'POST', token: alice.token, body, headers: key ? { 'Idempotency-Key': key } : {}, status: 400, code: 'HTTP_ERROR' });
  }
  await http('/transfers', { method: 'POST', token: alice.token, body, headers: { 'Idempotency-Key': randomUUID() }, status: 409, code: 'INSUFFICIENT_FUNDS' });
  await http(`/accounts/${b.id}`, { method: 'DELETE', token: bob.token, status: 204 });
  await http('/transfers', { method: 'POST', token: alice.token, body: { ...body, amount: '1' }, headers: { 'Idempotency-Key': randomUUID() }, status: 404, code: 'ACCOUNT_NOT_FOUND' });
  assert.equal((await http(`/accounts/${a.id}`, { token: alice.token })).data.currentBalance, '100');
  assert.equal((await http(`/accounts/${a.id}/transactions`, { token: alice.token })).pagination.total, 1);
});
