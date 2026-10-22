# SA Bank Account

Backend quản lý tài khoản ngân hàng cơ bản cho môn Kiến trúc phần mềm. Dự án Pha 1 triển khai REST API bằng **TypeScript, NestJS 12, Prisma 7 và PostgreSQL 15**, chạy trên **Node.js 24**.

README mô tả kiến trúc, đặc tả và cách chạy theo [đề bài](docs/phase1_document/Requirement.md). Phạm vi nghiệp vụ lấy từ [đặc tả Pha 1 rút gọn](docs/phase1_document/phase1-scope-reduced.md); các tài liệu thiết kế gốc có thể chứa tính năng ngoài phạm vi hiện tại.

## 1. Phạm vi và đối chiếu yêu cầu

Người dùng đăng ký, đăng nhập, mở tài khoản, xem số dư, nạp/rút tiền, chuyển khoản, xem lịch sử và đóng tài khoản. Đây là mô phỏng nghiệp vụ; nạp/rút không kết nối cổng thanh toán hay ngân hàng bên ngoài.

| Yêu cầu đề bài | Cách đáp ứng trong dự án |
| --- | --- |
| REST API, JSON; có POST, GET, DELETE | API `/api/v1`, danh sách endpoint ở mục 4 |
| Tài liệu OpenAPI/Swagger | Swagger UI `/api/docs`, OpenAPI JSON `/api/docs.json` khi không chạy production |
| Phân tầng API → nghiệp vụ → truy cập dữ liệu | Controller/DTO → use case/domain → port → Prisma repository/unit of work |
| Nghiệp vụ không import framework web hoặc thư viện DB | Use case dùng TypeScript và các port; cấu hình DI tại module NestJS |
| Đăng nhập; ít nhất một GET và POST có xác thực tập trung | JWT và `AccessTokenGuard` toàn cục; GET/POST `/accounts` đều cần token |
| Đóng gói Docker | Dockerfile nhiều stage, Compose gồm PostgreSQL, migration và ứng dụng |
| GitHub công khai, commit cẩn thận, README mô tả kiến trúc/đặc tả | [Repository](https://github.com/HUY-TD16/SA_BankAccount); nhóm cần bảo đảm quyền truy cập công khai khi nộp bài |
| Kiểm thử tải trên Kaggle CPU | **Chưa hoàn thành:** `test/performance/index.ts` hiện là placeholder, chưa có kết quả baseline |

Chưa thuộc Pha 1: MFA, refresh token, quên mật khẩu, nhân viên ngân hàng, audit log nghiệp vụ, rate limiting, caching và xử lý bất đồng bộ. Các thư mục placeholder không đại diện cho tính năng đã triển khai.

## 2. Kiến trúc

Ứng dụng là một **modular monolith**: ba module nghiệp vụ chạy trong một process và dùng chung PostgreSQL.

```mermaid
flowchart LR
    Client[HTTP client] --> API[Controller / DTO]
    API --> UC[Application / Use case]
    UC --> Domain[Domain / Entity / Money]
    UC --> Port[Repository / Unit of Work port]
    Infra[Infrastructure / Prisma adapter] -. implements .-> Port
    Infra --> DB[(PostgreSQL)]
    Module[NestJS module / DI] -. wires .-> UC
    Module -. wires .-> Infra
```

- **Presentation:** nhận request, validate DTO, lấy danh tính từ JWT và chuyển kết quả sang HTTP.
- **Application/Domain:** thực hiện nghiệp vụ, ownership, trạng thái tài khoản, tính tiền và quyết định replay; không truy vấn Prisma trực tiếp.
- **Infrastructure:** triển khai repository và unit of work, truy vấn PostgreSQL qua Prisma; triển khai bcrypt và JWT qua các port.
- **Composition:** các file `*.module.ts` nối implementation với use case qua dependency injection.

| Module | Trách nhiệm |
| --- | --- |
| `identity` | Đăng ký, chuẩn hóa email, băm mật khẩu và đăng nhập |
| `accounts` | Mở, liệt kê, xem và đóng tài khoản |
| `money-movement` | Nạp/rút, chuyển khoản, lịch sử giao dịch |
| `common` | JWT guard, validation, error filter, response envelope, request ID và logging |

`AccessTokenGuard` đăng ký qua `APP_GUARD`, bảo vệ mặc định các controller; đăng ký/đăng nhập dùng `@Public()`. Kiểm tra quyền sở hữu nằm trong nghiệp vụ. `GlobalExceptionFilter` chuyển lỗi sang HTTP; interceptor đóng gói response và middleware gắn request ID.

```text
src/
  main.ts                         # Bootstrap HTTP, prefix, Swagger
  app.module.ts                   # Ghép module, guard toàn cục
  common/                         # HTTP, security, config, domain dùng chung
  modules/
    identity/
    accounts/
    money-movement/
      presentation/http/          # Controller, DTO, schema Swagger
      application/ports/          # Hợp đồng với adapter
      application/use-cases/      # Điều phối nghiệp vụ
      domain/                     # Khái niệm và lỗi nghiệp vụ
      infrastructure/             # Adapter và truy cập dữ liệu
  infrastructure/prisma/          # Kết nối DB dùng chung
prisma/                           # Schema và migration SQL
 test/                            # Unit, integration, HTTP E2E
 docs/                            # Đề bài, đặc tả, hướng dẫn bổ sung
```

Ba module nghiệp vụ áp dụng cùng cách phân tầng; cây trên mở rộng `money-movement` làm ví dụ.

## 3. Dữ liệu và quy tắc nghiệp vụ

```mermaid
erDiagram
    USERS ||--o{ BANK_ACCOUNTS : owns
    USERS ||--o{ TRANSFERS : initiates
    BANK_ACCOUNTS ||--o{ FINANCIAL_TRANSACTIONS : records
    BANK_ACCOUNTS ||--o{ TRANSFERS : source
    BANK_ACCOUNTS ||--o{ TRANSFERS : destination
    TRANSFERS o|--o{ FINANCIAL_TRANSACTIONS : links
    USERS {
        string user_id PK
        string email UK
        string password_hash
    }
    BANK_ACCOUNTS {
        string id PK
        string user_id FK
        string account_number UK
        decimal current_balance
        string status
        datetime closed_at
    }
    FINANCIAL_TRANSACTIONS {
        string id PK
        string account_id FK
        string transfer_id FK
        string transaction_type
        string reference_type
        decimal amount
        decimal balance_after
    }
    TRANSFERS {
        string id PK
        string source_account_id FK
        string destination_account_id FK
        string initiated_by_user_id FK
        string idempotency_key
        decimal amount
    }
```

Schema đầy đủ: [prisma/schema.prisma](prisma/schema.prisma). ERD thể hiện quan hệ lưu trữ; nghiệp vụ chuyển khoản tạo đúng hai bút toán đối ứng.

- Tiền chỉ dùng **VND**, lưu `DECIMAL(18,0)` và truyền qua JSON dưới dạng chuỗi, ví dụ `"100000"`. Số dư không âm; amount giao dịch phải dương; tiền gửi ban đầu được bằng `0`.
- Tài khoản có loại `PAYMENT` hoặc `SAVINGS`, trạng thái `ACTIVE` hoặc `CLOSED`. Chưa tính lãi tiết kiệm.
- Chỉ chủ tài khoản được xem chi tiết, lịch sử, nạp/rút hoặc đóng; tài khoản không thuộc người gọi trả `404`.
- Đóng tài khoản chỉ khi số dư bằng `0`. DELETE là đóng logic, giữ lịch sử; gọi lại trên tài khoản đã đóng trả `204`.
- Chuyển khoản cho phép giữa người dùng khác nhau, nhưng người gọi phải sở hữu nguồn; nguồn và đích phải khác nhau. Đích không tồn tại hoặc đã đóng trả `404`; chuyển mới từ nguồn đã đóng trả `409`.
- Cập nhật tiền và ghi lịch sử nằm trong cùng DB transaction. Nạp/rút khóa dòng tài khoản; chuyển khoản khóa hai tài khoản theo thứ tự ID để giảm nguy cơ deadlock. Lỗi trong transaction làm rollback.
- Transfer dùng khóa duy nhất `(source_account_id, idempotency_key)`: lần đầu trả `201`, replay trả kết quả cũ với `200`, kể cả sau khi nguồn đã đóng. Client phải gửi lại cùng key và payload; phiên bản hiện tại chưa so sánh hash payload.
- Email được chuẩn hóa lowercase/trim và unique; mật khẩu lưu dưới dạng bcrypt hash.

Migration bổ sung **9 CHECK constraint**: email chuẩn hóa; số dư tài khoản không âm; currency VND; trạng thái đóng khớp `closed_at`; amount và số dư sau giao dịch hợp lệ; cặp transaction type/reference hợp lệ; amount chuyển khoản dương; nguồn khác đích. Xem [hướng dẫn CHECK constraint](docs/database-check-constraints.md).

## 4. Đặc tả HTTP API

Base URL mặc định: `http://localhost:3000/api/v1`. Request có body dùng `Content-Type: application/json`. Endpoint bảo vệ yêu cầu `Authorization: Bearer <accessToken>`.

| Method | Path (sau `/api/v1`) | JWT | Đầu vào chính | Thành công |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Không | `fullName`, `email`, `password`, `confirmPassword` | 201 |
| POST | `/auth/login` | Không | `email`, `password` | 200 |
| POST | `/accounts` | Có | `accountName`, `accountType`, `initialDeposit` | 201 |
| GET | `/accounts` | Có | Query `page`, `limit`, `status` | 200 |
| GET | `/accounts/{accountId}` | Có | UUID tài khoản | 200 |
| DELETE | `/accounts/{accountId}` | Có | UUID tài khoản, số dư phải bằng 0 | 204, body rỗng |
| POST | `/accounts/{accountId}/transactions` | Có | `type`: CREDIT/DEBIT, `amount`, `description?` | 201 |
| GET | `/accounts/{accountId}/transactions` | Có | Query `page`, `limit`, `type`, `from`, `to` | 200 |
| POST | `/transfers` | Có | `sourceAccountId`, `destinationAccountNumber`, `amount`, `description?` | 201 mới / 200 replay |

Transfer bắt buộc thêm header `Idempotency-Key` dài 16–128 ký tự sau trim. `CREDIT` là nạp tiền, `DEBIT` là rút tiền. Schema, giới hạn DTO và ví dụ chi tiết nằm trong Swagger.

Response thành công:

```json
{ "success": true, "data": {}, "meta": { "requestId": "..." } }
```

Danh sách có thêm `pagination` cùng cấp với `data`: `page`, `limit`, `total`, `totalPages`. Response lỗi:

```json
{
  "success": false,
  "error": { "code": "INSUFFICIENT_FUNDS", "message": "Số dư không đủ." },
  "meta": { "requestId": "..." }
}
```

Lỗi có thể thêm `error.details`. `meta.requestId` khớp header `X-Request-Id`; lỗi nội bộ không trả stack trace. Response `204` không có envelope.

| HTTP status | Ý nghĩa |
| --- | --- |
| 400 | Body/path/query/header không hợp lệ, chuyển cùng tài khoản |
| 401 | Sai thông tin đăng nhập; token thiếu, sai hoặc hết hạn |
| 404 | Không tìm thấy/không sở hữu tài khoản; đích chuyển khoản đã đóng |
| 409 | Email trùng, thiếu tiền, nguồn không hoạt động, đóng tài khoản còn tiền |
| 500 | Lỗi nội bộ ngoài dự kiến |

## 5. Chạy bằng Docker từ máy sạch

Cần Git và Docker Engine/Desktop đang chạy, có Compose v2. Không cần Node.js hay PostgreSQL trên host. Các lệnh bên dưới dùng **PowerShell**, chạy tại thư mục repository.

```powershell
git clone https://github.com/HUY-TD16/SA_BankAccount.git
cd SA_BankAccount
Copy-Item .env.example .env
```

Nếu đã có repository, bắt đầu từ bước sao chép `.env.example`. Sửa `.env` trước khi chạy:

| Biến | Mục đích |
| --- | --- |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | User, mật khẩu và DB được PostgreSQL tạo ở lần chạy đầu |
| `DB_PORT` | Cổng PostgreSQL trên host, mặc định 5432 |
| `DATABASE_URL` | URL cho app/Prisma chạy trên host: `localhost:<DB_PORT>` |
| `DOCKER_DATABASE_URL` | URL trong Compose: `postgres:5432` |
| `APP_PORT` | Cổng HTTP trên host, mặc định 3000 |
| `NODE_ENV` | `production` mặc định trong Compose; dùng `development` để mở Swagger |
| `JWT_ACCESS_SECRET` | Thay placeholder bằng secret riêng, ngẫu nhiên đủ mạnh |
| `JWT_ACCESS_TTL` | Hạn access token, mặc định `60m` |
| `BCRYPT_ROUNDS` | Chi phí băm mật khẩu, mặc định 12 |

Hai URL phải dùng đúng thông tin DB đã chọn. Khi mật khẩu chứa ký tự đặc biệt, URL-encode phần mật khẩu trong URL; `DB_PASSWORD` giữ giá trị gốc. Không commit `.env` chứa secret.

```powershell
docker compose up --build -d --wait --wait-timeout 180
docker compose ps -a
```

Kết quả mong đợi: `postgres` healthy → `migrate` exit 0 → `app` healthy. Migration tự chạy bằng `prisma migrate deploy` trước khi app khởi động. API ở `http://localhost:3000/api/v1` nếu giữ cổng mặc định.

Để xem tài liệu, đặt `NODE_ENV=development` trong `.env`, chạy `docker compose up -d`, rồi mở [Swagger UI](http://localhost:3000/api/docs) hoặc [OpenAPI JSON](http://localhost:3000/api/docs.json). Nút **Authorize** nhận access token sau đăng nhập, không nhập thêm chữ `Bearer`. Code hiện bật Swagger dựa trên `NODE_ENV`; biến `ENABLE_SWAGGER` trong file mẫu chưa được sử dụng.

```powershell
docker compose logs --tail 100 app migrate
docker compose down
# Sau khi cập nhật source/migration:
docker compose up --build -d --wait --wait-timeout 180
```

`down` giữ dữ liệu trong named volume; `down --volumes` xóa dữ liệu. Đổi thông tin DB trong `.env` không tự đổi user/database trong volume đã khởi tạo. Để kiểm tra máy sạch, dùng project riêng (`docker compose -p sa-bankaccount-clean ...`) và cổng riêng; giữ cùng tên project trong mọi lệnh của lần kiểm tra.

Image dùng build nhiều stage, chạy bằng user `node`, không chép `.env` vào image. Healthcheck app kiểm tra route bảo vệ trả `401` sau bootstrap; đây là liveness check, không phải kiểm tra kết nối DB liên tục.

## 6. Chạy phát triển trên host

Cần Node.js 24 và PostgreSQL. Sau khi tạo `.env`, có thể chỉ chạy DB bằng Compose:

```powershell
npm ci
docker compose up -d --wait postgres
# Thay user/password/DB bằng giá trị thật trong .env:
$env:DATABASE_URL = 'postgresql://your_db_user:your_password_here@localhost:5432/your_database_name?schema=public'
$env:NODE_ENV = 'development'
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Prisma CLI dùng `dotenv`, không tự nội suy `${DB_USER}` trong URL mẫu như Compose. Vì vậy hãy đặt `DATABASE_URL` hoàn chỉnh trong terminal như trên hoặc sửa thành URL hoàn chỉnh trong `.env`. `JWT_ACCESS_SECRET` vẫn lấy từ `.env`. App trên host dùng `PORT` (mặc định 3000); `APP_PORT` chỉ dành cho ánh xạ cổng Compose.

## 7. Thử API nhanh

Sau khi app chạy, thực hiện đăng ký → đăng nhập → mở tài khoản → xem danh sách:

```powershell
$baseUrl = 'http://localhost:3000/api/v1'
$email = "demo-$([guid]::NewGuid().ToString('N'))@example.test"
$register = @{ fullName='Demo User'; email=$email; password='DemoTest123!'; confirmPassword='DemoTest123!' } | ConvertTo-Json
Invoke-RestMethod "$baseUrl/auth/register" -Method Post -ContentType 'application/json' -Body $register
$login = @{ email=$email; password='DemoTest123!' } | ConvertTo-Json
$session = Invoke-RestMethod "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body $login
$headers = @{ Authorization="Bearer $($session.data.accessToken)" }
$body = @{ accountName='Demo account'; accountType='PAYMENT'; initialDeposit='0' } | ConvertTo-Json
$account = Invoke-RestMethod "$baseUrl/accounts" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
Invoke-RestMethod "$baseUrl/accounts" -Headers $headers
# Đóng tài khoản vừa tạo, số dư đang bằng 0:
Invoke-RestMethod "$baseUrl/accounts/$($account.data.id)" -Method Delete -Headers $headers
```

Các lệnh tạo dữ liệu demo thật trong database được cấu hình. Đóng tài khoản giữ lại bản ghi và trả `204` không có body.

## 8. Kiểm thử

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

## 9. Kiểm thử tải và hướng phát triển Pha 2

Đề bài yêu cầu kiểm thử tải trên **Kaggle CPU**. Repository hiện chưa có kịch bản chạy được hoặc số liệu; không xem kết quả unit/E2E là bằng chứng hiệu năng.

Để hoàn tất yêu cầu này, nhóm cần bổ sung workload tối thiểu gồm login, list account và debit đồng thời; lưu cấu hình CPU/RAM, phiên bản source, dữ liệu đầu vào, số client, thời lượng, throughput, p50/p95/p99 và error rate. Khi so sánh Pha 2 phải giữ cùng cấu hình phần cứng, workload và cách đo, đồng thời kiểm tra invariant số dư sau tải.

Các đề xuất Pha 2 như rate limiting, idempotency có so payload, caching hoặc quan sát metrics/tracing cần được chọn dựa trên kết quả baseline và đánh giá trước/sau, theo yêu cầu đề bài.

## 10. Tài liệu tham khảo trong repository

- [Đề bài](docs/phase1_document/Requirement.md)
- [Phạm vi và đặc tả Pha 1 rút gọn](docs/phase1_document/phase1-scope-reduced.md)
- [Thiết kế domain, database và API gốc](docs/phase1_document/phase1-domain-database-api-contract.md)
- [Hướng dẫn Swagger](docs/swagger.md)
- [Migration và kiểm tra CHECK constraint](docs/database-check-constraints.md)
