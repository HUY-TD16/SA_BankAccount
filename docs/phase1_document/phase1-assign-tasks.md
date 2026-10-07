# Chia việc

## Lộ trình Pha 1 (sau khi xong phần chung) — nhóm 3 người, còn \~6 tuần

Dựa theo 8 use case đã chốt ở `phase1-scope-reduced.md` và cách chia module đã bàn (A=identity, B=accounts, C=money-movement). Nguyên tắc xuyên suốt: **không mở mốc mới nếu mốc trước chưa qua "cổng chất lượng"** — đúng tinh thần blueprint gốc.

| Tuần | Mốc | Ai làm | Deliverable | Cổng chất lượng để qua tuần sau |
| :---- | :---- | :---- | :---- | :---- |
| **2** | Identity (UC-01, UC-02) | **A** | `POST /auth/register`, `POST /auth/login`, JWT ký/verify qua `TokenServicePort` | Unit test AuthService \+ e2e register→login→duplicate email pass |
| **2** | Account cơ bản (UC-03, UC-04) | **B** | `POST/GET /accounts`, `GET /accounts/:id` | Unit test ownership (user A không đọc được account của B) |
| **2** | Money-movement khung sườn | **C** | Domain entity, DTO, use case viết theo TDD với **fake `AccountRepositoryPort`** (chưa cần chờ B code thật xong, chỉ cần interface đã chốt) | Unit test `Money`, insufficient funds logic pass trên fake port |
| **3** | Đóng account (UC-07) | **B** | `DELETE /accounts/:id` (logic close) | Test: balance ≠ 0 → 409; đã CLOSED → không nạp/rút được |
| **3** | Nạp/rút tiền (UC-05, UC-06) | **C** | `POST/GET /accounts/:id/transactions`, row lock `SELECT FOR UPDATE` | Integration test: 2 request DEBIT đồng thời → balance không âm (chạy thật trên Postgres, không phải fake) |
| **3** | Identity đã xong → hỗ trợ B/C hoặc làm Swagger \+ `test/helpers` | **A** | Auth helper cho test (lấy token nhanh), DB reset helper | Cả 3 người dùng chung helper này cho integration test |
| **4** | Chuyển tiền (UC-08) | **C** | `POST /transfers`, lock 2 account theo ID tăng dần, idempotency key | Integration test: transfer đồng thời 2 chiều không deadlock; retry cùng key không tạo tiền lần 2 |
| **4** | Polish \+ review chéo | Cả 3 | Review PR lẫn nhau, thống nhất lại error code nếu lệch | Không còn PR nào đang mở quá 2 ngày |
| **5** | Integration test toàn hệ thống | Cả 3 (chia theo module mình phụ trách) | Test rollback giữa chừng, ownership 404 cho mọi resource, idempotency replay | Toàn bộ invariant ở mục 4.6 tài liệu domain/db (không account nào âm, tổng tiền transfer không đổi...) có test pass |
| **5** | E2E full flow | 1 người tổng hợp | `register → login → open → deposit → withdraw → transfer → history → close` chạy qua HTTP thật | Kịch bản demo chạy được từ đầu tới cuối không lỗi |
| **5** | Swagger hoàn thiện | A hoặc B | `/api/docs` đủ tất cả 8 endpoint, ví dụ request/response, mã lỗi | Swagger UI mở được, khớp response thực tế |
| **6** | Load test Kaggle CPU | 1 người phụ trách | k6 script: login, list account, concurrent debit | Có báo cáo p50/p95/p99, error rate, làm baseline cho Pha 2 |
| **6** | README \+ docs | Cả 3 (mỗi người viết phần module mình) | Scope, ERD, sơ đồ kiến trúc, hướng dẫn Docker, link Swagger | `docker compose up --build` chạy được trên máy sạch (nhờ người khác test thử, không tự test máy mình) |
| **7** | Buffer \+ sửa lỗi | Cả 3 | Dọn bug phát sinh từ load test/integration test | Không còn lỗi nghiêm trọng (âm balance, mất tiền, lỗi 500 không rõ nguyên nhân) |
| **7** | Rà lại Definition of Done | Cả 3 | Đối chiếu checklist mục 7 `phase1-scope-reduced.md` | Tick đủ hết checklist trước khi nộp/demo |

**Vài lưu ý quan trọng:**

- **C (money-movement) là người nặng việc nhất và phụ thuộc B** — nên cho C bắt đầu viết use case \+ unit test bằng **fake port** ngay từ tuần 2, không ngồi chờ B code xong thật mới bắt đầu.  
- **A xong sớm nhất** (identity chỉ 2 endpoint) — nên chủ động gánh phần việc chung còn thiếu (Swagger, test helper, README) thay vì rảnh tay giữa chừng.  
- Tuần 5 là **tuần rủi ro nhất** — nơi bug tích hợp giữa 3 module lộ ra nhiều nhất (ownership, transaction boundary). Đừng dồn tuần 5 làm cả load test lẫn integration test cùng lúc nếu thấy đang trễ — ưu tiên integration test đúng trước, load test có thể lùi sang đầu tuần 6\.