import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkImports, checkTasks } from '../../scripts/check-harness.mjs';

const base = {
  id: 'P2-01', title: 't', behavior: 'b', verification: ['npm test'],
  status: 'not_started', owner: '', branch: '', depends_on: [], evidence: [],
};
const always = () => true;

test('task list hợp lệ không báo lỗi', () => {
  assert.deepEqual(checkTasks({ tasks: [base] }, always), []);
});

test('passing không có evidence bị chặn', () => {
  const t = { ...base, status: 'passing', owner: 'A', branch: 'x' };
  assert.match(checkTasks({ tasks: [t] }, always).join(), /evidence/);
});

test('một người hai task active bị chặn', () => {
  const a = { ...base, status: 'active', owner: 'A', branch: 'x' };
  const b = { ...a, id: 'P2-02' };
  assert.match(checkTasks({ tasks: [a, b] }, always).join(), /chỉ một task active/);
});

test('active khi phụ thuộc chưa passing bị chặn', () => {
  const dep = { ...base };
  const t = { ...base, id: 'P2-02', status: 'active', owner: 'A', branch: 'x', depends_on: ['P2-01'] };
  assert.match(checkTasks({ tasks: [dep, t] }, always).join(), /chưa passing/);
});

test('active thiếu file tiến độ bị chặn', () => {
  const t = { ...base, status: 'active', owner: 'A', branch: 'x' };
  assert.match(checkTasks({ tasks: [t] }, () => false).join(), /progress\/P2-01\.md/);
});

test('domain import prisma bị chặn, import nội bộ thì không', () => {
  assert.equal(checkImports('domain', 'f.ts', "import { x } from '@prisma/client';").length, 1);
  assert.equal(checkImports('domain', 'f.ts', "import { x } from '../enums/a';").length, 0);
});

test('application import infrastructure hoặc bcrypt bị chặn', () => {
  assert.equal(checkImports('application', 'f.ts', "import { R } from '../../infrastructure/repo';").length, 1);
  assert.equal(checkImports('application', 'f.ts', "import * as b from 'bcrypt';").length, 1);
  assert.equal(checkImports('application', 'f.ts', "import { P } from '../ports/p';").length, 0);
  assert.equal(checkImports('application', 'f.ts', "import '../../infrastructure/setup';").length, 1);
});
