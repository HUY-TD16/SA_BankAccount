import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ quiet: true });

const schema = `constraints_${randomUUID().replace(/-/g, '')}`;
let client: Client;
let schemaCreated = false;

beforeAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString ||
      !decodeURIComponent(new URL(connectionString).pathname.slice(1)).endsWith('_test')) {
    throw new Error('Integration tests require a dedicated *_test DATABASE_URL');
  }
  client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  await client.query(`SET search_path TO "${schema}"`);
  const migrations = join(__dirname, '../../../prisma/migrations');
  for (const directory of readdirSync(migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    await client.query(readFileSync(join(migrations, directory, 'migration.sql'), 'utf8'));
  }
}, 30000);

beforeEach(async () => {
  await client.query('BEGIN');
  await client.query(`
    INSERT INTO users (user_id, email, full_name, password_hash, updated_at)
    VALUES ('user', 'user@example.test', 'Test User', 'test-only', now());
    INSERT INTO bank_accounts
      (id, user_id, account_number, account_name, account_type, updated_at)
    VALUES ('source', 'user', '0001', 'Source', 'PAYMENT', now()),
           ('destination', 'user', '0002', 'Destination', 'SAVINGS', now());
    INSERT INTO transfers
      (id, source_account_id, destination_account_id, initiated_by_user_id, amount, idempotency_key)
    VALUES ('transfer', 'source', 'destination', 'user', 1, 'test');
    INSERT INTO financial_transactions
      (id, account_id, transaction_type, reference_type, amount, balance_after)
    VALUES ('transaction', 'source', 'CREDIT', 'CASH_DEPOSIT', 1, 0);
  `);
});

afterEach(async () => {
  if (client) await client.query('ROLLBACK');
});

afterAll(async () => {
  if (client) {
    try {
      await client.query('ROLLBACK');
      if (schemaCreated) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await client.end();
    }
  }
});

describe('database CHECK constraints (direct SQL bypassing application validation)', () => {
  it.each([
    ['users_email_normalized_check', "UPDATE users SET email = 'User@example.test'"],
    ['users_email_normalized_check', "UPDATE users SET email = ' user@example.test'"],
    ['users_email_normalized_check', "UPDATE users SET email = 'user@example.test '"],
    ['bank_accounts_balance_nonnegative_check', 'UPDATE bank_accounts SET current_balance = -1'],
    ['bank_accounts_currency_vnd_check', "UPDATE bank_accounts SET currency = 'USD'"],
    ['bank_accounts_closed_at_check', "UPDATE bank_accounts SET status = 'CLOSED'"],
    ['bank_accounts_closed_at_check', 'UPDATE bank_accounts SET closed_at = now()'],
    ['financial_transactions_amount_positive_check', 'UPDATE financial_transactions SET amount = 0'],
    ['financial_transactions_amount_positive_check', 'UPDATE financial_transactions SET amount = -1'],
    ['financial_transactions_balance_nonnegative_check', 'UPDATE financial_transactions SET balance_after = -1'],
    ['transfers_amount_positive_check', 'UPDATE transfers SET amount = 0'],
    ['transfers_amount_positive_check', 'UPDATE transfers SET amount = -1'],
    ['transfers_distinct_accounts_check', 'UPDATE transfers SET destination_account_id = source_account_id'],
  ])('rejects %s: %s', async (constraint, sql) => {
    await expect(client.query(sql)).rejects.toMatchObject({ code: '23514', constraint });
  });

  const references = [
    ['OPENING_DEPOSIT', 'CREDIT'],
    ['CASH_DEPOSIT', 'CREDIT'],
    ['CASH_WITHDRAWAL', 'DEBIT'],
    ['TRANSFER_IN', 'CREDIT'],
    ['TRANSFER_OUT', 'DEBIT'],
  ];

  it.each(references)('accepts %s with %s', async (reference, type) => {
    await client.query(
      'UPDATE financial_transactions SET reference_type = $1, transaction_type = $2',
      [reference, type],
    );
  });

  it.each(references)('rejects %s with the opposite of %s', async (reference, type) => {
    await expect(client.query(
      'UPDATE financial_transactions SET reference_type = $1, transaction_type = $2',
      [reference, type === 'CREDIT' ? 'DEBIT' : 'CREDIT'],
    )).rejects.toMatchObject({
      code: '23514',
      constraint: 'financial_transactions_type_reference_check',
    });
  });

  it('accepts zero balances, VND, normalized email and consistent account states', async () => {
    await client.query(`
      UPDATE users SET email = 'normalized@example.test';
      UPDATE bank_accounts SET current_balance = 0, currency = 'VND',
        status = 'CLOSED', closed_at = now();
      UPDATE bank_accounts SET status = 'ACTIVE', closed_at = NULL;
      UPDATE financial_transactions SET amount = 1, balance_after = 0;
      UPDATE transfers SET amount = 1;
    `);
  });

  it('rejects an invalid new row as well as updates', async () => {
    await expect(client.query(`
      INSERT INTO financial_transactions
        (id, account_id, transaction_type, reference_type, amount, balance_after)
      VALUES ('invalid', 'source', 'CREDIT', 'CASH_DEPOSIT', 0, 0)
    `)).rejects.toMatchObject({
      code: '23514',
      constraint: 'financial_transactions_amount_positive_check',
    });
  });
});
