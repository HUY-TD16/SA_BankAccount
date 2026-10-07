# Thiết kế Bảo mật và Xử lý lỗi - Bank Account Service Pha 1

> Tài liệu này cụ thể hóa phần "Bảo mật khi build" trong `phase1-implementation-blueprint.md` và các business rule BR-AUTH/BR-ACCOUNT/BR-API trong `phase1-basic-bank-account.md`. Phạm vi: JWT middleware, phân quyền ownership trong service, validation DTO, global error handler, và chính sách logging không lộ token/password. Công nghệ tham chiếu: NestJS + TypeScript + Prisma + PostgreSQL, đúng theo blueprint đã chốt.

## 1. Mục tiêu thiết kế

Bốn tiêu chí đánh giá dưới đây quyết định mọi lựa chọn trong tài liệu này:

| Tiêu chí | Câu hỏi cần trả lời | Cách tài liệu này trả lời |
|---|---|---|
| **Khả năng mở rộng** | Thêm role, thêm endpoint, đổi framework có phải sửa lại toàn bộ logic bảo mật không? | Guard/interceptor/filter là hạ tầng dùng chung, tách khỏi domain; ownership rule nằm ở service qua policy thuần, không phụ thuộc NestJS. |
| **Bảo mật** | Request không hợp lệ, không đúng chủ sở hữu, hoặc lỗi hệ thống có bao giờ lộ dữ liệu/secret không? | Guard chặn danh tính, service chặn ownership, filter chuẩn hóa lỗi, logger redact field nhạy cảm ở một điểm duy nhất. |
| **Correctness tiền** | Lỗi giữa chừng có để lại state tiền sai không? | Error handling không tự ý rollback ngoài Unit of Work; mọi exception nghiệp vụ đều là domain error được ném từ trong transaction, đảm bảo Prisma tự rollback đúng. |
| **Dễ bảo trì** | Một dev mới có đọc được luồng auth/error từ controller xuống domain không? | Mỗi lớp có đúng một trách nhiệm, đặt tên nhất quán với cây thư mục blueprint, có bảng mapping lỗi rõ ràng. |

## 2. Nguyên tắc phân tầng bảo mật (nhắc lại từ blueprint)

```text
Request → [ValidationPipe: DTO] → [AccessTokenGuard: xác thực JWT]
        → [RolesGuard: kiểm tra role nếu route yêu cầu]
        → Controller (mỏng) → Use case (Application)
        → Service policy: ownership / state check (Domain rule, không phải guard)
        → Repository (Prisma) trong Unit of Work nếu có ghi tiền
        → [GlobalExceptionFilter] bắt mọi lỗi, map sang response envelope chuẩn
```

Nguyên tắc bắt buộc:

- **Guard chỉ xác thực danh tính (authentication) và role tĩnh (authorization thô).** Guard không bao giờ query `accountId` để so `userId`, vì đó là business rule có thể thay đổi theo từng use case (ví dụ staff được vượt ownership ở endpoint riêng).
- **Ownership luôn được kiểm tra trong use case/service**, dùng dữ liệu vừa đọc từ repository, không tin bất kỳ trường nào client tự gửi lên (`userId`, `accountId` trong body).
- **Không có endpoint nào tự viết lại đoạn code xác thực JWT.** Toàn bộ route protected chỉ khai báo guard qua decorator; điều này đúng yêu cầu đề bài "xác thực qua middleware/filter/interceptor, không viết lặp trong từng endpoint".

## 3. JWT Middleware / Guard

### 3.1 Thiết kế `AccessTokenGuard`

Vị trí: `src/common/security/guards/access-token.guard.ts`.

Trách nhiệm duy nhất:

1. Đọc header `Authorization: Bearer <token>`. Thiếu header → ném `UnauthorizedError` domain (không phải throw string).
2. Verify chữ ký và hạn dùng bằng `JWT_ACCESS_SECRET` (qua `TokenServicePort`, implementation là `JwtTokenService` ở tầng infrastructure — domain/application không import `jsonwebtoken` trực tiếp).
3. Parse payload tối thiểu `{ sub, role, iat, exp }`, gắn vào `request.user = { id: sub, role }`.
4. Token sai chữ ký, hết hạn, hoặc `role` không nằm trong enum hợp lệ → cùng một lỗi `401` chung, không phân biệt lý do cụ thể ra response (tránh dò token bằng oracle lỗi).

```ts
// Rút gọn minh họa - không phải code đầy đủ
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new AppUnauthorizedException('MISSING_TOKEN');

    const payload = await this.tokenService.verifyAccessToken(token); // throws AppUnauthorizedException nếu sai
    request.user = { id: payload.sub, role: payload.role };
    return true;
  }
}
```

Route public (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/api/docs*`) được đánh dấu bằng decorator `@Public()` đọc bởi guard qua `Reflector`, thay vì loại trừ theo path string — tránh quên bảo vệ endpoint mới thêm sau này (mặc định là **protected**, opt-out chứ không opt-in).

### 3.2 `RolesGuard`

Vị trí: `src/common/security/guards/roles.guard.ts`. Chạy sau `AccessTokenGuard`. Đọc metadata `@Roles('BANK_STAFF')` trên controller/handler, so với `request.user.role`. Không đủ quyền → `403 Forbidden` với `errorCode = FORBIDDEN_ROLE`, không tiết lộ role nào được yêu cầu.

### 3.3 `MfaChallengeGuard`

Guard riêng cho `/auth/mfa/verify`: chỉ chấp nhận `challengeToken` ngắn hạn (khác secret với access token), không chấp nhận access token thường tại endpoint này — tránh nhầm lẫn giữa hai loại token.

### 3.4 Vì sao đây là "mở rộng dễ dàng"

Thêm role mới (ví dụ `AUDITOR` ở Pha 2) chỉ cần: thêm giá trị enum + `@Roles()` ở controller mới. Không sửa `AccessTokenGuard`, không sửa domain. Đổi từ JWT sang session-based auth chỉ cần viết `TokenServicePort` implementation khác — use case và controller không đổi vì chúng chỉ phụ thuộc `request.user`.

## 4. Phân quyền Ownership trong Service (Application layer)

Đây là điểm khác biệt quan trọng nhất so với hệ thống quản lý tài chính cá nhân trong template cũ: **guard không đủ để bảo vệ dữ liệu tài khoản ngân hàng**, vì một `CUSTOMER` hợp lệ vẫn có thể gọi đúng route nhưng với `accountId` của người khác.

### 4.1 Vị trí thực thi

Ownership policy nằm trong use case (`application/use-cases/*.use-case.ts`), không nằm trong guard, không nằm trong Prisma repository. Ví dụ luồng `GET /accounts/{accountId}`:

```ts
// GetAccountUseCase - application layer, không import NestJS/Prisma
async execute(currentUserId: string, accountId: string): Promise<AccountDto> {
  const account = await this.accountRepository.findById(accountId);
  if (!account || account.userId !== currentUserId) {
    // Cùng một lỗi cho "không tồn tại" và "không phải chủ sở hữu"
    throw new AccountNotFoundError(accountId);
  }
  return AccountMapper.toDto(account);
}
```

### 4.2 Quy tắc bắt buộc

1. **404, không phải 403, khi không sở hữu.** Đúng theo BR-API #3 và UC-04/UC-05/UC-07: không tiết lộ account của người khác có tồn tại hay không. Đây là quyết định bảo mật có chủ đích (tránh account enumeration), không phải thiếu sót.
2. **Ownership check luôn đọc từ record vừa lấy ra database, không bao giờ tin `userId`/`accountId` do client truyền trong body.** DTO body cho các endpoint transaction/account **không có field `userId`**; `userId` chỉ lấy từ `request.user.id` do guard gắn vào.
3. **Transfer có hai vế khác nhau:** `sourceAccountId` phải ownership-check nghiêm ngặt (404 nếu không phải chủ), còn `destinationAccountNumber` chỉ cần tồn tại và `ACTIVE` — đúng BR-TRANSFER #2, vì Pha 1 chủ động cho chuyển tiền liên User.
4. **Staff bypass ownership chỉ ở đúng hai use case `staff-support` module**, mỗi lần đọc phải ghi `AuditLog` trong cùng use case (không tách riêng interceptor để tránh audit bị quên khi thêm endpoint mới, nhưng có unit test bắt buộc mọi staff use case phải gọi `auditLogPort.record(...)`).
5. **Không có "ownership middleware" dùng chung generic** (kiểu `checkOwnership(entity, req)` áp cho mọi resource) vì mỗi loại resource có rule khác nhau (account: strict; destination transfer: chỉ cần active; staff: bypass có điều kiện). Dùng chung một middleware sẽ che giấu sự khác biệt nghiệp vụ này — đánh đổi ít code hơn lấy rủi ro áp sai rule.

### 4.3 Test bắt buộc cho ownership (khớp mục 9.2 blueprint)

- Customer A gọi `GET/POST/DELETE` trên account của Customer B → luôn `404`.
- Customer A tạo transfer với `sourceAccountId` không thuộc mình → `404`, không chạm tới bước lock/trừ tiền.
- Customer gọi endpoint `/staff/*` → `403` (không phải `404`, vì đây là role check ở guard, khác lớp với ownership).
- Staff gọi thành công → có đúng một `AuditLog` mới được tạo.

## 5. Validation DTO

### 5.1 Công cụ và vị trí

`class-validator` + `class-transformer`, áp dụng qua `ValidationPipe` toàn cục (`common/http/pipes/validation.pipe.ts`), cấu hình:

```ts
new ValidationPipe({
  whitelist: true,           // loại bỏ field lạ thay vì lỗi hoặc silently ignore không rõ ràng
  forbidNonWhitelisted: true, // field lạ (vd userId, currentBalance) => 400 rõ ràng, không âm thầm bỏ qua
  transform: true,
  forbidUnknownValues: true,
});
```

`whitelist + forbidNonWhitelisted` là hàng rào kỹ thuật cho BR-ACCOUNT #5: nếu client cố gửi `currentBalance` hoặc `userId` trong body mở account/tạo transaction, request bị từ chối `400` thay vì bị service âm thầm bỏ qua — an toàn hơn vì lỗi hiện rõ ngay ở môi trường test.

### 5.2 DTO tiêu biểu

```ts
export class CreateTransactionDto {
  @IsIn(['CREDIT', 'DEBIT'])
  type: 'CREDIT' | 'DEBIT';

  @Matches(/^[1-9][0-9]*$/, { message: 'amount phải là chuỗi số nguyên dương' })
  amount: string; // string để giữ nguyên tắc "không dùng number cho tiền" tới tận DTO

  @IsOptional()
  @MaxLength(250)
  description?: string;
}
```

Nguyên tắc chung cho mọi DTO tiền tệ (`initialDeposit`, `amount`): kiểu `string`, regex số nguyên dương (hoặc không âm khi cho phép 0), **không** `@IsNumber()`/`number` — khớp trực tiếp với quyết định "không dùng float/number cho tiền" trong contract và blueprint. Việc convert sang `bigint`/`Decimal` chỉ xảy ra trong `Money` value object ở domain, không xảy ra ở DTO hay controller.

### 5.3 Bảng validation rule bám theo BR-AUTH/BR-ACCOUNT/BR-TRANSACTION

| DTO | Rule chính | Nguồn |
|---|---|---|
| `RegisterDto` | email hợp lệ + trim/lowercase ở service; `fullName` 2-100 ký tự; password 8-72 ký tự, có hoa/thường/số/ký tự đặc biệt, không khoảng trắng; `confirmPassword === password` | BR-AUTH #1-4 |
| `LoginDto` | email, password bắt buộc, không giới hạn thêm (tránh lộ policy password qua lỗi validation khi login) | UC-02 |
| `OpenAccountDto` | `accountName` bắt buộc; `accountType` enum; `initialDeposit` string số nguyên ≥ 0 | BR-ACCOUNT #3-4 |
| `CreateTransactionDto` | `type` enum CREDIT/DEBIT; `amount` string số nguyên > 0; không có `accountId`/`userId` (lấy từ path/token) | BR-TRANSACTION #2 |
| `CreateTransferDto` | `sourceAccountId` UUID; `destinationAccountNumber` string; `amount` string số nguyên > 0; header `Idempotency-Key` 16-128 ký tự (validate riêng ở guard/pipe cho header) | BR-TRANSFER #1, #6 |
| `ResetPasswordDto` | `token`, `newPassword`, `confirmPassword` cùng rule password như register | BR-AUTH #3, #8 |
| `MfaConfirmDto` | `code` đúng 6 chữ số | UC-11 |

Validation lỗi luôn trả `400` với `details: [{ field, reason }]` theo đúng error envelope ở mục 6, không bao giờ lộ giá trị password đã gửi lên trong `details`.

## 6. Global Error Handler

### 6.1 Kiến trúc lỗi

```text
Domain/Application throws AppError (subclass cụ thể)
        ↓
GlobalExceptionFilter (common/http/filters/global-exception.filter.ts)
        ↓
Map AppError → { httpStatus, errorCode, message, details? }
        ↓
ResponseEnvelopeInterceptor bọc thành { success:false, error, meta.requestId }
```

`AppError` là base class định nghĩa ở **domain/application**, không phải `HttpException` của NestJS — giữ đúng nguyên tắc domain không phụ thuộc framework. `GlobalExceptionFilter` là nơi duy nhất biết cách map `AppError` sang HTTP status.

```ts
export abstract class AppError extends Error {
  abstract readonly errorCode: string;
  abstract readonly httpStatus: number;
  readonly details?: Array<{ field: string; reason: string }>;
}

export class AccountNotFoundError extends AppError {
  readonly errorCode = 'ACCOUNT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(accountId: string) {
    super(`Account ${accountId} not found`); // message nội bộ, KHÔNG trả nguyên văn ra client
  }
}

export class InsufficientFundsError extends AppError {
  readonly errorCode = 'INSUFFICIENT_FUNDS';
  readonly httpStatus = 409;
}

export class IdempotencyKeyReusedError extends AppError {
  readonly errorCode = 'IDEMPOTENCY_KEY_REUSED';
  readonly httpStatus = 409;
}
```

### 6.2 Bảng mapping lỗi domain → HTTP (khớp mục 5.3 API contract)

| Domain error | HTTP | errorCode | Ghi chú |
|---|---|---|---|
| `ValidationError` (từ ValidationPipe) | 400 | `VALIDATION_ERROR` | `details` liệt kê field, không echo giá trị nhạy cảm |
| `InvalidCredentialsError` | 401 | `INVALID_CREDENTIALS` | Dùng chung cho "email không tồn tại" và "sai password" |
| `TokenExpiredError` / `TokenInvalidError` | 401 | `UNAUTHORIZED` | Không phân biệt lý do cụ thể ra ngoài |
| `MfaRequiredError` (không phải lỗi thật, dùng nội bộ) | — | — | Xử lý ở use case login, không đi qua filter như lỗi |
| `MfaCodeInvalidError` | 401 | `MFA_CODE_INVALID` | |
| `ForbiddenRoleError` | 403 | `FORBIDDEN_ROLE` | |
| `AccountNotFoundError` | 404 | `ACCOUNT_NOT_FOUND` | Dùng cả khi không tồn tại lẫn không sở hữu |
| `EmailAlreadyExistsError` | 409 | `EMAIL_EXISTS` | |
| `InsufficientFundsError` | 409 | `INSUFFICIENT_FUNDS` | |
| `AccountNotActiveError` | 409 | `ACCOUNT_NOT_ACTIVE` | Account đã CLOSED |
| `AccountBalanceNotZeroError` | 409 | `ACCOUNT_BALANCE_NOT_ZERO` | Đóng account còn tiền |
| `IdempotencyKeyReusedError` | 409 | `IDEMPOTENCY_KEY_REUSED` | Payload khác, key trùng |
| `SameSourceDestinationError` | 400 | `SAME_ACCOUNT_TRANSFER` | |
| `RateLimitExceededError` | 429 | `RATE_LIMIT_EXCEEDED` | Áp cho login/forgot/reset/MFA |
| Lỗi không xác định / Prisma exception lạ | 500 | `INTERNAL_ERROR` | Không trả message gốc, không trả stack trace |

### 6.3 Nguyên tắc filter

1. **Không bao giờ trả nguyên văn `error.message`/`error.stack` của exception lạ ra response.** Chỉ log ở server, trả `500` + `requestId` cho client để tra log — đúng nguyên tắc "không trả database exception, stack trace, token hoặc thông tin cho phép suy ra dữ liệu User khác" trong contract.
2. **Prisma unique-violation (P2002) không lọt tới client dưới dạng raw error.** Repository bắt lỗi Prisma cụ thể, ném lại thành `AppError` nghiệp vụ tương ứng (`EmailAlreadyExistsError`, hoặc constraint `idempotency_key` → `IdempotencyKeyReusedError`) — tránh lộ tên bảng/cột database.
3. **Filter không tự rollback gì cả.** Rollback tiền hoàn toàn do Prisma `$transaction` xử lý khi promise bên trong reject; filter chỉ chạy **sau** khi transaction đã rollback xong, đảm bảo correctness tiền không phụ thuộc vào tầng HTTP.
4. **`meta.requestId`** luôn có mặt kể cả ở lỗi 500, sinh bởi `RequestIdInterceptor` trước khi vào controller, để correlate với log.

### 6.4 Vì sao đây là "dễ bảo trì"

Thêm một lỗi nghiệp vụ mới (Pha 2, ví dụ `TransferLimitExceededError`) chỉ cần: định nghĩa class `AppError` mới + thêm một dòng vào bảng mapping trong filter. Không đụng tới guard, controller, hay bất kỳ use case khác. Không có `try/catch` rải rác ở controller — controller chỉ gọi use case và để exception tự bay lên filter.

## 7. Không log token/password — Logging & Redaction

### 7.1 Nguyên tắc

- Logger chuẩn hóa (`common/observability/logger.service.ts`) bọc một thư viện JSON logger (ví dụ `pino`), **redact tại một điểm duy nhất** bằng danh sách field cố định, áp dụng cho mọi log line, không phải nhớ redact thủ công ở từng chỗ gọi log.

```ts
const REDACTED_FIELDS = [
  'password', 'confirmPassword', 'newPassword',
  'token', 'accessToken', 'refreshToken', 'challengeToken',
  'authorization', 'cookie', 'secret',
  'mfaSecret', 'code', // mã TOTP
  'accountNumber', // số tài khoản đầy đủ - hạn chế PII không cần thiết
];
```

- Interceptor log request/response (`RequestIdInterceptor` hoặc middleware logging riêng) chỉ log **path, method, status, duration, requestId, userId (nếu đã xác thực)** — không bao giờ log `body` hoặc `headers.authorization` nguyên văn. Nếu cần log body để debug, phải đi qua hàm redact ở trên trước, không log trực tiếp `JSON.stringify(req.body)`.
- `AuditLog.metadata` (jsonb) tuân theo đúng giới hạn ở contract mục 3.6: cấm password, hash, reset token, JWT, TOTP secret, số account đầy đủ nếu không cần — audit service dùng cùng hàm `redact()` với logger để tránh hai bộ luật khác nhau.
- Test bắt buộc: integration test gọi `/auth/login` với password sai, assert log output (capture qua logger mock) **không chứa** chuỗi password đã gửi.

### 7.2 Vì sao đây là "bảo mật tốt"

Redact tập trung nghĩa là một dev thêm field nhạy cảm mới (ví dụ Pha 2 thêm `cardNumber`) chỉ cần thêm vào `REDACTED_FIELDS`, áp dụng ngay cho mọi log call hiện có — không phải rà từng chỗ gọi `logger.log()` trong code cũ.

## 8. Đối chiếu với bốn tiêu chí yêu cầu

### 8.1 Khả năng mở rộng

- Guard, filter, pipe là cross-cutting concern tách khỏi domain/application → thêm module (Pha 2: notification, fee, ledger đầy đủ) không sửa lại auth/error hiện có.
- `AppError` định nghĩa ở domain, filter chỉ là bảng tra cứu → thêm module mới chỉ cần thêm class lỗi + một dòng mapping.
- `TokenServicePort`, `PasswordHasherPort`, `MfaServicePort` là interface → đổi JWT sang session, đổi bcrypt sang argon2, không đụng use case.
- Role mới chỉ cần thêm enum + `@Roles()`, không sửa `AccessTokenGuard`.

### 8.2 Bảo mật

- Không có endpoint tự viết middleware xác thực riêng (đúng yêu cầu đề bài).
- Ownership luôn kiểm tra lại từ dữ liệu server, không tin client input; trả `404` thay vì `403` để chống account enumeration.
- Validation `whitelist/forbidNonWhitelisted` chặn client tự sửa `currentBalance`/`userId` ở tầng HTTP, trước khi tới service.
- Error response không bao giờ lộ stack trace, message Prisma gốc, hay phân biệt "email không tồn tại" với "sai password".
- Redact log/audit tập trung, có test tự động xác nhận không log password/token.
- Rate limit ở guard riêng cho login/forgot/reset/MFA theo `.env` (`RATE_LIMIT_LOGIN_PER_MINUTE`, `RATE_LIMIT_RESET_PER_HOUR`) chống brute-force.

### 8.3 Correctness tiền

- Lỗi nghiệp vụ (insufficient funds, account not active...) được ném **bên trong** Prisma `$transaction` của Unit of Work; Prisma tự rollback toàn bộ khi promise reject, filter chỉ xử lý ở tầng HTTP sau khi DB đã rollback — không có đường nào để filter "sửa" hoặc bỏ sót rollback.
- Idempotency key reuse với payload khác trả lỗi rõ ràng `409 IDEMPOTENCY_KEY_REUSED` thay vì âm thầm tạo transfer mới → không nhân đôi tiền.
- Validation DTO buộc `amount`/`initialDeposit` là chuỗi số nguyên dương ngay từ tầng vào, chặn `float`/khoa học ký hiệu lọt xuống domain trước khi tới `Money` value object.

### 8.4 Dễ bảo trì

- Một luồng request có đúng 5 điểm chạm bảo mật/lỗi (pipe → guard → guard → filter/interceptor), mỗi điểm một trách nhiệm, đặt tên khớp cây thư mục blueprint → dev mới đọc `common/` là nắm hết cơ chế chung, đọc `application/use-cases/*` là nắm hết business rule.
- Bảng mapping lỗi (mục 6.2) là tài liệu sống, review được cùng code, không phải suy luận rải rác trong nhiều file.
- Controller không chứa `try/catch` hay `if (account.userId !== user.id)` — giữ đúng nguyên tắc "controller chỉ parse/validate DTO và trả HTTP response" của BR-API #4.

## 9. Definition of Done cho phần bảo mật và lỗi

- `AccessTokenGuard`, `RolesGuard`, `MfaChallengeGuard` áp dụng qua decorator, có unit test cho từng trường hợp thiếu/sai/hết hạn token và role không đủ.
- Mọi use case đọc/ghi account đều có test ownership: user A không truy cập được resource của user B (404), staff bypass có audit log kèm test.
- `ValidationPipe` bật `whitelist + forbidNonWhitelisted`; có test xác nhận field `currentBalance`/`userId` trong body bị từ chối `400`.
- `GlobalExceptionFilter` phủ đủ bảng mapping mục 6.2; test xác nhận lỗi không xác định trả `500` không kèm stack trace/message gốc.
- Logger/audit dùng chung hàm redact; test xác nhận log không chứa password/token/secret sau khi gọi các endpoint auth.
- Rate limit hoạt động trên `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/mfa/verify`, có test trả `429` khi vượt ngưỡng.
- Tài liệu này được review cùng `phase1-domain-database-api-contract.md` và `phase1-implementation-blueprint.md`, không có mâu thuẫn về mã lỗi/status code.
