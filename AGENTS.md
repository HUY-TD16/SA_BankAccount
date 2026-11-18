# AGENTS.md

Hướng dẫn cho người và coding agent làm việc trên repo này trong pha 2. File này chỉ là bản đồ. Chi tiết nằm trong các tài liệu được liên kết bên dưới.

## Repo này là gì

Backend quản lý tài khoản ngân hàng: đăng ký, đăng nhập, mở tài khoản, nạp, rút, chuyển khoản, sao kê. NestJS 12, Prisma 7, PostgreSQL 15. Kiến trúc modular monolith, mỗi module chia `domain`, `application`, `infrastructure`, `presentation`.

Pha 2 của môn Kiến trúc phần mềm: nhóm nhận lại hệ thống này, đánh giá, đề xuất kiến trúc mới cho các điểm nghẽn đã đo được, rồi đo lại trước và sau trên cùng phần cứng Kaggle CPU.

## Khi bắt đầu một phiên

1. `pwd` phải là thư mục gốc repo. `git status` phải sạch hoặc chỉ có việc của bạn.
2. Đọc `phase2-tasks.json` để biết task nào đang `active`, của ai, nhánh nào.
3. Đọc file tiến độ của task mình: `docs/phase2/progress/<task-id>.md`.
4. `git log --oneline -5`.
5. Chạy `./init.sh`. Nếu nó báo đỏ, sửa nền trước khi làm thêm gì.
6. Chỉ làm một task cho tới khi nó `passing` hoặc ghi rõ lý do `blocked`.

## Lệnh chuẩn

| Việc | Lệnh |
| --- | --- |
| Cài và kiểm tra nhanh | `./init.sh` (Windows: chạy trong Git Bash) |
| Chạy app ở máy | `cp .env.example .env`, điền giá trị, `npx prisma migrate deploy`, `npm run start:dev`, mở `http://localhost:3000/api/docs` |
| Unit test | `npm test -- --runInBand` |
| Kiểm tra harness (task list, ranh giới lớp) | `npm run check:harness` |
| Hợp đồng Swagger | `npm run test:swagger` |
| Integration test | `DATABASE_URL=<db_test> npx prisma migrate deploy && DATABASE_URL=<db_test> npx jest --config jest.integration.config.js --runInBand` |
| E2E HTTP | `E2E_DATABASE_URL=<db_test> npm run test:e2e` |
| Đo tải | notebook `docs/performance/kaggle-load-test.ipynb` trên Kaggle CPU, xem `docs/phase2/giao-thuc-do.md` |

Notebook Kaggle ghim `REPO_URL` và `COMMIT` ở ô đầu. Đo nhánh nào thì đổi hai biến này sang fork của nhóm và đúng SHA đó, nếu không sẽ đo nhầm code cũ.

`<db_test>` là chuỗi kết nối tới một database có tên kết thúc bằng `_test`. Test sẽ xoá dữ liệu trong đó. `./init.sh --db` chạy luôn integration và e2e nếu đã đặt `DATABASE_URL`.

## Bản đồ tài liệu

- `docs/phase2/README.md`: mục lục pha 2, phân công, cách làm việc.
- `docs/phase2/danh-gia.md`: đánh giá hệ thống hiện tại, điểm nghẽn có số liệu.
- `docs/phase2/giao-thuc-do.md`: cách đo trước và sau để so sánh được.
- `docs/phase2/quy-trinh.md`: hợp đồng task, kiểm tra trạng thái sạch, bàn giao.
- `docs/phase2/rubric-review.md`: người review chấm theo bảng này.
- `docs/phase2/adr/`: mỗi quyết định kiến trúc một file.
- `docs/project-guide/01-architecture.md`: kiến trúc gốc và luồng tiền.
- `docs/project-guide/04-business-rules.md`: luật nghiệp vụ.
- `docs/performance/phase1-load-test.md`: số liệu nền từ pha 1.

## Bất biến không được phá

Các thay đổi kiến trúc pha 2 phải giữ nguyên những điều sau. Test hiện có đã kiểm tra phần lớn, đừng sửa test để nó qua.

- Số dư không bao giờ âm. Rút hoặc chuyển vượt số dư trả `409 INSUFFICIENT_FUNDS`.
- Mỗi giao dịch thành công có đúng một dòng sổ cái tương ứng trong `financial_transactions`.
- Chuyển khoản là nguyên tử: trừ nguồn, cộng đích, ghi `transfers` và hai dòng sổ cái cùng commit hoặc cùng rollback.
- Gửi lại cùng `Idempotency-Key` không trừ tiền lần hai.
- Tiền là `bigint` trong code, `DECIMAL(18,0)` trong DB, chuỗi trong JSON. Không dùng `number` cho tiền.
- Khoá hai tài khoản theo thứ tự UUID tăng dần để tránh deadlock.
- Đăng nhập với email không tồn tại vẫn tốn thời gian như email có thật.
- Không hạ `BCRYPT_ROUNDS` để lấy số đẹp. Đó là đổi bảo mật, không phải kiến trúc.
- `domain` không import framework hay hạ tầng. `application` không import `infrastructure`, `presentation`, Prisma, bcrypt, jsonwebtoken. `npm run check:harness` kiểm tra điều này.

## Hợp đồng làm việc

- Mỗi người một task `active` tại một thời điểm (WIP=1). `npm run check:harness` sẽ báo lỗi nếu vượt.
- Một task chỉ chuyển sang `passing` khi lệnh xác minh của nó đã chạy thật và kết quả được ghi vào `evidence`. Sửa code xong chưa phải là xong.
- Mọi cải tiến hiệu năng phải có số đo trước và sau theo `docs/phase2/giao-thuc-do.md`, cùng phần cứng, cùng kịch bản. Không bịa số, không lấy số từ máy cá nhân để so với số Kaggle.
- Thay đổi kiến trúc nào cũng có ADR trong `docs/phase2/adr/` trước khi merge.
- Người viết code không tự duyệt. Một thành viên khác review theo `docs/phase2/rubric-review.md`.
- Không đổi hợp đồng API (đường dẫn, mã lỗi, envelope) nếu nhóm chưa thống nhất trong ADR.
- Nhận xét review lặp lại lần thứ hai thì biến nó thành test hoặc thêm vào script kiểm tra, đừng chỉ nhắc lại.
- Không commit `.env`, mật khẩu, khoá JWT, file zip kết quả đo mới. Kết quả đo để trên Kaggle hoặc release, trong repo chỉ giữ bảng tổng hợp.

## Khi kết thúc phiên

Đi qua `docs/phase2/quy-trinh.md` mục "Trạng thái sạch". Tối thiểu:

1. `npm test -- --runInBand` và `npm run check:harness` xanh.
2. Cập nhật `docs/phase2/progress/<task-id>.md`: đã làm gì, đã xác minh gì, còn gì, bước tiếp theo.
3. Cập nhật `status` và `evidence` trong `phase2-tasks.json` nếu có thay đổi.
4. Commit phần đã an toàn. Không để file tạm, log, dump DB trong cây thư mục.
