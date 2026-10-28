# Hợp đồng REST API

[Mục lục](README.md) · [README dự án](../../README.md)

## 1. Quy ước chung

Base URL mặc định: `http://localhost:3000/api/v1`. Request có body dùng `Content-Type: application/json`. Trừ đăng ký/đăng nhập, mọi endpoint cần `Authorization: Bearer <accessToken>`. Danh tính lấy từ token, không lấy từ `userId` trong body.

Tiền được nhận/trả dưới dạng string VND nguyên. Ngày giờ trả dạng ISO 8601. `accountId` trong path phải là UUID v4; `sourceAccountId` trong body transfer được DTO kiểm tra UUID. `accountNumber` là số tài khoản dùng để nhận chuyển tiền, khác ID nội bộ.

Field ngoài DTO bị từ chối `400`. Trong các bảng dưới, dấu `?` nghĩa là tùy chọn. Các UUID/số tài khoản ở ví dụ là minh họa, phải thay bằng dữ liệu tạo trong môi trường chạy.

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "example-request-id" }
}
```

Mỗi phần bên dưới mô tả giá trị **bên trong `data`**; không bỏ envelope khi đọc response thật. Ngoại lệ DELETE thành công trả 204 và không có body. `meta.requestId` tương ứng header `X-Request-Id`.

## 2. Xác thực

### POST /auth/register

Không cần JWT. Tạo user, trả **201**. Client gọi `/auth/login` để nhận access token.

| Field | Điều kiện |
| --- | --- |
| fullName | Chuỗi dài 2–100 theo DTO; use case trim trước khi lưu |
| email | Email hợp lệ, tối đa 254; use case trim/lowercase trước khi kiểm tra và lưu |
| password | 8–72 ký tự; có hoa, thường, số, ký tự đặc biệt; không khoảng trắng |
| confirmPassword | Bắt buộc, phải khớp password |

```json
{
  "fullName": "Nguyen Van A",
  "email": "customer@example.com",
  "password": "DemoTest123!",
  "confirmPassword": "DemoTest123!"
}
```

`data` gồm `id`, `email`, `fullName`, **`createAt`** (tên thuộc tính trong response). Không có password/passwordHash. Email trùng trả `409 EMAIL_EXISTS`; sai xác nhận/DTO trả `400 VALIDATION_ERROR`.

### POST /auth/login

Không cần JWT. Body:

```json
{ "email": "customer@example.com", "password": "DemoTest123!" }
```

Thành công **200**, `data` gồm `accessToken` và `user` với cùng hình dạng user nêu trên. Sai email hoặc mật khẩu cùng trả `401 INVALID_CREDENTIALS`. Hạn token theo `JWT_ACCESS_TTL`, mặc định `60m`. Khi token hết hạn, client đăng nhập để nhận token mới.

## 3. Tài khoản

### POST /accounts

Cần JWT. Body:

```json
{ "accountName": "Chi tiêu", "accountType": "PAYMENT", "initialDeposit": "500000" }
```

| Field | Điều kiện |
| --- | --- |
| accountName | String; sau trim dài 1–100 |
| accountType | PAYMENT hoặc SAVINGS |
| initialDeposit | String chỉ gồm chữ số; giá trị 0–999999999999999999 |

Thành công **201**. Server sinh số tài khoản và gán chủ từ JWT. Tiền ban đầu > 0 tạo thêm OPENING_DEPOSIT trong cùng transaction. Ví dụ `data`:

```json
{
  "id": "81ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "accountNumber": "100000012345",
  "accountName": "Chi tiêu",
  "accountType": "PAYMENT",
  "currentBalance": "500000",
  "currency": "VND",
  "status": "ACTIVE",
  "createdAt": "2026-10-27T10:00:00.000Z",
  "closedAt": null
}
```

### GET /accounts

Cần JWT. Chỉ lấy tài khoản của người gọi, trả **200**. Query:

| Query | Mặc định / giới hạn |
| --- | --- |
| page? | 1; số nguyên dương |
| limit? | 20; từ 1 đến 100 |
| status? | ACTIVE hoặc CLOSED; bỏ qua để lấy cả hai |

Ví dụ: `/accounts?page=1&limit=20&status=ACTIVE`. `data` là mảng account với hình dạng ở trên, sắp xếp `createdAt DESC, id DESC`.

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "meta": { "requestId": "example-request-id" }
}
```

`totalPages` tối thiểu bằng 1, kể cả không có bản ghi. Phân trang dùng offset; mỗi lần đọc trang lấy dữ liệu tại thời điểm truy vấn.

### GET /accounts/{accountId}

Cần JWT. Trả **200**, `data` là account. Chủ sở hữu vẫn xem được account CLOSED. Không tồn tại hoặc không sở hữu trả `404 ACCOUNT_NOT_FOUND`.

### DELETE /accounts/{accountId}

Cần JWT. Không có body. Chỉ đóng tài khoản số dư 0; thành công **204**, body rỗng. Đóng lại tài khoản của mình đã CLOSED cũng 204. Còn tiền trả `409 ACCOUNT_HAS_BALANCE`; không tồn tại/không sở hữu trả 404. Đây là đóng logic, không xóa bản ghi hay lịch sử.

## 4. Nạp, rút và lịch sử

### POST /accounts/{accountId}/transactions

Cần JWT và quyền sở hữu tài khoản ACTIVE. Body:

```json
{ "type": "DEBIT", "amount": "50000", "description": "Rút tiền mô phỏng" }
```

| Field | Điều kiện |
| --- | --- |
| type | CREDIT = nạp; DEBIT = rút |
| amount | String số nguyên dương, không có số 0 đầu, tối đa 18 chữ số |
| description? | String tối đa 250 ký tự |

Thành công **201**, `data` là giao dịch:

```json
{
  "id": "13ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "accountId": "81ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "transferId": null,
  "transactionType": "DEBIT",
  "referenceType": "CASH_WITHDRAWAL",
  "amount": "50000",
  "balanceAfter": "450000",
  "status": "COMPLETED",
  "description": "Rút tiền mô phỏng",
  "createdAt": "2026-10-27T10:01:00.000Z"
}
```

Thiếu tiền trả `409 INSUFFICIENT_FUNDS`; tài khoản đã đóng trả `409 ACCOUNT_NOT_ACTIVE`; không tồn tại/không sở hữu trả 404. Nạp làm số dư vượt giới hạn lưu trữ trả 400. Endpoint này xử lý mỗi POST như một yêu cầu giao dịch riêng; gửi lại POST có thể thực hiện thêm một lần, kể cả khi gửi cùng Idempotency-Key.

### GET /accounts/{accountId}/transactions

Cần JWT và quyền sở hữu, kể cả account CLOSED. Trả **200**, `data` là mảng giao dịch và có `pagination` như danh sách tài khoản.

| Query | Điều kiện |
| --- | --- |
| page?, limit? | Mặc định 1, 20; limit tối đa 100 |
| type? | CREDIT hoặc DEBIT |
| from?, to? | ISO 8601; lọc createdAt >= from và <= to |

Ví dụ: `/accounts/{accountId}/transactions?type=DEBIT&from=2026-10-01T00:00:00.000Z&to=2026-10-31T23:59:59.999Z&page=1&limit=20`.

Sắp xếp `createdAt DESC, id DESC`. Bộ lọc CREDIT bao gồm cả tiền nạp, opening deposit và transfer in; DEBIT gồm rút và transfer out. Query hỗ trợ lọc theo `type`, `from` và `to`. Hai mốc thời gian được kiểm tra định dạng riêng, không kiểm tra chéo `from <= to`; khoảng ngược có thể trả danh sách rỗng. Gửi thời gian có hậu tố Z hoặc offset rõ ràng.

## 5. Chuyển khoản

### POST /transfers

Cần JWT và header **`Idempotency-Key`**, 16–128 ký tự sau trim. Mỗi ý định chuyển mới dùng key mới; retry giữ nguyên key và payload.

```http
POST /api/v1/transfers
Authorization: Bearer <accessToken>
Content-Type: application/json
Idempotency-Key: transfer-demo-20261027-001
```

```json
{
  "sourceAccountId": "81ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "destinationAccountNumber": "100000054321",
  "amount": "100000",
  "description": "Thanh toán nội bộ"
}
```

| Field | Điều kiện |
| --- | --- |
| sourceAccountId | UUID, phải thuộc người gọi |
| destinationAccountNumber | String không rỗng; tra tài khoản đích theo số này |
| amount | String số nguyên dương, không số 0 đầu, tối đa 18 chữ số |
| description? | String tối đa 250 ký tự |

Thành công **201** nếu mới, **200** nếu replay. `data` là transfer, không phải hai giao dịch hoặc số dư hai tài khoản:

```json
{
  "id": "23ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "sourceAccountId": "81ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "destinationAccountId": "91ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "initiatedByUserId": "71ed4895-3bc6-46c9-b7b2-c0e86b978a10",
  "amount": "100000",
  "description": "Thanh toán nội bộ",
  "idempotencyKey": "transfer-demo-20261027-001",
  "status": "COMPLETED",
  "createdAt": "2026-10-27T10:02:00.000Z"
}
```

Đọc lịch sử từng tài khoản để lấy TRANSFER_OUT/TRANSFER_IN. Không có endpoint GET transfer riêng ở phiên bản này.

Lỗi chính: thiếu/sai header trả `400 HTTP_ERROR`; nguồn trùng đích trả `400 SAME_ACCOUNT_TRANSFER`; nguồn không sở hữu, đích không tồn tại hoặc đích CLOSED với chuyển mới trả 404; nguồn CLOSED với chuyển mới hoặc thiếu tiền trả 409.

**Quy tắc replay:** server tra đích và kiểm tra nguồn khác đích trước bước tìm transfer cũ. Việc nhận diện transfer cũ dựa trên nguồn và key, không so sánh payload/hash. Khi key được dùng với dữ liệu khác, kết quả phụ thuộc các bước kiểm tra này và có thể là transfer cũ thay vì lỗi `409`. Replay cùng payload được kiểm tra quyền sở hữu, nhưng không bị chặn chỉ vì tài khoản đã đóng sau giao dịch. Xem [thứ tự xử lý](04-business-rules.md).

## 6. Mã lỗi

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "amount", "reason": "amount_out_of_range" }]
  },
  "meta": { "requestId": "example-request-id" }
}
```

Ví dụ minh họa cấu trúc; message/reason cụ thể phụ thuộc nhánh validation. Client nên xử lý theo status/code thay vì so sánh nguyên văn message.

| HTTP | Code thường gặp | Ý nghĩa |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Body/query/DTO sai, tiền vượt giới hạn |
| 400 | HTTP_ERROR | Ví dụ header key không hợp lệ hoặc ParseUUIDPipe từ chối path |
| 400 | SAME_ACCOUNT_TRANSFER | Nguồn trùng đích |
| 401 | UNAUTHORIZED | Thiếu hoặc không chấp nhận token |
| 401 | INVALID_CREDENTIALS | Đăng nhập thất bại |
| 404 | ACCOUNT_NOT_FOUND | Không tồn tại, không sở hữu, hoặc đích không khả dụng |
| 409 | EMAIL_EXISTS | Email đã đăng ký |
| 409 | INSUFFICIENT_FUNDS | Không đủ số dư |
| 409 | ACCOUNT_NOT_ACTIVE | Ghi giao dịch mới lên nguồn/tài khoản đã đóng |
| 409 | ACCOUNT_HAS_BALANCE | Đóng tài khoản còn tiền |
| 500 | INTERNAL_ERROR | Lỗi ngoài dự kiến; không trả stack trace |

`HTTP_ERROR` là nhánh fallback cho HttpException, không chỉ dành riêng cho 400. Lỗi DB ngoài dự kiến có thể đi vào 500; không phải mọi constraint violation đều được chuyển thành lỗi nghiệp vụ 409.

## 7. Swagger và nguồn hợp đồng

Swagger UI ở `/api/docs`, OpenAPI JSON ở `/api/docs.json` khi `NODE_ENV != production`. Trong Swagger, bấm Authorize và nhập token, không thêm chữ Bearer. Route Swagger nằm ngoài prefix `/api/v1`.

Nguồn đối chiếu: [AuthController](../../src/modules/identity/presentation/http/auth.controller.ts), [AccountsController](../../src/modules/accounts/presentation/http/accounts.controller.ts), [TransactionController](../../src/modules/money-movement/presentation/http/transactions.controller.ts), [TransfersController](../../src/modules/money-movement/presentation/http/transfers.controller.ts), cùng DTO bên cạnh từng controller. Hướng dẫn thao tác: [chạy và demo](05-running.md), [Swagger hiện có](../swagger.md).
