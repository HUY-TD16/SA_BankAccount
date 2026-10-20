# Swagger / OpenAPI

Khi ứng dụng chạy ở development hoặc test:

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/docs.json`
- API prefix: `/api/v1`

Ví dụ với port mặc định: `http://localhost:3000/api/docs`.
Swagger dùng cùng host/port với trang đang mở. Ở `NODE_ENV=production`,
cả UI và OpenAPI JSON đều không được đăng ký.

## Thử API

1. Gọi `POST /api/v1/auth/register` với dữ liệu mẫu hợp lệ.
2. Gọi `POST /api/v1/auth/login`, lấy `data.accessToken`.
3. Bấm **Authorize**, dán token (không thêm tiền tố `Bearer`).
4. Tạo tài khoản, nạp/rút tiền hoặc xem lịch sử.
5. Khi chuyển tiền, cung cấp header `Idempotency-Key` không rỗng. Dùng một
   khóa mới cho mỗi giao dịch mới; khi thử lại, giữ nguyên khóa và payload.
   API trả 201 khi tạo mới và 200 khi trả lại giao dịch đã tồn tại.

Khóa idempotency được xét cùng tài khoản nguồn. Hiện use case trả lại giao
dịch đã tồn tại sau khi kiểm tra tài khoản và quyền sở hữu; không so sánh toàn
bộ payload để phát hiện việc dùng lại khóa với tham số khác.

## Quy ước dữ liệu

- Tiền VND nhận/trả dưới dạng chuỗi số nguyên.
- Thành công: `{ success: true, data, meta: { requestId } }`.
- Danh sách: thêm `pagination: { page, limit, total, totalPages }`, `data` là mảng.
- Lỗi: `{ success: false, error: { code, message, details? }, meta: { requestId } }`.
- `details`, khi có, là mảng `{ field, reason }`.
- Đóng tài khoản thành công trả HTTP 204, không có body.
- Header `X-Request-Id` dùng để truy vết request.
- User response dùng tên trường `createAt` đúng với API hiện tại.

## Kiểm tra và bảo trì

Chạy `npm run test:swagger` để build và kiểm tra OpenAPI với Nest/Swagger
thật cùng các controller hiện tại. Kiểm tra không cần database, dùng provider
giả cho các use case và HTTP loopback trên cổng tạm thời.

Schema response nằm trong `dto/*-response.schema.ts` của từng module.
Helper `src/common/http/swagger/response.schemas.ts` mô tả envelope chung.
Khi thay đổi response, validation hoặc endpoint, cập nhật Swagger tương ứng
và chạy lại kiểm tra. Bài kiểm tra này xác minh tài liệu và đường dẫn Swagger;
nó không thay thế kiểm thử nghiệp vụ hay tích hợp database.
