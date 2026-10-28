**Kiểm thử tải Pha 1 — Bank Account**

Kiểm thử được chạy trên Kaggle CPU ngày **28/10/2026 (UTC)**, gồm đăng nhập, xem tài khoản và rút tiền đồng thời. Mục tiêu là đo thời gian phản hồi, số request xử lý được và kiểm tra số dư sau tải.

**1. Môi trường và dữ liệu**

- CPU Intel Xeon @ 2.20 GHz, 4 CPU logic, quota 4 CPU, giới hạn RAM 30 GiB. API, PostgreSQL và k6 chạy chung một phiên Kaggle.
- Node 24.22.0, PostgreSQL 15.19 (Ubuntu 15.19-1.pgdg24.04+2), k6 1.3.0. psutil thực tế ghi nhận trong lần chạy là 5.9.5. Notebook và Docker mặc định cùng dùng phiên bản lớn PostgreSQL 15.
- Source commit: `a4a0f831054dc13c3e366952cc960cecd941efe0`. Bcrypt rounds 12, thread pool 4.
- Mỗi lượt có 1 user và 20 tài khoản PAYMENT/VND, mỗi tài khoản ban đầu có 1 tỷ VND. Dữ liệu được tạo lại trước mỗi lượt, ngoài thời gian đo.

**2. Kịch bản**

| Bài test | Request | Kết quả mong đợi |
|---|---|---|
| Đăng nhập | `POST /api/v1/auth/login` với email và mật khẩu đúng | HTTP 200, có access token |
| Xem tài khoản | `GET /api/v1/accounts?page=1&limit=20` với token | HTTP 200, đúng 20 tài khoản của user |
| Rút tiền đồng thời | `POST /api/v1/accounts/{id}/transactions`, cùng một tài khoản, mỗi lần rút 1 VND | HTTP 201, số dư giảm đúng và không âm |

Mỗi bài chạy với **1, 5 và 20 client ảo (VU)**, đo **60 giây/lượt**, lặp **3 lần**, tổng cộng **27 lượt chính thức**.

Trước mỗi lượt có 10 giây chạy làm nóng, lưu riêng. Mỗi client chờ phản hồi rồi nghỉ 100 ms trước khi gửi tiếp; giữa các lượt nghỉ 2 giây. Request timeout là 30 giây. Khi hết thời gian đo, k6 cho iteration đang chạy tối đa 35 giây để hoàn tất.

**3. Cách chạy lại**

1. Bắt đầu phiên Kaggle mới, import [notebook](kaggle-load-test.ipynb), chọn **Accelerator=None**, **Internet=On**.
2. Giữ `MODE = 'smoke'`, chạy lần lượt các phần. Phần 4 phải in `Database ready: 15.x`; phiên bản đầy đủ được lưu trong `environment.json` ở phần 6.
3. Khi chạy thử đạt, thêm ô `MODE = 'full'` trước phần 9, rồi chạy lại phần **9 → 10 → 11**. Tải ZIP ở phần 11 sau khi hoàn tất.

Khi đo lại để so sánh, giữ cùng phần cứng, phiên bản phần mềm, workload, dữ liệu đầu vào và cách đo. Kiểm tra `environment.json` vì CPU được cấp trên Kaggle có thể khác giữa các phiên.

**4. Kết quả**

Bộ full có **76.960 request**, **error rate 0%** ở cả 27 lượt. Có đủ 27 lượt làm nóng riêng. CSV và bảng tổng hợp đã được đối chiếu với JSON k6 gốc; CPU/RAM đã được đối chiếu với 1.650 mẫu của tiến trình API.

Bảng dưới lấy median từng chỉ số qua ba lần chạy. p50/p95/p99 là các ngưỡng thời gian phản hồi ứng với khoảng 50%/95%/99% request của từng lượt; bảng tổng hợp không tính lại percentile trên dữ liệu gộp.

| Bài test | VU | Request/giây | p50 (ms) | p95 (ms) | p99 (ms) | CPU API (%) |
|---|---:|---:|---:|---:|---:|---:|
| Đăng nhập | 1 | 2,50 | 297,08 | 309,99 | 321,65 | 74,18 |
| Đăng nhập | 5 | 10,86 | 352,83 | 388,96 | 422,55 | 369,32 |
| Đăng nhập | 20 | 11,34 | 1.649,11 | 1.736,08 | 1.783,00 | 388,99 |
| Xem tài khoản | 1 | 9,49 | 3,89 | 4,37 | 4,91 | 3,64 |
| Xem tài khoản | 5 | 47,17 | 4,49 | 6,19 | 8,61 | 14,80 |
| Xem tài khoản | 20 | 188,60 | 4,27 | 7,40 | 15,70 | 49,54 |
| Rút tiền | 1 | 8,88 | 11,11 | 13,12 | 16,57 | 6,11 |
| Rút tiền | 5 | 44,52 | 10,76 | 13,25 | 21,30 | 24,82 |
| Rút tiền | 20 | 99,44 | 44,74 | 324,30 | 582,51 | 61,80 |

CPU 100% tương đương một CPU logic. Vì vậy 388,99% ở login tương đương khoảng 3,89 CPU, gần hết quota 4 CPU. RSS của API cao nhất quan sát được khoảng 445,18 MiB, chưa đủ dữ liệu để kết luận có rò rỉ bộ nhớ.

**5. Kiểm tra số dư**

Sau từng lượt, số dư phải bằng số dư đầu trừ số lần rút thành công × 1 VND; số bút toán DEBIT phải bằng số lần rút thành công. Các tài khoản khác giữ nguyên số dư, không có số dư âm.

Cả **27 lượt chính thức và 27 lượt làm nóng đều đạt** kiểm tra này. Login và xem tài khoản không làm thay đổi số dư.

Bài riêng chống rút quá số dư cũng đạt: 20 request cùng rút 10.000 VND từ tài khoản có 100.000 VND, kết quả **10 lần thành công, 10 lần báo thiếu tiền, số dư 0 và 10 bút toán DEBIT**. Các lỗi thiếu tiền dự kiến này không gộp vào error rate ở trên.

**6. Nhận xét**

- **Đăng nhập:** có dấu hiệu bão hòa CPU ở 20 VU. Từ 5 lên 20 VU, throughput chỉ tăng từ 10,86 lên 11,34 request/giây, còn p95 tăng từ khoảng 389 lên 1.736 ms.
- **Xem tài khoản:** xử lý nhanh với dữ liệu hiện tại, đạt khoảng 188,60 request/giây ở 20 VU. Chưa thể xem đây là công suất tối đa của API vì còn giới hạn client và khoảng nghỉ giữa request.
- **Rút tiền:** số dư vẫn đúng nhưng phản hồi chậm hơn khi nhiều client cùng thao tác một tài khoản. Ở 20 VU, throughput ba lượt dao động **96,85–113,98 request/giây**, p99 tổng hợp khoảng 582,51 ms.
- Ngưỡng error rate dưới 1% đã đạt. Chưa đặt ngưỡng latency, nên chưa kết luận hệ thống đạt mọi yêu cầu hiệu năng.

**File để xem lại**

[ZIP kết quả gốc](bank-test-20261028-163024-full.zip) chứa cấu hình máy, source, script, dữ liệu đầu vào, CSV/JSON, CPU/RAM, log và kiểm tra số dư. Dùng các file **full** cho báo cáo chính thức; các file smoke dùng để kiểm tra nhanh môi trường.

[Script k6](../../test/performance/kaggle-load.js) · [Cấu hình test](../../test/performance/protocol.json)
