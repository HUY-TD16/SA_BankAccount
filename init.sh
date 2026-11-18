#!/usr/bin/env bash
# Khởi động chuẩn cho mỗi phiên làm việc.
#   ./init.sh        cài, sinh Prisma client, build, unit test, kiểm tra harness
#   ./init.sh --db   thêm integration và e2e (cần DATABASE_URL trỏ tới DB *_test)
set -euo pipefail
cd "$(dirname "$0")"
export PRISMA_HIDE_UPDATE_MESSAGE=1

step() { printf '\n== %s\n' "$1"; }
fail() { printf '\nLỖI: %s\nCách sửa: %s\n' "$1" "$2" >&2; exit 1; }

step "Node"
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null) \
  || fail "không tìm thấy node" "cài Node 24 (Dockerfile và CI dùng 24)."
[ "$node_major" = "24" ] || echo "Cảnh báo: đang dùng Node $node_major, Dockerfile và CI dùng Node 24."

step "Cài dependency"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci || fail "npm ci thất bại" "xem lỗi ở trên; thường do lockfile lệch, đừng sửa bằng npm install trừ khi cố ý đổi dependency."
else
  echo "node_modules đã khớp lockfile, bỏ qua."
fi

step "Prisma client"
npx prisma generate >/dev/null || fail "prisma generate thất bại" "kiểm tra prisma/schema.prisma vừa sửa có hợp lệ không: npx prisma validate."

step "Build"
npm run build >/dev/null || fail "build thất bại" "chạy npm run build để xem lỗi TypeScript đầy đủ."

step "Unit test"
npm test -- --runInBand --silent || fail "unit test đỏ" "sửa nền trước khi làm task mới; xem test lỗi ở trên."

step "Kiểm tra harness"
npm run check:harness --silent || fail "harness check đỏ" "đọc thông báo ở trên, mỗi dòng nói rõ file nào và cách sửa."

if [ "${1:-}" = "--db" ]; then
  : "${DATABASE_URL:?Đặt DATABASE_URL tới một database có tên kết thúc bằng _test}"
  db_name=${DATABASE_URL%%\?*}; db_name=${db_name##*/}
  case "$db_name" in
    *_test) ;;
    *) fail "DATABASE_URL trỏ tới '$db_name'" "chỉ dùng database có hậu tố _test, test sẽ xoá dữ liệu trong đó." ;;
  esac
  step "Migration"
  npx prisma migrate deploy >/dev/null || fail "migrate deploy thất bại" "kiểm tra Postgres đang chạy và DATABASE_URL đúng."
  step "Integration test"
  npx jest --config jest.integration.config.js --runInBand --silent || fail "integration test đỏ" "xem test lỗi ở trên."
  step "E2E test"
  E2E_DATABASE_URL="$DATABASE_URL" npm run test:e2e --silent || fail "e2e test đỏ" "xem test lỗi ở trên."
fi

printf '\nSẵn sàng. Mở phase2-tasks.json để xem task của bạn.\n'
