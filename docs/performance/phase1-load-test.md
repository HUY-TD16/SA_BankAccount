**Kiểm thử tải Pha 1 — Bank Account**

Kiểm thử được chạy trên Kaggle CPU ngày **27/10/2026**, gồm đăng nhập, xem tài khoản và rút tiền đồng thời. Mục tiêu là đo thời gian phản hồi, số request xử lý được và kiểm tra số dư sau tải.

**1. Môi trường và dữ liệu**

- CPU AMD EPYC 7B12, 4 CPU logic, giới hạn RAM 30 GiB. API, PostgreSQL và k6 chạy chung một phiên Kaggle.
- Node 24.22.0, PostgreSQL 16.15, k6 1.3.0. psutil thực tế ghi nhận trong lần chạy là 5.9.5.
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

1. Import [notebook](kaggle-load-test.ipynb) vào Kaggle, chọn **Accelerator=None**, **Internet=On**.
2. Giữ `MODE = 'smoke'`, chạy lần lượt các phần để kiểm tra môi trường và số dư.
3. Khi chạy thử đạt, thêm ô `MODE = 'full'` trước phần 9, rồi chạy lại phần **9 → 10 → 11**. Tải ZIP ở phần 11 sau khi hoàn tất.

**4. Kết quả**

Bộ full có **76.073 request**, **error rate 0%** ở cả 27 lượt. Có đủ 27 lượt làm nóng riêng. CSV và bảng tổng hợp đã được đối chiếu với JSON k6 gốc.

Bảng dưới lấy median từng chỉ số qua ba lần chạy. p50/p95/p99 là các ngưỡng thời gian phản hồi ứng với khoảng 50%/95%/99% request của từng lượt; bảng tổng hợp không tính lại percentile trên dữ liệu gộp.

| Bài test | VU | Request/giây | p50 (ms) | p95 (ms) | p99 (ms) | CPU API (%) |
|---|---:|---:|---:|---:|---:|---:|
| Đăng nhập | 1 | 2,83 | 250,18 | 264,11 | 280,75 | 69,98 |
| Đăng nhập | 5 | 13,23 | 272,60 | 300,99 | 322,77 | 344,49 |
| Đăng nhập | 20 | 14,76 | 1.239,45 | 1.312,49 | 1.502,33 | 383,54 |
| Xem tài khoản | 1 | 9,50 | 3,85 | 5,12 | 6,61 | 3,39 |
| Xem tài khoản | 5 | 47,34 | 3,96 | 5,97 | 9,05 | 12,56 |
| Xem tài khoản | 20 | 188,08 | 4,41 | 8,40 | 14,80 | 37,59 |
| Rút tiền | 1 | 8,73 | 13,15 | 17,80 | 22,07 | 6,66 |
| Rút tiền | 5 | 43,74 | 12,58 | 18,06 | 26,54 | 27,31 |
| Rút tiền | 20 | 103,55 | 40,45 | 313,86 | 485,51 | 60,39 |

CPU 100% tương đương một CPU logic. Vì vậy 383,54% ở login tương đương khoảng 3,84 CPU, gần hết quota 4 CPU. RSS của API cao nhất quan sát được khoảng 442 MiB, chưa đủ dữ liệu để kết luận có rò rỉ bộ nhớ.

**5. Kiểm tra số dư**

Sau từng lượt, số dư phải bằng số dư đầu trừ số lần rút thành công × 1 VND; số bút toán DEBIT phải bằng số lần rút thành công. Các tài khoản khác giữ nguyên số dư, không có số dư âm.

Cả **27 lượt chính thức và 27 lượt làm nóng đều đạt** kiểm tra này. Login và xem tài khoản không làm thay đổi số dư.

Bài riêng chống rút quá số dư cũng đạt: 20 request cùng rút 10.000 VND từ tài khoản có 100.000 VND, kết quả **10 lần thành công, 10 lần báo thiếu tiền, số dư 0 và 10 bút toán DEBIT**. Các lỗi thiếu tiền dự kiến này không gộp vào error rate ở trên.

**6. Nhận xét**

- **Đăng nhập:** có dấu hiệu bão hòa CPU ở 20 VU. Từ 5 lên 20 VU, throughput chỉ tăng từ 13,23 lên 14,76 request/giây, còn p95 tăng từ 301 lên 1.312 ms.
- **Xem tài khoản:** xử lý nhanh với dữ liệu hiện tại, đạt khoảng 188 request/giây ở 20 VU. Chưa thể xem đây là công suất tối đa của API vì còn giới hạn client và khoảng nghỉ giữa request.
- **Rút tiền:** số dư vẫn đúng nhưng phản hồi chậm hơn khi nhiều client cùng thao tác một tài khoản. Ở 20 VU, throughput ba lượt dao động **75,73–106,10 request/giây**, nên cần ghi nhận cả độ dao động này.
- Ngưỡng error rate dưới 1% đã đạt. Chưa đặt ngưỡng latency, nên chưa kết luận hệ thống đạt mọi yêu cầu hiệu năng.

**File để xem lại**

[ZIP kết quả gốc](bank-test-20261027-150005-full.zip) chứa cấu hình máy, source, script, dữ liệu đầu vào, CSV/JSON, CPU/RAM, log và kiểm tra số dư. Khi đọc ZIP, dùng các file **full**; một số file smoke cũ đã bị ghi đè một phần và không đồng bộ.

[Script k6](../test/performance/kaggle-load.js) · [Cấu hình test](../test/performance/protocol.json) 
