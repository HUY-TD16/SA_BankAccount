# 9 tình huống xung đột đồng thời và giải pháp kỹ thuật

Tài liệu phân tích chi tiết 9 tình huống biên và xung đột đồng thời trong môi trường thực tế, nguy cơ thất thoát dữ liệu và cách hệ thống giải quyết trong mã nguồn.

## 1. Hai request cùng rút tiền đồng thời từ một tài khoản

– **Bối cảnh:** Tài khoản hiện có **100.000 VND**. Hai request từ ứng dụng di động gửi lên cùng một thời điểm, mỗi request yêu cầu rút **80.000 VND** (tổng số tiền muốn rút là 160.000 VND).  
– **Nguy cơ tiềm ẩn:** Cả 2 luồng xử lý cùng đọc số dư tại một thời điểm thấy còn 100.000 VND, dẫn đến cả hai cùng cho phép trừ tiền và tài khoản bị âm thành **-60.000 VND**, gây thất thoát tiền của ngân hàng.  
– **Giải pháp của hệ thống:**  
  – Áp dụng khóa bi quan bằng câu lệnh `SELECT ... FOR UPDATE` trong transaction của PostgreSQL.  
  – Khi request 1 đọc dữ liệu, dòng tài khoản đó bị khóa lại. Request 2 buộc phải tạm dừng và xếp hàng chờ ở cổng cơ sở dữ liệu.  
  – Request 1 rút 80.000 VND, cập nhật số dư thành 20.000 VND, ghi sổ cái và commit. Khóa được giải phóng.  
  – Request 2 nhận được quyền truy cập, đọc lại số dư mới là 20.000 VND, nhận thấy số dư không đủ nên ném ngoại lệ `InsufficientFundsError`.  
– **Kết quả thực tế:** 1 request thành công với mã 201 Created, 1 request bị từ chối với lỗi 409 Conflict. Số dư cuối cùng chính xác là 20.000 VND.  
– **Vị trí mã nguồn:** [WithdrawMoneyUseCase](../../src/modules/money-movement/application/use-cases/withdraw-money.use-case.ts), [PrismaUnitOfWork](../../src/modules/money-movement/infrastructure/persistence/prisma-unit-of-work.ts).  

## 2. Sự cố hệ thống giữa bước trừ tiền nguồn và cộng tiền đích

– **Bối cảnh:** Tài khoản A chuyển **100.000 VND** sang tài khoản B. Ứng dụng đã trừ thành công 100.000 VND ở tài khoản A, nhưng ngay trước khi cộng tiền vào tài khoản B thì xảy ra lỗi mất kết nối DB hoặc server bị tắt đột ngột.  
– **Nguy cơ tiềm ẩn:** Tài khoản A bị trừ tiền nhưng tài khoản B không nhận được, tiền bị biến mất khỏi hệ thống và số dư hai bên không cân bằng.  
– **Giải pháp của hệ thống:**  
  – Áp dụng mẫu thiết kế Unit of Work qua `UnitOfWorkPort` và `PrismaUnitOfWork`. Toàn bộ 5 thao tác: trừ tiền A, cộng tiền B, tạo bản ghi chuyển khoản `transfers`, tạo 2 dòng sao kê `financial_transactions` đều được đặt chung trong một transaction duy nhất.  
  – Nếu bất kỳ câu lệnh nào thất bại hoặc server gặp exception, cơ chế ACID của PostgreSQL tự động rollback toàn bộ 100%.  
– **Kết quả thực tế:** Số dư tài khoản A và B được khôi phục nguyên vẹn như trước khi gửi lệnh. Client nhận mã lỗi 500.  
– **Vị trí mã nguồn:** [TransferMoneyUseCase](../../src/modules/money-movement/application/use-cases/transfer-money.use-case.ts).  

## 3. Client gửi lại yêu cầu chuyển tiền sau khi bị gián đoạn mạng

– **Bối cảnh:** Client gửi lệnh chuyển 100.000 VND. Server đã xử lý thành công và lưu vào cơ sở dữ liệu, nhưng đường truyền mạng bị ngắt đúng lúc gói tin phản hồi HTTP đang truyền về client. Ứng dụng client không nhận được kết quả nên tự động thử gửi lại lệnh.  
– **Nguy cơ tiềm ẩn:** Server xử lý lại từ đầu khiến tài khoản A bị trừ tiếp 100.000 VND lần thứ hai.  
– **Giải pháp của hệ thống:**  
  – Bắt buộc client phải sinh một chuỗi ngẫu nhiên `Idempotency-Key` dài từ 16 đến 128 ký tự đính kèm trong header HTTP.  
  – Bảng `transfers` được đặt ràng buộc duy nhất trên cặp tài khoản nguồn và idempotency key.  
  – Khi nhận request, `TransferMoneyUseCase` kiểm tra xem đã tồn tại bản ghi với key này trên tài khoản nguồn hay chưa. Nếu đã tồn tại, hệ thống trả về ngay kết quả giao dịch trước đó kèm mã HTTP 200 OK mà không thực hiện lại logic trừ tiền.  
– **Kết quả thực tế:** Lần gọi đầu trả về 201 Created, lần gọi sau trả về 200 OK. Tiền chỉ bị trừ đúng một lần duy nhất.  
– **Vị trí mã nguồn:** [TransfersController](../../src/modules/money-movement/presentation/http/transfers.controller.ts), [TransferMoneyUseCase](../../src/modules/money-movement/application/use-cases/transfer-money.use-case.ts).  

## 4. Hai lệnh chuyển tiền chéo nhau chạy đồng thời gây bế tắc

– **Bối cảnh:** Tại cùng một thời điểm, người dùng A chuyển tiền cho người dùng B, đồng thời người dùng B cũng chuyển tiền cho người dùng A.  
– **Nguy cơ tiềm ẩn:**  
  – Tiến trình 1 khóa tài khoản A, sau đó xin khóa tiếp tài khoản B.  
  – Tiến trình 2 khóa tài khoản B, sau đó xin khóa tiếp tài khoản A.  
  – Hai tiến trình chờ đợi khóa của nhau vô tận, dẫn đến treo kết nối cơ sở dữ liệu và bị abort ngắt quãng.  
– **Giải pháp của hệ thống:**  
  – Trước khi xin khóa, hệ thống luôn chuẩn hóa thứ tự khóa bằng cách so sánh UUID của 2 tài khoản: tài khoản có UUID nhỏ hơn luôn bị khóa trước, tài khoản có UUID lớn hơn bị khóa sau.  
  – Dù chiều chuyển tiền là từ A sang B hay từ B sang A, cả 2 tiến trình đều cạnh tranh xin khóa tài khoản có UUID nhỏ hơn trước. Tiến trình nào đến trước sẽ giành được khóa đầu tiên; tiến trình đến sau phải chờ ở ngoài, triệt tiêu hoàn toàn chu trình khóa luẩn quẩn.  
– **Kết quả thực tế:** Giao dịch được tuần tự hóa an toàn, không bao giờ xảy ra lỗi deadlock trong cơ sở dữ liệu.  
– **Vị trí mã nguồn:** [TransferMoneyUseCase](../../src/modules/money-movement/application/use-cases/transfer-money.use-case.ts).  

## 5. Người dùng cố tình can thiệp URL để thao tác trên tài khoản người khác

– **Bối cảnh:** Kẻ tấn công đăng nhập tài khoản của chính mình để lấy JWT token hợp lệ, sau đó đổi `accountId` trên đường dẫn URL thành ID tài khoản của một nạn nhân khác để xem số dư hoặc rút tiền.  
– **Nguy cơ tiềm ẩn:** Lộ thông tin bí mật tài chính hoặc bị đánh cắp tiền nếu server chỉ kiểm tra xem người gọi đã đăng nhập hay chưa.  
– **Giải pháp của hệ thống:**  
  – `AccessTokenGuard` trích xuất `sub` từ JWT đã được ký mật mã.  
  – Tầng Application Use Case truy vấn tài khoản và kiểm tra quyền sở hữu nghiêm ngặt:  
    ```typescript
    if (account.userId !== currentUserId) {
      throw new AccountNotFoundError();
    }
    ```
  – Hệ thống chủ động trả về lỗi 404 Account Not Found thay vì 403 Forbidden để kẻ tấn công không thể dò quét xem tài khoản đó có thực sự tồn tại trong hệ thống hay không.  
– **Kết quả thực tế:** Mọi hành vi truy cập trái phép đều nhận HTTP 404 Not Found.  

## 6. Đóng tài khoản đồng thời có tiền nạp vào

– **Bối cảnh:** Tài khoản đang có số dư 0 VND. Người dùng gửi lệnh đóng tài khoản, đồng thời có một lệnh nạp 100.000 VND từ một nguồn khác gửi tới cùng lúc.  
– **Nguy cơ tiềm ẩn:** Tài khoản bị đóng nhưng bên trong vẫn còn 100.000 VND vừa được nạp vào, khiến tiền bị đóng băng không thể rút ra.  
– **Giải pháp của hệ thống:**  
  – Thao tác đóng tài khoản thực thi câu lệnh SQL UPDATE có điều kiện nguyên tử:  
    ```sql
    UPDATE bank_accounts 
    SET status = 'CLOSED', closed_at = NOW() 
    WHERE id = :id AND user_id = :userId AND status = 'ACTIVE' AND current_balance = 0;
    ```
  – Nếu số lượng dòng bị ảnh hưởng bằng 0, nghĩa là số dư đã bị thay đổi hoặc trạng thái không còn là ACTIVE, use case lập tức đọc lại dữ liệu mới nhất:  
    – Nếu có tiền nạp vào trước: Ném lỗi 409 ACCOUNT_HAS_BALANCE để từ chối đóng.  
    – Nếu tài khoản đã được đóng trước: Ném lỗi 409 ACCOUNT_NOT_ACTIVE cho lệnh nạp tiền.  
– **Kết quả thực tế:** Không bao giờ xảy ra tình trạng tài khoản đóng mà số dư khác 0.  

## 7. Sai số làm tròn khi tính toán số tiền lớn

– **Bối cảnh:** Tiền tệ VND có giá trị lớn. Nếu hệ thống sử dụng kiểu số thông thường của JavaScript (`number`), khi thực hiện các phép cộng trừ vượt quá giới hạn an toàn của số thực 64-bit, số học sẽ bị làm tròn sai lệch.  
– **Nguy cơ tiềm ẩn:** Sai lệch sổ cái kế toán dù chỉ 1 đồng cũng là lỗi nghiêm trọng trong hệ thống ngân hàng.  
– **Giải pháp của hệ thống:**  
  – Tạo riêng Value Object `Money` sử dụng kiểu dữ liệu nguyên thủy `bigint` của TypeScript và Node.js để thực hiện các phép tính cộng, trừ, so sánh.  
  – Tầng HTTP API luôn nhận và trả giá trị tiền dưới dạng chuỗi `string`.  
  – Tầng cơ sở dữ liệu lưu trữ cột số dư bằng kiểu `DECIMAL(18, 0)` của PostgreSQL.  
– **Kết quả thực tế:** Đảm bảo độ chính xác tuyệt đối 100% cho mọi giá trị tiền tệ trong phạm vi 18 chữ số.  
– **Vị trí mã nguồn:** [Money Value Object](../../src/common/domain/value-objects/money.value-object.ts).  

## 8. Gửi lại yêu cầu nạp hoặc rút tiền

– **Bối cảnh:** Người dùng nạp 100.000 VND, do mạng lag nên bấm nút nạp 2 lần liên tiếp.  
– **Đặc tả nghiệp vụ:** Khác với chuyển khoản liên tài khoản vốn có `Idempotency-Key`, các thao tác nạp và rút tiền mặt tại quầy trong pha mô phỏng này được coi là các yêu cầu giao dịch độc lập.  
– **Xử lý:**  
  – Mỗi lần gửi request hợp lệ, hệ thống sẽ thực hiện khóa dòng, ghi nhận một giao dịch nạp tiền mới và sinh mã giao dịch riêng biệt.  
  – Với rút tiền, nếu lần bấm thứ 2 làm số dư không còn đủ, hệ thống sẽ ném lỗi `INSUFFICIENT_FUNDS`.  
– **Khuyến nghị sử dụng:** Phía client cần chủ động vô hiệu hóa nút bấm ngay khi gửi request để tránh người dùng click đúp ngoài ý muốn.  

## 9. Kẻ tấn công cố tình chèn trường lạ vào body

– **Bối cảnh:** Khi gọi API mở tài khoản `POST /accounts`, kẻ tấn công cố tình thêm các trường bí mật vào payload JSON như `currentBalance: "999999999999"` hoặc `userId: "victim-user-id"`.  
– **Nguy cơ tiềm ẩn:** Nếu backend ghi thẳng body vào database, kẻ tấn công có thể tự gán tài khoản cho người khác hoặc tự tạo ra số dư khổng lồ mà không cần nạp tiền.  
– **Giải pháp của hệ thống:**  
  – Cấu hình toàn cục NestJS `ValidationPipe` với hai tùy chọn nghiêm ngặt:  
    – `whitelist: true`: Tự động lọc bỏ toàn bộ các trường không được khai báo trong DTO.  
    – `forbidNonWhitelisted: true`: Bật chế độ cảnh báo, nếu request chứa bất kỳ trường lạ nào ngoài DTO sẽ lập tức bị chặn đứng và trả về lỗi HTTP 400 Bad Request.  
  – `userId` luôn được lấy trực tiếp từ JWT Payload đã được kiểm tra chữ ký ở `AccessTokenGuard`.  
– **Kết quả thực tế:** Mọi toan tính can thiệp trường dữ liệu đều bị triệt tiêu từ cửa ngõ Controller.  
– **Vị trí mã nguồn:** [validation-pipe.factory.ts](../../src/common/http/pipes/validation-pipe.factory.ts), [open-account.dto.ts](../../src/modules/accounts/presentation/http/dto/open-account.dto.ts).  
