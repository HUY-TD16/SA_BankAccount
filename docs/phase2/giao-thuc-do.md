# Giao thức đo trước và sau

Mục tiêu: một con số "sau" chỉ có nghĩa khi đặt cạnh con số "trước" đo cùng cách. File này định nghĩa "cùng cách".

## Cố định

- Phần cứng: Kaggle Notebook CPU, không GPU (Intel Xeon 2.20 GHz, 4 vCPU, 30 GB RAM). Ghi lại `lscpu` và `free -g` vào log mỗi lần chạy, nếu Kaggle cấp máy khác thì chạy lại.
- Phần mềm: Node 24, PostgreSQL 15, k6 cùng bản với baseline. Ghi phiên bản thật vào log.
- Cấu hình app: `NODE_ENV=production`, `BCRYPT_ROUNDS=12`, `UV_THREADPOOL_SIZE=4`. Task nào muốn đổi một trong các giá trị này phải nói rõ trong ADR và đo lại cả "trước" với giá trị mới.
- Cách chạy: app, Postgres và k6 trên cùng notebook, như pha 1.
- Dữ liệu: reset trước mỗi lượt, fixture theo `test/performance/protocol-v2.json` (pha 1 dùng `protocol.json`).
- Mỗi ô (kịch bản x số VU) chạy 3 lần, 60 giây, có 10 giây làm nóng riêng. Báo cáo trung vị của 3 lần, kèm min và max để thấy độ dao động.

## Protocol v2

Giữ nguyên ba kịch bản của pha 1 để nối được với số cũ, thêm:

| Kịch bản | Mô tả | VU |
| --- | --- | --- |
| `debit` | như pha 1, mọi VU rút trên một tài khoản | 1, 5, 20, 50 |
| `debit_spread` | mỗi VU rút trên một tài khoản riêng trong 20 tài khoản | 5, 20 |
| `transfer` | chuyển 1 VND giữa hai tài khoản ngẫu nhiên, mỗi request một `Idempotency-Key` mới | 5, 20, 50 |
| `list` | như pha 1 | 1, 5, 20, 50, 100 |
| `login` | như pha 1 | 1, 5, 20, 40, 80 |
| `mixed` | một nhóm VU đăng nhập liên tục, nhóm khác xem danh sách; đo riêng độ trễ từng nhóm | 40 login + 20 list |

Hiện thực ở `test/performance/protocol-v2.json` (`id` là `sa-bank-phase2-kaggle-v2`) và `test/performance/kaggle-load.js`. Không sửa `protocol.json` của v1, để còn tái lập được số pha 1.

- `transfer` chọn ngẫu nhiên nguồn và đích khác nhau trong 20 tài khoản, mỗi lần 1 VND.
- `mixed` chạy hai scenario k6 cùng lúc. Bảng kết quả có hai dòng `mixed:login` và `mixed:list`, cột `vus` ghi tổng 60.
- CPU Postgres (`pg_cpu_avg_pct`) là tổng CPU của postmaster và các backend, đo mỗi giây như CPU app.

## Lưu ý với notebook

- Ô đầu notebook ghim `REPO_URL` (đang là repo gốc HUY-TD16) và `COMMIT`. Đổi sang fork của nhóm và SHA cần đo. Notebook tự kiểm `rev-parse HEAD` khớp `COMMIT`.
- Notebook đọc `test/performance/kaggle-load.js` và file protocol từ repo đã checkout, không giữ bản sao. Đổi kịch bản thì sửa file trong repo, rồi đo lại bằng SHA mới.
- `WORKLOADS` ở ô đầu chọn chạy một phần kịch bản, ví dụ `['debit', 'login', 'mixed']`.
- Notebook mới chỉ chạy protocol v2. Muốn tái lập số pha 1 thì dùng notebook ở commit `e83d991`.

## Bắt buộc sau mỗi lượt có ghi tiền

- Số dư cuối = số dư đầu trừ tổng tiền của các request 201.
- Số dòng sổ cái mới = số request 201 (chuyển khoản là 2 dòng mỗi request).
- Không có số dư âm.
- Tổng số dư toàn hệ thống không đổi sau `transfer`.

Lượt nào trượt đối soát thì bỏ cả lượt, không lấy số hiệu năng của nó.

## Ghi kết quả

- Commit SHA đã đo, id protocol, ngày chạy, link notebook Kaggle.
- File zip đầy đủ để ở output Kaggle hoặc GitHub Release, không commit vào repo.
- Bảng trung vị vào `docs/performance/`, mỗi đợt một file: `phase2-baseline.md`, sau đó `phase2-<task>.md`.
- Trong `phase2-tasks.json`, `evidence` của task trỏ tới file bảng và link notebook.

## Không được làm

- So số đo máy cá nhân với số Kaggle.
- Chọn lần chạy đẹp nhất trong 3 lần.
- Đổi kịch bản giữa "trước" và "sau".
- Điền số khi chưa chạy. Ô nào chưa đo thì ghi "chưa đo" và lý do.
