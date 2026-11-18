// Kiểm tra cơ học cho pha 2: danh sách task và ranh giới lớp.
// Mỗi lỗi in ra: sai ở đâu, vì sao, sửa thế nào. Chạy: npm run check:harness
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUSES = ['not_started', 'active', 'blocked', 'passing'];

export function checkTasks(doc, progressExists) {
  const errors = [];
  const tasks = Array.isArray(doc?.tasks) ? doc.tasks : null;
  if (!tasks) return ['phase2-tasks.json: thiếu mảng "tasks".'];

  const ids = new Set();
  for (const t of tasks) {
    const at = `phase2-tasks.json task ${t.id ?? '(không có id)'}`;
    if (!/^P2-\d{2}$/.test(t.id ?? '')) errors.push(`${at}: id phải có dạng P2-NN.`);
    if (ids.has(t.id)) errors.push(`${at}: id bị trùng.`);
    ids.add(t.id);
    if (!STATUSES.includes(t.status)) {
      errors.push(`${at}: status "${t.status}" không hợp lệ. Dùng một trong: ${STATUSES.join(', ')}.`);
    }
    for (const f of ['title', 'behavior']) {
      if (!t[f]) errors.push(`${at}: thiếu "${f}".`);
    }
    if (!Array.isArray(t.verification) || t.verification.length === 0) {
      errors.push(`${at}: thiếu "verification". Ghi lệnh hoặc bước kiểm chứng cụ thể để người khác chạy lại được.`);
    }
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const activeByOwner = new Map();
  for (const t of tasks) {
    const at = `phase2-tasks.json task ${t.id}`;
    for (const dep of t.depends_on ?? []) {
      if (!byId.has(dep)) errors.push(`${at}: depends_on trỏ tới "${dep}" không tồn tại.`);
    }
    if (t.status === 'active' || t.status === 'passing') {
      if (!t.owner || !t.branch) {
        errors.push(`${at}: task ${t.status} phải có "owner" và "branch". Nhận task trước khi làm.`);
      }
      const unfinished = (t.depends_on ?? []).filter((d) => byId.get(d)?.status !== 'passing');
      if (unfinished.length) {
        errors.push(`${at}: đang ${t.status} nhưng phụ thuộc ${unfinished.join(', ')} chưa passing. Làm xong phụ thuộc trước hoặc đổi về not_started.`);
      }
      if (!progressExists(t.id)) {
        errors.push(`${at}: thiếu docs/phase2/progress/${t.id}.md. Tạo file từ docs/phase2/progress/_mau.md.`);
      }
    }
    if (t.status === 'active' && t.owner) {
      activeByOwner.set(t.owner, [...(activeByOwner.get(t.owner) ?? []), t.id]);
    }
    if (t.status === 'passing' && !(Array.isArray(t.evidence) && t.evidence.length)) {
      errors.push(`${at}: passing mà "evidence" rỗng. Chạy lệnh trong "verification" rồi ghi kết quả (link CI, link Kaggle, số đo) vào evidence.`);
    }
    if (t.status === 'blocked' && !t.blocked_reason) {
      errors.push(`${at}: blocked phải có "blocked_reason" nói rõ đang chờ gì.`);
    }
  }
  for (const [owner, list] of activeByOwner) {
    if (list.length > 1) {
      errors.push(`phase2-tasks.json: ${owner} đang active ${list.join(', ')}. Mỗi người chỉ một task active; chuyển bớt về not_started hoặc blocked.`);
    }
  }
  return errors;
}

const FRAMEWORK = /^(@nestjs\/|@prisma\/|pg$|bcrypt|jsonwebtoken|express|class-validator|class-transformer)/;
const DRIVERS = /^(@prisma\/|pg$|bcrypt|jsonwebtoken|express)/;
const OUTER_LAYERS = /\/(infrastructure|presentation)(\/|$)/;

export function checkImports(layer, file, source) {
  const errors = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/(?:from\s+|require\(|import\()\s*['"]([^'"]+)['"]/);
    if (!m) return;
    const spec = m[1];
    const at = `${file}:${i + 1}`;
    if (layer === 'domain') {
      if (FRAMEWORK.test(spec)) {
        errors.push(`${at}: domain import "${spec}". Domain phải chạy được không cần framework hay DB. Đưa phần này sang infrastructure và để domain dùng kiểu thuần.`);
      } else if (OUTER_LAYERS.test(spec) || /\/application(\/|$)/.test(spec)) {
        errors.push(`${at}: domain import "${spec}" từ lớp ngoài. Phụ thuộc chỉ được hướng vào trong; chuyển kiểu cần dùng vào domain.`);
      }
    } else if (layer === 'application') {
      if (DRIVERS.test(spec)) {
        errors.push(`${at}: application import "${spec}". Use case chỉ nói chuyện qua port; khai báo interface trong application/ports và hiện thực ở infrastructure.`);
      } else if (OUTER_LAYERS.test(spec)) {
        errors.push(`${at}: application import "${spec}". Không gọi thẳng adapter hay controller; thêm port rồi bind trong *.module.ts.`);
      }
    }
  });
  return errors;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const errors = [];

  const tasksPath = join(root, 'phase2-tasks.json');
  let doc;
  try {
    doc = JSON.parse(readFileSync(tasksPath, 'utf8'));
  } catch (e) {
    errors.push(`phase2-tasks.json: không đọc được JSON (${e.message}).`);
  }
  if (doc) {
    const progress = (id) => existsSync(join(root, 'docs/phase2/progress', `${id}.md`));
    errors.push(...checkTasks(doc, progress));
  }

  const layerDirs = [['domain', join(root, 'src/common/domain')]];
  for (const mod of readdirSync(join(root, 'src/modules'))) {
    layerDirs.push(['domain', join(root, 'src/modules', mod, 'domain')]);
    layerDirs.push(['application', join(root, 'src/modules', mod, 'application')]);
  }
  for (const [layer, dir] of layerDirs) {
    for (const file of walk(dir)) {
      errors.push(...checkImports(layer, relative(root, file), readFileSync(file, 'utf8')));
    }
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    console.error(`\n${errors.length} lỗi harness.`);
    process.exit(1);
  }
  console.log('Harness OK: task list hợp lệ, ranh giới domain/application giữ nguyên.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
