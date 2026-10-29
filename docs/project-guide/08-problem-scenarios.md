# Các tình huống và cơ chế xử lý

[Mục lục](README.md) · [Đề cương trình bày](../presentation.md)

- Nội dung: các tình huống khi sử dụng API, nguy cơ đối với dữ liệu và cách mã nguồn xử lý.
- Các ví dụ giả định request hợp lệ, database hoạt động bình thường và không có giao dịch khác ngoài những giao dịch được nêu.
- Kết quả dưới đây là hành vi mong đợi theo triển khai; cách chạy kiểm thử nằm trong [hướng dẫn kiểm thử](06-testing.md).

## 1. Hai request cùng rút tiền từ một tài khoản

- **Ví dụ:** tài khoản có 100.000 VND; hai request cùng rút 80.000 VND.
- **Nguy cơ:** cả hai cùng đọc số dư 100.000 và đều được chấp nhận, dù tổng tiền rút vượt số dư.
- **Cách xử lý:** khóa dòng tài khoản bằng `SELECT ... FOR UPDATE` trong database transaction. Request giữ khóa kiểm tra số dư và ghi giao dịch; request còn lại chờ khóa rồi đọc số dư mới.
- **Kết quả mong đợi:** một request thành công; request còn lại nhận `409 INSUFFICIENT_FUNDS`. Số dư cuối 20.000 VND, chỉ thêm một giao dịch DEBIT.
- **Mã nguồn:** [WithdrawMoneyUseCase](../../src/modules/money-movement/application/use-cases/withdraw-money.use-case.ts), [PrismaUnitOfWork](../../src/modules/money-movement/infrastructure/persistence/prisma-unit-of-work.ts).

## 2. Chuyển tiền bị lỗi giữa bước trừ nguồn và cộng đích

- **Ví dụ:** A có 500.000 VND, B có 0 VND; chuyển 100.000 VND nhưng gặp lỗi sau bước cập nhật A, trước bước cập nhật B.
- **Nguy cơ:** A mất tiền trong khi B không nhận được tiền; số dư và lịch sử lệch nhau.
- **Cách xử lý:** cập nhật hai số dư, tạo Transfer và hai giao dịch đối ứng trong cùng một transaction. Callback phát sinh lỗi thì Prisma rollback toàn bộ các thay đổi của transaction.
- **Kết quả mong đợi:** A vẫn 500.000 VND, B vẫn 0 VND; không có Transfer hoặc bút toán mới từ lệnh thất bại. Lỗi nội bộ ngoài dự kiến trả HTTP 500.
- **Phân biệt:** nếu database đã commit nhưng client mất kết nối trước khi nhận response, giao dịch vẫn tồn tại; trường hợp đó xử lý bằng retry cùng key ở mục 3.
- **Mã nguồn:** [TransferMoneyUseCase](../../src/modules/money-movement/application/use-cases/transfer-money.use-case.ts), [PrismaUnitOfWork](../../src/modules/money-movement/infrastructure/persistence/prisma-unit-of-work.ts).

## 3. Client gửi lại chuyển khoản sau timeout

- **Ví dụ:** chuyển 100.000 VND từ A sang B đã commit, nhưng client không nhận được phản hồi và gửi lại.
- **Nguy cơ:** backend thực hiện thêm một lần chuyển tiền.
- **Cách xử lý:** client gửi cùng `Idempotency-Key` và toàn bộ payload. Sau khi tra đích, khóa tài khoản và xác minh quyền sở hữu nguồn, use case tìm transfer theo `(sourceAccountId, idempotencyKey)`.
- **Kết quả mong đợi:** nếu đã có transfer, trả bản ghi cũ với HTTP 200; không đổi số dư, không tạo thêm bút toán. Chuyển mới thành công trả HTTP 201.
- **Quy tắc sử dụng:** mỗi ý định chuyển mới dùng key mới; cùng một lệnh được gửi lại phải giữ nguyên key và payload. Key dài 16–128 ký tự sau trim.
- **Giới hạn cần biết:** việc nhận diện transfer cũ không so sánh payload/hash. Đổi payload có thể trả kết quả cũ hoặc lỗi ở bước kiểm tra trước đó; không mặc định nhận lỗi xung đột khi đổi payload.
- **Mã nguồn:** [TransfersController](../../src/modules/money-movement/presentation/http/transfers.controller.ts), [TransferMoneyUseCase](../../src/modules/money-movement/application/use-cases/transfer-money.use-case.ts), [unique key trong schema](../../prisma/schema.prisma).

## 4. Hai lệnh chuyển tiền ngược chiều chạy đồng thời

- **Ví dụ:** một request chuyển A → B, request khác chuyển B → A.
- **Nguy cơ:** nếu mỗi request khóa nguồn trước, request thứ nhất giữ A chờ B, request thứ hai giữ B chờ A; hai request có thể rơi vào deadlock.
- **Cách xử lý:** sắp hai ID theo thứ tự tăng dần và luôn khóa theo thứ tự này, bất kể chiều chuyển.
- **Kết quả mong đợi:** các request tranh chấp hai tài khoản chờ khóa theo cùng thứ tự; request tiếp tục xử lý kiểm tra trạng thái và số dư sau khi lấy được khóa.
- **Phạm vi:** cách sắp khóa giảm nguy cơ deadlock trong luồng chuyển khoản này. `PrismaUnitOfWork` không tự động retry transaction khi gặp deadlock hoặc timeout.
- **Mã nguồn:** [TransferMoneyUseCase](../../src/modules/money-movement/application/use-cases/transfer-money.use-case.ts), [PrismaUnitOfWork](../../src/modules/money-movement/infrastructure/persistence/prisma-unit-of-work.ts).

## 5. Người dùng đổi ID để truy cập tài khoản người khác

- **Ví dụ:** user A có JWT hợp lệ nhưng thay accountId trong URL bằng tài khoản của user B.
- **Nguy cơ:** xem số dư, lịch sử hoặc rút tiền của người khác nếu backend chỉ kiểm tra đăng nhập.
- **Cách xử lý:** guard kiểm tra JWT; use case đối chiếu chủ tài khoản với user lấy từ token. Client không tự chỉ định danh tính bằng userId trong body.
- **Kết quả mong đợi:** xem, nạp/rút, xem lịch sử hoặc đóng tài khoản không thuộc mình đều nhận `404 ACCOUNT_NOT_FOUND`; số dư không thay đổi.
- **Phân biệt:** khi chuyển khoản, nguồn phải thuộc người gọi; đích được phép thuộc người khác. Có quyền gửi tiền tới B không đồng nghĩa có quyền xem hoặc rút tiền từ B.
- **Mã nguồn:** [AccessTokenGuard](../../src/common/security/guards/access-token.guard.ts), [GetAccountUseCase](../../src/modules/accounts/application/use-cases/get-account.use-case.ts), [WithdrawMoneyUseCase](../../src/modules/money-movement/application/use-cases/withdraw-money.use-case.ts).

## 6. Đóng tài khoản đồng thời có tiền nạp vào

- **Ví dụ:** tài khoản ACTIVE có số dư 0; một request đóng tài khoản, một request nạp 100.000 VND.
- **Nguy cơ:** thao tác đóng dựa trên số dư cũ bằng 0 trong khi số dư thực đã thay đổi.
- **Cách xử lý:** đóng tài khoản bằng UPDATE có điều kiện `id`, `userId`, `status = ACTIVE`, `currentBalance = 0`. Nếu không cập nhật được, use case đọc lại dữ liệu để trả kết quả. Nạp tiền khóa dòng và kiểm tra ACTIVE trước khi ghi.
- **Nếu nạp hoàn tất trước:** tài khoản có 100.000 VND; đóng bị từ chối với `409 ACCOUNT_HAS_BALANCE`.
- **Nếu đóng hoàn tất trước:** tài khoản CLOSED, số dư 0; nạp bị từ chối với `409 ACCOUNT_NOT_ACTIVE`.
- **Dữ liệu lưu lại:** đóng cập nhật CLOSED và closedAt, không xóa tài khoản hoặc lịch sử. Gọi đóng lại tài khoản của mình trả HTTP 204.
- **Mã nguồn:** [CloseAccountUseCase](../../src/modules/accounts/application/use-cases/close-account.use-case.ts), [PrismaAccountRepository](../../src/modules/accounts/infrastructure/persistence/prisma-account.repository.ts), [DepositMoneyUseCase](../../src/modules/money-movement/application/use-cases/deposit-money.use-case.ts).

## 7. Sai số khi biểu diễn tiền

- **Ví dụ:** một giá trị VND lớn vượt phạm vi số nguyên an toàn của JavaScript được chuyển sang `number` trước khi tính toán.
- **Nguy cơ:** giá trị bị làm tròn, số tiền ghi nhận khác dữ liệu client muốn gửi.
- **Cách xử lý:** API nhận/trả tiền dưới dạng string; `Money` dùng bigint để cộng/trừ; PostgreSQL lưu DECIMAL(18,0).
- **Kết quả mong đợi:** tính toán theo số nguyên VND; không dùng phép cộng/trừ số thực cho tiền trong domain.
- **Điều kiện đầu vào:** amount giao dịch phải dương; initialDeposit được bằng 0. Giá trị lưu trữ tối đa là `999999999999999999`; nạp hoặc chuyển vào làm vượt giới hạn bị từ chối.
- **Phía client:** giữ giá trị tiền dưới dạng chuỗi hoặc kiểu số nguyên chính xác; không đổi qua number rồi mới gửi.
- **Mã nguồn:** [Money](../../src/common/domain/value-objects/money.value-object.ts), [DepositMoneyUseCase](../../src/modules/money-movement/application/use-cases/deposit-money.use-case.ts), [Prisma schema](../../prisma/schema.prisma).

## 8. Gửi lại POST nạp/rút tạo thêm giao dịch

- **Ví dụ:** nạp 100.000 VND đã thành công, client gửi lại cùng body vì chưa thấy phản hồi.
- **Nguy cơ:** lần gửi thứ hai tiếp tục tăng số dư và tạo lịch sử mới.
- **Hành vi của dự án:** endpoint nạp/rút xử lý mỗi POST như một yêu cầu riêng; không sử dụng Idempotency-Key để tìm giao dịch cũ.
- **Kết quả mong đợi:** hai lần nạp hợp lệ có thể tăng tổng cộng 200.000 VND và tạo hai giao dịch. Hai lần rút được kiểm tra số dư riêng; lần sau có thể thành công hoặc báo thiếu tiền.
- **Cách sử dụng:** khi mất phản hồi, kiểm tra số dư và lịch sử trước khi gửi lại. Không áp dụng cơ chế retry của transfer cho endpoint nạp/rút.
- **Phạm vi tương tự:** gửi lại POST mở tài khoản có thể tạo thêm tài khoản; endpoint này cũng không chống lặp theo key.
- **Mã nguồn:** [TransactionController](../../src/modules/money-movement/presentation/http/transactions.controller.ts), [DepositMoneyUseCase](../../src/modules/money-movement/application/use-cases/deposit-money.use-case.ts), [WithdrawMoneyUseCase](../../src/modules/money-movement/application/use-cases/withdraw-money.use-case.ts).

## 9. Client gửi thêm trường để thay đổi dữ liệu ngoài hợp đồng

- **Ví dụ:** body mở tài khoản được thêm `userId`, `currentBalance` hoặc `accountNumber`.
- **Nguy cơ:** client tự chọn chủ sở hữu, số dư hoặc số tài khoản nếu server ghi thẳng toàn bộ body vào database.
- **Cách xử lý:** validation pipe bật whitelist và forbidNonWhitelisted; field ngoài DTO bị từ chối. Server lấy user từ JWT, sinh số tài khoản và xử lý số dư qua initialDeposit hợp lệ.
- **Kết quả mong đợi:** HTTP 400, không tạo tài khoản từ request có field thừa.
- **Phân biệt:** initialDeposit là field được API cho phép trong nghiệp vụ mô phỏng; currentBalance không phải field client được tự gửi khi mở tài khoản.
- **Mã nguồn:** [Validation pipe](../../src/common/http/pipes/validation-pipe.factory.ts), [OpenAccountDto](../../src/modules/accounts/presentation/http/dto/open-account.dto.ts), [AccountsController](../../src/modules/accounts/presentation/http/accounts.controller.ts).
