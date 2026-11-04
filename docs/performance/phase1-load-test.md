# Báo cáo kiểm thử tải hệ thống

Báo cáo kết quả kiểm thử chịu tải hệ thống Bank Account Backend được nhóm thực hiện trên môi trường máy chủ độc lập **Kaggle CPU** vào ngày **28/10/2026** và đợt đo bổ sung ngày **31/10/2026**.

Mục tiêu chính của đợt kiểm thử là:
1. Đánh giá khả năng mở rộng và thời gian phản hồi của hệ thống dưới các mức tải đồng thời khác nhau.
2. Kiểm chứng tính toàn vẹn số dư và cơ chế chống âm tiền khi có nhiều tiến trình cùng rút tiền trên một tài khoản.
3. Xác định giới hạn xử lý và điểm nghẽn tài nguyên của các luồng nghiệp vụ.

## 1. Môi trường và cấu hình thử nghiệm

Để kết quả đo có tính khách quan và có thể tái lập, nhóm chạy toàn bộ ứng dụng, database và công cụ tạo tải trên một môi trường cô lập:
– **Nền tảng kiểm thử:** Kaggle Notebook không dùng GPU.  
– **Phần cứng:** Intel Xeon 2.20 GHz, 4 vCPUs logic, 30 GB RAM.  
– **Phần mềm:** Node.js 24.22.0, PostgreSQL 15.19, công cụ đo tải Grafana k6 v1.3.0.  
– **Cấu hình ứng dụng:** chế độ production, Bcrypt chi phí 12, UV_THREADPOOL_SIZE = 4.  
– **Tập dữ liệu chuẩn bị:** Mỗi lượt kiểm thử sử dụng 1 người dùng và 20 tài khoản thanh toán `PAYMENT`, mỗi tài khoản có số dư ban đầu là 1 tỷ VND. Dữ liệu được làm mới hoàn toàn trước mỗi lượt đo.  

## 2. Kịch bản đo tải chi tiết

Nhóm thiết kế 3 kịch bản đại diện cho 3 nhóm thao tác đặc thù trong kiến trúc:
1. **Kịch bản 1: Đăng nhập** (`POST /auth/login`)  
   Đại diện cho luồng xử lý nặng về tính toán CPU do thuật toán băm mật khẩu Bcrypt.
2. **Kịch bản 2: Xem danh sách tài khoản** (`GET /accounts?page=1&limit=20`)  
   Đại diện cho luồng chỉ đọc dữ liệu.
3. **Kịch bản 3: Rút tiền đồng thời** (`POST /accounts/{id}/transactions`)  
   Nhiều client ảo cùng thực hiện rút 1 VND trên cùng một tài khoản duy nhất, đại diện cho luồng ghi cạnh tranh khóa dòng dữ liệu `SELECT ... FOR UPDATE`.

Mỗi kịch bản được thực thi ở 3 mức tải đồng thời: **1 VU**, **5 VU** và **20 VU**. Mỗi lượt đo kéo dài **60 giây**, có **10 giây làm nóng** riêng biệt, và được lặp lại **3 lần** độc lập để lấy giá trị trung vị. Tổng cộng thực hiện **27 lượt đo chính thức**.

## 3. Kết quả đo tải thực tế

Tổng số requests ghi nhận trong 27 lượt đo chính thức là **76.960 requests**, với **tỉ lệ lỗi 0%**.

Bảng số liệu lấy theo giá trị trung vị của từng chỉ số qua 3 lần chạy:

| Kịch bản kiểm thử | Tải đồng thời | Throughput (Req/giây) | p50 (ms) | p95 (ms) | p99 (ms) | Mức tải CPU API |
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

*(Ghi chú: Mức tải CPU 100% tương đương 1 lõi logic; 388.99% nghĩa là ứng dụng đã khai thác gần như trọn vẹn cả 4 vCPUs được cấp).*

## 4. Kiểm chứng tính toàn vẹn dữ liệu và đối soát số dư

Sau mỗi lượt đo rút tiền, script kiểm tra tự động chạy câu lệnh SQL đối soát trực tiếp trên database:
– **Công thức kiểm tra:** $\text{Số dư sau test} = \text{Số dư ban đầu} - (\text{Số lượt rút thành công} \times 1\text{ VND})$.  
– **Kiểm tra sổ cái:** Số dòng phát sinh trong bảng `financial_transactions` với mã `CASH_WITHDRAWAL` phải khớp chính xác 100% với số lượng request HTTP 201 Created.  
– **Kết quả:** Cả **27 lượt đo chính thức và 27 lượt làm nóng đều vượt qua bài test đối soát**. Không có bất kỳ sai lệch số học nào, không có số dư âm.  

### Thử nghiệm đặc biệt: Kiểm tra chặn rút quá số dư
Nhóm thực hiện một bài test biên riêng biệt: Tạo tài khoản có số dư **100.000 VND**, sau đó cho **20 request đồng thời cùng rút 10.000 VND** (tổng nhu cầu rút là 200.000 VND, vượt gấp đôi số dư).
– **Kết quả thực tế:** Đúng **10 request đầu tiên thành công** (HTTP 201), **10 request tiếp theo bị từ chối với lỗi HTTP 409 INSUFFICIENT_FUNDS**.  
– **Số dư cuối cùng:** Đúng bằng **0 VND**, số bản ghi sổ cái sinh ra đúng bằng 10. Điều này chứng minh cơ chế khóa dòng đã ngăn chặn thành công 100% tình trạng thấu chi tài khoản.  

## 5. Thử nghiệm bổ sung: Tìm ngưỡng bão hòa của luồng đăng nhập

Nhận thấy luồng đăng nhập có throughput chững lại ở mức khoảng 11 req/giây, vào ngày **31/10/2026**, nhóm đã đo bổ sung riêng luồng login ở các dải tải tăng dần: **1, 5, 10, 20, 40 và 80 VU** (mỗi mức chạy 3 lần, 60 giây mỗi lượt):

| Tải ảo (VU) | Throughput (Req/giây) | p50 (ms) | p95 (ms) | p99 (ms) | Mức tải CPU API |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 2.56 | 289.06 | 291.04 | 294.81 | 73.13% |
| 5 | 11.19 | 340.87 | 367.96 | 398.86 | 368.29% |
| 10 | 11.75 | 743.96 | 886.43 | 923.59 | 391.19% |
| 20 | 11.75 | 1,591.47 | 1,644.03 | 1,675.63 | 389.72% |
| 40 | 11.72 | 3,291.83 | 3,356.79 | 3,374.65 | 387.92% |
| 80 | 11.72 | 6,684.40 | 6,756.30 | 6,787.56 | 390.42% |

## 6. Phân tích chuyên sâu và đánh giá kiến trúc

Từ các kết quả đo đạc thực tế, nhóm rút ra 3 kết luận kiến trúc quan trọng:

### 1. Luồng đọc mở rộng tuyến tính xuất sắc
Throughput tăng gần như hoàn hảo theo cấp số nhân: $9.49 \rightarrow 47.17 \rightarrow 188.60\text{ req/giây}$ khi tăng từ 1 lên 20 VU. Độ trễ trung vị p50 giữ vững ở mức khoảng 4ms. Điều này chứng minh việc phân tách luồng đọc độc lập, không bị ảnh hưởng bởi transaction lock, đã tận dụng triệt để index trên PostgreSQL.

### 2. Luồng ghi phản ánh chi phí an toàn dữ liệu
Ở 20 VU cạnh tranh trên cùng 1 tài khoản, throughput đạt xấp xỉ 100 req/giây. Độ trễ ở đuôi phân vị cao (p95: 324ms, p99: 582ms) tăng lên là hiện tượng bình thường trong kỹ thuật cơ sở dữ liệu: đây là thời gian xếp hàng chờ giải phóng khóa dòng của các tiến trình cạnh tranh trên cùng một tài khoản. Nhóm chấp nhận đánh đổi độ trễ ở đuôi để đổi lấy sự đảm bảo tuyệt đối về tính toàn vẹn số dư (tỉ lệ lỗi 0%, không âm tiền).

### 3. Luồng đăng nhập chậm có chủ đích để bảo mật
Throughput đăng nhập đạt đỉnh và bão hòa ở ngưỡng khoảng 11.75 req/giây. Khi tải tăng từ 10 lên 80 VU, CPU duy trì ở mức tối đa gần 390% (chạm trần 4 lõi). 
Nguyên nhân không phải do nghẽn I/O hay lỗi code, mà do thuật toán băm mật khẩu Bcrypt chi phí 12 tiêu tốn khoảng 300ms tính toán CPU cho mỗi lần băm. Với 4 lõi CPU, công suất xử lý lý thuyết tối đa là:
$$\text{Max Throughput} = \frac{4\text{ cores}}{0.3\text{ giây}} \approx 13.3\text{ req/giây}$$
Kết quả thực tế đạt 11.75 req/giây chứng minh hệ thống đã khai thác tới gần 90% hiệu suất tính toán tối đa của phần cứng mà không hề phát sinh lỗi hay sập tiến trình.
