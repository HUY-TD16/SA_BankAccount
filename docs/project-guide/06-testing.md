# Kiểm thử

[Mục lục](README.md) · [README dự án](../../README.md)

Các lệnh chạy tại thư mục gốc repository. Bộ kiểm thử gồm unit, integration, hợp đồng Swagger và HTTP E2E.

## 1. Kiểm thử

### Unit và hợp đồng Swagger

```powershell
npm ci
npx prisma generate
npm test -- --runInBand
npm run test:swagger
```

Unit test kiểm tra nghiệp vụ và các thành phần riêng lẻ; test Swagger kiểm tra tài liệu sinh từ source. HTTP E2E kiểm tra luồng request/response trên ứng dụng đang chạy.

### E2E qua HTTP thật

Tạo PostgreSQL test riêng; cần Docker đang chạy và Node.js 24 trên host:

```powershell
docker run --name bank-http-e2e -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e_local_test -e POSTGRES_DB=bank_http_test -p 55432:5432 -d postgres:15-alpine
docker exec bank-http-e2e pg_isready -U e2e -d bank_http_test
# Chờ pg_isready báo accepting connections trước khi chạy test.
$env:E2E_DATABASE_URL = 'postgresql://e2e:e2e_local_test@localhost:55432/bank_http_test?schema=public'
npm run test:e2e
```

Runner tự generate Prisma Client, build, migrate DB test, khởi động `dist/main.js` trên cổng tự chọn và gửi HTTP thật. Không cần khởi động app trước. Bộ test hiện có 6 test case, bao phủ luồng ngân hàng, guard, DTO, ownership, status code, response envelope và replay transfer.

**Database phải tồn tại trước**, tên kết thúc bằng `_test`. Nếu thiếu `E2E_DATABASE_URL`, runner dùng `DATABASE_URL` và vẫn kiểm tra hậu tố. Dùng DB riêng cho test; không chạy đồng thời với tác vụ reset DB đó.

Mỗi lần chạy suite dùng `runId` riêng. Hook kết thúc dừng app và xóa dữ liệu của lần chạy, giữ schema/migration; các case trong suite có dùng chung fixture. Nếu process bị kill hoặc máy tắt đột ngột, cleanup có thể không chạy.

Chạy lại: `docker start bank-http-e2e`, đặt lại biến môi trường nếu mở terminal mới, rồi `npm run test:e2e`. Khi không cần DB test nữa, xóa riêng container bằng `docker rm -f -v bank-http-e2e`.

### Integration với PostgreSQL

Dùng DB test ở trên, đặt `DATABASE_URL` trong cùng terminal:

```powershell
$env:DATABASE_URL = 'postgresql://e2e:e2e_local_test@localhost:55432/bank_http_test?schema=public'
npx prisma migrate deploy
npx jest --config jest.integration.config.js --runInBand
# Hoặc chỉ kiểm tra CHECK constraint:
npx jest --config jest.integration.config.js --runInBand test/integration/database/check-constraints.spec.ts
```

Integration kiểm tra repository, transaction và database; `banking-flow.spec.ts` gọi trực tiếp use case. Bộ CHECK constraint tạo schema riêng, áp dụng migration và thử SQL vi phạm. HTTP E2E nằm ở `test/e2e/banking-http.e2e.cjs` và chạy bằng Node test runner, không dùng Jest.

Lỗi thường gặp:

- `ECONNREFUSED`: kiểm tra Docker/PostgreSQL và cổng trong URL.
- `Integration tests require a dedicated *_test DATABASE_URL`: đặt URL tới DB test trong đúng terminal đang chạy Jest.
- E2E báo DB không tồn tại: tạo DB trước; migration không thay thế bước chuẩn bị DB của runner.
- Swagger không mở: kiểm tra `NODE_ENV`; production hiện không expose Swagger.

## 2. Kiểm thử tải và hướng phát triển Pha 2

Đề bài yêu cầu kiểm thử tải trên **Kaggle CPU**. Repository hiện chưa có kịch bản chạy được hoặc số liệu; không xem kết quả unit/E2E là bằng chứng hiệu năng.

Để hoàn tất yêu cầu này, nhóm cần bổ sung workload tối thiểu gồm login, list account và debit đồng thời; lưu cấu hình CPU/RAM, phiên bản source, dữ liệu đầu vào, số client, thời lượng, throughput, p50/p95/p99 và error rate. Khi so sánh Pha 2 phải giữ cùng cấu hình phần cứng, workload và cách đo, đồng thời kiểm tra invariant số dư sau tải.

Các đề xuất Pha 2 như rate limiting, idempotency có so payload, caching hoặc quan sát metrics/tracing cần được chọn dựa trên kết quả baseline và đánh giá trước/sau, theo yêu cầu đề bài.
