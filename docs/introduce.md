# Giới thiệu đề tài: Dịch vụ quản lý tài khoản ngân hàng

Báo cáo tóm tắt đề tài môn học **Kiến trúc Phần mềm**, giai đoạn 1.

## 1. Mục tiêu và phạm vi đề tài

### 1.1. Mục tiêu cốt lõi
Xây dựng một hệ thống backend cung cấp RESTful API quản lý tài khoản ngân hàng và điều phối các luồng giao dịch tiền tệ nội bộ. Mục tiêu kỹ thuật trọng tâm của đề tài là đảm bảo **tính đúng đắn và toàn vẹn của dữ liệu tài chính**:
– Không làm thất thoát, sai lệch hoặc nhân đôi số dư tài khoản dưới bất kỳ tình huống nào.  
– Tuyệt đối không để xảy ra số dư âm khi có nhiều giao dịch đồng thời.  
– Ngăn ngừa tình trạng bế tắc deadlock khi các tài khoản chuyển tiền qua lại lẫn nhau cùng lúc.  
– Chống trừ tiền trùng lặp khi phía client gặp sự cố gián đoạn mạng và gửi lại yêu cầu.  

### 1.2. Phạm vi giai đoạn 1
– **Môi trường hoạt động:** Hệ thống mô phỏng nội bộ; số dư và các giao dịch nạp, rút được khởi tạo và ghi nhận trực tiếp trong cơ sở dữ liệu.  
– **Tiền tệ:** Chuẩn hóa giao dịch bằng đơn vị Việt Nam Đồng (**VND**).  
– **Phân hệ chức năng:**  
  1. Xác thực người dùng (Đăng ký, Đăng nhập cấp JWT).  
  2. Quản lý tài khoản (Mở tài khoản thanh toán `PAYMENT` hoặc tiết kiệm `SAVINGS`, xem thông tin, đóng tài khoản).  
  3. Giao dịch tiền tệ (Nạp tiền, rút tiền, xem sao kê phân trang).  
  4. Chuyển khoản nội bộ (Chuyển tiền liên tài khoản kèm cơ chế Idempotency).  
– **Triển khai:** Đóng gói toàn bộ bằng Docker và Docker Compose, tích hợp Swagger UI phục vụ kiểm thử trực quan.  

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ | Lý do lựa chọn |
| :--- | :--- | :--- |
| **Ngôn ngữ** | TypeScript (Node.js 24) | Đảm bảo tính chặt chẽ về kiểu dữ liệu, phát hiện lỗi sớm khi biên dịch. |
| **Framework** | NestJS 12 | Hỗ trợ cấu trúc Module rõ ràng, hệ thống Dependency Injection mạnh mẽ và hệ sinh thái middleware/guards toàn diện. |
| **Cơ sở dữ liệu** | PostgreSQL 15 | Hệ quản trị cơ sở dữ liệu quan hệ mạnh mẽ, hỗ trợ đầy đủ ACID transaction, khóa dòng `SELECT ... FOR UPDATE` và CHECK constraint. |
| **ORM** | Prisma 7 | Quản lý schema, sinh migration tự động và hỗ trợ transaction an toàn. |
| **Bảo mật** | JWT và Bcrypt | Xác thực phi trạng thái qua JWT; mật khẩu được băm bằng thuật toán Bcrypt an toàn với chi phí 12. |
| **Validation** | class-validator, class-transformer | Kiểm soát chặt chẽ kiểu dữ liệu đầu vào tại tầng Controller, tự động loại bỏ các trường không hợp lệ. |
| **Tài liệu API** | Swagger / OpenAPI 3.0 | Tự động sinh tài liệu API trực quan tại `/api/docs`, hỗ trợ test trực tiếp trên trình duyệt. |
| **Đóng gói** | Docker, Docker Compose | Đảm bảo môi trường chạy đồng nhất giữa các máy tính cá nhân và môi trường kiểm thử. |
| **Kiểm thử** | Jest và Grafana k6 | Kiểm thử tự động từ Unit, Integration, E2E test đến kiểm thử tải trên máy chủ độc lập. |

## 3. Danh sách nghiệp vụ và REST API

### 3.1. Danh sách 8 use case chính
– **UC-01:** Đăng ký người dùng mới.  
– **UC-02:** Đăng nhập và nhận JWT Access Token.  
– **UC-03:** Mở tài khoản ngân hàng mới kèm số dư ban đầu.  
– **UC-04:** Xem danh sách và chi tiết tài khoản của người dùng.  
– **UC-05:** Nạp tiền hoặc rút tiền từ tài khoản.  
– **UC-06:** Xem lịch sử giao dịch sao kê với phân trang và bộ lọc.  
– **UC-07:** Đóng tài khoản khi số dư bằng 0.  
– **UC-08:** Chuyển khoản nội bộ giữa hai tài khoản.  

### 3.2. Bảng tổng hợp endpoint

Base URL: `/api/v1`

| Method | Endpoint | Xác thực | Mục đích | Mã HTTP thành công |
| :--- | :--- | :---: | :--- | :---: |
| `POST` | `/auth/register` | Không | Đăng ký người dùng mới | `201 Created` |
| `POST` | `/auth/login` | Không | Đăng nhập lấy access token | `200 OK` |
| `POST` | `/accounts` | JWT | Mở tài khoản ngân hàng | `201 Created` |
| `GET` | `/accounts` | JWT | Xem danh sách tài khoản của bản thân | `200 OK` |
| `GET` | `/accounts/{accountId}` | JWT | Xem chi tiết số dư một tài khoản | `200 OK` |
| `DELETE` | `/accounts/{accountId}` | JWT | Đóng tài khoản khi số dư bằng 0 | `204 No Content` |
| `POST` | `/accounts/{accountId}/transactions` | JWT | Nạp hoặc rút tiền | `201 Created` |
| `GET` | `/accounts/{accountId}/transactions` | JWT | Xem lịch sử giao dịch sao kê | `200 OK` |
| `POST` | `/transfers` | JWT + Header `Idempotency-Key` | Chuyển khoản liên tài khoản | `201` mới / `200` gửi lại |

### 3.3. Các mã lỗi HTTP chuẩn hóa

Hệ thống bắt lỗi tập trung qua `GlobalExceptionFilter` và trả về mã lỗi nhất quán:
– **`400 Bad Request`:** Dữ liệu đầu vào sai định dạng hoặc vi phạm ràng buộc validation.  
– **`401 Unauthorized`:** Thiếu token, token không hợp lệ, token hết hạn hoặc sai thông tin đăng nhập.  
– **`404 Not Found`:** Tài khoản không tồn tại hoặc tài khoản không thuộc quyền sở hữu của người gọi nhằm tránh tiết lộ thông tin tài khoản của người khác.  
– **`409 Conflict`:** Xung đột nghiệp vụ như email đã tồn tại, số dư không đủ để rút hoặc chuyển tiền, tài khoản đã bị đóng, đóng tài khoản khi vẫn còn tiền.  
– **`500 Internal Server Error`:** Lỗi không mong muốn từ hệ thống, chỉ trả về `requestId` để tra soát log, không làm lộ stack trace hay cấu trúc database.  

## 4. Các quy tắc nghiệp vụ cốt lõi

### 4.1. Quy tắc về tiền tệ và số dư
1. **Không cho phép thấu chi:** Mọi giao dịch rút tiền hoặc chuyển tiền đi đều phải kiểm tra điều kiện `currentBalance >= amount`. Nếu không đủ số dư, hệ thống lập tức từ chối và ném lỗi `INSUFFICIENT_FUNDS` với mã 409.
2. **Độ chính xác số nguyên:** Tiền được tính toán bằng số nguyên VND, sử dụng kiểu `bigint` trong mã nguồn và lưu bằng kiểu `DECIMAL(18, 0)` trong database. Tuyệt đối không dùng kiểu số thực để tránh lỗi làm tròn.
3. **Bất biến của sổ cái:** Giao dịch một khi đã hoàn tất thì không được phép chỉnh sửa hay xóa bỏ. Mỗi bản ghi giao dịch trong `financial_transactions` luôn lưu lại số dư ngay sau thời điểm giao dịch `balanceAfter` để phục vụ đối soát.

### 4.2. Quy tắc về chuyển khoản
1. **Giao dịch nguyên tử:** Trừ tiền tài khoản nguồn, cộng tiền tài khoản đích, tạo bản ghi `transfers` và tạo 2 dòng sao kê đối ứng đều được bọc trong một database transaction duy nhất. Cùng thành công hoặc cùng rollback 100%.
2. **Khóa dòng theo thứ tự cố định:** Khi thực hiện chuyển tiền giữa 2 tài khoản, hệ thống luôn sắp xếp UUID của 2 tài khoản và khóa tài khoản có UUID nhỏ hơn trước. Cơ chế này đảm bảo không bao giờ xảy ra deadlock khi 2 tài khoản chuyển tiền qua lại lẫn nhau đồng thời.
3. **Bắt buộc có Idempotency-Key:** Mỗi lệnh chuyển tiền phải có khóa định danh duy nhất gửi từ client. Nếu gửi lại cùng một khóa cho cùng một tài khoản nguồn, hệ thống sẽ trả lại kết quả cũ với mã HTTP 200 thay vì trừ tiền lần thứ hai.

### 4.3. Quy tắc về quyền sở hữu và bảo mật
1. **Xác thực quyền sở hữu nghiêm ngặt:** Người dùng chỉ có quyền thao tác trên tài khoản do chính mình sở hữu thông qua so khớp `userId` từ JWT với `userId` của tài khoản. Nếu truy cập tài khoản của người khác, hệ thống chủ động trả về `404 Not Found` thay vì 403 Forbidden để bảo vệ tính riêng tư của hệ thống.
2. **Quy tắc đóng tài khoản:** Chỉ cho phép đóng tài khoản khi số dư khả dụng bằng đúng 0 VND. Thao tác đóng chỉ chuyển trạng thái sang `CLOSED` và lưu thời điểm `closedAt`, không xóa dữ liệu để bảo tồn lịch sử giao dịch.
3. **Chuẩn hóa thông tin đăng nhập:** Email luôn được trim khoảng trắng và chuyển về chữ thường trước khi kiểm tra hoặc lưu vào cơ sở dữ liệu. Mật khẩu phải đạt độ dài từ 8 đến 72 ký tự với đầy đủ chữ hoa, chữ thường, số và ký tự đặc biệt.
