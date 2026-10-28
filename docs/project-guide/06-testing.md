# Kiểm thử và giới hạn triển khai

[Mục lục](README.md) · [README dự án](../../README.md)

Các lệnh chạy tại thư mục gốc repository. Tài liệu mô tả bộ kiểm thử hiện có, không phải biên bản xác nhận tất cả test đã chạy thành công.

## 1. Kiểm thử

### Unit và hợp đồng Swagger

```powershell
npm ci
npx prisma generate
npm test -- --runInBand
npm run test:swagger
```

Unit test kiểm tra nghiệp vụ và các thành phần riêng lẻ; test Swagger kiểm tra tài liệu sinh từ source. Chúng không thay thế E2E qua HTTP thật.

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

## 2. Kiểm thử tải trên Kaggle CPU

Notebook kiểm thử tải Pha 1 hiện dùng **PostgreSQL 15**, cùng phiên bản lớn với Docker. Kịch bản gồm login, list account và debit đồng thời trên cùng một tài khoản. Mỗi bài chạy ở **1, 5 và 20 VU**, đo **60 giây/lượt**, lặp **3 lần**, tổng cộng **27 lượt chính thức**; trước mỗi lượt có 10 giây làm nóng riêng.

Lần chạy trên **Kaggle CPU ngày 28/10/2026 (UTC)** dùng **PostgreSQL 15.19**, ghi nhận **76.960 request**, **error rate 0%**; kiểm tra số dư và số bút toán sau cả 27 lượt chính thức và 27 lượt làm nóng đều đạt. Bài rút quá số dư riêng cũng đạt: 10 request thành công, 10 request báo thiếu tiền, số dư cuối bằng 0. Chưa đặt ngưỡng latency nên kết quả này chưa xác nhận mọi yêu cầu về thời gian phản hồi.

Môi trường đo dùng CPU Intel Xeon @ 2.20 GHz, 4 CPU logic, quota 4 CPU, giới hạn RAM 30 GiB. Khi chạy lại, notebook lưu phần cứng và phiên bản phần mềm thực tế vào `environment.json`. Khi so sánh các lần đo, giữ cùng cấu hình phần cứng, phiên bản phần mềm, dữ liệu đầu vào, workload và cách đo; kiểm tra loại CPU được Kaggle cấp cho mỗi phiên.

Cách chạy lại:

1. Bắt đầu phiên Kaggle mới, import [notebook](../performance/kaggle-load-test.ipynb), chọn **Accelerator=None**, **Internet=On**.
2. Giữ `MODE = 'smoke'`, chạy lần lượt để kiểm tra môi trường và số dư. Phần 4 phải in `Database ready: 15.x`.
3. Khi chạy thử đạt, thêm ô `MODE = 'full'` trước phần 9, rồi chạy lại phần **9 → 10 → 11** và tải ZIP ở phần 11.

Xem [kịch bản và kết quả chi tiết](../performance/phase1-load-test.md), [script k6](../../test/performance/kaggle-load.js) và [cấu hình test](../../test/performance/protocol.json). [ZIP kết quả PostgreSQL 15.19](../performance/bank-test-20261028-163024-full.zip) lưu cấu hình CPU/RAM, source commit, dữ liệu đầu vào, số VU, thời lượng, throughput, p50/p95/p99, error rate, CPU/RAM API và kiểm tra số dư. Dùng các file **full** cho báo cáo chính thức; smoke chỉ dùng để kiểm tra nhanh môi trường.


