# Chạy dự án và thử API

[Mục lục](README.md) · [README dự án](../../README.md)

Các lệnh chạy tại thư mục gốc repository.

## 1. Chạy bằng Docker từ máy sạch

Cần Git và Docker Engine/Desktop đang chạy, có Compose v2. Không cần Node.js hay PostgreSQL trên host. Các lệnh bên dưới dùng **PowerShell**, chạy tại thư mục repository.

```powershell
git clone https://github.com/HUY-TD16/SA_BankAccount.git
cd SA_BankAccount
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Nếu đã có repository, chỉ sao chép `.env.example` khi chưa có `.env`; giữ cấu hình hiện có nếu đã chạy trước đó. Sửa `.env` trước khi chạy:

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

Để xem tài liệu, đặt `NODE_ENV=development` trong `.env`, chạy `docker compose up -d`, rồi mở [Swagger UI](http://localhost:3000/api/docs) hoặc [OpenAPI JSON](http://localhost:3000/api/docs.json). Nút **Authorize** nhận access token sau đăng nhập, không nhập thêm chữ `Bearer`. Swagger được bật khi `NODE_ENV` khác `production`.

```powershell
docker compose logs --tail 100 app migrate
docker compose down
# Sau khi cập nhật source/migration:
docker compose up --build -d --wait --wait-timeout 180
```

`down` giữ dữ liệu trong named volume; `down --volumes` xóa dữ liệu. Đổi thông tin DB trong `.env` không tự đổi user/database trong volume đã khởi tạo. Để kiểm tra máy sạch, dùng project riêng (`docker compose -p sa-bankaccount-clean ...`) và cổng riêng; giữ cùng tên project trong mọi lệnh của lần kiểm tra.

Image dùng build nhiều stage, chạy bằng user `node`, không chép `.env` vào image. Healthcheck app kiểm tra route bảo vệ trả `401` sau bootstrap; đây là liveness check, không phải kiểm tra kết nối DB liên tục.

## 2. Chạy phát triển trên host

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

## 3. Thử API nhanh

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


