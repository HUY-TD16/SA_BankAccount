
# 0001. Tách health endpoint cho giám sát

- Trạng thái: Đề xuất
- Task: P2-04
- Người viết: Chiến
- Người duyệt: Chờ review

## Bối cảnh

Docker healthcheck gọi `/api/v1/accounts` và chờ HTTP 401.
Phản hồi này xác nhận ứng dụng nhận được request nhưng chưa xác nhận truy vấn được PostgreSQL.

## Các phương án

- A. Giữ cách hiện tại. Không cần thêm route, nhưng không kiểm tra được PostgreSQL.
- B. Tách `/health/live` để kiểm tra tiến trình và `/health/ready` để kiểm tra PostgreSQL bằng `SELECT 1`.

## Quyết định

Chọn B. Docker gọi `/api/v1/health/ready` và coi ứng dụng khỏe khi nhận HTTP 200.
Nếu truy vấn PostgreSQL thất bại, endpoint trả HTTP 503.

## Hệ quả

Có thể phân biệt ứng dụng đang chạy với ứng dụng sẵn sàng truy vấn dữ liệu.
Mỗi lần gọi `ready` thực hiện một truy vấn nhẹ. E2E qua 7/7 và Docker build thành công trên máy local.
