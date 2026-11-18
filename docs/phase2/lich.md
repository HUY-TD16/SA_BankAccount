# Lịch pha 2

Ba tuần, từ 18/11 đến 08/12/2026. Mỗi tuần kết thúc bằng một mốc. Tuần 3 là đệm: nếu chỉ có 2 tuần thì gộp phần đo tổng hợp và báo cáo vào 02/12 và 03/12.

Trạng thái thật của từng task nằm trong `phase2-tasks.json`. File này chỉ ghi kế hoạch.

## Tuần 1 (18/11 đến 24/11): có số baseline

Mốc M1 (24/11): baseline v2 và health endpoint đã vào `main`, ADR nháp của P2-02 và P2-03 đã có.

| Người | Việc | Hạn |
| --- | --- | --- |
| Đạt (P2-01) | Notebook đo fork của nhóm và đọc `kaggle-load.js` từ repo thay vì bản sao. Viết protocol v2, thêm kịch bản `transfer`, `debit_spread`, `mixed`. Chạy thử ít VU ở máy | 21/11 |
| Đạt (P2-01) | Chạy protocol v2 trên Kaggle, ưu tiên ô `debit` một tài khoản nóng và `login` cùng `mixed`. Viết `docs/performance/phase2-baseline.md` | 24/11 |
| Chiến (P2-04) | `/health/live`, `/health/ready`, test e2e, healthcheck của Dockerfile dùng endpoint mới. Mở PR | 21/11 |
| Chiến (P2-02) | Đọc luồng rút, nạp và `prisma-unit-of-work.ts`. ADR nháp so sánh một câu `UPDATE ... WHERE balance >= amount` với xếp hàng theo tài khoản | 24/11 |
| Hải (P2-03) | Đọc luồng đăng nhập và bcrypt. ADR nháp so sánh giới hạn đồng thời, trả 429 kèm `Retry-After`, hàng đợi có giới hạn | 21/11 |
| Hải (P2-03) | Làm thử trên nhánh, unit test cho phần giới hạn đồng thời. Task vẫn `not_started` tới khi P2-01 passing | 24/11 |

## Tuần 2 (25/11 đến 01/12): cải tiến và đo lại

Mốc M2 (01/12): P2-02 và P2-03 đã vào `main`, có số trước và sau, ADR đã duyệt.

| Người | Việc | Hạn |
| --- | --- | --- |
| Chiến (P2-02) | Chốt ADR theo số baseline. Code, thêm integration test đồng thời; bài 20 lệnh rút 10.000 trên số dư 100.000 vẫn ra đúng 10 thành công. Mở PR | 28/11 |
| Hải (P2-03) | Chốt ADR theo số `mixed`. Nếu tải đăng nhập không làm chậm endpoint khác thì mục tiêu là 429 nhanh và p99 thấp. Code, test, mở PR | 28/11 |
| Đạt | Review hai PR. Chạy đo "sau" trên Kaggle cho cả hai nhánh, cùng notebook, cùng người chạy. Dựng khung P2-05 | 01/12 |

## Tuần 3 (02/12 đến 08/12): đo tổng hợp và báo cáo

Mốc M3 (08/12): báo cáo hoàn chỉnh.

| Người | Việc | Hạn |
| --- | --- | --- |
| Đạt (P2-05) | Đo `main` khi đã có cả hai cải tiến, vì chúng có thể ảnh hưởng nhau. Viết báo cáo trước và sau | 05/12 |
| Chiến | Phần P2-02 và P2-04 trong báo cáo: vấn đề, phương án, số đo, đánh đổi | 05/12 |
| Hải | Phần P2-03 và demo: tải đăng nhập cao, request vượt ngưỡng nhận 429 ngay thay vì chờ 7 giây | 05/12 |
| Cả nhóm | Sửa theo review, đọc chéo báo cáo, `./init.sh --db` xanh trên `main` | 08/12 |

## Review chéo

| PR | Người review |
| --- | --- |
| P2-01 (Đạt) | Chiến |
| P2-04, P2-02 (Chiến) | Hải |
| P2-03 (Hải) | Chiến |

Đạt đọc thêm cả hai PR cải tiến vì là người chạy đo.

## Rủi ro

- P2-01 trễ thì P2-02 và P2-03 bị kẹt. Đạt chạy trước hai ô `debit` và `login` cùng `mixed` để hai người kia bắt đầu được.
- Kaggle cấp máy khác cấu hình. Lưu `lscpu` mỗi lần chạy; nếu khác thì đo lại cả số trước, không trộn.

## Họp

Tối thứ Hai, 15 phút. Mỗi người đọc file tiến độ của mình, cập nhật `phase2-tasks.json`, chạy `npm run check:harness`.
