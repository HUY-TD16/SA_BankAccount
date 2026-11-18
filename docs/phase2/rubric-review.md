# Bảng chấm khi review PR pha 2

Chấm từng dòng 0, 1 hoặc 2. Dòng nào 0 thì PR chưa merge được, bất kể tổng điểm.

| Tiêu chí | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Đúng nghiệp vụ tiền | Phá một bất biến trong `AGENTS.md` hoặc không có test chứng minh | Có test nhưng thiếu trường hợp đồng thời hoặc lỗi | Có test cả đường thành công, đường lỗi và đồng thời; integration hoặc e2e xanh |
| Bằng chứng | Không có lệnh xác minh nào được chạy | Chạy một phần, hoặc chỉ có output tự báo | Mọi lệnh trong `verification` đã chạy, CI xanh, evidence trỏ tới nguồn kiểm lại được |
| Số đo trước và sau | Không có số, hoặc số khác máy, khác kịch bản | Có số nhưng thiếu trung vị 3 lần hoặc thiếu đối soát | Đúng [giao-thuc-do.md](giao-thuc-do.md), có commit SHA và link notebook |
| Lý do kiến trúc | Không có ADR | ADR có một phương án, không nói đánh đổi | ADR so sánh ít nhất hai phương án, nói rõ đánh đổi và lý do chọn |
| Ranh giới lớp | `check:harness` đỏ, hoặc logic nghiệp vụ nằm trong controller hay adapter | Đúng lớp nhưng có trùng lặp hoặc port thừa | Đúng lớp, thay đổi nhỏ nhất đủ dùng |
| Hợp đồng API | Đổi đường dẫn, mã lỗi hoặc envelope mà không có ADR | Đổi có ADR nhưng Swagger chưa cập nhật | Không đổi, hoặc đổi có ADR và `test:swagger` xanh |
| Trạng thái sạch | Thiếu file tiến độ, còn file rác, task JSON sai trạng thái | Có nhưng thiếu bước tiếp theo | Đủ checklist trong [quy-trinh.md](quy-trinh.md) |

Ghi điểm và nhận xét vào comment PR. Nhận xét đã gặp ở PR trước thì ghi rõ "lặp lại" để người viết biến nó thành kiểm tra tự động.
