# Quy trình làm việc pha 2

## Nhận task

1. Chọn task `not_started` có mọi phụ thuộc đã `passing` trong `phase2-tasks.json`.
2. Điền `owner`, `branch`, đổi `status` thành `active`. Nhánh đặt theo dạng `p2-02/ten-ngan`.
3. Chép `docs/phase2/progress/_mau.md` thành `docs/phase2/progress/<task-id>.md`, điền mục "Hợp đồng".
4. `npm run check:harness` phải xanh. Mở PR nháp sớm để nhóm thấy hướng đi.

Mỗi người một task `active`. Muốn đổi việc thì chuyển task cũ về `blocked` (ghi `blocked_reason`) hoặc `not_started`.

## Hợp đồng task

Trước khi viết code, mục "Hợp đồng" trong file tiến độ phải trả lời được:

- Làm xong thì hệ thống khác trước ở hành vi nào, quan sát được bằng cách nào.
- Lệnh hoặc bước nào chứng minh điều đó. Chép từ `verification` trong JSON, bổ sung nếu cần.
- Số "trước" lấy từ đâu, mục tiêu "sau" là gì.
- Ngoài phạm vi: những gì không làm trong task này.

Với task đổi kiến trúc (P2-02, P2-03, P2-04), viết ADR nháp trong `docs/phase2/adr/` cùng lúc, có ít nhất hai phương án.

## Trong lúc làm

- Commit nhỏ, mỗi commit build được và unit test xanh.
- Thêm test cho hành vi mới trước hoặc cùng lúc với code. Không sửa test cũ cho nó qua; nếu test cũ sai, ghi lý do trong commit.
- Gặp quyết định ngoài phạm vi (đổi API, đổi schema dùng chung, đổi cấu hình đo): dừng, ghi vào file tiến độ, hỏi nhóm.

## Đánh dấu passing

Chỉ khi:

1. Mọi lệnh trong `verification` đã chạy thật và ra đúng kết quả.
2. `evidence` có link tới CI xanh, link notebook Kaggle, file bảng số, hoặc đoạn output, tuỳ task.
3. ADR (nếu có) đã được người review đồng ý.
4. PR đã có một người khác review theo [rubric-review.md](rubric-review.md).

`npm run check:harness` chặn `passing` không có `evidence`, nhưng không đọc được evidence có thật hay không. Phần đó do người review kiểm.

## Trạng thái sạch khi kết thúc phiên

- [ ] `npm run build` xanh.
- [ ] `npm test -- --runInBand` xanh.
- [ ] `npm run check:harness` xanh.
- [ ] Nếu đã đụng tới repository, transaction hoặc migration: integration và e2e xanh (`./init.sh --db`).
- [ ] File tiến độ ghi: đã làm gì, đã xác minh gì bằng lệnh nào, còn lỗi gì, bước tiếp theo.
- [ ] `phase2-tasks.json` đúng trạng thái thật.
- [ ] Không còn file tạm, log, dump DB, zip kết quả đo, `.env` trong `git status`.
- [ ] Người khác clone nhánh, chạy `./init.sh`, đọc file tiến độ là làm tiếp được.

## Bàn giao

Khi chuyển task cho người khác hoặc dừng lâu, thêm mục "Bàn giao" cuối file tiến độ: trạng thái hiện tại, những gì đã chứng minh, những gì chưa, lỗi đã biết, việc nên làm tiếp theo, file nên đọc trước.

## Review

Người viết code không tự duyệt PR của mình. Người review chạy lại ít nhất một lệnh trong `verification` trên máy mình hoặc đọc log CI, rồi chấm theo [rubric-review.md](rubric-review.md). Nhận xét nào xuất hiện lần thứ hai ở PR khác thì thêm vào `scripts/check-harness.mjs` hoặc thành test.
