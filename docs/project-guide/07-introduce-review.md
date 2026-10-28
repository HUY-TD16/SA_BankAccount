# Đối chiếu tài liệu giới thiệu

[Mục lục](README.md) · [README dự án](../../README.md)

## 1. Nguồn và phạm vi

[introduce.md](../introduce.md) mô tả phạm vi đề tài, công nghệ, 8 use case, 9 endpoint và các quy tắc về số dư, chuyển tiền, quyền sở hữu. Bảng dưới đối chiếu nội dung này với cấu hình và hành vi ứng dụng.

## 2. Nội dung đối chiếu

| Chủ đề | Nội dung trong introduce.md | Thông tin trong mã nguồn và cấu hình |
| --- | --- | --- |
| Database | PostgreSQL 16 | Docker Compose dùng PostgreSQL 15 |
| Kiểm thử | Jest và k6 | Các bộ test chạy được gồm Jest unit/integration, Swagger contract và HTTP E2E bằng Node test runner |
| Kiến trúc | Phân tầng theo module, nghiệp vụ sử dụng interface | Một ứng dụng NestJS gồm identity, accounts và money-movement; port được kết nối với adapter qua dependency injection |
| Lỗi nội bộ | Chỉ trả requestId | Response gồm success=false, error.code/message an toàn và meta.requestId |
| Idempotency | Gửi lại cùng key nhận kết quả cũ | Tra theo nguồn và key; luồng xử lý không so sánh payload/hash |
| Lịch sử giao dịch | Không sửa/xóa | API cung cấp thao tác ghi và đọc; database không có trigger cấm UPDATE/DELETE lịch sử |
| Đóng tài khoản | Đóng khi số dư bằng 0, giữ lịch sử | Cập nhật CLOSED và closedAt; gọi đóng lại trả 204, chủ tài khoản vẫn xem được lịch sử |

## 3. Phân bố nội dung

README trình bày bài toán, tính năng, công nghệ, kiến trúc tổng quan, endpoint và cách khởi chạy. Bộ project-guide cung cấp nội dung chi tiết theo chủ đề:

| Nội dung | Tài liệu |
| --- | --- |
| Module, lớp, dependency và luồng xử lý | [Kiến trúc](01-architecture.md) |
| ERD, cấu trúc bảng và ràng buộc | [Database](02-database.md) |
| Request, response, validation và mã lỗi | [API](03-api.md) |
| Use case, trạng thái tài khoản và retry | [Nghiệp vụ](04-business-rules.md) |
| Cấu hình môi trường, Docker và demo | [Chạy dự án](05-running.md) |
| Chuẩn bị database test và chạy các bộ kiểm thử | [Kiểm thử](06-testing.md) |

Sơ đồ trong bộ project-guide sử dụng Mermaid. File introduce.md được giữ làm tài liệu nguồn, gồm cả sơ đồ nhúng bằng data URI. Số trang khi in Markdown phụ thuộc khổ giấy, font, lề và trình render.
