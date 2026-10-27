# Tài liệu chi tiết — SA Bank Account

[README dự án](../../README.md)

Bộ tài liệu này giải thích triển khai hiện tại của Pha 1, đối chiếu trực tiếp với controller, DTO, use case, Prisma schema, migration và cấu hình chạy. Ngày rà soát: **27/10/2026**. Tài liệu thiết kế trong `docs/phase1_document` được giữ nguyên làm nguồn yêu cầu; tính năng chỉ có trong thiết kế hoặc placeholder không được tính là đã hoàn thành.

| Tài liệu | Nội dung | Đối tượng đọc |
| --- | --- | --- |
| [01 — Kiến trúc](01-architecture.md) | Module, các lớp, dependency, transaction và luồng request | Người đánh giá thiết kế, lập trình viên |
| [02 — Database](02-database.md) | ERD, từ điển dữ liệu, index, constraint, migration | Người phát triển và quản lý dữ liệu |
| [03 — API](03-api.md) | Đầy đủ 9 endpoint, request/response, lỗi, phân trang | Người tích hợp client, kiểm thử |
| [04 — Nghiệp vụ](04-business-rules.md) | Use case, điều kiện, kết quả, retry và tình huống đồng thời | Người tìm hiểu bài toán |
| [05 — Chạy dự án](05-running.md) | Docker, môi trường local, demo PowerShell | Người chạy thử |
| [06 — Kiểm thử](06-testing.md) | Unit, integration, HTTP E2E, tải và giới hạn | Người kiểm chứng hệ thống |
| [07 — Đánh giá introduce.md](07-introduce-review.md) | Điểm tốt, điểm thiếu, điều chỉnh để thành README | Người biên soạn tài liệu |

Lộ trình đọc: README → nghiệp vụ → kiến trúc → database. Khi cần chạy demo, đọc phần chạy dự án rồi dùng tài liệu API. Các lệnh shell đều chạy tại thư mục gốc repository, trừ khi ghi rõ khác.

Nguồn kiểm chứng chính: [src](../../src), [schema](../../prisma/schema.prisma), [migration](../../prisma/migrations), [scripts](../../package.json), [test](../../test). Khi thay đổi endpoint hoặc nghiệp vụ, cập nhật tài liệu tương ứng và Swagger cùng lần thay đổi mã nguồn.
