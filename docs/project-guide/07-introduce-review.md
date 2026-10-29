# Đối chiếu tài liệu giới thiệu

[Mục lục](README.md) · [README dự án](../../README.md)

## 1. Nguồn và phạm vi

[introduce.md](../introduce.md) mô tả phạm vi đề tài, công nghệ, 8 use case, 9 endpoint và các quy tắc về số dư, chuyển tiền, quyền sở hữu. Bảng dưới đối chiếu nội dung này với cấu hình và hành vi ứng dụng.

## 2. Nội dung đối chiếu

| Chủ đề | Nội dung trong introduce.md | Thông tin trong mã nguồn và cấu hình |
| --- | --- | --- |
| Bài toán | Có chức năng và mục tiêu đúng đắn về tiền | Bổ sung ví dụ race condition, rollback, retry; phân biệt mô phỏng với tiền thật |
| Công nghệ | Ghi PostgreSQL 16 và k6 | Đối chiếu Compose dùng PostgreSQL 15; k6/load test chưa triển khai |
| Kiến trúc | Chủ yếu một câu mô tả và ảnh nhúng base64 | Nêu modular monolith, port/adapter, DI, trách nhiệm module; sơ đồ Mermaid và sequence |
| Dữ liệu | Có nguyên tắc tiền nhưng thiếu mô hình dữ liệu | Thêm 4 thực thể, ERD, từ điển bảng và constraint |
| Endpoint | Danh sách đủ các route chính | Bổ sung payload, phân trang, quy ước response và phân biệt ID/số tài khoản |
| API lỗi | Lỗi 500 mô tả là chỉ trả requestId | Thực tế còn có success=false và error.code/message an toàn; ghi rõ envelope |
| Idempotency | Dễ tạo cảm giác chống lặp hoàn chỉnh | Nêu phạm vi nguồn+key, chưa so payload; không áp dụng cho nạp/rút |
| Bất biến lịch sử | Nêu không sửa/xóa tuyệt đối | Làm rõ API không hỗ trợ; chưa có trigger cấm sửa/xóa trực tiếp ở DB |
| Đóng tài khoản | Thiếu hành vi gọi lại và đọc lịch sử | Ghi rõ 204 khi đóng lại; vẫn xem được lịch sử của mình |
| Khởi chạy | Chưa có | Thêm Docker quickstart; local/config/demo đặt ở tài liệu riêng |
| Kiểm thử | Liệt kê công cụ, chưa tách trạng thái hoàn thành | Tách unit, integration, Swagger, HTTP E2E; không khẳng định có kết quả tải |
| Trình bày | Escape dấu câu, tiêu đề rỗng, ảnh base64 khó review | Markdown thuần, bảng ngắn, Mermaid và liên kết tương đối |

Ảnh base64 trong Markdown làm file nguồn lớn và khó đọc diff; một số trình render có thể không hiển thị data URI. Mermaid phù hợp để duy trì sơ đồ kiến trúc cùng mã nguồn; nếu nơi xem không hỗ trợ Mermaid có thể xuất thêm SVG/PNG sau.

## 3. Phân bổ nội dung README

README mới đặt mục tiêu lượng nội dung tương đương khoảng 4–5 trang đọc/in thông thường: bài toán và công nghệ; kiến trúc; dữ liệu và nghiệp vụ; API; khởi chạy và chỉ dẫn đọc tiếp. Đây là mục tiêu độ dài, không phải số trang cố định: Markdown không có phân trang, số trang thực phụ thuộc font, khổ giấy, lề và cách render bảng/sơ đồ.

Thông tin đủ để trả lời nhanh: dự án giải quyết gì, ai sử dụng, dùng công nghệ nào, tổ chức ra sao, có API gì, chạy thế nào, và còn thiếu gì. Quy trình setup chi tiết, bảng dữ liệu đầy đủ, từng request/response và các nhánh nghiệp vụ được đặt ở tài liệu chuyên đề.

Nếu cần bản nộp đúng 4 hoặc 5 trang A4, nên xuất một bản PDF với cấu hình trang cố định và kiểm tra bố cục riêng; không ép README bằng các ngắt trang tùy tiện gây khó đọc trên repository.

## 4. Nguyên tắc duy trì

Mã nguồn và migration là cơ sở mô tả hành vi hiện tại; thiết kế gốc là cơ sở đối chiếu yêu cầu. Khi có khác biệt, ghi rõ giới hạn hoặc phần chưa triển khai. Thay endpoint cần cập nhật DTO/Swagger và API guide; thay tiền/trạng thái cần cập nhật business guide; thay schema/constraint cần cập nhật database guide.

Bản introduce.md được giữ nguyên để lưu lại tài liệu đầu vào. Không chỉnh mã nghiệp vụ chỉ để làm cho tài liệu trông đầy đủ hơn.
