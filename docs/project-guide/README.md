# Tài liệu kỹ thuật chi tiết - SA Bank Account

Mục lục tài liệu kỹ thuật dành cho giảng viên và thành viên nhóm phát triển, mô tả chi tiết kiến trúc, cơ sở dữ liệu, API và các quy trình vận hành hệ thống.

## Danh mục tài liệu chuyên đề

| STT | Tài liệu | Nội dung chính | Đối tượng tham khảo |
| :---: | :--- | :--- | :--- |
| **01** | [Kiến trúc hệ thống](01-architecture.md) | Phân tầng Clean Architecture, Hexagonal Architecture, Modular Monolith, quy trình Dependency Injection và sơ đồ luồng request. | Đánh giá thiết kế, lập trình viên |
| **02** | [Thiết kế cơ sở dữ liệu](02-database.md) | Sơ đồ quan hệ thực thể, từ điển dữ liệu 4 bảng chính, chỉ mục index và các ràng buộc toàn vẹn CHECK constraints. | Quản trị dữ liệu, backend dev |
| **03** | [Đặc tả REST API](03-api.md) | Danh sách chi tiết 9 endpoints, cấu trúc request và response, validation rules, phân trang và chuẩn mã lỗi HTTP. | Tích hợp frontend, kiểm thử API |
| **04** | [Quy tắc nghiệp vụ](04-business-rules.md) | Mô hình hóa 8 use cases, vòng đời tài khoản từ mở đến đóng, quy tắc tiền tệ VND và tính bất biến của sổ cái. | Phân tích nghiệp vụ, tester |
| **05** | [Hướng dẫn chạy dự án](05-running.md) | Quy trình thiết lập môi trường Docker Compose, cấu hình file môi trường và kịch bản demo nhanh trên Swagger UI. | Cài đặt, triển khai demo |
| **06** | [Quy trình kiểm thử](06-testing.md) | Hướng dẫn chạy các bộ test tự động: Unit test, Integration test, Swagger Contract test và HTTP E2E test. | Đảm bảo chất lượng |
| **07** | [Đánh giá kiến trúc và đánh đổi](07-introduce-review.md) | Phân tích các đánh đổi kỹ thuật giữa Monolith và Microservices, khóa bi quan và khóa lạc quan, giới hạn và định hướng nâng cấp. | Đánh giá học thuật, báo cáo bảo vệ |
| **08** | [9 tình huống xung đột đồng thời](08-problem-scenarios.md) | Phân tích sâu 9 kịch bản lỗi thực tế gồm rút quá số dư, deadlock khi chuyển chéo, gửi lại lệnh sau timeout, can thiệp URL và giải pháp mã nguồn. | Vấn đáp kỹ thuật, thuyết trình |

## Lộ trình đọc tài liệu khuyến nghị

1. **Để nắm tổng quan dự án:** Bắt đầu từ [README.md](../../README.md) ở thư mục gốc $\rightarrow$ [04 — Quy tắc nghiệp vụ](04-business-rules.md).
2. **Để đánh giá thiết kế kỹ thuật:** Đọc [01 — Kiến trúc hệ thống](01-architecture.md) $\rightarrow$ [02 — Thiết kế cơ sở dữ liệu](02-database.md) $\rightarrow$ [07 — Đánh giá kiến trúc](07-introduce-review.md).
3. **Để chuẩn bị vấn đáp và thuyết trình:** Đọc kỹ [08 — 9 tình huống xung đột đồng thời](08-problem-scenarios.md) và [Báo cáo đo tải Kaggle](../performance/phase1-load-test.md).
4. **Để cài đặt và chạy thử nghiệm:** Xem [05 — Hướng dẫn chạy dự án](05-running.md) kết hợp [03 — Đặc tả REST API](03-api.md).
