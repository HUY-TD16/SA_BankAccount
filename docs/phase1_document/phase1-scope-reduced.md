# Đặc tả Pha 1 (Phạm vi rút gọn) \- Bank Account Service

> Tài liệu này thay thế phạm vi trong `phase1-basic-bank-account.md`, `phase1-domain-database-api-contract.md`, `phase1-implementation-blueprint.md` và `phase1-security-error-design.md` bằng một bản **rút gọn**, phù hợp với nhóm 3 người, 7 tuần. Các quyết định kỹ thuật (correctness tiền, phân tầng, ownership) được **giữ nguyên tinh thần** từ bốn tài liệu gốc; chỉ cắt các tính năng nâng cao không bắt buộc theo `Requirement.md`.

## 0\. Vì sao rút gọn và những gì bị cắt

Đề bài (`Requirement.md`) chỉ yêu cầu: REST API tối thiểu có POST/GET/DELETE, tài liệu OpenAPI, phân tầng rõ, hỗ trợ đăng nhập với ít nhất 1 GET \+ 1 POST có xác thực qua middleware, đóng gói Docker, và **"chỉ triển khai chức năng cơ bản, không cần tối ưu."** Bản thiết kế gốc đã vượt xa mức này (MFA, refresh rotation, rate limit, staff \+ audit log, idempotency đầy đủ). Với nguồn lực hiện tại, các phần sau được **cắt khỏi Pha 1** và để dành làm đề xuất cải tiến cho Pha 2:

| Cắt khỏi Pha 1 | Lý do |
| :---- | :---- |
| MFA/TOTP | Không bắt buộc theo đề; tốn effort implement \+ test |
| Refresh token rotation | Thay bằng JWT access token đơn hạn, đủ đáp ứng "hỗ trợ đăng nhập" |
| Forgot/Reset password | Không bắt buộc; cần mailer \+ flow riêng |
| Rate limiting | Thuộc dạng "tối ưu/hardening", đề bài không yêu cầu |
| `BANK_STAFF` \+ audit log | Không bắt buộc; CUSTOMER đã đủ để có endpoint có xác thực |
| Idempotency-Key đầy đủ (request hash) | Giữ lại ở dạng tối giản: chỉ chặn trùng key, không so hash payload |
| Test pyramid 5 tầng cho mọi tính năng | Rút còn: unit test service tiền \+ vài integration test rollback/concurrency \+ 1 bộ load test |

Các mục trên là ứng viên tự nhiên cho Pha 2 vì có thể đo lường trước/sau (ví dụ: thêm rate limit giảm brute-force, thêm refresh rotation tăng bảo mật phiên, thêm caching/read replica tăng throughput).

---

## 1\. Use case tối thiểu

8 use case, đủ POST/GET/DELETE và có endpoint xác thực qua middleware:

| \# | Use case | Method \+ Path | Auth |
| :---- | :---- | :---- | :---- |
| UC-01 | Đăng ký (Register User) | `POST /api/v1/auth/register` | Không |
| UC-02 | Đăng nhập (Login) | `POST /api/v1/auth/login` | Không |
| UC-03 | Mở tài khoản | `POST /api/v1/accounts` | JWT |
| UC-04 | Xem danh sách / chi tiết tài khoản | `GET /api/v1/accounts`, `GET /api/v1/accounts/:accountId` | JWT |
| UC-05 | Nạp / rút tiền (CREDIT/DEBIT) | `POST /api/v1/accounts/:accountId/transactions` | JWT |
| UC-06 | Xem lịch sử giao dịch | `GET /api/v1/accounts/:accountId/transactions` | JWT |
| UC-07 | Đóng tài khoản (logic close) | `DELETE /api/v1/accounts/:accountId` | JWT |
| UC-08 | Chuyển tiền giữa hai tài khoản | `POST /api/v1/transfers` | JWT |

Ghi chú: UC-08 (Transfer) được giữ lại dù không bắt buộc riêng lẻ, vì đây là nghiệp vụ thể hiện rõ nhất correctness tiền (double-entry, transaction, lock) — điểm mạnh chính của đồ án.

---

## 2\. Business rules và acceptance criteria

### BR-AUTH

1. `email` bắt buộc, trim \+ lowercase trước khi kiểm tra/lưu; **unique** toàn hệ thống.  
2. `fullName` bắt buộc, 2-100 ký tự sau trim.  
3. Password 8-72 ký tự, có hoa/thường/số/ký tự đặc biệt; `confirmPassword` phải khớp `password`; không log password dưới bất kỳ hình thức nào.  
4. Password chỉ lưu dạng bcrypt hash.  
5. JWT access token có `sub = userId`, ký bằng secret từ environment, hạn dùng ngắn-vừa (ví dụ 60 phút — không cần refresh rotation ở Pha 1).  
6. Không có role phân biệt ở Pha 1 (bỏ `BANK_STAFF`); mọi user đã đăng ký đều là user thường, chỉ thao tác dữ liệu của chính mình.  
7. Mọi endpoint ngoài `register`, `login`, Swagger đều đi qua auth guard.

**Acceptance criteria (trích):**

- Given email đã tồn tại (kể cả khác hoa/thường hoặc có khoảng trắng), when đăng ký lại, then trả `409`.  
- Given email/password sai, when đăng nhập, then trả cùng một lỗi `401` chung, không tiết lộ email có tồn tại hay không.  
- Given JWT thiếu/sai/hết hạn, when gọi API bảo vệ, then guard chặn với `401` trước khi vào controller.

### BR-ACCOUNT

1. Một account thuộc đúng một User; một User có thể có nhiều account.  
2. Account mới `ACTIVE`; đóng thì chuyển `CLOSED` (logic close, không hard delete).  
3. `accountNumber` do hệ thống tự sinh, unique; client không tự chọn.  
4. `initialDeposit` là số nguyên VND không âm.  
5. `currentBalance` không nhận từ client; chỉ thay đổi qua mở account hoặc transaction thành công.  
6. Account chỉ đóng được khi `currentBalance = 0`; đóng không xóa lịch sử giao dịch.  
7. Mọi truy cập account của customer phải qua ownership check trong **service** (`account.userId === currentUserId`), guard không thay thế được bước này.

**Acceptance criteria (trích):**

- Given account không thuộc user hiện tại hoặc không tồn tại, when GET/POST/DELETE, then trả `404` (không phải `403`) — tránh account enumeration.  
- Given balance ≠ 0, when DELETE, then trả `409`.

### BR-TRANSACTION

1. Transaction thuộc đúng một account.  
2. `type` chỉ `CREDIT`/`DEBIT`; `amount` là số nguyên VND \> 0\.  
3. Chỉ account `ACTIVE` mới tạo được transaction.  
4. `DEBIT` yêu cầu balance ≥ amount trước khi trừ (không thấu chi).  
5. Update balance \+ insert transaction phải nằm trong **cùng một database transaction**; không có trạng thái nửa vời.  
6. Transaction hoàn tất (`COMPLETED`) là bất biến — không sửa/xóa ở Pha 1\.  
7. Balance dùng `NUMERIC(18,0)`; tuyệt đối không `float`/`double`.

**Acceptance criteria (trích):**

- Given CREDIT 100.000 vào account có 50.000, when thành công, then balance \= 150.000 và có đúng 1 transaction CREDIT.  
- Given DEBIT lớn hơn balance, when request, then trả `409`, không đổi balance, không tạo transaction.  
- Given hai request DEBIT đồng thời, then balance cuối không âm.

### BR-TRANSFER

1. Transfer gồm 1 account nguồn, 1 account đích, amount \> 0, tạo `transferId` duy nhất.  
2. Account nguồn phải thuộc user đang đăng nhập; account đích chỉ cần tồn tại và `ACTIVE` (được phép chuyển liên user).  
3. Trừ nguồn, cộng đích, tạo Transfer \+ 2 Transaction (đối ứng) phải nằm trong **cùng một database transaction**.  
4. Lock 2 account theo thứ tự ID tăng dần để tránh deadlock khi 2 transfer ngược chiều chạy song song.  
5. Tổng tiền 2 account trước/sau transfer không đổi (không phí ở Pha 1).  
6. `Idempotency-Key` bắt buộc ở header; **bản rút gọn**: chỉ cần unique theo `(sourceAccountId, idempotencyKey)` — nếu key đã tồn tại thì trả lại kết quả Transfer cũ (không so sánh lại payload/hash ở Pha 1; việc phát hiện "cùng key khác payload" để dành cho Pha 2 nếu có thời gian).

**Acceptance criteria (trích):**

- Given nguồn 500.000, đích 100.000, transfer 200.000, then kết quả 300.000/300.000, đúng 1 Transfer \+ 1 DEBIT \+ 1 CREDIT cùng `transferId`.  
- Given account nguồn không thuộc user hoặc đích không tồn tại/đã đóng, then trả `404`, không đổi balance nào.  
- Given gửi lại cùng `Idempotency-Key`, then trả lại transfer đã tạo, không chuyển tiền lần hai.

### BR-API

1. REST, JSON, prefix `/api/v1`.  
2. Response lỗi thống nhất: `success`, `error.code`, `error.message`, `error.details?`.  
3. `400` dữ liệu không hợp lệ · `401` token thiếu/sai/hết hạn · `404` resource không tồn tại/không sở hữu · `409` email trùng, số dư không đủ, đóng account còn tiền, idempotency key trùng.  
4. Controller chỉ parse/validate DTO và trả response; business rule nằm ở service; repository là tầng duy nhất import ORM.

---

## 3\. Thiết kế domain và database

### 3.1 Entity (4 bảng — bỏ `refresh_tokens`, `password_reset_tokens`, `mfa_credentials`, `audit_logs`)

```text
User (1) ─────< BankAccount (1) ─────< FinancialTransaction
                     │                         │
                     ├── source of ──< Transfer >── destination
                     │                         │
                                                └── transferId (nullable)
```

| Entity | Trách nhiệm |
| :---- | :---- |
| `User` | Danh tính, email, password hash. |
| `BankAccount` | Account nội bộ, chủ sở hữu, trạng thái, `currentBalance`. |
| `FinancialTransaction` | Bản ghi bất biến CREDIT/DEBIT, `balanceAfter`. |
| `Transfer` | Điều phối 2 account, liên kết 2 transaction đối ứng. |

### 3.2 `users`

| Cột | Kiểu | Ràng buộc |
| :---- | :---- | :---- |
| `id` | uuid | PK |
| `email` | varchar(254) | NOT NULL, lowercase/trimmed |
| `full_name` | varchar(100) | NOT NULL |
| `password_hash` | varchar(255) | NOT NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

- `UNIQUE INDEX uq_users_email_ci ON users (lower(email))`  
- `CHECK (email = lower(btrim(email)))`

### 3.3 `bank_accounts`

| Cột | Kiểu | Ràng buộc |
| :---- | :---- | :---- |
| `id` | uuid | PK |
| `user_id` | uuid | FK → users, NOT NULL |
| `account_number` | varchar(20) | NOT NULL, UNIQUE |
| `account_name` | varchar(100) | NOT NULL |
| `account_type` | account\_type enum | NOT NULL |
| `current_balance` | numeric(18,0) | NOT NULL, default 0 |
| `currency` | char(3) | NOT NULL, default `VND` |
| `status` | account\_status enum | NOT NULL, default `ACTIVE` |
| `closed_at` | timestamptz | NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

- `CHECK (current_balance >= 0)`, `CHECK (currency = 'VND')`, `CHECK ((status='CLOSED') = (closed_at IS NOT NULL))`  
- Index `idx_accounts_user_status_created (user_id, status, created_at DESC)`  
- `DELETE` API chỉ set `status='CLOSED'`

### 3.4 `financial_transactions`

| Cột | Kiểu | Ràng buộc |
| :---- | :---- | :---- |
| `id` | uuid | PK |
| `account_id` | uuid | FK → bank\_accounts, NOT NULL |
| `transfer_id` | uuid | FK → transfers, NULL |
| `transaction_type` | enum | `CREDIT`, `DEBIT` |
| `reference_type` | enum | `OPENING_DEPOSIT`, `CASH_DEPOSIT`, `CASH_WITHDRAWAL`, `TRANSFER_IN`, `TRANSFER_OUT` |
| `amount` | numeric(18,0) | NOT NULL, \> 0 |
| `balance_after` | numeric(18,0) | NOT NULL, \>= 0 |
| `status` | enum | default `COMPLETED` |
| `description` | varchar(250) | NULL |
| `created_at` | timestamptz | NOT NULL |

- `CHECK` khớp type/reference (`TRANSFER_IN`→CREDIT, `TRANSFER_OUT`→DEBIT, ...)  
- `UNIQUE (transfer_id, transaction_type) WHERE transfer_id IS NOT NULL`  
- Index `idx_transactions_account_created (account_id, created_at DESC, id DESC)`  
- Cấm UPDATE/DELETE transaction `COMPLETED` ở tầng application.

### 3.5 `transfers`

| Cột | Kiểu | Ràng buộc |
| :---- | :---- | :---- |
| `id` | uuid | PK |
| `source_account_id` | uuid | FK, NOT NULL |
| `destination_account_id` | uuid | FK, NOT NULL |
| `initiated_by_user_id` | uuid | FK, NOT NULL |
| `amount` | numeric(18,0) | NOT NULL, \> 0 |
| `description` | varchar(250) | NULL |
| `idempotency_key` | varchar(128) | NOT NULL |
| `status` | enum | `COMPLETED` |
| `created_at` | timestamptz | NOT NULL |

- `CHECK (amount > 0)`, `CHECK (source_account_id <> destination_account_id)`  
- `UNIQUE (source_account_id, idempotency_key)`  
- (Bỏ `request_hash` so với bản gốc — rút gọn theo BR-TRANSFER \#6)

### 3.6 Quy tắc correctness (giữ nguyên từ thiết kế gốc — đây là phần không cắt)

**Nạp/rút** — trong 1 PostgreSQL transaction: `SELECT ... FOR UPDATE` account → kiểm tra `ACTIVE`/ownership/balance → tính balance mới bằng `numeric` → `UPDATE` balance → `INSERT` transaction → `COMMIT`. Rút tiền nên có thêm `WHERE current_balance >= :amount` làm hàng rào thứ hai.

**Transfer** — trong 1 PostgreSQL transaction: tìm theo `(source_account_id, idempotency_key)` → nếu tồn tại trả kết quả cũ → lock 2 account theo **ID tăng dần** → kiểm tra ownership/state/balance → trừ nguồn, cộng đích → tạo Transfer \+ 2 Transaction → `COMMIT`.

Invariant bắt buộc kiểm bằng test: không account nào âm; mỗi transfer có đúng 2 entry đối ứng cùng `transferId`; tổng balance không đổi qua transfer; cùng idempotency key không tạo tiền lần hai.

---

## 4\. Thiết kế API contract

### 4.1 Quy ước chung

- Base URL `/api/v1`; `Content-Type: application/json; charset=utf-8`.  
- Protected endpoint: `Authorization: Bearer <access-token>`.  
- `POST /transfers` bắt buộc header `Idempotency-Key` (chuỗi 16-128 ký tự, client tự sinh).  
- `amount`, `currentBalance`, `balanceAfter` trả **string** (VD `"150000"`), không dùng JSON number.  
- UUID, timestamp là string; timestamp ISO-8601 UTC.

### 4.2 Response envelope

```json
// Success
{ "success": true, "data": {}, "meta": { "requestId": "..." } }

// List success
{ "success": true, "data": [], "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }, "meta": { "requestId": "..." } }

// Error
{
  "success": false,
  "error": { "code": "INSUFFICIENT_FUNDS", "message": "Số dư không đủ.", "details": [{ "field": "amount", "reason": "exceeds_available_balance" }] },
  "meta": { "requestId": "..." }
}
```

### 4.3 Status code

`200` đọc/login thành công · `201` tạo mới (register, open account, transaction, transfer lần đầu) · `204` đóng account thành công · `400` DTO không hợp lệ · `401` token thiếu/sai/hết hạn · `404` không tồn tại/không sở hữu · `409` email trùng, insufficient funds, account chưa đóng được, idempotency key trùng · `500` lỗi không dự kiến (trả kèm `requestId`, không trả chi tiết lỗi gốc).

### 4.4 Endpoint contract

**Auth**

| Method | Path | Request chính | Response |
| :---- | :---- | :---- | :---- |
| POST | `/auth/register` | `fullName`, `email`, `password`, `confirmPassword` | `201`, User an toàn |
| POST | `/auth/login` | `email`, `password` | `200`, `{ accessToken, user }` |

**Account**

| Method | Path | Auth | Request/query | Response |
| :---- | :---- | :---- | :---- | :---- |
| POST | `/accounts` | JWT | `accountName`, `accountType`, `initialDeposit` | `201`, Account |
| GET | `/accounts` | JWT | `status?` | `200`, paginated list |
| GET | `/accounts/{id}` | JWT | Path UUID | `200`, Account |
| DELETE | `/accounts/{id}` | JWT | Path UUID | `204`, chỉ khi balance \= 0 |

Account response:

```json
{
  "id": "81ed...", "accountNumber": "100000012345", "accountName": "Tài khoản thanh toán",
  "accountType": "PAYMENT", "currentBalance": "500000", "currency": "VND",
  "status": "ACTIVE", "createdAt": "2026-09-16T00:00:00Z", "closedAt": null
}
```

**Transaction**

| Method | Path | Auth | Request/query | Response |
| :---- | :---- | :---- | :---- | :---- |
| POST | `/accounts/{id}/transactions` | JWT | `type`, `amount`, `description?` | `201`, Transaction |
| GET | `/accounts/{id}/transactions` | JWT | `page`, `limit`, `type?`, `from?`, `to?` | `200`, paginated history |

**Transfer**

| Method | Path | Auth | Header | Request | Response |
| :---- | :---- | :---- | :---- | :---- | :---- |
| POST | `/transfers` | JWT | `Idempotency-Key` | `sourceAccountId`, `destinationAccountNumber`, `amount`, `description?` | `201` lần đầu / `200` khi replay cùng key |

### 4.5 OpenAPI/Swagger

- Sinh/duy trì từ source code (NestJS `@nestjs/swagger` hoặc tương đương), expose `/api/docs` (Swagger UI) và `/api/docs.json`.  
- Bắt buộc có: `bearerAuth` security scheme, schema cho mọi request/response \+ error envelope \+ pagination, enum rõ cho type/status, response 400/401/404/409/500 theo từng operation, ví dụ thành công \+ ít nhất 1 ví dụ lỗi cho transaction/transfer.

---

## 5\. Kiến trúc code và dependency rule

**Quy tắc dependency (không đổi so với bản gốc — đây là phần cốt lõi cần giữ):**

```
presentation (Controller/DTO) → application (Use case) → domain (Entity/Value Object)
infrastructure (Prisma repository, JWT service) triển khai port do application định nghĩa
```

`domain` và `application` **không được import** `@nestjs/*`, `prisma`, HTTP request/response, hay PostgreSQL client. Controller chỉ gọi use case và map HTTP/DTO — không query DB, không kiểm tra balance, không ký JWT.

```text
bank-account-service/
├── src/
│   ├── main.ts                       # Bootstrap, global prefix /api/v1
│   ├── app.module.ts
│   ├── common/
│   │   ├── config/                   # env validation
│   │   ├── http/
│   │   │   ├── filters/global-exception.filter.ts
│   │   │   ├── interceptors/response-envelope.interceptor.ts
│   │   │   ├── interceptors/request-id.interceptor.ts
│   │   │   └── pipes/validation.pipe.ts
│   │   └── security/
│   │       ├── decorators/current-user.decorator.ts
│   │       └── guards/access-token.guard.ts
│   ├── modules/
│   │   ├── identity/                 # chỉ register + login
│   │   │   ├── domain/
│   │   │   ├── application/ports + use-cases (register-user, login)
│   │   │   ├── infrastructure/ (prisma-user.repository, bcrypt-hasher, jwt-token.service)
│   │   │   ├── presentation/http/auth.controller.ts
│   │   │   └── identity.module.ts
│   │   ├── accounts/
│   │   │   ├── domain/, application/ (open, list, get, close account)
│   │   │   ├── infrastructure/persistence/prisma-account.repository.ts
│   │   │   ├── presentation/http/accounts.controller.ts
│   │   │   └── accounts.module.ts
│   │   └── money-movement/
│   │       ├── domain/ (financial-transaction, transfer, money value object)
│   │       ├── application/ (create-cash-transaction, list-transactions, create-transfer, unit-of-work port)
│   │       ├── infrastructure/persistence/ (prisma repositories + unit of work)
│   │       ├── presentation/http/ (transactions.controller.ts, transfers.controller.ts)
│   │       └── money-movement.module.ts
│   └── infrastructure/prisma/ (prisma.module.ts, prisma.service.ts)
├── prisma/ (schema.prisma, migrations/, seed.ts — không seed BANK_STAFF)
├── test/
│   ├── unit/          # domain/application, fake port
│   ├── integration/   # Postgres thật: rollback, row lock, constraint
│   ├── e2e/            # register → login → open → deposit → transfer → history → close
│   └── performance/    # k6 tối thiểu trên Kaggle CPU
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

**Đã bỏ so với cây thư mục gốc:** `security/guards/roles.guard.ts`, `security/guards/mfa-challenge.guard.ts`, module `staff-support/`, các use-case MFA/refresh/forgot-reset, `test/contract/` (gộp việc validate OpenAPI vào e2e nếu còn thời gian).

---

## 6\. Thiết kế bảo mật và lỗi

### 6.1 JWT Guard (giữ nguyên nguyên tắc, bỏ RolesGuard/MfaChallengeGuard)

`AccessTokenGuard` (`src/common/security/guards/access-token.guard.ts`) là nơi **duy nhất** verify JWT:

1. Đọc `Authorization: Bearer <token>`; thiếu → `401 MISSING_TOKEN`.  
2. Verify chữ ký/hạn dùng qua `TokenServicePort` (implementation `JwtTokenService` ở infrastructure).  
3. Gắn `request.user = { id: sub }`.  
4. Token sai chữ ký/hết hạn → cùng một lỗi `401` chung (không phân biệt lý do ra response).

Route public (`/auth/register`, `/auth/login`, `/api/docs*`) đánh dấu bằng `@Public()` decorator đọc qua `Reflector` — mặc định **protected**, opt-out chứ không opt-in.

### 6.2 Ownership trong service (không đổi — đây là phần quan trọng nhất cần giữ)

Ownership **luôn** được kiểm tra trong use case, đọc từ record vừa lấy ra DB, không tin `userId`/`accountId` client tự gửi trong body:

```ts
async execute(currentUserId: string, accountId: string): Promise<AccountDto> {
  const account = await this.accountRepository.findById(accountId);
  if (!account || account.userId !== currentUserId) {
    throw new AccountNotFoundError(accountId); // 404, không phải 403
  }
  return AccountMapper.toDto(account);
}
```

Quy tắc: **404 khi không sở hữu** (không tiết lộ account người khác tồn tại hay không); DTO body không có field `userId`/`currentBalance`.

### 6.3 Validation DTO

`class-validator` qua `ValidationPipe` toàn cục: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — chặn client gửi `currentBalance`/`userId` lạ trong body bằng `400` rõ ràng.

Tiền tệ (`initialDeposit`, `amount`): kiểu **string**, regex số nguyên dương, không `@IsNumber()`; convert sang `bigint`/`Decimal` chỉ ở `Money` value object trong domain.

### 6.4 Global Error Handler

`AppError` (base class ở domain/application, không phải `HttpException`) → `GlobalExceptionFilter` map sang HTTP status duy nhất một nơi:

| Domain error | HTTP | errorCode |
| :---- | :---- | :---- |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `InvalidCredentialsError` | 401 | `INVALID_CREDENTIALS` |
| `TokenInvalidError` | 401 | `UNAUTHORIZED` |
| `AccountNotFoundError` | 404 | `ACCOUNT_NOT_FOUND` |
| `EmailAlreadyExistsError` | 409 | `EMAIL_EXISTS` |
| `InsufficientFundsError` | 409 | `INSUFFICIENT_FUNDS` |
| `AccountNotActiveError` | 409 | `ACCOUNT_NOT_ACTIVE` |
| `AccountBalanceNotZeroError` | 409 | `ACCOUNT_BALANCE_NOT_ZERO` |
| `IdempotencyKeyReusedError` | 409 | `IDEMPOTENCY_KEY_REUSED` |
| `SameSourceDestinationError` | 400 | `SAME_ACCOUNT_TRANSFER` |
| Lỗi không xác định/Prisma lạ | 500 | `INTERNAL_ERROR` (không trả stack trace/message gốc) |

Nguyên tắc: Prisma unique-violation (P2002) luôn được repository bắt và ném lại thành `AppError` nghiệp vụ — không lọt tên bảng/cột ra client. Filter **không tự rollback**; rollback tiền hoàn toàn do `prisma.$transaction` xử lý khi promise reject.

### 6.5 Logging & Redaction

Redact tập trung tại một điểm (logger wrapper), áp dụng cho mọi log line: `password`, `confirmPassword`, `token`, `accessToken`, `authorization`, `cookie`, `secret`, `accountNumber`. Không log `body` hoặc `headers.authorization` nguyên văn.

---

## 7\. Definition of Done cho Pha 1 (rút gọn)

- 8 endpoint ở mục 1 hoạt động, xuất hiện đầy đủ trong Swagger.  
- Phân tầng API → Service → Repository rõ ràng; domain/application không import NestJS/Prisma.  
- `AccessTokenGuard` dùng chung cho mọi protected route; ownership được test tại service (user A không đọc/sửa/đóng được account của user B → `404`).  
- Migration dựng được 4 bảng: `users`, `bank_accounts`, `financial_transactions`, `transfers`.  
- Unit test: `Money` value object, insufficient funds, ownership, idempotency decision.  
- Integration test: rollback khi lỗi giữa chừng, row lock khi 2 debit/transfer đồng thời, `current_balance` không âm.  
- E2E test: register → login → open account → deposit → withdraw → transfer → history → close account.  
- `docker compose up --build` dựng được app \+ PostgreSQL trên máy sạch.  
- 1 bộ load test tối thiểu chạy được trên Kaggle CPU (workload: login, list account, concurrent debit), lưu p50/p95/p99 và error rate làm baseline cho Pha 2\.  
- README có scope, ERD, sơ đồ kiến trúc, hướng dẫn chạy Docker, link Swagger.

## 8\. Backlog cho Pha 2 (không làm ở Pha 1\)

MFA/TOTP · Refresh token rotation \+ reuse detection · Forgot/Reset password · Rate limiting cho login · `BANK_STAFF` \+ audit log · Idempotency đầy đủ (so `request_hash`) · Caching/read replica cho lịch sử giao dịch · Observability (metrics, tracing) · Queue hóa xử lý transaction nếu cần scale.

&nbsp;