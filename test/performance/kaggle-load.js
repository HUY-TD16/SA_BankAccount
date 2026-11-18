import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Fixtures are prepared outside k6: setup traffic is excluded from these metrics.
const fixture = JSON.parse(open(__ENV.FIXTURE));
const protocol = JSON.parse(open(__ENV.PROTOCOL_FILE));
const workload = __ENV.WORKLOAD || 'list';
if (!protocol.workloads.includes(workload)) throw new Error('Invalid WORKLOAD');
const vus = Number(__ENV.VUS || 1);
const latency = new Trend('operation_duration', true);
const errors = new Rate('operation_errors');
const requests = new Counter('operation_requests');
const successes = new Counter('operation_successes');
const base = 'http://127.0.0.1:3000/api/v1';
const thresholds = { operation_errors: [protocol.error_threshold] };
const scenario = {
  executor: 'constant-vus', duration: __ENV.DURATION || protocol.duration, gracefulStop: protocol.graceful_stop,
};
const runId = Date.now().toString(36);

let scenarios = { measured: { ...scenario, vus } };
if (workload === 'mixed') {
  scenarios = {
    login: { ...scenario, vus: protocol.mixed.login_vus, exec: 'login' },
    list: { ...scenario, vus: protocol.mixed.list_vus, exec: 'list' },
  };
  // Thresholds on tagged submetrics make k6 report each group's latency separately in the summary.
  for (const name of ['login', 'list']) {
    thresholds[`operation_duration{name:${name}}`] = ['max>=0'];
    thresholds[`operation_requests{name:${name}}`] = ['count>=0'];
    thresholds[`operation_successes{name:${name}}`] = ['count>=0'];
    thresholds[`operation_errors{name:${name}}`] = [protocol.error_threshold];
  }
}

export const options = {
  scenarios,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds,
};

function call(op) {
  const params = {
    timeout: protocol.request_timeout,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.token}` },
    tags: { name: op },
  };
  const ids = fixture.accountIds;
  if (op === 'login') {
    const response = http.post(`${base}/auth/login`, JSON.stringify({
      email: fixture.email, password: fixture.password,
    }), params);
    return [response, 200, (data) => typeof data?.accessToken === 'string'];
  }
  if (op === 'list') {
    const response = http.get(`${base}/accounts?page=${protocol.fixture.list_page}&limit=${protocol.fixture.list_limit}`, params);
    return [response, 200, (data) => {
      const got = Array.isArray(data) ? data.map((account) => account?.id) : null;
      return Array.isArray(got) && got.length === ids.length &&
        new Set(got).size === ids.length && got.every((id) => ids.includes(id));
    }];
  }
  if (op === 'transfer') {
    const amount = protocol.fixture.transfer_amount;
    const source = Math.floor(Math.random() * ids.length);
    const destination = (source + 1 + Math.floor(Math.random() * (ids.length - 1))) % ids.length;
    params.headers['Idempotency-Key'] = `transfer-${runId}-${__VU}-${__ITER}`; // New key per request: no replays. API needs >= 16 chars.
    const response = http.post(`${base}/transfers`, JSON.stringify({
      sourceAccountId: ids[source], destinationAccountNumber: fixture.accountNumbers[destination], amount,
    }), params);
    return [response, 201, (data) => data?.amount === amount && data?.sourceAccountId === ids[source] &&
      data?.destinationAccountId === ids[destination]];
  }
  // debit hits one hot account (lock contention); debit_spread gives each VU its own account (write cost only).
  const accountId = op === 'debit_spread' ? ids[(__VU - 1) % ids.length] : ids[0];
  const amount = protocol.fixture.debit_amount;
  const response = http.post(`${base}/accounts/${accountId}/transactions`,
    JSON.stringify({ type: 'DEBIT', amount }), params);
  return [response, 201, (data) => data?.amount === amount && data?.transactionType === 'DEBIT' &&
    data?.accountId === accountId];
}

function step(op) {
  const [response, status, valid] = call(op);
  let body;
  try { body = response.json(); } catch (_) { body = null; }
  const ok = response.status === status && body?.success === true && valid(body.data);
  const tags = { name: op };
  latency.add(response.timings.duration, tags);
  errors.add(!ok, tags);
  requests.add(1, tags);
  successes.add(ok ? 1 : 0, tags);
  sleep(protocol.think_time_seconds); // Fixed think time; VUs are not requests/second.
}

export default function () { step(workload); }
export function login() { step('login'); }
export function list() { step('list'); }

export function handleSummary(data) {
  return {
    [__ENV.SUMMARY]: JSON.stringify(data, null, 2),
    stdout: JSON.stringify({ workload, metrics: {
      latency: data.metrics.operation_duration?.values,
      errors: data.metrics.operation_errors?.values,
      requests: data.metrics.operation_requests?.values,
    } }, null, 2) + '\n',
  };
}
