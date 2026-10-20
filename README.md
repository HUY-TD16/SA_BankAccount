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

## Kết quả kiểm tra Docker ngày 20/10/2026

Đã build image từ source, không dùng dependency hoặc output build của host,
và chạy project kiểm thử riêng với volume PostgreSQL mới:

- PostgreSQL và app healthy; 2 migration áp dụng thành công, có đủ 9 CHECK.
- API: unauthenticated accounts 401; register 201; login 200; open account 201;
  list accounts 200; số dư mở tài khoản đúng `100000` VND.
- Sau `down` rồi `up`, app healthy, dữ liệu còn nguyên và migration báo
  `No pending migrations to apply`.
- Build local thành công; 155/155 unit test đạt.
