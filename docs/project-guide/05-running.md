# Hướng dẫn khởi chạy dự án và kịch bản thử nghiệm

Tài liệu hướng dẫn các bước thiết lập môi trường, khởi động hệ thống và chạy thử kịch bản demo mẫu từ máy sạch.

## 1. Khởi chạy bằng Docker Compose

Cách tiếp cận này không yêu cầu cài đặt sẵn Node.js hay PostgreSQL trên máy host. Toàn bộ môi trường đã được đóng gói thành các container độc lập.

### 1.1. Yêu cầu tiên quyết
– Đã cài đặt **Git**.  
– Đã cài đặt **Docker Desktop** hoặc Docker Engine trên Linux hỗ trợ Compose v2.  

### 1.2. Các bước khởi chạy

1. **Clone mã nguồn và khởi tạo file cấu hình:**
   ```powershell
   git clone https://github.com/HUY-TD16/SA_BankAccount.git
   cd SA_BankAccount
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

2. **Kiểm tra file cấu hình môi trường:**
   Đảm bảo các giá trị trong `.env` phù hợp với máy của bạn:
   ```env
   DB_USER=khanhNguyenHong2311
   DB_PASSWORD=az1978bl
   DB_NAME=bank_account
   DB_PORT=5434
   DATABASE_URL="postgresql://khanhNguyenHong2311:az1978bl@localhost:5434/bank_account?schema=public"
   DOCKER_DATABASE_URL="postgresql://khanhNguyenHong2311:az1978bl@postgres:5432/bank_account?schema=public"
   APP_PORT=3000
   NODE_ENV=development
   JWT_ACCESS_SECRET=khoa_bi_mat_jwt_cho_do_an_kien_truc_phan_mem_2026
   JWT_ACCESS_TTL=60m
   BCRYPT_ROUNDS=12
   ```

   > [!TIP]
   > - `NODE_ENV=development`: Cần thiết để Swagger UI được kích hoạt tại `http://localhost:3000/api/docs`.
   > - Nếu cổng `5432` trên máy host bị dịch vụ PostgreSQL cũ chiếm dụng, bạn có thể đổi `DB_PORT=5434` như mẫu trên để tránh xung đột cổng.

3. **Khởi động các container:**
   ```powershell
   docker compose up --build -d
   ```
   Lệnh này thực hiện tuần tự 3 việc:
   – Khởi động service `postgres` và chờ kiểm tra trạng thái khỏe mạnh.  
   – Chạy container `migrate` thực thi lệnh `prisma migrate deploy` để tạo bảng và các ràng buộc CHECK constraint.  
   – Khởi động backend NestJS `app` lắng nghe tại cổng `3000`.  

4. **Kiểm tra trạng thái các container:**
   ```powershell
   docker compose ps
   ```
   Kết quả mong đợi: `postgres` (healthy), `migrate` (exited 0), `app` (healthy).

5. **Xem log ứng dụng khi cần kiểm tra:**
   ```powershell
   docker compose logs -f app
   ```

6. **Dừng hệ thống:**
   ```powershell
   docker compose down
   # Nếu muốn xóa sạch volume cơ sở dữ liệu để chạy lại từ đầu:
   docker compose down -v
   ```

## 2. Khởi chạy ở môi trường phát triển local

Nếu bạn muốn chạy trực tiếp mã nguồn bằng Node.js trên máy host để debug code:

1. **Yêu cầu:** Node.js v24.x, npm, và một cơ sở dữ liệu PostgreSQL đang chạy.
2. **Cài đặt dependencies và generate Prisma client:**
   ```powershell
   npm install
   npx prisma generate
   ```
3. **Chạy migration database:**
   ```powershell
   npx prisma migrate deploy
   ```
4. **Khởi động server ở chế độ tự reload khi sửa code:**
   ```powershell
   npm run start:dev
   ```

## 3. Kịch bản thử nghiệm nhanh bằng PowerShell

Nếu không muốn mở trình duyệt Swagger UI, bạn có thể mở một cửa sổ PowerShell mới và dán toàn bộ đoạn script dưới đây để chạy tự động một vòng đời tài khoản hoàn chỉnh từ đăng ký đến đóng tài khoản:

```powershell
$baseUrl = 'http://localhost:3000/api/v1'
$randomSuffix = Get-Random
$email = "test_user_$randomSuffix@bank.test"

Write-Host "1. Đang đăng ký người dùng mới: $email..." -ForegroundColor Cyan
$regBody = @{
    fullName = "Nguyen Van Test"
    email = $email
    password = "Password123!"
    confirmPassword = "Password123!"
} | ConvertTo-Json
$regRes = Invoke-RestMethod "$baseUrl/auth/register" -Method Post -ContentType 'application/json' -Body $regBody

Write-Host "2. Đang đăng nhập lấy JWT token..." -ForegroundColor Cyan
$loginBody = @{ email = $email; password = "Password123!" } | ConvertTo-Json
$loginRes = Invoke-RestMethod "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody
$token = $loginRes.data.accessToken
$headers = @{ Authorization = "Bearer $token" }

Write-Host "3. Đang mở tài khoản thanh toán mới (Số dư ban đầu = 0)..." -ForegroundColor Cyan
$openAccBody = @{
    accountName = "Ví chi tiêu cá nhân"
    accountType = "PAYMENT"
    initialDeposit = "0"
} | ConvertTo-Json
$accRes = Invoke-RestMethod "$baseUrl/accounts" -Method Post -Headers $headers -ContentType 'application/json' -Body $openAccBody
$accountId = $accRes.data.id
Write-Host "   -> Đã mở tài khoản thành công! ID: $accountId" -ForegroundColor Green

Write-Host "4. Đang nạp 1.000.000 VND vào tài khoản..." -ForegroundColor Cyan
$depositBody = @{
    type = "CREDIT"
    amount = "1000000"
    description = "Nạp tiền sinh hoạt phí"
} | ConvertTo-Json
$depRes = Invoke-RestMethod "$baseUrl/accounts/$accountId/transactions" -Method Post -Headers $headers -ContentType 'application/json' -Body $depositBody
Write-Host "   -> Nạp tiền thành công! Số dư sau nạp: $($depRes.data.balanceAfter) VND" -ForegroundColor Green

Write-Host "5. Đang rút toàn bộ 1.000.000 VND để đưa số dư về 0..." -ForegroundColor Cyan
$withdrawBody = @{
    type = "DEBIT"
    amount = "1000000"
    description = "Rút tiền về 0 để đóng tài khoản"
} | ConvertTo-Json
$withRes = Invoke-RestMethod "$baseUrl/accounts/$accountId/transactions" -Method Post -Headers $headers -ContentType 'application/json' -Body $withdrawBody
Write-Host "   -> Rút tiền thành công! Số dư hiện tại: $($withRes.data.balanceAfter) VND" -ForegroundColor Green

Write-Host "6. Đang thực hiện đóng tài khoản..." -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/accounts/$accountId" -Method Delete -Headers $headers
Write-Host "   -> Đã đóng tài khoản thành công với mã 204!" -ForegroundColor Green

Write-Host "`n=== KỊCH BẢN THỬ NGHIỆM HOÀN TẤT THÀNH CÔNG 100%! ===" -ForegroundColor Yellow
```
