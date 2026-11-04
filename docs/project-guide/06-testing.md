# Hướng dẫn thực thi kiểm thử toàn diện

Tài liệu hướng dẫn chi tiết cách chạy 4 cấp độ kiểm thử của hệ thống: **Unit Test**, **Swagger Contract Test**, **Integration Test** và **End-to-End Test**, cùng phương pháp chạy kiểm thử tải trên máy chủ Kaggle.

## 1. Unit test và Swagger contract test

Các bài kiểm thử đơn vị tập trung kiểm tra tính đúng đắn của logic nghiệp vụ tại tầng Domain và Use Case bằng cách sử dụng các Mock/Fake Repository mà không cần kết nối tới cơ sở dữ liệu thật.

### Cách thực hiện
```powershell
# 1. Cài đặt dependencies
npm ci

# 2. Sinh Prisma Client type-safe
npx prisma generate

# 3. Chạy toàn bộ 25 Unit Test Suites
npm test -- --runInBand

# 4. Chạy kiểm tra hợp đồng Swagger OpenAPI
npm run test:swagger
```

– **Kết quả mong đợi:** 25/25 test suites passed (100%), bao phủ toàn bộ các use case: đăng ký, đăng nhập, mở tài khoản, nạp tiền, rút tiền, chuyển khoản và kiểm tra Value Object `Money`.  
– **`npm run test:swagger`:** Khởi chạy một server HTTP loopback tạm thời để kiểm tra xem cấu trúc Swagger Document sinh ra có khớp chính xác với DTO và Response Envelope hay không.  

## 2. Integration test với PostgreSQL

Integration test kiểm chứng sự tương tác thực tế giữa ứng dụng và cơ sở dữ liệu PostgreSQL: kiểm tra câu lệnh khóa dòng `SELECT ... FOR UPDATE`, cơ chế rollback khi lỗi, và các ràng buộc toàn vẹn CHECK constraint.

### 2.1. Chuẩn bị database test riêng biệt
Để đảm bảo an toàn, hệ thống yêu cầu cơ sở dữ liệu test phải có tên kết thúc bằng hậu tố `_test`. Bạn có thể bật nhanh một container PostgreSQL test độc lập bằng Docker:

```powershell
# Khởi tạo container PostgreSQL riêng cho kiểm thử
docker run --name bank-db-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bank_account_test -p 55432:5432 -d postgres:15-alpine

# Chờ vài giây cho PostgreSQL sẵn sàng nhận kết nối
docker exec bank-db-test pg_isready -U postgres -d bank_account_test
```

### 2.2. Chạy migration và thực thi test suites
Trong cùng cửa sổ PowerShell đó, thiết lập chuỗi kết nối và chạy lệnh test:

```powershell
# Gán biến môi trường trỏ vào database test
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:55432/bank_account_test?schema=public'

# Áp dụng migration vào DB test
npx prisma migrate deploy

# Chạy toàn bộ Integration Tests
npx jest --config jest.integration.config.js --runInBand

# Hoặc chạy riêng bộ kiểm tra 9 ràng buộc CHECK Constraint:
npx jest --config jest.integration.config.js --runInBand test/integration/database/check-constraints.spec.ts
```

– **`check-constraints.spec.ts`:** Tự động tạo schema tạm thời, cố tình thực hiện các thao tác SQL vi phạm như chèn số dư âm, email viết hoa, chuyển khoản cùng tài khoản và xác nhận PostgreSQL trả về đúng mã lỗi `23514` (`check_violation`).  

## 3. HTTP End-to-End test

Bộ test E2E kiểm tra toàn bộ luồng hoạt động từ ngoài vào trong: gửi các HTTP Request thật qua mạng, đi qua Middleware, Guard, Interceptor, Controller, Use Case và ghi xuống database thật.

### Cách thực hiện
```powershell
# Đặt biến môi trường DB test cho bộ E2E runner
$env:E2E_DATABASE_URL = 'postgresql://postgres:postgres@localhost:55432/bank_account_test?schema=public'

# Chạy test E2E
npm run test:e2e
```

– **Cơ chế hoạt động:** E2E runner tự động build mã nguồn TypeScript, chạy migration, tự khởi động server NestJS trên một cổng ngẫu nhiên và gửi các request HTTP thật.  
– **Phạm vi kiểm tra:** Xác thực JWT token, luồng mở tài khoản, nạp tiền, rút tiền, kiểm tra mã HTTP status, cấu trúc response envelope và kiểm chứng tính năng phát lại giao dịch khi dùng cùng `Idempotency-Key`.  

## 4. Kiểm thử tải hệ thống trên Kaggle CPU

Để đo lường hiệu năng thực tế trong điều kiện chịu tải cao và kiểm tra cơ chế chống rút quá số dư, nhóm sử dụng công cụ **Grafana k6** chạy trên nền tảng máy chủ **Kaggle CPU** (4 vCPUs Xeon, 30 GB RAM).

### Các tài nguyên kiểm thử tải
– **Notebook thực thi:** `docs/performance/kaggle-load-test.ipynb`.  
– **Kịch bản đo k6:** `test/performance/kaggle-load.js`.  
– **Cấu hình thông số test:** `test/performance/protocol.json`.  
– **Báo cáo phân tích chi tiết:** [Báo cáo Kiểm thử Tải Pha 1](../performance/phase1-load-test.md).  

### Tóm tắt kết quả đo đạc
– Thực hiện **27 lượt đo chính thức** (mỗi lượt 60 giây, 10 giây warm-up riêng).  
– Tổng số requests xử lý: **76.960 requests**, tỉ lệ lỗi **0.00%**.  
– Luồng chỉ đọc (Xem tài khoản) mở rộng tuyến tính hoàn hảo, đạt **188.60 req/giây** với độ trễ trung vị p50 chỉ **khoảng 4ms**.  
– Luồng ghi cạnh tranh (Rút tiền đồng thời) đạt **99.44 req/giây**, cơ chế khóa dòng đảm bảo 100% không có tài khoản nào bị âm tiền.  
– Luồng đăng nhập đạt đỉnh bão hòa ở **khoảng 11.75 req/giây** do tận dụng tối đa 100% công suất tính toán của 4 lõi CPU cho thuật toán băm Bcrypt an toàn.  
