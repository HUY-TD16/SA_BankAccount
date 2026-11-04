# SA Bank Account - Dịch vụ quản lý tài khoản và giao dịch ngân hàng

Dự án môn học **Kiến trúc Phần mềm**.
Hệ thống backend cung cấp RESTful API quản lý vòng đời tài khoản ngân hàng và các giao dịch tài chính nội bộ bao gồm đăng ký, đăng nhập, mở tài khoản, nạp tiền, rút tiền, chuyển khoản và truy vấn sao kê.

Mục tiêu trọng tâm của dự án là giải quyết triệt để các bài toán kỹ thuật đặc thù trong ngành ngân hàng: **đảm bảo tính toàn vẹn số dư**, **chống rút quá số dư**, **triệt tiêu deadlock khi chuyển tiền đồng thời**, và **chống trừ tiền trùng lặp**.

## 1. Bài toán nghiệp vụ và tính năng

Trong một hệ thống ngân hàng thực tế, thách thức kỹ thuật lớn nhất không phải là các thao tác CRUD thông thường, mà là bài toán **xử lý đồng thời** và **tính đúng đắn của dữ liệu tài chính**:
– Hai yêu cầu rút tiền diễn ra cùng một thời điểm không được phép làm âm tài khoản.  
– Chuyển tiền giữa 2 tài khoản phải đảm bảo tính nguyên tử: nếu trừ tài khoản gửi thành công nhưng cộng tài khoản nhận bị lỗi, toàn bộ giao dịch phải được rollback ngay lập tức.  
– Hai người dùng chuyển tiền chéo nhau tại cùng một thời điểm không được gây bế tắc trong cơ sở dữ liệu.  
– Mạng lag khiến client gửi lại yêu cầu chuyển tiền nhiều lần tuyệt đối không được trừ tiền 2 lần.  

### Các chức năng chính

| Phân hệ | Chức năng | Mô tả chi tiết |
| :--- | :--- | :--- |
| **Xác thực** | Đăng ký và đăng nhập | Đăng ký tài khoản bằng email, mật khẩu băm Bcrypt chi phí 12, cấp phát JWT Access Token. |
| **Tài khoản** | Mở tài khoản | Hỗ trợ loại tài khoản `PAYMENT` (thanh toán) và `SAVINGS` (tiết kiệm) với số dư khởi tạo. |
| | Xem thông tin | Tra cứu danh sách tài khoản thuộc quyền sở hữu hoặc xem chi tiết số dư một tài khoản. |
| | Đóng tài khoản | Đóng tài khoản khi số dư đúng bằng 0, lưu vết lịch sử vĩnh viễn. |
| **Giao dịch** | Nạp tiền | Ghi nhận tăng số dư và ghi sổ cái giao dịch với mã tham chiếu `CASH_DEPOSIT`. |
| | Rút tiền | Kiểm tra số dư khả dụng, trừ tiền và ghi sổ cái `CASH_WITHDRAWAL` để chặn rút quá số dư. |
| | Chuyển khoản | Chuyển tiền nội bộ nguyên tử giữa 2 tài khoản kèm mã chống trùng lặp `Idempotency-Key`. |
| | Lịch sử giao dịch | Tra cứu biến động số dư theo tài khoản, hỗ trợ phân trang và lọc theo thời gian hoặc loại giao dịch. |

*Phạm vi thử nghiệm:* Hệ thống hoạt động trong môi trường mô phỏng nội bộ với đơn vị tiền tệ tiêu chuẩn là **VND**.

## 2. Công nghệ sử dụng

Nhóm lựa chọn các công nghệ hiện đại, ổn định và có khả năng kiểm soát chặt chẽ transaction:

– **Ngôn ngữ và nền tảng:** TypeScript, Node.js v24 LTS.  
– **Framework backend:** NestJS 12 trên nền Express, tận dụng cơ chế Dependency Injection, Middleware, Guard, Interceptor và Exception Filter toàn cục.  
– **Cơ sở dữ liệu:** PostgreSQL 15, hỗ trợ mạnh mẽ ACID transactions, khóa dòng `SELECT ... FOR UPDATE` và các ràng buộc CHECK constraint.  
– **ORM và quản lý migration:** Prisma 7, quản lý schema, tự động generate client type-safe và điều phối transaction.  
– **Xác thực và bảo mật:** JSON Web Token cho xác thực phi trạng thái, `bcrypt` băm mật khẩu, `class-validator` và `class-transformer` kiểm soát chặt đầu vào.  
– **Tài liệu API:** Swagger UI và OpenAPI 3.0 tự động phát sinh tại `/api/docs`.  
– **Đóng gói và triển khai:** Docker và Docker Compose v2.  
– **Kiểm thử:** Jest cho kiểm thử tự động và Grafana k6 cho kiểm thử tải trên máy chủ độc lập.  

## 3. Kiến trúc hệ thống và cơ chế an toàn dữ liệu

### Mô hình modular monolith kết hợp Clean Architecture và Hexagonal Architecture

Dự án áp dụng mô hình **Modular Monolith**: toàn bộ hệ thống chạy trong một ứng dụng NestJS duy nhất nhưng được chia tách ranh giới module rõ ràng (`identity`, `accounts`, `money-movement`). Lựa chọn này giúp hệ thống đơn giản trong việc triển khai và tối ưu hiệu năng do dùng chung transaction trực tiếp, tránh được sự phức tạp không cần thiết của Microservices ở quy mô đồ án.

Bên trong từng module, nhóm áp dụng kiến trúc phân tầng Clean Architecture và Hexagonal Architecture:
1. **Domain Layer:** Chứa Entities (`BankAccount`, `User`), Value Object `Money` và các ngoại lệ nghiệp vụ. Hoàn toàn độc lập, không phụ thuộc vào framework bên ngoài.
2. **Application Layer:** Chứa Use Cases thực thi nghiệp vụ và các Port định nghĩa hợp đồng giao tiếp.
3. **Infrastructure Layer:** Chứa các Adapter hiện thực hóa các Port như Prisma repositories, Bcrypt hasher, JWT service.
4. **Presentation Layer:** Controllers và DTO tiếp nhận HTTP request, validate dữ liệu và trả về phản hồi chuẩn.

```mermaid
flowchart TD
    Client[Client / Swagger UI] --> Presentation[Presentation Layer: Controllers & DTOs]
    Presentation --> Application[Application Layer: Use Cases]
    Application --> Domain[Domain Layer: Entities & Money Value Object]
    Application --> Ports[Application Ports: Interfaces]
    Adapters[Infrastructure Adapters: Prisma, Bcrypt, JWT] -. Implements .-> Ports
    Adapters --> Database[(PostgreSQL Database)]
```

### 5 cơ chế cốt lõi đảm bảo an toàn tiền tệ

1. **Khóa dòng dữ liệu:**
   Khi nạp, rút hoặc chuyển tiền, hệ thống sử dụng khóa dòng `SELECT ... FOR UPDATE` trực tiếp trong transaction. Các giao dịch cạnh tranh trên cùng một tài khoản sẽ phải xếp hàng tuần tự, loại bỏ hoàn toàn hiện tượng dirty read hay race condition.
2. **Sắp xếp thứ tự khóa để triệt tiêu deadlock:**
   Trong use case chuyển khoản giữa tài khoản A và B, hệ thống so sánh UUID và luôn khóa tài khoản có UUID nhỏ hơn trước. Dù client gọi A chuyển sang B hay B chuyển sang A đồng thời, cả 2 tiến trình đều xin khóa theo cùng một thứ tự, triệt tiêu hoàn toàn khả năng xảy ra deadlock.
3. **Bảo toàn tính nguyên tử qua Unit of Work:**
   Một lệnh chuyển tiền gồm 5 thao tác: khóa 2 tài khoản, trừ tiền nguồn, cộng tiền đích, tạo bản ghi `transfers`, và tạo 2 dòng sao kê đối ứng trong `financial_transactions`. Toàn bộ 5 thao tác này nằm trong cùng một khối `tx.$transaction`. Bất kỳ lỗi nào xảy ra đều khiến toàn bộ thay đổi rollback về trạng thái ban đầu.
4. **Cơ chế Idempotency chống trừ tiền 2 lần:**
   Mỗi yêu cầu chuyển tiền bắt buộc phải kèm header `Idempotency-Key`. Hệ thống sử dụng ràng buộc duy nhất trên cặp `(source_account_id, idempotency_key)` trong bảng `transfers`. Nếu client bị rớt mạng và gửi lại cùng key, hệ thống nhận diện đây là lệnh phát lại, trả về kết quả cũ mà không trừ tiền lần thứ hai.
5. **Đảm bảo độ chính xác số học tuyệt đối:**
   Hệ thống không sử dụng kiểu dữ liệu số thực của JavaScript để tránh sai số làm tròn. Toàn bộ tính toán tiền tệ được bọc trong Value Object `Money` sử dụng `bigint` cho số nguyên VND, truyền qua HTTP API dưới dạng chuỗi `string`, và lưu trữ trong PostgreSQL bằng kiểu `DECIMAL(18, 0)`.

## 4. Danh sách REST API chính

Base URL: `http://localhost:3000/api/v1`  
Tất cả các endpoint (trừ Register/Login) đều yêu cầu Header: `Authorization: Bearer <access_token>`.

| Phương thức | Endpoint | Yêu cầu JWT | Mô tả chức năng | HTTP Status |
| :--- | :--- | :---: | :--- | :---: |
| `POST` | `/auth/register` | Không | Đăng ký người dùng mới | `201 Created` |
| `POST` | `/auth/login` | Không | Đăng nhập lấy JWT access token | `200 OK` |
| `POST` | `/accounts` | Có | Mở tài khoản ngân hàng mới | `201 Created` |
| `GET` | `/accounts` | Có | Xem danh sách tài khoản của người dùng với phân trang | `200 OK` |
| `GET` | `/accounts/{accountId}` | Có | Xem thông tin chi tiết và số dư một tài khoản | `200 OK` |
| `DELETE` | `/accounts/{accountId}` | Có | Đóng tài khoản khi số dư bằng 0 | `204 No Content` |
| `POST` | `/accounts/{accountId}/transactions` | Có | Nạp tiền hoặc rút tiền | `201 Created` |
| `GET` | `/accounts/{accountId}/transactions` | Có | Xem lịch sử giao dịch sao kê | `200 OK` |
| `POST` | `/transfers` | Có | Chuyển khoản nội bộ kèm header Idempotency-Key | `201` mới / `200` gửi lại |

### Quy ước định dạng phản hồi

Mọi API thành công đều trả về cấu trúc thống nhất:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "requestId": "1b6be851-86bf-4fc0-9e80-0208088f8e69" }
}
```

Khi có lỗi, hệ thống không bao giờ để lộ stack trace ra ngoài:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Số dư tài khoản không đủ"
  },
  "meta": { "requestId": "1b6be851-86bf-4fc0-9e80-0208088f8e69" }
}
```

## 5. Hướng dẫn cài đặt và khởi chạy nhanh

### Yêu cầu môi trường
– Đã cài đặt **Git** và **Docker** hỗ trợ Compose v2.  

### Các bước khởi chạy bằng Docker

1. **Clone repository và chuẩn bị file cấu hình:**
   ```powershell
   git clone https://github.com/HUY-TD16/SA_BankAccount.git
   cd SA_BankAccount
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

2. **Cấu hình môi trường:**
   Mở file `.env` và kiểm tra các biến cơ bản:
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

3. **Khởi chạy hệ thống bằng Docker Compose:**
   ```powershell
   docker compose up --build -d
   ```

4. **Trải nghiệm và kiểm thử trên Swagger UI:**
   – Mở trình duyệt truy cập: **`http://localhost:3000/api/docs`**  
   – Đăng ký tài khoản $\rightarrow$ Đăng nhập lấy `accessToken`.  
   – Bấm nút **Authorize** ở góc trên bên phải Swagger, dán token vào để thực hiện các thao tác mở tài khoản, nạp rút tiền và chuyển khoản.  

5. **Dừng hệ thống:**
   ```powershell
   docker compose down
   ```

## 6. Kết quả kiểm thử và đo tải thực tế

Dự án được kiểm thử toàn diện từ Unit Test đến Performance Test:
– **Unit và Integration Test:** 25 test suites, 172 test cases passed 100%. Chạy lệnh: `npm test`.  
– **Swagger Contract Test:** Kiểm tra tính hợp lệ của tài liệu OpenAPI. Chạy lệnh: `npm run test:swagger`.  

### Báo cáo kiểm thử tải độc lập trên Kaggle CPU
Nhóm đã tiến hành chạy bài test tải thực tế bằng công cụ Grafana k6 trên máy chủ Kaggle CPU với cấu hình Intel Xeon 2.20 GHz, 4 Cores, 30GB RAM, PostgreSQL 15.19. Tổng cộng thực hiện **27 lượt đo chính thức**, xử lý **76.960 requests**, đạt **tỉ lệ lỗi 0%** và toàn bộ số dư đối soát sau tải đều chính xác tuyệt đối.

| Kịch bản kiểm thử | Tải đồng thời | Throughput (Req/giây) | p50 Latency (ms) | p95 Latency (ms) | p99 Latency (ms) | Tải CPU API |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Đăng nhập** | 1 VU | 2.50 | 297.08 | 309.99 | 321.65 | 74.18% |
| | 5 VU | 10.86 | 352.83 | 388.96 | 422.55 | 369.32% |
| | 20 VU | 11.34 | 1,649.11 | 1,736.08 | 1,783.00 | 388.99% |
| **Xem tài khoản** | 1 VU | 9.49 | 3.89 | 4.37 | 4.91 | 3.64% |
| | 5 VU | 47.17 | 4.49 | 6.19 | 8.61 | 14.80% |
| | 20 VU | 188.60 | 4.27 | 7.40 | 15.70 | 49.54% |
| **Rút tiền** | 1 VU | 8.88 | 11.11 | 13.12 | 16.57 | 6.11% |
| | 5 VU | 44.52 | 10.76 | 13.25 | 21.30 | 24.82% |
| | 20 VU | 99.44 | 44.74 | 324.30 | 582.51 | 61.80% |

#### Nhận xét phân tích hiệu năng
1. **Luồng đọc:** Đạt hiệu năng cao và ổn định, độ trễ p50 chỉ khoảng 4ms ngay cả khi chịu tải 20 VU với 188 req/giây. Điều này chứng minh việc tách biệt câu lệnh truy vấn không bọc trong lock đã giải phóng tối đa tài nguyên.
2. **Luồng ghi:** Đạt gần 100 req/giây ở 20 VU với 0% lỗi. Độ trễ ở đuôi p95 và p99 tăng lên phản ánh thời gian xếp hàng chờ giải phóng khóa dòng của các tiến trình cạnh tranh trên cùng một tài khoản, đảm bảo tuyệt đối không có tài khoản nào bị âm tiền.
3. **Luồng đăng nhập:** Chạm trần ở mức xấp xỉ 11.3 req/giây do chi phí tính toán của thuật toán băm Bcrypt chi phí 12 chiếm trọn 4 lõi CPU. Đây là đặc tính bảo mật có chủ đích nhằm chống tấn công vét cạn mật khẩu.

## 7. Cấu trúc thư mục mã nguồn

```text
SA_BankAccount/
├── src/
│   ├── app.module.ts                   # Module gốc cấu hình hệ thống
│   ├── main.ts                         # Điểm khởi chạy ứng dụng
│   ├── common/                         # Tầng dùng chung xuyên suốt các module
│   │   ├── config/                     # Quản lý biến môi trường
│   │   ├── domain/                     # Value Object Money, AppError chuẩn hóa
│   │   ├── http/                       # Exception filter, interceptors, pipes, Swagger
│   │   └── security/                   # Guards, decorators, ports xác thực
│   ├── infrastructure/
│   │   └── prisma/                     # Kết nối cơ sở dữ liệu Prisma Client
│   └── modules/                        # Các bounded context nghiệp vụ
│       ├── identity/                   # Phân hệ quản lý người dùng & xác thực
│       ├── accounts/                   # Phân hệ quản lý tài khoản & số dư
│       └── money-movement/             # Phân hệ điều phối nạp, rút, chuyển khoản
├── prisma/
│   ├── schema.prisma                   # Định nghĩa Data Model PostgreSQL
│   └── migrations/                     # Lịch sử các bản migration SQL
├── test/                               # Bộ test suites
└── docs/                               # Tài liệu hướng dẫn chuyên sâu đồ án
    ├── project-guide/                  # Hướng dẫn chi tiết kiến trúc & vận hành
    └── performance/                    # Chi tiết báo cáo đo tải Kaggle CPU
```

## 8. Tài liệu kỹ thuật chi tiết

Để tìm hiểu sâu hơn về từng khía cạnh kỹ thuật của đồ án, mời Thầy Cô và các bạn tham khảo các tài liệu chuyên đề:
– [Hướng dẫn kiến trúc phân tầng và Port/Adapter](docs/project-guide/01-architecture.md)  
– [Thiết kế cơ sở dữ liệu và ràng buộc toàn vẹn](docs/project-guide/02-database.md)  
– [Đặc tả chi tiết hợp đồng REST API](docs/project-guide/03-api.md)  
– [Quy tắc nghiệp vụ và vòng đời tài khoản](docs/project-guide/04-business-rules.md)  
– [Hướng dẫn chạy dự án và demo](docs/project-guide/05-running.md)  
– [Hướng dẫn thực thi các bộ kiểm thử](docs/project-guide/06-testing.md)  
– [Phân tích 9 tình huống xung đột đồng thời và cách xử lý](docs/project-guide/08-problem-scenarios.md)  
– [Báo cáo chi tiết đo tải k6 trên Kaggle](docs/performance/phase1-load-test.md)  
