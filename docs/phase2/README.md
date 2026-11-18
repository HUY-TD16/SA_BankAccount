# Pha 2

Pha 2 lấy hệ thống pha 1 làm nền, tìm điểm nghẽn bằng số đo, đề xuất kiến trúc để cải thiện thuộc tính chất lượng, rồi đo lại để chứng minh. Mọi số đo chạy trên cùng một cấu hình Kaggle CPU.

## Đọc theo thứ tự

1. [danh-gia.md](danh-gia.md): hệ thống đang mạnh ở đâu, yếu ở đâu, số liệu nào chứng minh.
2. [giao-thuc-do.md](giao-thuc-do.md): đo thế nào để số trước và sau so được với nhau.
3. [quy-trinh.md](quy-trinh.md): nhận task, làm, xác minh, review, bàn giao.
4. [rubric-review.md](rubric-review.md): bảng chấm khi review PR.
5. [adr/](adr/): các quyết định kiến trúc đã chốt.

## Task và người làm

Nguồn sự thật là [`phase2-tasks.json`](../../phase2-tasks.json) ở gốc repo. File đó ghi người nhận, nhánh, trạng thái, lệnh xác minh và bằng chứng của từng task. Bảng dưới chỉ để đọc nhanh, nếu lệch thì tin file JSON.

| Task | Việc | Phụ thuộc |
| --- | --- | --- |
| P2-00 | Harness và CI | |
| P2-01 | Đo lại baseline với kịch bản đầy đủ hơn | P2-00 |
| P2-02 | Giảm tranh chấp ghi trên tài khoản nóng | P2-01 |
| P2-03 | Cách ly tải đăng nhập | P2-01 |
| P2-04 | Health endpoint | P2-00 |
| P2-05 | Báo cáo trước và sau | P2-02, P2-03, P2-04 |

P2-02 và P2-03 cần số baseline v2 làm mốc "trước", nên P2-01 phải xong trước khi hai task này được tính là `active`. Trong lúc chờ, người nhận P2-02 hoặc P2-03 vẫn có thể viết ADR nháp và đọc code.

## Tiến độ từng task

Mỗi task có một file riêng trong [progress/](progress/), tạo từ [progress/_mau.md](progress/_mau.md). Mỗi người chỉ sửa file của task mình nên không bị xung đột khi merge.
