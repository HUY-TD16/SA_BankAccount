# ADR-001: Cách ly tải đăng nhập (Login Load Isolation) bằng Nginx Routing và Rate Limiting

* **Trạng thái (Status):** Đề xuất
* **Công nghệ liên quan:** Node.js `24.22.0`, PostgreSQL `15.19`, Bcrypt (cost `12`), JWT, Prisma, Nginx, Docker Compose

---

## 1. Bối cảnh & Vấn đề (Context)

Hệ thống hiện tại được thiết kế theo kiến trúc nguyên khối phân tầng (**Clean Architecture**) gồm các lớp:
* **Presentation:** Controllers & DTOs
* **Application:** Use Cases & Ports
* **Domain:** Entities & Money Value Object
* **Infrastructure Adapters:** Prisma, Bcrypt, JWT giao tiếp với cơ sở dữ liệu PostgreSQL

Hiện tại, toàn bộ các API (từ xác thực đăng nhập đến truy vấn số dư, chuyển tiền) đều được phục vụ trên cùng một tiến trình Node.js duy nhất.

### Kết quả đo lường hiệu năng thực tế
Khi tiến hành kiểm thử chịu tải bằng **Grafana k6 v1.3.0** trên môi trường Kaggle Notebook (*Intel Xeon 2.20 GHz, 4 vCPUs logic, 30 GB RAM, cấu hình production, `Bcrypt cost = 12`, `UV_THREADPOOL_SIZE = 4`*), luồng `POST /login` bộc lộ đặc tính tiêu tốn tài nguyên tính toán rất nặng (**CPU-bound**):

| Kịch bản kiểm thử | Tải đồng thời | Throughput (Req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Mức tải CPU API |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Đăng nhập (`/login`) | 1 VU | 2.50 | 297.08 | 309.99 | 321.65 | 74.18% |
| Đăng nhập (`/login`) | 5 VU | 10.86 | 352.83 | 388.96 | 422.55 | 369.32% |
| Đăng nhập (`/login`) | 20 VU | 11.34 | 1,649.11 | 1,736.08 | 1,783.00 | 388.99% |

### Phân tích nguyên nhân kỹ thuật
* Thuật toán băm **Bcrypt (cost 12)** tiêu tốn khoảng $\sim 300\text{ ms}$ CPU cho mỗi yêu cầu và thực thi bất đồng bộ thông qua **libuv thread pool** (mặc định giới hạn 4 luồng tương ứng với 4 vCPUs).
* Khi tải đạt ngưỡng $20\text{ VU}$, toàn bộ 4 vCPUs bị bão hòa hoàn toàn ($\sim 389\%$), thông lượng chạm trần ở mức $\sim 11.34\text{ req/s}$ và độ trễ trung vị ($p_{50}$) tăng gấp $5.5$ lần (từ $297.08\text{ ms}$ lên $1,649.11\text{ ms}$).
* **Rủi ro hệ thống:** Nếu tiếp tục chạy chung tiến trình, một đợt tăng đột biến lượng đăng nhập (hoặc tấn công dò mật khẩu / Brute-force) sẽ chiếm trọn CPU và làm cạn kiệt *libuv thread pool*, gây nghẽn dây chuyền (**cascading failure**) sang các nghiệp vụ tài chính lõi như chuyển tiền và kiểm tra số dư.

---

## 2. Các phương án xem xét

| Phương án | Mô tả | Đánh giá & Kết luận |
| :--- | :--- | :--- |
| **Phương án 1:** Tách thành Microservice xác thực độc lập | Tách riêng module Auth sang một repository/service mới hoàn toàn với pipeline và codebase riêng biệt. | **Loại bỏ:** Tốn nhiều thời gian tái cấu trúc mã nguồn (refactoring), phát sinh độ phức tạp về quản lý đa kho mã nguồn, vượt quá phạm vi và quỹ thời gian của bài tập lớn. |
| **Phương án 2:** Nginx Routing + Tách cụm Container + Rate Limiting | Giữ nguyên mã nguồn Monolith, triển khai thành 2 cụm container tách biệt tài nguyên phần cứng (CPU limit) và dùng Nginx định tuyến đường dẫn `/login` kết hợp giới hạn tốc độ truy cập. | **Được chọn:** Đạt được mục tiêu cách ly tài nguyên ở tầng hạ tầng (Infrastructure) mà không phải thay đổi logic nghiệp vụ hay kiến trúc mã nguồn. |
| **Phương án 3:** Rate Limit trong code ứng dụng trên 1 container duy nhất | Sử dụng thư viện middleware giới hạn request (ví dụ `express-rate-limit`) ngay bên trong tiến trình Node.js hiện tại. | **Loại bỏ:** Các request bị từ chối vẫn phải đi qua tầng mạng và Event Loop của Node.js; đồng thời chưa giải quyết được bài toán tách biệt quota CPU vật lý giữa luồng đăng nhập và luồng giao dịch. |

---

## 3. Quyết định kiến trúc

Nhóm quyết định áp dụng **Phương án 2** với thiết kế triển khai gồm **4 thành phần kỹ thuật cốt lõi**:

1. **Phân tách cụm container chạy (Runtime & Resource Isolation):**
   Sử dụng chung một Docker Image duy nhất của ứng dụng nhưng khởi chạy thành 2 service độc lập trong `docker-compose.yml` với giới hạn tài nguyên CPU cứng (`deploy.resources.limits.cpus`):
   * `auth-api`: Chuyên trách xử lý luồng xác thực đăng nhập (giới hạn quota cố định, ví dụ `1.0 – 1.5 vCPU`).
   * `core-api`: Chuyên trách các nghiệp vụ tài khoản, tra cứu số dư và chuyển tiền (được bảo toàn phần lớn số vCPU còn lại của máy chủ).

2. **Định tuyến tại lớp biên (Reverse Proxy Routing):**
   Đặt **Nginx** làm cổng giao tiếp duy nhất (API Gateway / Reverse Proxy) tiếp nhận mọi lưu lượng từ Client và Swagger UI:
   * Đường dẫn `POST /api/auth/login` được định tuyến (`proxy_pass`) trực tiếp sang cụm `auth-api`.
   * Toàn bộ các đường dẫn nghiệp vụ còn lại (`/api/accounts/**`, `/api/transactions/**`) được định tuyến sang cụm `core-api`.

3. **Giới hạn tốc độ tại tầng biên (Edge Rate Limiting):**
   Cấu hình `limit_req_zone` trên Nginx riêng cho endpoint `/api/auth/login` (ví dụ: giới hạn $10\text{ req/s}$ kết hợp hàng đợi `burst` nhỏ) để chủ động từ chối sớm và trả về mã HTTP **`429 Too Many Requests`** ngay tại tầng Nginx khi lưu lượng vượt ngưỡng chịu tải vật lý ($\sim 11\text{ req/s}$), ngăn ngừa tình trạng dồn ứ hàng đợi bên trong `auth-api`.

4. **Chia sẻ trạng thái tối thiểu (Stateless Shared-Nothing Execution):**
   Cả hai cụm `auth-api` và `core-api` kết nối chung tới cơ sở dữ liệu **PostgreSQL** và sử dụng chung khóa bí mật **`JWT_SECRET`**. Cơ chế này cho phép token do `auth-api` ký phát được `core-api` xác thực hoàn toàn không trạng thái (*stateless*) mà không cần gọi API chéo qua lại giữa hai cụm.

---

## 4. Hệ quả & Đánh đổi (Consequences)

### Tích cực (Pros)
* **Bảo vệ tuyệt đối luồng giao dịch lõi:** Ngay cả khi `auth-api` bị bão hòa 100% CPU bởi hàng chục VU đăng nhập đồng thời, `core-api` vẫn giữ nguyên 100% tài nguyên được cấp phát để xử lý chuyển tiền và truy vấn số dư với độ trễ thấp và ổn định.
* **Không phải sửa đổi kiến trúc mã nguồn:** Giữ nguyên toàn bộ thiết kế *Clean Architecture* cùng các lớp Use Cases / Adapters hiện có; chỉ cần bổ sung cấu hình `nginx.conf` và cập nhật `docker-compose.yml`, đảm bảo tiến độ bài tập lớn.
* **Chặn tải dư thừa từ lớp ngoài cùng:** Nginx loại bỏ các request vượt ngưỡng ngay ở tầng Reverse Proxy với chi phí CPU không đáng kể, giảm áp lực lên Node.js Event Loop.

### Tiêu cực & Đánh đổi (Cons)
* **Tăng nhẹ mức tiêu thụ bộ nhớ (RAM):** Việc vận hành 2 tiến trình Node.js độc lập thay vì 1 tiến trình làm tăng mức sử dụng RAM cơ bản (khoảng $+80\text{–}150\text{ MB}$). Tuy nhiên, mức tăng này hoàn toàn nằm trong khả năng đáp ứng của môi trường kiểm thử (30 GB RAM) cũng như máy tính cá nhân thông thường.
* **Tăng nhẹ độ phức tạp vận hành:** Nhóm phát triển cần cấu hình, quản lý và kiểm thử bổ sung file cấu hình `nginx.conf` cùng các tham số `limit_req` khi triển khai môi trường demo.

---

## 5. Tài liệu tham chiếu triển khai (Implementation Artifacts)
* `docker-compose.yml`: Định nghĩa 2 service `auth-api`, `core-api` cùng cấu hình giới hạn CPU và container `nginx`.
* `nginx/nginx.conf`: Cấu hình `upstream`, `location /api/auth/login`, `limit_req_zone` và chuyển tiếp header chuẩn (`X-Real-IP`, `X-Forwarded-For`).