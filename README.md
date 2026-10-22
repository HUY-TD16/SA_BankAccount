# SA Bank Account

## Chạy bằng Docker từ máy sạch

Yêu cầu: Git và Docker Engine/Docker Desktop đang chạy, hỗ trợ Docker Compose v2.
Không cần cài Node.js, npm hoặc PostgreSQL trên máy host.

Tại thư mục repository:

```powershell
Copy-Item .env.example .env
# Sửa DB_USER, DB_PASSWORD, DB_NAME và JWT_ACCESS_SECRET trong .env.
docker compose up --build -d --wait --wait-timeout 180
docker compose ps -a
```

`postgres` phải healthy, `migrate` kết thúc với exit code 0, `app` phải healthy.
Compose chỉ khởi động app sau khi PostgreSQL sẵn sàng và `prisma migrate deploy`
thành công. Migration được giữ nguyên trong repository, bao gồm 9 CHECK constraint.
Nếu migration thất bại, xem `docker compose logs migrate`; app không được khởi động.

- API: `http://localhost:3000/api/v1` (đổi cổng host bằng `APP_PORT`).
- Swagger: đặt `NODE_ENV=development` trong `.env`, chạy lại `docker compose up -d`,
  rồi mở `http://localhost:3000/api/docs`. Production mặc định tắt Swagger.
- `DATABASE_URL` dùng cho Node/Prisma chạy trên host, kết nối `localhost:DB_PORT`.
- `DOCKER_DATABASE_URL` dùng trong container, kết nối `postgres:5432`.
  `.env.example` có sẵn cả hai mẫu. Nếu mật khẩu chứa ký tự đặc biệt, URL-encode
  phần mật khẩu trong hai URL; `DB_PASSWORD` vẫn là mật khẩu gốc.
- Healthcheck app xác nhận HTTP route được bảo vệ trả 401 sau khi Nest khởi động;
  đây là liveness check, không kiểm tra lại database ở từng lần probe.

Image chạy bằng user `node`, dùng Node 24, build nhiều stage và chỉ giữ dependency
production. Prisma CLI vẫn có trong image để chạy migration. `.dockerignore`
loại `.env`, `node_modules`, `dist`, `.git` khỏi build context; image tự cài dependency,
generate Prisma Client và biên dịch source. Bước `tsc-alias` đổi alias `@src` thành
đường dẫn tương đối để `node dist/main.js` chạy độc lập.

## Kiểm tra API sau khi khởi động

```powershell
$baseUrl = 'http://localhost:3000/api/v1'
$email = "docker-$([guid]::NewGuid().ToString('N'))@example.test"
$register = @{ fullName='Docker Test'; email=$email; password='DockerTest123!'; confirmPassword='DockerTest123!' } | ConvertTo-Json
Invoke-RestMethod "$baseUrl/auth/register" -Method Post -ContentType 'application/json' -Body $register
$login = @{ email=$email; password='DockerTest123!' } | ConvertTo-Json
$session = Invoke-RestMethod "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body $login
$headers = @{ Authorization="Bearer $($session.data.accessToken)" }
$account = @{ accountName='Docker account'; accountType='PAYMENT'; initialDeposit='100000' } | ConvertTo-Json
Invoke-RestMethod "$baseUrl/accounts" -Method Post -Headers $headers -ContentType 'application/json' -Body $account
Invoke-RestMethod "$baseUrl/accounts" -Headers $headers
```

Đăng ký và tạo account trả 201; đăng nhập và danh sách account trả 200.
Tài khoản mới có số dư `100000`. Các lệnh này tạo dữ liệu demo trong database đã chọn.

Kiểm tra migration và ràng buộc bằng service PostgreSQL:

```powershell
$sql = @'
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name;
SELECT conname FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace;
'@
$sql | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Để kiểm tra trên volume trống, dùng project riêng, ví dụ `-p sa-bankaccount-clean`,
đồng thời đặt `DB_PORT` và `APP_PORT` khác stack đang chạy. Thêm cùng `-p` vào
mọi lệnh Compose của lần kiểm tra đó. Compose tạo volume riêng cho từng project.

## Vận hành

```powershell
docker compose logs --tail 100 app migrate
docker compose down
# Sau khi cập nhật source hoặc thêm migration:
docker compose up --build -d --wait --wait-timeout 180
```

`down` giữ dữ liệu PostgreSQL trong named volume. Chỉ thêm `--volumes` nếu chủ động
muốn xóa dữ liệu của stack đó. Thay đổi DB_USER/DB_PASSWORD/DB_NAME trong `.env`
không tự cập nhật user/database đã tồn tại trong volume.

## Kiểm tra source khi có Node.js

```powershell
npm ci
npx prisma generate
npm run build
npm test -- --runInBand
```

## E2E qua HTTP thật

Yêu cầu Node.js 24, dependency đã cài bằng `npm ci`, PostgreSQL đang chạy.
Test dùng Node test runner (không dùng Jest và các Nest mock của unit test).
Nó generate Prisma Client, build source, migrate database test, khởi động
`dist/main.js` bằng process riêng trên cổng tự chọn rồi gửi request HTTP thật.
Không cần chạy `npm start` trước. Guard, pipe, filter, interceptor và repository
đều là implementation thật.

Cách chạy độc lập bằng PostgreSQL Docker riêng (PowerShell):

```powershell
cd E:\Project\SA_BankAccount\Code\SA_BankAccount
npm ci
# Mở Docker Desktop và chờ engine sẵn sàng trước lệnh dưới.
docker run --name bank-http-e2e -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e_local_test -e POSTGRES_DB=bank_http_test -p 55432:5432 -d postgres:15-alpine
docker exec bank-http-e2e pg_isready -U e2e -d bank_http_test
# Chờ lệnh pg_isready báo accepting connections.
$env:E2E_DATABASE_URL = 'postgresql://e2e:e2e_local_test@localhost:55432/bank_http_test?schema=public'
npm run test:e2e
```

Kết quả mong đợi: 6 test PASS, fail 0. Đã xác minh ngày 22/10/2026 trên PostgreSQL
test trống và chạy lại trên database đã migrate; cả hai lần đều đạt. Mỗi test chứa nhiều request và assertion:

- Full banking flow: register/login, mở account, nạp/rút, chuyển liên user,
  replay 200 so với lần đầu 201, kiểm tra số dư, lịch sử/phân trang/filter,
  đóng account 204 body rỗng, replay sau khi nguồn đóng.
- Guard chặn token thiếu, sai, hết hạn bằng 401 ở GET và POST.
- DTO body/path/query/header sai trả 400; email trùng 409; sai mật khẩu 401.
- Ownership chặn đọc/ghi/history/close/transfer của user khác bằng 404.
- Transfer thiếu tiền trả 409; đích đóng trả 404; từ chối không làm đổi số dư.
- Mọi response JSON đều kiểm tra success/error envelope, requestId trùng
  `X-Request-Id`, không trả stack; kết quả identity không lộ password/hash.

Nếu đã có database test, chỉ cần đặt `E2E_DATABASE_URL` tương ứng rồi chạy
`npm run test:e2e`. Tên database bắt buộc kết thúc bằng `_test`; nếu thiếu biến này,
runner dùng `DATABASE_URL` nhưng vẫn kiểm tra điều kiện đó trước khi ghi/migrate.
Test tự dừng process app và dọn các user/account/transaction/transfer riêng của
lần chạy (kể cả khi assertion thất bại); giữ schema và migration đã áp dụng.
Không chạy đồng thời với công việc đang reset database test đó.

Chạy lại với container đã tạo: `docker start bank-http-e2e`, đặt lại biến
`E2E_DATABASE_URL` nếu mở terminal mới, rồi `npm run test:e2e`.
Sau khi xong có thể xóa riêng container test: `docker rm -f -v bank-http-e2e`.

Lỗi `ECONNREFUSED`: kiểm tra Docker/PostgreSQL và port. Lỗi yêu cầu `_test`:
đặt lại `E2E_DATABASE_URL` trong cùng terminal. Lỗi `42P04` khi tự tạo database:
database đã tồn tại, dùng lại database đó. Runner tự migrate nên không cần
chạy migration thủ công. Unit test vẫn chạy riêng bằng `npm test -- --runInBand`.

## Kết quả kiểm tra Docker ngày 20/10/2026

Đã build image từ source, không dùng dependency hoặc output build của host,
và chạy project kiểm thử riêng với volume PostgreSQL mới:

- PostgreSQL và app healthy; 2 migration áp dụng thành công, có đủ 9 CHECK.
- API: unauthenticated accounts 401; register 201; login 200; open account 201;
  list accounts 200; số dư mở tài khoản đúng `100000` VND.
- Sau `down` rồi `up`, app healthy, dữ liệu còn nguyên và migration báo
  `No pending migrations to apply`.
- Build local thành công; 155/155 unit test đạt.
