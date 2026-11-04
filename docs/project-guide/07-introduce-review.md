# Báo cáo đánh giá kiến trúc và đánh đổi kỹ thuật

Tài liệu ghi chép các đánh đổi kỹ thuật, bài học rút ra và định hướng phát triển của nhóm trong quá trình hiện thực hóa hệ thống Bank Account.

## 1. Lý do lựa chọn kiến trúc và các đánh đổi kỹ thuật

### 1.1. Modular monolith thay vì Microservices
– **Quyết định:** Gom toàn bộ 3 bounded context `identity`, `accounts`, `money-movement` vào một ứng dụng NestJS duy nhất và dùng chung một instance PostgreSQL.  
– **Lý do lựa chọn:**  
  – Ở quy mô nghiệp vụ hiện tại, tính toàn vẹn của giao dịch chuyển khoản đòi hỏi tính nguyên tử tuyệt đối. Trong Modular Monolith, nhóm có thể thực thi trọn vẹn nghiệp vụ này bằng một database transaction duy nhất.  
  – Nếu chia thành Microservices, nhóm sẽ phải đối mặt với bài toán giao dịch phân tán, buộc phải áp dụng Saga pattern, Outbox pattern và Event Broker với tính nhất quán cuối cùng. Điều này làm tăng độ phức tạp vận hành và rủi ro mất cân đối số dư tạm thời ngoài phạm vi yêu cầu của đồ án.  
– **Đánh đổi:** Cả 3 module phải scale cùng nhau. Nếu module `identity` bị nghẽn CPU do Bcrypt, toàn bộ instance ứng dụng bị ảnh hưởng. Tuy nhiên, nhờ tổ chức mã nguồn theo Clean Architecture và phân tách ranh giới module chặt chẽ qua Port và Adapter, việc tách thành các service riêng biệt trong tương lai là hoàn toàn khả thi mà không cần viết lại tầng Domain.  

### 1.2. Khóa dòng bi quan thay vì khóa lạc quan
– **Quyết định:** Sử dụng câu lệnh SQL `SELECT ... FOR UPDATE` trực tiếp tại thời điểm bắt đầu giao dịch nạp, rút hoặc chuyển tiền.  
– **Lý do lựa chọn:**  
  – Trong lĩnh vực tài chính ngân hàng, việc cho phép giao dịch ghi thất bại rồi bắt người dùng thử lại nhiều lần khi có xung đột cao mang lại trải nghiệm rất kém.  
  – Khóa bi quan ép các tiến trình cùng thao tác trên một tài khoản phải xếp hàng tuần tự trong hàng đợi của PostgreSQL, đảm bảo khi một giao dịch được xử lý, nó luôn đọc được số dư thực tế mới nhất.  
– **Đánh đổi:** Độ trễ ở đuôi phân vị cao như p95 và p99 tăng lên khi có nhiều request đồng thời vào cùng một tài khoản. Nhóm chấp nhận đánh đổi thời gian chờ đợi này để đổi lấy tính an toàn dữ liệu tuyệt đối.  

### 1.3. Sắp xếp thứ tự khóa để loại bỏ deadlock
– **Vấn đề:** Khi tài khoản A chuyển tiền cho B, đồng thời tài khoản B chuyển tiền cho A:  
  – Tiến trình 1 khóa A, chờ khóa B.  
  – Tiến trình 2 khóa B, chờ khóa A.  
  – Cơ sở dữ liệu rơi vào bế tắc và một trong hai tiến trình bị hủy đột ngột.  
– **Giải pháp của nhóm:** Trong `TransferMoneyUseCase`, trước khi xin khóa, hệ thống luôn so sánh ID tài khoản và sắp xếp:  
  $$\text{firstId} = \min(\text{sourceId}, \text{destId}), \quad \text{secondId} = \max(\text{sourceId}, \text{destId})$$
  Cả hai tiến trình đều buộc phải xin khóa `firstId` trước rồi mới xin khóa `secondId`. Tiến trình nào đến trước sẽ giữ khóa đầu tiên, tiến trình kia tự động chờ ở ngoài, triệt tiêu hoàn toàn khả năng xảy ra chu trình chờ đợi lẫn nhau.

## 2. Rà soát thực tế so với thiết kế ban đầu

| Tiêu chí | Thiết kế lý thuyết ban đầu | Hiện thực hóa trong mã nguồn | Đánh giá & Ghi chú thực tế |
| :--- | :--- | :--- | :--- |
| **Bảo toàn số dư** | Trừ tiền nguồn, cộng tiền đích | Bọc trọn vẹn trong `UnitOfWorkPort` | Hoạt động chính xác, rollback toàn bộ nếu có lỗi phát sinh giữa chừng. |
| **Xử lý số âm** | Kiểm tra số dư khả dụng | Kiểm tra kép: ở tầng Application và CHECK constraint ở PostgreSQL | Phòng vệ hai lớp, chặn đứng tình trạng thấu chi. |
| **Idempotency** | Gửi lại cùng key trả kết quả cũ | Lưu ràng buộc duy nhất trên cặp `(source_account_id, idempotency_key)` | Chống trừ tiền trùng lặp hiệu quả khi client bị timeout hoặc mạng chập chờn. |
| **Kiểm tra quyền sở hữu** | Kiểm tra quyền trên từng route | `AccessTokenGuard` trích xuất danh tính, Use Case so khớp `userId` | Trả về 404 thay vì 403 để không tiết lộ sự tồn tại của tài khoản người khác. |
| **Lịch sử giao dịch** | Ghi nhận biến động số dư | Mỗi giao dịch ghi kèm `balanceAfter` | Dữ liệu sổ cái bất biến, phục vụ đối soát và kiểm toán tài chính. |
| **Hiệu năng băm mật khẩu** | Đăng ký và đăng nhập an toàn | Bcrypt chi phí 12 chiếm khoảng 300ms CPU mỗi lượt | Đạt mục tiêu an toàn bảo mật, chấp nhận trần thông lượng đăng nhập khoảng 11 req/giây trên 4 CPU. |

## 3. Các giới hạn hiện tại và hướng nâng cấp

Dù hệ thống đã giải quyết trọn vẹn các yêu cầu cốt lõi của Giai đoạn 1, nhóm cũng tự đánh giá một số điểm có thể mở rộng thêm trong thực tế:
1. **Kiểm tra Payload Hash trong Idempotency:** Hiện tại hệ thống đối chiếu theo cặp tài khoản nguồn và key. Hướng nâng cấp tiếp theo là lưu thêm mã băm SHA-256 của Request Body để báo lỗi nếu client cố tình dùng cùng một key nhưng thay đổi số tiền hoặc tài khoản nhận.
2. **Cơ chế Phân trang Keyset:** API xem lịch sử giao dịch hiện dùng phân trang dạng offset và limit. Với bảng giao dịch hàng triệu dòng, nên chuyển sang phân trang bằng con trỏ để tối ưu tốc độ quét index.
3. **Trigger cấm sửa hoặc xóa trực tiếp trên bảng sổ cái:** Hiện tại API không có endpoint nào sửa hay xóa bảng `financial_transactions`. Tuy nhiên, để ngăn chặn cả quyền can thiệp trực tiếp của quản trị viên database, có thể viết thêm PostgreSQL Trigger để cấm cập nhật hoặc xóa dòng trong bảng này.
