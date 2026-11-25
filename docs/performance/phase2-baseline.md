# Baseline pha 2 (protocol v2)

Số đo "trước" cho P2-02, P2-03 và P2-05. Cách đo: `docs/phase2/giao-thuc-do.md`.

## Lượt chạy

| Mục | Giá trị |
| --- | --- |
| Commit đã đo | `b6d07cdbe24b353ddbd10de7cabb9dcfb78e06ed` (nhánh `p2-01/baseline-v2`) |
| Code ứng dụng | Trùng `main` `0a12ec5`: `git diff 0a12ec5 b6d07cd -- src prisma package.json package-lock.json` rỗng |
| Protocol | `sa-bank-phase2-kaggle-v2`, 20 ô × 3 lần, 60 giây mỗi lượt, 10 giây làm nóng riêng |
| Ngày chạy | 25/11/2026, 09:43 đến 11:05 (giờ Việt Nam) |
| Notebook Kaggle | kernel `datdoooooooo/sa-bank-load-full` bản 1 (riêng tư), Internet tắt, dataset `datdoooooooo/sa-bank-offline` |
| File zip kết quả | `bank-test-20261125-024344-full.zip`, 17 MB, sha256 `45590c5f498401aec4b6721fd4b8280dc333ae9bafbc961ec352093aa6dc9d40`. Chưa đưa lên GitHub Release |
| Máy | Intel Xeon 2.20 GHz, 4 vCPU (`cpu.max` 400000/100000), 31 GiB RAM |
| Phần mềm | Node 24.22.0, k6 1.3.0, PostgreSQL 15.19 (bản dựng sẵn `@embedded-postgres/linux-x64`), psutil 5.9.5 |
| Cấu hình | `NODE_ENV=production`, `BCRYPT_ROUNDS=12`, `UV_THREADPOOL_SIZE=4`; Postgres mặc định (`shared_buffers` 128 MB, `max_connections` 100, `fsync` và `synchronous_commit` bật) |
| Đối soát (`report-full.json`) | 60/60 lượt và mọi lượt làm nóng pass, lỗi 0% ở mọi ô |
| Bài rút vượt số dư | 10 lần 201, 10 lần 409 `INSUFFICIENT_FUNDS`, số dư 0, 10 dòng sổ cái DEBIT |

Chạy offline vì tài khoản Kaggle không bật được Internet. So với pha 1 khác ba chỗ: Postgres không cài từ PGDG mà dùng bản dựng sẵn cùng phiên bản 15.19, migration áp bằng file SQL thay cho `prisma migrate deploy`, psutil 5.9.5 thay cho 7.2.2. Lượt "sau" của P2-02, P2-03 phải chạy cùng cách này.

## Bảng trung vị

Trung vị của 3 lần mỗi ô; `p95_min` và `p95_max` cho thấy độ dao động. CPU 100% là một vCPU. `mixed` có hai dòng, cột `vus` ghi tổng 60 (40 đăng nhập, 20 xem danh sách). `api_rss_max_mib` là RSS lớn nhất của tiến trình API, tiến trình sống suốt đợt đo nên con số gần như không đổi.

| workload | vus | rps | p50_ms | p95_ms | p99_ms | error_pct | api_cpu_avg_pct | pg_cpu_avg_pct | api_rss_max_mib | p95_min | p95_max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| debit | 1 | 9.00 | 9.76 | 11.13 | 14.05 | 0.00 | 5.30 | 1.63 | 466.57 | 10.65 | 13.27 |
| debit | 5 | 44.94 | 9.82 | 11.95 | 19.26 | 0.00 | 22.34 | 7.92 | 466.57 | 11.67 | 12.45 |
| debit | 20 | 125.74 | 28.42 | 215.90 | 426.96 | 0.00 | 63.48 | 28.35 | 466.90 | 148.95 | 236.18 |
| debit | 50 | 122.15 | 313.33 | 359.46 | 394.42 | 0.00 | 61.26 | 28.41 | 466.90 | 357.80 | 479.57 |
| debit_spread | 5 | 44.31 | 11.32 | 16.46 | 20.88 | 0.00 | 16.05 | 7.61 | 466.87 | 16.39 | 20.08 |
| debit_spread | 20 | 175.07 | 11.62 | 22.08 | 29.50 | 0.00 | 59.46 | 29.90 | 466.87 | 18.87 | 22.35 |
| transfer | 5 | 43.42 | 13.42 | 18.93 | 23.00 | 0.00 | 29.46 | 15.87 | 466.87 | 17.59 | 19.95 |
| transfer | 20 | 161.03 | 20.19 | 41.16 | 62.57 | 0.00 | 89.70 | 62.58 | 466.87 | 40.48 | 43.13 |
| transfer | 50 | 185.10 | 161.37 | 232.56 | 277.40 | 0.00 | 101.05 | 75.85 | 466.82 | 230.10 | 387.32 |
| list | 1 | 9.55 | 3.31 | 3.77 | 4.23 | 0.00 | 2.97 | 1.00 | 465.45 | 3.75 | 3.79 |
| list | 5 | 47.57 | 3.62 | 5.04 | 7.11 | 0.00 | 11.70 | 4.73 | 465.45 | 4.83 | 5.16 |
| list | 20 | 189.52 | 3.88 | 6.46 | 12.81 | 0.00 | 44.07 | 17.81 | 465.45 | 6.37 | 6.82 |
| list | 50 | 459.47 | 5.90 | 17.04 | 36.43 | 0.00 | 94.82 | 41.41 | 465.41 | 15.74 | 17.41 |
| list | 100 | 540.48 | 82.72 | 104.59 | 131.84 | 0.00 | 105.71 | 46.91 | 465.41 | 102.75 | 109.75 |
| login | 1 | 2.54 | 292.34 | 295.57 | 299.49 | 0.00 | 73.07 | 0.16 | 462.70 | 294.87 | 296.87 |
| login | 5 | 11.04 | 347.35 | 376.22 | 404.31 | 0.00 | 368.88 | 0.56 | 462.70 | 373.90 | 376.36 |
| login | 20 | 11.39 | 1639.42 | 1724.68 | 1750.24 | 0.00 | 387.71 | 0.68 | 462.70 | 1674.88 | 1846.19 |
| login | 40 | 11.52 | 3356.16 | 3426.67 | 3456.40 | 0.00 | 387.76 | 0.65 | 462.70 | 3413.14 | 3430.41 |
| login | 80 | 11.55 | 6814.87 | 6891.08 | 6949.16 | 0.00 | 389.90 | 0.55 | 462.70 | 6847.82 | 7035.78 |
| mixed:login | 60 | 9.41 | 4174.85 | 4357.01 | 4434.64 | 0.00 | 352.25 | 15.34 | 462.70 | 4316.69 | 4382.42 |
| mixed:list | 60 | 156.43 | 16.19 | 45.19 | 63.20 | 0.00 | 352.25 | 15.34 | 462.70 | 42.11 | 46.36 |

## Nhận xét

Chỉ đọc từ bảng trên, chưa phải kết luận kiến trúc.

- **Tài khoản nóng (cho P2-02).** Cùng 20 VU, rút trên một tài khoản có p95 216 ms, rải trên 20 tài khoản chỉ 22 ms và throughput cao hơn (175 so với 126 req/s). CPU app và Postgres hai ô gần bằng nhau (khoảng 60% và 29%). Vậy độ trễ đuôi đến từ chờ khoá dòng, không phải chi phí ghi. Từ 20 lên 50 VU throughput đứng ở khoảng 122 req/s, p50 tăng từ 28 lên 313 ms: hàng chờ khoá đã bão hoà. Đây là mốc "trước" của P2-02 (ô `debit` 5, 20, 50 VU).
- **Đăng nhập (cho P2-03).** Bão hoà ở 11.5 req/s, CPU app khoảng 388%, gần kín 4 vCPU, khớp pha 1 (11.7 req/s). Từ 20 VU trở lên độ trễ tăng tuyến tính theo số client, 80 VU p99 6.95 s.
- **Tải đăng nhập làm chậm endpoint khác.** Xem danh sách 20 VU chạy riêng có p95 6.5 ms. Khi chạy cùng 40 VU đăng nhập (`mixed:list`), p95 lên 45 ms và p50 từ 3.9 lên 16 ms. Theo điều kiện trong `phase2-tasks.json`, P2-03 phải giảm cả p95 của `mixed:list`, không chỉ độ trễ đăng nhập.
- **Chuyển khoản.** 20 VU p95 41 ms. Tới 50 VU p95 233 ms, CPU app khoảng 101% và CPU Postgres 76%.
- **Xem danh sách ở tải cao.** Mở rộng gần tuyến tính tới 50 VU (459 req/s, p95 17 ms). Ở 100 VU throughput chỉ lên 540 req/s, p50 nhảy lên 83 ms, CPU app khoảng 106%. Chuyển khoản 50 VU cũng dừng quanh 100% CPU app. Có thể một tiến trình Node đã chạm trần một lõi cho phần JavaScript (bcrypt chạy trên threadpool nên không bị trần này). Chưa có số đo riêng event loop để khẳng định, ghi lại làm ứng viên cho đợt sau, ngoài phạm vi P2-02 và P2-03.
- **So với pha 1.** Rút tiền 20 VU một tài khoản: pha 1 p95 324 ms, 99 req/s; v2 p95 216 ms, 126 req/s. Hai đợt khác commit (`a4a0f83` so với `0a12ec5`) và khác cách cài Postgres, nên chỉ so trong cùng protocol v2.
