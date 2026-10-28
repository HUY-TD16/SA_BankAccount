import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Fixtures are prepared outside k6: setup traffic is excluded from these metrics.
const fixture = JSON.parse(open(__ENV.FIXTURE));
const protocol = JSON.parse(open(__ENV.PROTOCOL_FILE));
const workload = __ENV.WORKLOAD || 'list';
if (!protocol.workloads.includes(workload)) throw new Error('Invalid WORKLOAD');
const isDebit = workload === 'debit';
const vus = Number(__ENV.VUS || 1);
const latency = new Trend('operation_duration', true);
const errors = new Rate('operation_errors');
const requests = new Counter('operation_requests');
const successes = new Counter('operation_successes');
const base = 'http://127.0.0.1:3000/api/v1';
const thresholds = { operation_errors: [protocol.error_threshold] };

export const options = {
  scenarios: {
    measured: {
      executor: 'constant-vus', vus,
      duration: __ENV.DURATION || protocol.duration, gracefulStop: protocol.graceful_stop,
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds,
};

export default function () {
  const params = {
    timeout: protocol.request_timeout,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.token}` },
    tags: { name: workload },
  };
  let response;
  // All clients debit the first account to exercise concurrent updates to one balance.
  const accountId = fixture.accountIds[0];
  if (workload === 'login') {
    response = http.post(`${base}/auth/login`, JSON.stringify({
      email: fixture.email, password: fixture.password,
    }), params);
  } else if (workload === 'list') {
    response = http.get(`${base}/accounts?page=${protocol.fixture.list_page}&limit=${protocol.fixture.list_limit}`, params);
  } else {
    response = http.post(`${base}/accounts/${accountId}/transactions`,
      JSON.stringify({ type: 'DEBIT', amount: protocol.fixture.debit_amount }), params);
  }
  let body;
  try { body = response.json(); } catch (_) { body = null; }
  let ok = response.status === (isDebit ? 201 : 200) && body?.success === true;
  if (workload === 'login') ok = ok && typeof body?.data?.accessToken === 'string';
  if (workload === 'list') {
    const ids = Array.isArray(body?.data) ? body.data.map((account) => account?.id) : null;
    ok = ok && Array.isArray(ids) && ids.length === fixture.accountIds.length &&
      new Set(ids).size === fixture.accountIds.length && ids.every((id) => fixture.accountIds.includes(id));
  }
  if (isDebit) {
    ok = ok && body?.data?.amount === protocol.fixture.debit_amount && body?.data?.transactionType === 'DEBIT' && body?.data?.accountId === accountId;
  }
  latency.add(response.timings.duration);
  errors.add(!ok);
  requests.add(1);
  successes.add(ok ? 1 : 0);
  sleep(protocol.think_time_seconds); // Fixed think time; VUs are not requests/second.
}

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
