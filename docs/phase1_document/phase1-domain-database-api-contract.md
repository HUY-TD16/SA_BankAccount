# Thiết kế Domain, Database và API Contract - Bank Account Pha 1

## 1. Mục tiêu thiết kế

Tài liệu này chốt mô hình domain, PostgreSQL schema logic và HTTP contract cho hệ thống Bank Account Pha 1. Các quyết định ưu tiên theo thứ tự:

1. **Correctness tiền:** không mất tiền, nhân đôi tiền hoặc để số dư âm do cạnh tranh đồng thời.
2. **Bảo mật:** dữ liệu và quyền chỉ được cấp đúng người; credential/token không lộ ra API hoặc log.
3. **Dễ bảo trì:** domain không phụ thuộc framework/ORM; API và business rule có tên rõ ràng.
4. **Khả năng mở rộng:** có thể thêm phí, reversal, worker, notification hoặc ledger đầy đủ ở pha sau mà không phá API lõi.

## 2. Domain model

### 2.1 Bounded context và thuật ngữ

- **Identity & Access:** đăng ký, login, MFA, reset password, refresh token và role.
- **Account:** vòng đời account, số dư hiện tại và quyền sở hữu.
- **Money Movement:** nạp, rút, chuyển tiền, lịch sử bất biến và idempotency.
- **Audit:** ghi lại hành động nhạy cảm của staff và các security event cần tra cứu.

`FinancialTransaction` là bản ghi biến động tiền. `database transaction` là giao dịch ACID của PostgreSQL. Hai khái niệm này không được dùng lẫn trong code hoặc tài liệu.

### 2.2 Entity và quan hệ

```text
User (1) ─────< BankAccount (1) ─────< FinancialTransaction
  │                    │                         │
  │                    ├── source of ──< Transfer >── destination
  │                    │                         │
  ├────< RefreshToken  │                         └── transferId (nullable)
  ├────< PasswordResetToken
  ├────  MfaCredential (0..1)
  └────< AuditLog
```

| Entity | Trách nhiệm |
|---|---|
| `User` | Danh tính, email, password hash, role và trạng thái đăng nhập/MFA. |
| `BankAccount` | Account nội bộ, chủ sở hữu, trạng thái và `currentBalance`. |
| `FinancialTransaction` | Bản ghi bất biến cho credit/debit và số dư sau thao tác. |
| `Transfer` | Nghiệp vụ chuyển tiền, liên kết hai account và hai transaction đối ứng. |
| `RefreshToken` | Phiên dài hạn có rotation/revocation. |
| `PasswordResetToken` | Token một lần đặt lại password. |
| `MfaCredential` | TOTP secret đã mã hóa của User. |
| `AuditLog` | Dấu vết truy cập nhạy cảm, đặc biệt là staff đọc dữ liệu khách hàng. |

### 2.3 Quy tắc aggregate và dependency

- `User` là owner của `BankAccount`.
- `BankAccount` là aggregate root cho nghiệp vụ nạp/rút. `FinancialTransaction` chỉ được tạo qua `TransactionService`, không có endpoint CRUD trực tiếp.
- `Transfer` là aggregate nghiệp vụ điều phối hai `BankAccount`; `TransferService` phải khóa cả hai account và commit tất cả thay đổi atomically.
- `currentBalance` là read model/denormalized balance có kiểm soát. `FinancialTransaction` là audit history bất biến để đối soát.
- Không có service nào được sửa `currentBalance` trực tiếp ngoài transaction repository trong database transaction hợp lệ.

## 3. Thiết kế database PostgreSQL

### 3.1 Quy ước chung

- Primary key: `uuid`, sinh ở application hoặc PostgreSQL (`gen_random_uuid()`).
- Thời gian: `timestamptz`, lưu UTC; API trả ISO-8601 UTC.
- Tiền: `numeric(18,0)` vì Pha 1 chỉ dùng VND nguyên. Không dùng `float`, `double` hoặc JavaScript `number` cho tính toán tiền.
- Trạng thái/loại: PostgreSQL enum hoặc `varchar` + `CHECK`; ORM phải map thành enum domain.
- `created_at`, `updated_at` có ở entity thay đổi được. Transaction không được update/delete sau khi `COMPLETED`.
- Mọi foreign key dùng `ON DELETE RESTRICT`, trừ refresh/reset token có thể `CASCADE` theo User. Không cascade account sang transaction.

### 3.2 `users`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | User ID nội bộ. |
| `email` | varchar(254) | NOT NULL | Lưu lowercase, trimmed. |
| `full_name` | varchar(100) | NOT NULL | Tên hiển thị. |
| `password_hash` | varchar(255) | NOT NULL | bcrypt hash. |
| `role` | user_role | NOT NULL, default `CUSTOMER` | Chỉ `CUSTOMER`, `BANK_STAFF`. |
| `mfa_enabled` | boolean | NOT NULL, default false | Bật sau khi verify TOTP. |
| `status` | user_status | NOT NULL, default `ACTIVE` | Pha 1 dùng `ACTIVE`; dự phòng `SUSPENDED`. |
| `created_at` | timestamptz | NOT NULL | UTC. |
| `updated_at` | timestamptz | NOT NULL | UTC. |

Constraints/indexes:

- `UNIQUE INDEX uq_users_email_ci ON users (lower(email))`.
- `CHECK (email = lower(btrim(email)))` để bảo vệ dữ liệu nếu bypass application.
- Không có API công khai tạo `BANK_STAFF`; tạo bằng seed/admin DB khi phát triển.

### 3.3 `bank_accounts`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | Account ID API. |
| `user_id` | uuid | FK → users, NOT NULL | Chủ account. |
| `account_number` | varchar(20) | NOT NULL | Số account nội bộ do hệ thống sinh. |
| `account_name` | varchar(100) | NOT NULL | Tên người dùng đặt. |
| `account_type` | account_type | NOT NULL | Ví dụ `PAYMENT`, `SAVINGS`. |
| `current_balance` | numeric(18,0) | NOT NULL, default 0 | Số dư hiện tại. |
| `currency` | char(3) | NOT NULL, default `VND` | Cố định VND ở Pha 1. |
| `status` | account_status | NOT NULL, default `ACTIVE` | `ACTIVE`, `CLOSED`. |
| `closed_at` | timestamptz | NULL | Có giá trị khi đóng. |
| `created_at` / `updated_at` | timestamptz | NOT NULL | UTC. |

Constraints/indexes:

- `UNIQUE (account_number)`.
- `CHECK (current_balance >= 0)` và `CHECK (currency = 'VND')`.
- `CHECK ((status = 'CLOSED') = (closed_at IS NOT NULL))`.
- Index `idx_accounts_user_status_created (user_id, status, created_at DESC)` cho danh sách account của customer.
- Không hard delete account. `DELETE` API chỉ cập nhật `status='CLOSED'`, `closed_at=now()` khi balance bằng 0.

### 3.4 `financial_transactions`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | Mã giao dịch. |
| `account_id` | uuid | FK → bank_accounts, NOT NULL | Account bị biến động. |
| `transfer_id` | uuid | FK → transfers, NULL | Có ở transfer; null ở nạp/rút. |
| `transaction_type` | transaction_type | NOT NULL | `CREDIT`, `DEBIT`. |
| `reference_type` | transaction_reference_type | NOT NULL | `OPENING_DEPOSIT`, `CASH_DEPOSIT`, `CASH_WITHDRAWAL`, `TRANSFER_IN`, `TRANSFER_OUT`. |
| `amount` | numeric(18,0) | NOT NULL | Luôn dương. |
| `balance_after` | numeric(18,0) | NOT NULL | Balance sau entry. |
| `status` | transaction_status | NOT NULL, default `COMPLETED` | Pha 1 chỉ tạo `COMPLETED`. |
| `description` | varchar(250) | NULL | Không chứa credential/PII không cần thiết. |
| `created_at` | timestamptz | NOT NULL | Thời điểm hạch toán UTC. |

Constraints/indexes:

- `CHECK (amount > 0)`; `CHECK (balance_after >= 0)`.
- `CHECK` kết hợp type/reference: `TRANSFER_IN` phải `CREDIT`, `TRANSFER_OUT` phải `DEBIT`, `CASH_DEPOSIT` phải `CREDIT`, `CASH_WITHDRAWAL` phải `DEBIT`.
- Partial unique index: một `transfer_id` chỉ có tối đa một `CREDIT` và một `DEBIT`: `UNIQUE (transfer_id, transaction_type) WHERE transfer_id IS NOT NULL`.
- Index `idx_transactions_account_created (account_id, created_at DESC, id DESC)` cho history pagination.
- Index `idx_transactions_transfer (transfer_id) WHERE transfer_id IS NOT NULL`.
- Application/repository cấm `UPDATE`/`DELETE` transaction `COMPLETED`; có thể gia cố bằng PostgreSQL trigger trong Pha 2.

### 3.5 `transfers`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | `transferId` public. |
| `source_account_id` | uuid | FK → bank_accounts, NOT NULL | Account bị trừ. |
| `destination_account_id` | uuid | FK → bank_accounts, NOT NULL | Account được cộng. |
| `initiated_by_user_id` | uuid | FK → users, NOT NULL | Người ra lệnh. |
| `amount` | numeric(18,0) | NOT NULL | Luôn dương. |
| `description` | varchar(250) | NULL | Nội dung chuyển. |
| `idempotency_key` | varchar(128) | NOT NULL | Key client gửi. |
| `request_hash` | char(64) | NOT NULL | SHA-256 payload canonical. |
| `status` | transfer_status | NOT NULL | Pha 1: `COMPLETED`. |
| `created_at` | timestamptz | NOT NULL | UTC. |

Constraints/indexes:

- `CHECK (amount > 0)` và `CHECK (source_account_id <> destination_account_id)`.
- `UNIQUE (source_account_id, idempotency_key)`.
- Index `idx_transfers_initiated_created (initiated_by_user_id, created_at DESC)`.
- Index `idx_transfers_destination_created (destination_account_id, created_at DESC)`.
- `request_hash` so sánh khi tái dùng key: cùng hash trả transfer cũ; khác hash trả `409 IDEMPOTENCY_KEY_REUSED`.

### 3.6 Security tables

#### `refresh_tokens`

`id` uuid PK, `user_id` FK, `token_hash` char(64) unique, `family_id` uuid, `expires_at`, `revoked_at` nullable, `replaced_by_token_id` nullable self-FK, `created_at`, `ip_hash` nullable, `user_agent_hash` nullable.

- Index `(user_id, expires_at DESC)`.
- Khi refresh: tìm theo hash, kiểm tra active/hạn, revoke token cũ rồi tạo token mới trong cùng database transaction.
- Token cũ được dùng lại là token reuse: revoke cả `family_id` và trả `401`.

#### `password_reset_tokens`

`id` uuid PK, `user_id` FK, `token_hash` char(64) unique, `expires_at`, `used_at` nullable, `created_at`.

- Index `(user_id, expires_at DESC)`.
- Chỉ token active mới nhất có giá trị; khi tạo token mới phải invalid token reset cũ của User.

#### `mfa_credentials`

`user_id` uuid PK/FK, `secret_ciphertext` text NOT NULL, `key_version` smallint NOT NULL, `confirmed_at` nullable, `created_at`, `updated_at`.

- `mfa_enabled` trên `users` chỉ true khi `confirmed_at` có giá trị.
- Secret được mã hóa bằng application key lấy từ secret manager/environment; không lưu/hiển thị QR sau setup response.

#### `audit_logs`

`id` uuid PK, `actor_user_id` FK nullable, `action` varchar(80), `target_type` varchar(50), `target_id` uuid nullable, `request_id` uuid nullable, `metadata` jsonb nullable, `created_at` timestamptz NOT NULL.

- Index `(actor_user_id, created_at DESC)` và `(target_type, target_id, created_at DESC)`.
- `metadata` chỉ chứa dữ liệu tối thiểu; cấm password, hash, reset token, JWT, TOTP secret và số account đầy đủ nếu không cần.

## 4. Quy tắc correctness và cạnh tranh đồng thời

### 4.1 Nạp/rút

Trong một PostgreSQL transaction:

1. `SELECT ... FOR UPDATE` account đích.
2. Kiểm tra account `ACTIVE`, ownership và điều kiện số dư.
3. Tính balance mới bằng `numeric`, không phải float.
4. `UPDATE bank_accounts SET current_balance = ...`.
5. `INSERT financial_transactions` có `balance_after` bằng balance mới.
6. Commit; nếu bất kỳ bước nào lỗi thì rollback toàn bộ.

Với rút tiền, repository có thể bổ sung update có điều kiện `WHERE current_balance >= :amount` và kiểm tra đúng một row được cập nhật. Đây là hàng rào thứ hai chống negative balance.

### 4.2 Transfer

Trong một PostgreSQL transaction:

1. Tìm `Transfer` bằng `(source_account_id, idempotency_key)`. Nếu tồn tại, so `request_hash` và trả kết quả cũ hoặc lỗi `409`.
2. Lấy account nguồn và đích bằng `FOR UPDATE` theo **ID tăng dần**, không theo vai trò nguồn/đích, để giảm deadlock.
3. Kiểm tra source ownership, hai account `ACTIVE`, account khác nhau và source đủ tiền.
4. Trừ source, cộng destination; tạo `Transfer` và hai `FinancialTransaction` cùng `transfer_id`.
5. Commit. Hai account thay đổi cùng thành công hoặc cùng rollback.

Invariants cần kiểm tra bằng integration test sau mọi workload đồng thời:

- Không account nào có `current_balance < 0`.
- Với một transfer hoàn tất có đúng hai entry: source `TRANSFER_OUT/DEBIT`, destination `TRANSFER_IN/CREDIT`, cùng amount và cùng `transferId`.
- Tổng `current_balance` của tập account trước/sau transfer không đổi; nạp/rút là ngoại lệ có giải thích trong ledger.
- Cùng idempotency key không làm tăng/giảm tiền lần thứ hai.

## 5. API contract chung

### 5.1 Base URL, headers và serialization

- Base URL: `/api/v1`.
- Request/response: `Content-Type: application/json; charset=utf-8`.
- Protected endpoint: `Authorization: Bearer <access-token>`.
- `POST /transfers` bắt buộc `Idempotency-Key`: UUID hoặc chuỗi 16-128 ký tự duy nhất phía client.
- Server sinh `X-Request-Id` UUID cho mọi response; client có thể gửi lại header này để trace.
- UUID và timestamp là string. `amount`, `currentBalance`, `balanceAfter` trả **string nguyên VND** để tránh mất chính xác JSON/JavaScript, ví dụ `"150000"`.
- Field không tồn tại khác với `null`: dùng `null` chỉ khi schema cho phép rõ ràng.

### 5.2 Response envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "b1c1d2e3-..." }
}
```

List success:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 },
  "meta": { "requestId": "b1c1d2e3-..." }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Số dư tài khoản không đủ.",
    "details": [{ "field": "amount", "reason": "exceeds_available_balance" }]
  },
  "meta": { "requestId": "b1c1d2e3-..." }
}
```

`details` chỉ dùng cho validation an toàn; không trả database exception, stack trace, token hoặc thông tin cho phép suy ra dữ liệu User khác.

### 5.3 Status code chuẩn

| Status | Khi dùng |
|---|---|
| `200 OK` | Đọc thành công, login, refresh, thao tác idempotent trả resource cũ. |
| `201 Created` | Register, mở account, tạo transaction/transfer lần đầu. |
| `204 No Content` | Logout hoặc đóng logic account thành công. |
| `400 Bad Request` | DTO/body/query/header không hợp lệ. |
| `401 Unauthorized` | Thiếu, sai, hết hạn access/refresh token hoặc MFA code sai. |
| `403 Forbidden` | Token hợp lệ nhưng role không phải `BANK_STAFF` ở staff endpoint. |
| `404 Not Found` | Customer không sở hữu account, account không tồn tại hoặc destination account không tồn tại/đóng. |
| `409 Conflict` | Email trùng, insufficient funds, account chưa thể đóng, idempotency key reuse khác payload. |
| `429 Too Many Requests` | Vượt rate limit, nhất là login/forgot/reset/MFA. |
| `500 Internal Server Error` | Lỗi không dự kiến; trả requestId để tra log. |

### 5.4 Pagination, filter và sort

- `page`: integer >= 1, default `1`.
- `limit`: integer 1-100, default `20`.
- Transaction history: mặc định `createdAt DESC, id DESC` để thứ tự ổn định khi timestamp trùng.
- Filter được hỗ trợ: `type=CREDIT|DEBIT`, `from=ISO-8601`, `to=ISO-8601`; toàn bộ filter phải áp dụng sau ownership check.
- Nếu history rất lớn ở Pha 2, thêm cursor pagination nhưng giữ `page/limit` trong Pha 1 để đơn giản API.

## 6. Endpoint contract

### 6.1 Identity & access

| Method | Path | Auth | Request chính | Response thành công |
|---|---|---|---|---|
| POST | `/auth/register` | Public | `fullName`, `email`, `password`, `confirmPassword` | `201`, User an toàn |
| POST | `/auth/login` | Public | `email`, `password` | `200`, access token hoặc MFA challenge |
| POST | `/auth/refresh` | Refresh cookie | Không body | `200`, access token mới, refresh cookie rotate |
| POST | `/auth/logout` | Refresh cookie hoặc JWT | Không body | `204`, revoke refresh token |
| POST | `/auth/forgot-password` | Public | `email` | `200`, message chung |
| POST | `/auth/reset-password` | Public | `token`, `newPassword`, `confirmPassword` | `200`, revoke sessions cũ |
| POST | `/auth/mfa/setup` | JWT | Không body | `200`, setupId + provisioning URI/QR một lần |
| POST | `/auth/mfa/confirm` | JWT | `code` | `200`, MFA enabled |
| POST | `/auth/mfa/verify` | MFA challenge | `challengeToken`, `code` | `200`, access token + refresh cookie |

`POST /auth/login` response khi MFA chưa bật:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": { "id": "uuid", "email": "customer@example.com", "fullName": "Nguyen Van A", "role": "CUSTOMER", "mfaEnabled": false }
  }
}
```

Khi MFA bật, response không có access/refresh token:

```json
{
  "success": true,
  "data": { "mfaRequired": true, "challengeToken": "opaque-or-signed-short-lived-token" }
}
```

### 6.2 Account

| Method | Path | Auth | Request chính | Response |
|---|---|---|---|---|
| POST | `/accounts` | CUSTOMER | `accountName`, `accountType`, `initialDeposit` | `201`, Account |
| GET | `/accounts` | CUSTOMER | `status` optional | `200`, paginated Account list |
| GET | `/accounts/{accountId}` | CUSTOMER | Path UUID | `200`, Account |
| DELETE | `/accounts/{accountId}` | CUSTOMER | Path UUID | `204`, chỉ khi balance = 0 |

Create account request:

```json
{ "accountName": "Tài khoản thanh toán", "accountType": "PAYMENT", "initialDeposit": "500000" }
```

Account response `data`:

```json
{
  "id": "81ed...",
  "accountNumber": "100000012345",
  "accountName": "Tài khoản thanh toán",
  "accountType": "PAYMENT",
  "currentBalance": "500000",
  "currency": "VND",
  "status": "ACTIVE",
  "createdAt": "2026-09-16T00:00:00Z",
  "closedAt": null
}
```

### 6.3 Nạp/rút và lịch sử

| Method | Path | Auth | Request/query | Response |
|---|---|---|---|---|
| POST | `/accounts/{accountId}/transactions` | CUSTOMER owner | `type`, `amount`, `description?` | `201`, FinancialTransaction |
| GET | `/accounts/{accountId}/transactions` | CUSTOMER owner | `page`, `limit`, `type`, `from`, `to` | `200`, paginated history |

Create transaction request:

```json
{ "type": "DEBIT", "amount": "150000", "description": "Rút tiền mặt" }
```

Transaction response `data`:

```json
{
  "id": "ee0b...",
  "accountId": "81ed...",
  "transferId": null,
  "type": "DEBIT",
  "referenceType": "CASH_WITHDRAWAL",
  "amount": "150000",
  "balanceAfter": "350000",
  "status": "COMPLETED",
  "description": "Rút tiền mặt",
  "createdAt": "2026-09-16T00:05:00Z"
}
```

### 6.4 Transfer

| Method | Path | Auth | Request/header | Response |
|---|---|---|---|---|
| POST | `/transfers` | CUSTOMER | `Idempotency-Key`; `sourceAccountId`, `destinationAccountNumber`, `amount`, `description?` | `201` lần đầu; `200` khi replay cùng key/payload |

Request:

```http
Idempotency-Key: 2c58ad47-62de-4bda-a241-6c456b2a3ec4
```

```json
{
  "sourceAccountId": "81ed...",
  "destinationAccountNumber": "100000099999",
  "amount": "200000",
  "description": "Chuyển tiền thử nghiệm"
}
```

Response `data`:

```json
{
  "id": "ab12...",
  "sourceAccountId": "81ed...",
  "destinationAccountId": "cd34...",
  "amount": "200000",
  "currency": "VND",
  "status": "COMPLETED",
  "sourceTransactionId": "de56...",
  "destinationTransactionId": "ef78...",
  "createdAt": "2026-09-16T00:10:00Z"
}
```

Response không được trả balance hoặc lịch sử chi tiết của destination account nếu account đó không thuộc caller.

### 6.5 Staff read-only

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/staff/accounts/{accountId}` | `BANK_STAFF` | `200`, Account và chủ sở hữu tối thiểu cần hỗ trợ |
| GET | `/staff/accounts/{accountId}/transactions` | `BANK_STAFF` | `200`, history phân trang |

Hai endpoint này gọi `StaffAccountQueryService`, kiểm tra role ở guard, tạo `AuditLog` sau khi đọc thành công, và không dùng lại customer endpoint theo cách bỏ qua ownership một cách ngầm định.

## 7. Yêu cầu OpenAPI/Swagger

OpenAPI 3.1 phải được sinh/duy trì từ source code và expose tại:

- Swagger UI: `/api/docs`
- Raw document: `/api/docs.json`

Spec bắt buộc có:

1. `servers` cho local Docker và môi trường test.
2. `bearerAuth` HTTP security scheme; mô tả refresh cookie và `Idempotency-Key` header.
3. Schema component cho mọi request/response, pagination, error envelope, UUID, ISO datetime và money string.
4. Enum rõ cho role, account status/type, transaction type/reference type và transfer status.
5. Response `400`, `401`, `403`, `404`, `409`, `429`, `500` phù hợp từng operation.
6. Ví dụ request/response thành công và tối thiểu một ví dụ lỗi nghiệp vụ cho transaction/transfer.
7. Security requirement áp dụng mặc định cho protected route; public endpoint phải được đánh dấu rõ.

## 8. Definition of Done cho phần thiết kế

- ERD khớp với tám entity trong tài liệu và migration thực thi được trên PostgreSQL trống.
- Tất cả unique constraint, foreign key, check constraint và index trong mục 3 có migration hoặc lý do rõ ràng nếu trì hoãn.
- Integration test chứng minh deposit, withdrawal, transfer, idempotency replay, rollback và concurrent debit/transfer giữ đúng invariants mục 4.
- Không schema/API nào dùng float cho tiền hoặc trả credential/secret/hash.
- OpenAPI validate thành công, bao phủ mọi endpoint mục 6 và khớp response thực tế.
- Reviewer có thể lần từ endpoint → service → repository → bảng và hiểu ownership, role, transaction boundary.
