# Tài liệu chi tiết — SA Bank Account

[README dự án](../../README.md)

Bộ tài liệu mô tả kiến trúc, dữ liệu, hợp đồng API, quy tắc nghiệp vụ và cách vận hành SA Bank Account. Nội dung tham chiếu tới controller, DTO, use case, Prisma schema, migration và cấu hình chạy.

| Tài liệu | Nội dung | Đối tượng đọc |
| --- | --- | --- |
| [01 — Kiến trúc](01-architecture.md) | Module, các lớp, dependency, transaction và luồng request | Người đánh giá thiết kế, lập trình viên |
| [02 — Database](02-database.md) | ERD, từ điển dữ liệu, index, constraint, migration | Người phát triển và quản lý dữ liệu |
| [03 — API](03-api.md) | Đầy đủ 9 endpoint, request/response, lỗi, phân trang | Người tích hợp client, kiểm thử |
| [04 — Nghiệp vụ](04-business-rules.md) | Use case, điều kiện, kết quả, retry và tình huống đồng thời | Người tìm hiểu bài toán |
| [05 — Chạy dự án](05-running.md) | Docker, môi trường local, demo PowerShell | Người chạy thử |
| [06 — Kiểm thử](06-testing.md) | Unit, integration, Swagger contract và HTTP E2E | Người kiểm chứng hệ thống |

Lộ trình đọc: README → nghiệp vụ → kiến trúc → database. Khi cần chạy demo, đọc phần chạy dự án rồi dùng tài liệu API. Các lệnh shell đều chạy tại thư mục gốc repository, trừ khi ghi rõ khác.

Nguồn kiểm chứng chính: [src](../../src), [schema](../../prisma/schema.prisma), [migration](../../prisma/migrations), [scripts](../../package.json), [test](../../test). Khi thay đổi endpoint hoặc nghiệp vụ, cập nhật tài liệu tương ứng và Swagger cùng lần thay đổi mã nguồn.
