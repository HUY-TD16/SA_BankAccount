# Pha 2

Pha 2 lấy hệ thống pha 1 làm nền, tìm điểm nghẽn bằng số đo, đề xuất kiến trúc để cải thiện thuộc tính chất lượng, rồi đo lại để chứng minh. Mọi số đo chạy trên cùng một cấu hình Kaggle CPU.

## Đọc theo thứ tự

1. [danh-gia.md](danh-gia.md): hệ thống đang mạnh ở đâu, yếu ở đâu, số liệu nào chứng minh.
2. [giao-thuc-do.md](giao-thuc-do.md): đo thế nào để số trước và sau so được với nhau.
3. [quy-trinh.md](quy-trinh.md): nhận task, làm, xác minh, review, bàn giao.
4. [rubric-review.md](rubric-review.md): bảng chấm khi review PR.
5. [adr/](adr/): các quyết định kiến trúc đã chốt.
6. [lich.md](lich.md): lịch 3 tuần, mốc, review chéo.

## Task và người làm

Nguồn sự thật là [`phase2-tasks.json`](../../phase2-tasks.json) ở gốc repo. File đó ghi người nhận, nhánh, trạng thái, lệnh xác minh và bằng chứng của từng task. Bảng dưới chỉ để đọc nhanh, nếu lệch thì tin file JSON.

| Task | Việc | Người | Phụ thuộc |
| --- | --- | --- | --- |
| P2-00 | Harness và CI | Đạt | |
| P2-01 | Đo lại baseline với kịch bản đầy đủ hơn | Đạt | P2-00 |
| P2-02 | Giảm tranh chấp ghi trên tài khoản nóng | Chiến | P2-01 |
| P2-03 | Cách ly tải đăng nhập | Hải | P2-01 |
| P2-04 | Health endpoint | Chiến | P2-00 |
| P2-05 | Báo cáo trước và sau | Đạt | P2-02, P2-03, P2-04 |

Thứ tự: Đạt làm P2-01, Chiến làm P2-04, Hải viết ADR nháp cho P2-03. Khi P2-01 passing, Chiến chuyển sang P2-02 và Hải bắt đầu code P2-03.

P2-02 và P2-03 cần số baseline v2 làm mốc "trước", nên P2-01 phải xong trước khi hai task này được tính là `active`. Trong lúc chờ, người nhận P2-02 hoặc P2-03 vẫn có thể viết ADR nháp và đọc code.

## Tiến độ từng task

Mỗi task có một file riêng trong [progress/](progress/), tạo từ [progress/_mau.md](progress/_mau.md). Mỗi người chỉ sửa file của task mình nên không bị xung đột khi merge.
