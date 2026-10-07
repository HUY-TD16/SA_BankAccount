# Đặc tả tối thiểu \- Hệ thống Bank Account (Pha 1\)

## 1\. Mục tiêu và phạm vi đã chốt

Hệ thống là **dịch vụ backend quản lý tài khoản ngân hàng cơ bản**. Người dùng đăng ký, đăng nhập, mở tài khoản, xem tài khoản và lịch sử giao dịch, thực hiện giao dịch **ghi có (nạp tiền)** hoặc **ghi nợ (rút tiền)**, và đóng tài khoản.

Đây không phải là hệ thống quản lý tài chính cá nhân và không kết nối với ngân hàng bên ngoài. Mọi tài khoản, số dư và giao dịch đều được quản lý nội bộ để minh họa đúng nghiệp vụ cơ bản, bảo mật, phân tầng và toàn vẹn dữ liệu của Pha 1\.

### Trong phạm vi Pha 1

- Đăng ký và đăng nhập bằng email/mật khẩu.  
- JWT cho các API cần bảo vệ.  
- Mở, xem danh sách, xem chi tiết và đóng tài khoản.  
- Nạp tiền, rút tiền và xem lịch sử giao dịch của tài khoản.  
- Chuyển tiền từ một tài khoản sang một tài khoản khác trong hệ thống.  
- Kiểm tra quyền sở hữu tài khoản.  
- Cập nhật số dư cùng lúc với việc ghi nhận giao dịch.  
- Quên mật khẩu/đặt lại mật khẩu, refresh token và MFA bằng ứng dụng TOTP.  
- Phân quyền tối thiểu giữa khách hàng (`CUSTOMER`) và nhân viên ngân hàng (`BANK_STAFF`).  
- REST API JSON, OpenAPI/Swagger, Docker, PostgreSQL, kiểm thử cơ bản.

### Ngoài phạm vi Pha 1

- Kết nối ngân hàng, thanh toán thật, thẻ, QR, SMS OTP, KYC và email/SMS provider production.  
- Lãi suất, khoản vay, hạn mức thấu chi, đa tiền tệ.  
- Quản lý thu/chi cá nhân, category, shop, payment method, bill, goal, dashboard thống kê.  
- Sửa hoặc xóa giao dịch đã hoàn tất; hoàn tiền sẽ là chức năng riêng ở giai đoạn sau.  
- Tạo/sửa/xóa nhân viên qua API công khai; tài khoản `BANK_STAFF` được seed hoặc cấp trực tiếp ở database cho bài tập.  
- Các thao tác nghiệp vụ của nhân viên như phê duyệt giao dịch, khóa/mở khóa tài khoản, hoàn tiền và thay đổi số dư.

### Thuật ngữ

| Thuật ngữ | Ý nghĩa |
| :---- | :---- |
| User | Người dùng đã đăng ký trong hệ thống. |
| Bank Account | Tài khoản nội bộ thuộc đúng một User. |
| Transaction | Bản ghi bất biến của một lần nạp hoặc rút tiền. Không nhầm với database transaction. |
| CREDIT | Nạp tiền vào tài khoản, làm tăng số dư. |
| DEBIT | Rút tiền khỏi tài khoản, làm giảm số dư. |
| Transfer | Chuyển tiền: một DEBIT ở account nguồn và một CREDIT ở account đích cùng thuộc một `transferId`. |
| Close account | Đóng tài khoản bằng API `DELETE`; không xóa lịch sử tài chính vật lý. |
| Refresh token | Token dài hạn, lưu dạng hash ở server, chỉ dùng để đổi access token mới. |
| MFA/TOTP | Mã một lần theo thời gian do ứng dụng xác thực tạo ra. |
| CUSTOMER | User thông thường, chỉ truy cập dữ liệu của chính mình. |
| BANK\_STAFF | Nhân viên ngân hàng có quyền đọc tài khoản/giao dịch phục vụ hỗ trợ, nhưng không được tự ý tạo giao dịch tiền. |

## 2\. Use case tối thiểu

### UC-01 \- Đăng ký người dùng

**Actor:** Visitor  
**Mục tiêu:** Tạo một User để có thể đăng nhập và sử dụng hệ thống.

**Tiền điều kiện:** Backend và database hoạt động.

**Luồng chính:**

1. Visitor gửi họ tên, email, mật khẩu và xác nhận mật khẩu.  
2. API kiểm tra dữ liệu đầu vào.  
3. `AuthService` chuẩn hóa email, kiểm tra email chưa tồn tại và hash mật khẩu.  
4. Hệ thống lưu User mới.  
5. Hệ thống trả HTTP `201 Created` cùng thông tin User an toàn; không trả password hash.

**Luồng thay thế:** Email đã tồn tại trả `409 Conflict`; dữ liệu không hợp lệ trả `400 Bad Request`.

**Acceptance criteria:**

- Given email chưa tồn tại và mật khẩu hợp lệ, when đăng ký, then tạo đúng một User và mật khẩu chỉ được lưu dưới dạng hash.  
- Given cùng email khác chữ hoa/thường hoặc có khoảng trắng đầu/cuối, when đăng ký lần hai, then bị từ chối `409`.  
- Given password và confirmPassword khác nhau, when đăng ký, then không tạo User.

### UC-02 \- Đăng nhập

**Actor:** Visitor đã có tài khoản người dùng  
**Mục tiêu:** Nhận JWT để gọi API bảo vệ.

**Luồng chính:** gửi email và mật khẩu; hệ thống tìm User, so sánh password với hash, ký access token và trả token cùng thông tin User an toàn.

**Acceptance criteria:**

- Given thông tin hợp lệ, when đăng nhập, then trả `200 OK`, JWT hợp lệ có `sub = userId` và không trả password hash.  
- Given email không tồn tại hoặc password sai, when đăng nhập, then trả cùng một lỗi `401 Unauthorized`; không tiết lộ email có tồn tại hay không.  
- Given JWT thiếu, sai chữ ký hoặc hết hạn, when gọi API bảo vệ, then middleware chặn request với `401` trước controller.

### UC-03 \- Mở tài khoản ngân hàng

**Actor:** Authenticated User  
**Mục tiêu:** Tạo một Bank Account thuộc về chính mình.

**Dữ liệu tối thiểu:** `accountName`, `accountType`, `initialDeposit`.

**Luồng chính:** User gửi request có JWT; hệ thống xác thực, tạo mã/tên tài khoản nội bộ duy nhất, tạo account trạng thái `ACTIVE`, số dư ban đầu bằng `initialDeposit`, và ghi một transaction `CREDIT` loại `OPENING_DEPOSIT` nếu số dư ban đầu lớn hơn 0\.

**Acceptance criteria:**

- Given JWT hợp lệ và initialDeposit không âm, when mở tài khoản, then account thuộc về `sub` trong JWT, ở trạng thái `ACTIVE` và có số dư chính xác.  
- Given initialDeposit lớn hơn 0, then số dư và giao dịch nạp ban đầu được lưu cùng thành công hoặc cùng rollback.  
- Given request thiếu trường bắt buộc hoặc số tiền âm, then không tạo account và trả `400`.

### UC-04 \- Xem danh sách và chi tiết tài khoản

**Actor:** Authenticated User  
**Mục tiêu:** Xem các tài khoản của chính mình và số dư hiện tại.

**Acceptance criteria:**

- `GET /api/v1/accounts` chỉ trả các account của User đang đăng nhập; không trả account của User khác.  
- `GET /api/v1/accounts/:accountId` trả account đang `ACTIVE` hoặc `CLOSED` của chủ sở hữu cùng số dư hiện tại.  
- Given account không tồn tại hoặc không thuộc User, when truy vấn, then trả `404 Not Found`.  
- Response không chứa password, JWT hoặc thông tin nhạy cảm của User khác.

### UC-05 \- Nạp tiền hoặc rút tiền

**Actor:** Authenticated User  
**Mục tiêu:** Tạo giao dịch tài chính trên một tài khoản do mình sở hữu.

**Dữ liệu tối thiểu:** `accountId`, `type` (`CREDIT` hoặc `DEBIT`), `amount`, `description` tùy chọn.

**Luồng chính:** Hệ thống xác thực token, kiểm tra ownership và trạng thái account, kiểm tra amount, khóa/cập nhật số dư trong database transaction, rồi lưu Transaction `COMPLETED`.

**Acceptance criteria:**

- Given `CREDIT` 100,000 VND vào account có số dư 50,000 VND, when request thành công, then số dư là 150,000 VND và có đúng một transaction `CREDIT`.  
- Given `DEBIT` lớn hơn số dư hiện tại, when request, then trả `409 Conflict`, không đổi số dư và không tạo transaction.  
- Given account thuộc User khác, when tạo transaction, then trả `404` và không tiết lộ account đó tồn tại.  
- Given lỗi xảy ra sau khi cập nhật số dư nhưng trước khi lưu transaction, then toàn bộ thay đổi rollback.  
- Given hai request đồng thời rút tiền, then số dư cuối cùng không âm và chỉ các giao dịch hợp lệ được hoàn tất.

### UC-06 \- Xem lịch sử giao dịch

**Actor:** Authenticated User  
**Mục tiêu:** Xem lịch sử nạp/rút của một account thuộc về mình.

**Acceptance criteria:**

- `GET /api/v1/accounts/:accountId/transactions?page=1&limit=20` chỉ trả transaction của account do User sở hữu.  
- Kết quả sắp xếp giảm dần theo `createdAt`; có metadata `page`, `limit`, `total`.  
- Mỗi transaction có mã, loại, số tiền, số dư sau giao dịch, trạng thái, thời điểm và mô tả; không trả dữ liệu tài khoản của User khác.  
- Given không có giao dịch, then trả `200` với mảng rỗng, không phải `404`.

### UC-07 \- Đóng tài khoản

**Actor:** Authenticated User  
**Mục tiêu:** Ngừng sử dụng một account của mình mà vẫn giữ lịch sử giao dịch.

**Quyết định Pha 1:** `DELETE /api/v1/accounts/:accountId` là lệnh **đóng logic**: chuyển trạng thái thành `CLOSED`, không xóa vật lý account hoặc transaction.

**Acceptance criteria:**

- Given account của chủ sở hữu có balance bằng 0, when gọi DELETE, then account thành `CLOSED` và trả `204 No Content`.  
- Given balance khác 0, when gọi DELETE, then trả `409 Conflict`; User phải rút hết tiền trước.  
- Given account đã `CLOSED`, when nạp/rút, then trả `409`; lịch sử vẫn đọc được.  
- Given account của User khác hoặc không tồn tại, when DELETE, then trả `404`.

### UC-08 \- Chuyển tiền giữa hai tài khoản

**Actor:** Authenticated User  
**Mục tiêu:** Chuyển một khoản tiền từ account nguồn do mình sở hữu sang một account đích đang hoạt động trong hệ thống.

**Dữ liệu tối thiểu:** `sourceAccountId`, `destinationAccountNumber`, `amount`, `description` tùy chọn, `Idempotency-Key` header.

**Luồng chính:** Hệ thống xác thực User, kiểm tra account nguồn thuộc User và cả hai account đều `ACTIVE`; khóa hai account theo thứ tự ID cố định, kiểm tra đủ số dư, trừ tiền nguồn, cộng tiền đích và tạo Transfer cùng hai Transaction liên kết trong **một database transaction**.

**Acceptance criteria:**

- Given nguồn có 500,000 VND, đích có 100,000 VND và transfer 200,000 VND, when transfer thành công, then số dư lần lượt là 300,000 và 300,000 VND; có đúng một Transfer, một `DEBIT` nguồn và một `CREDIT` đích cùng `transferId`.  
- Given account nguồn không thuộc User hoặc account đích không tồn tại/đã đóng, when transfer, then trả `404`, không thay đổi số dư và không tạo bản ghi nào.  
- Given amount lớn hơn số dư nguồn hoặc nguồn trùng đích, when transfer, then trả `409` hoặc `400` tương ứng.  
- Given request cùng `Idempotency-Key` được gửi lại sau timeout, then hệ thống trả kết quả transfer đã tạo, không chuyển tiền lần hai.  
- Given có lỗi ở bất kỳ bước nào, then cả hai số dư và toàn bộ bản ghi transfer/transaction rollback.

### UC-09 \- Quên và đặt lại mật khẩu

**Actor:** Visitor/User  
**Mục tiêu:** Nhận liên kết đặt lại mật khẩu và thiết lập mật khẩu mới an toàn.

**Luồng chính:** User gửi email đến endpoint forgot-password. Hệ thống luôn trả response chung, nếu email tồn tại thì tạo token ngẫu nhiên một lần có hạn và gửi link qua email. User gửi token cùng mật khẩu mới đến reset-password; hệ thống kiểm tra token, đổi password hash và thu hồi toàn bộ refresh token hiện có.

**Acceptance criteria:**

- Given email tồn tại, when yêu cầu reset, then email chứa token/link một lần có hạn; database chỉ lưu hash của token.  
- Given email không tồn tại, when yêu cầu reset, then vẫn trả response thành công chung, không tiết lộ email có tồn tại hay không.  
- Given token hết hạn, đã dùng hoặc sai, when đặt lại mật khẩu, then trả `400` và không đổi password.  
- Given reset thành công, then password cũ không đăng nhập được và mọi refresh token cũ bị revoke.

### UC-10 \- Làm mới phiên đăng nhập

**Actor:** User đã đăng nhập  
**Mục tiêu:** Nhận access token mới mà không phải gửi lại password.

**Quyết định:** Refresh token là opaque random token, lưu server dưới dạng hash và gửi cho browser bằng cookie `HttpOnly`, `Secure`, `SameSite`. Access token JWT ngắn hạn, ví dụ 15 phút; refresh token có hạn dài hơn, ví dụ 7 ngày.

**Acceptance criteria:**

- Given refresh token hợp lệ, chưa hết hạn và chưa revoke, when gọi refresh endpoint, then cấp access token mới và rotate refresh token cũ.  
- Given refresh token hết hạn, bị revoke hoặc đã dùng sau rotation, then trả `401` và xóa cookie refresh token.  
- Given logout, then refresh token hiện tại bị revoke và không thể dùng để lấy access token mới.

### UC-11 \- Bật và xác minh MFA

**Actor:** Authenticated User  
**Mục tiêu:** Bảo vệ đăng nhập bằng TOTP từ ứng dụng authenticator.

**Luồng chính:** User đang có access token gọi endpoint setup; hệ thống sinh TOTP secret, trả provisioning URI/QR một lần. User gửi mã TOTP để confirm; sau đó `mfaEnabled=true`. Khi đăng nhập bằng password, hệ thống chỉ trả MFA challenge ngắn hạn; endpoint verify mã TOTP mới cấp access token và refresh token.

**Acceptance criteria:**

- TOTP secret được mã hóa khi lưu và không xuất hiện trong log hoặc API response sau bước setup.  
- Given MFA đã bật và password đúng, when login, then không cấp access/refresh token trước khi verify mã TOTP.  
- Given mã TOTP sai hoặc hết cửa sổ thời gian cho phép, then trả `401` và không tạo phiên đăng nhập.  
- Given User chưa bật MFA, when login bằng password đúng, then quy trình login thông thường hoạt động.

### UC-12 \- Truy cập hỗ trợ của nhân viên ngân hàng

**Actor:** BANK\_STAFF  
**Mục tiêu:** Xem chi tiết và lịch sử account để hỗ trợ khách hàng mà không làm thay đổi tiền.

**Phạm vi quyền tối thiểu:** `BANK_STAFF` chỉ được gọi các endpoint đọc dành cho staff: xem một account theo ID và lịch sử của account đó. Staff không được mở/đóng account thay khách, nạp/rút/chuyển tiền, reset password hoặc cấp role.

**Acceptance criteria:**

- Given JWT có role `BANK_STAFF`, when gọi staff read endpoint, then có thể xem account và lịch sử bất kể chủ sở hữu.  
- Given JWT có role `CUSTOMER`, when gọi staff endpoint, then trả `403 Forbidden`.  
- Mọi staff read thành công phải tạo audit log gồm staffId, action, targetAccountId và thời điểm; audit log không chứa token hoặc password.

## 3\. Business rules

### BR-AUTH \- Người dùng và xác thực

1. `email` là bắt buộc, được trim và chuyển lowercase trước khi kiểm tra/lưu; email là unique toàn hệ thống.  
2. `fullName` là bắt buộc, sau trim có từ 2 đến 100 ký tự.  
3. Mật khẩu có 8-72 ký tự, ít nhất một chữ hoa, một chữ thường, một số và một ký tự đặc biệt; không có khoảng trắng.  
4. `confirmPassword` phải bằng chính xác `password` và không được lưu hoặc log.  
5. Password chỉ được lưu bằng bcrypt hash. Không log password, hash, JWT secret hoặc access token.  
6. JWT access token có `sub` là `userId` và `role`, được ký bằng secret từ environment và có hạn dùng ngắn, ví dụ 15 phút.  
7. Refresh token phải là random opaque token, chỉ lưu hash, có ngày hết hạn, trạng thái revoke và rotation. Không đặt refresh token trong localStorage.  
8. Forgot-password token là random, một lần, có hạn tối đa 15 phút và chỉ lưu hash. Response yêu cầu reset phải giống nhau dù email có tồn tại hay không.  
9. Sau reset password, logout hoặc dấu hiệu token reuse, các refresh token liên quan phải bị revoke.  
10. MFA dùng TOTP; secret phải mã hóa khi lưu. MFA challenge không phải access token và hết hạn ngắn.  
11. Role chỉ là `CUSTOMER` hoặc `BANK_STAFF`. Public register chỉ tạo `CUSTOMER`; không có API tự đăng ký/cấp role staff.  
12. Tất cả endpoint ngoài register, login, forgot-password, reset-password và Swagger đều phải đi qua auth middleware/guard.

### BR-ACCOUNT \- Tài khoản ngân hàng

1. Một account thuộc đúng một User; một User có thể có nhiều account.  
2. Account mới có trạng thái `ACTIVE`; account đóng có trạng thái `CLOSED`.  
3. Hệ thống tự sinh `accountNumber` nội bộ duy nhất; client không được tự chọn số tài khoản.  
4. `initialDeposit` là số nguyên VND không âm. Pha 1 chỉ hỗ trợ VND để tránh xử lý tỷ giá và làm tròn đa tiền tệ.  
5. `currentBalance` không được nhận từ client trong API update. Nó chỉ thay đổi bởi thao tác mở account hoặc transaction thành công.  
6. Account chỉ được đóng khi `currentBalance = 0`. Đóng account không được xóa lịch sử giao dịch.  
7. API customer truy cập account phải xác minh `account.userId == authenticatedUserId` trong service; guard chỉ xác thực danh tính, không thay thế ownership check.  
8. `BANK_STAFF` chỉ được vượt ownership check ở các staff read endpoint đã định nghĩa; mọi lần truy cập phải được audit.

### BR-TRANSACTION \- Giao dịch tiền

1. Transaction thuộc đúng một account và vì vậy thuộc gián tiếp một User.  
2. `type` chỉ nhận `CREDIT` hoặc `DEBIT`; `amount` là số nguyên VND lớn hơn 0\.  
3. Chỉ account `ACTIVE` mới tạo được transaction.  
4. `CREDIT` cộng amount vào balance; `DEBIT` trừ amount khỏi balance.  
5. Pha 1 không cho thấu chi: trước `DEBIT`, balance phải lớn hơn hoặc bằng amount.  
6. Cập nhật balance và insert Transaction phải thực hiện trong cùng một database transaction. Một phần thành công không được phép tồn tại.  
7. Transaction hoàn tất là bất biến. Sửa/xóa không thuộc Pha 1; nếu cần sửa sai về sau phải tạo reversal transaction.  
8. Hệ thống lưu `balanceAfter`, `createdAt`, `status=COMPLETED` để audit tối thiểu.  
9. Số dư dùng kiểu `NUMERIC(18,0)` trong PostgreSQL hoặc integer minor unit; tuyệt đối không dùng `float`/`double`.

### BR-TRANSFER \- Chuyển tiền

1. Transfer gồm một account nguồn, một account đích, amount lớn hơn 0, trạng thái `COMPLETED` và mã `transferId` duy nhất.  
2. Account nguồn phải thuộc `CUSTOMER` đang đăng nhập. Account đích chỉ cần tồn tại, `ACTIVE` và không được trùng nguồn; vì vậy Pha 1 hỗ trợ chuyển cho User khác trong cùng hệ thống.  
3. Source `DEBIT`, destination `CREDIT`, cập nhật hai balance, Transfer record và hai Transaction record phải nằm trong **cùng một database transaction**.  
4. Repository phải lock hai account theo thứ tự ID tăng dần hoặc dùng chiến lược tương đương để giảm deadlock khi transfer ngược chiều đồng thời.  
5. Tổng tiền của hai account trước và sau transfer phải bằng nhau. Không tạo phí transfer trong Pha 1\.  
6. `Idempotency-Key` là bắt buộc cho transfer, unique theo source account trong một khoảng thời gian còn hiệu lực. Request lặp cùng key và cùng payload trả lại kết quả cũ; cùng key nhưng payload khác trả `409`.

### BR-API \- Quy ước API

1. API dùng REST, JSON và prefix `/api/v1`.  
2. Response lỗi dùng cấu trúc thống nhất: `success`, `message`, `errorCode`, `details` (nếu có).  
3. `400` cho dữ liệu không hợp lệ, `401` cho token thiếu/sai/hết hạn, `403` cho role không đủ, `404` cho tài nguyên customer không có quyền truy cập hoặc không tồn tại, `409` cho email trùng, số dư không đủ, idempotency conflict hoặc đóng account còn tiền.  
4. Controller chỉ parse/validate DTO và trả HTTP response. Business rule nằm ở service. Repository là tầng duy nhất import ORM/database client.

## 4\. Thay đổi cần áp dụng từ template

| Nội dung template hiện có | Điều chỉnh cho Bank Account Pha 1 |
| :---- | :---- |
| `Register an Account` có thể gây nhầm là mở Bank Account | Đổi thành **Register User**; mở tài khoản ngân hàng là UC-03 riêng. |
| Transaction `Revenue`/`Expense` | Đổi thành `CREDIT`/`DEBIT`, tương ứng nạp/rút. |
| `category_id`, `shopName`, `paymentMethod` | Bỏ khỏi Pha 1; chỉ giữ description tùy chọn. |
| Cho sửa bank name, branch, account number, balance | Không làm update account trong phạm vi tối thiểu. Đặc biệt không cho client sửa trực tiếp balance hay account number. |
| Delete account và cascade transaction | Đổi thành logical close khi balance bằng 0; giữ audit history. |
| Expense summary, bills, goals, savings summary | Chuyển hoàn toàn ra Pha 2/backlog. |
| Transaction list theo User | Dùng lịch sử theo `accountId`, đồng thời ownership được kiểm tra từ JWT. |
| Chưa có transfer | Thêm `Transfer`, hai transaction đối ứng, idempotency key và kiểm tra nguyên tử. |
| JWT access token đơn lẻ | Thêm refresh-token rotation, forgot/reset password và MFA TOTP. |
| Chỉ có authenticated user | Thêm `CUSTOMER` và `BANK_STAFF`; staff có endpoint chỉ đọc và audit log. |

## 5\. API tối thiểu

| Method | Endpoint | Auth | Mục đích |
| :---- | :---- | :---- | :---- |
| POST | `/api/v1/auth/register` | No | Đăng ký User |
| POST | `/api/v1/auth/login` | No | Đăng nhập và nhận JWT |
| POST | `/api/v1/auth/refresh` | Refresh cookie | Rotate refresh token, cấp access token mới |
| POST | `/api/v1/auth/logout` | Refresh cookie/JWT | Revoke refresh token hiện tại |
| POST | `/api/v1/auth/forgot-password` | No | Gửi yêu cầu đặt lại mật khẩu |
| POST | `/api/v1/auth/reset-password` | No | Đặt mật khẩu bằng token một lần |
| POST | `/api/v1/auth/mfa/setup` | JWT | Sinh TOTP provisioning URI/QR |
| POST | `/api/v1/auth/mfa/confirm` | JWT | Xác nhận và bật MFA |
| POST | `/api/v1/auth/mfa/verify` | MFA challenge | Hoàn tất login MFA |
| POST | `/api/v1/accounts` | JWT | Mở account |
| GET | `/api/v1/accounts` | JWT | Danh sách account của mình |
| GET | `/api/v1/accounts/:accountId` | JWT | Chi tiết account |
| POST | `/api/v1/accounts/:accountId/transactions` | JWT | Nạp/rút tiền |
| GET | `/api/v1/accounts/:accountId/transactions` | JWT | Lịch sử giao dịch |
| POST | `/api/v1/transfers` | JWT \+ `Idempotency-Key` | Chuyển tiền trong hệ thống |
| DELETE | `/api/v1/accounts/:accountId` | JWT | Đóng logic account |
| GET | `/api/v1/staff/accounts/:accountId` | JWT \+ BANK\_STAFF | Staff xem account để hỗ trợ |
| GET | `/api/v1/staff/accounts/:accountId/transactions` | JWT \+ BANK\_STAFF | Staff xem lịch sử, có audit log |

## 6\. Câu hỏi phản biện sau khi chốt use case

1. “Đăng ký” là đăng ký User hay mở Bank Account? Tên endpoint, use case và UI đã tách hai khái niệm này chưa?  
2. Transfer cho phép chuyển đến account của User khác hay chỉ giữa các account của cùng User? Đặc tả đã chốt account nguồn thuộc người gọi và account đích có thể thuộc User khác chưa?  
3. Giao dịch mở tài khoản với số dư ban đầu có phải là một `CREDIT` để lịch sử và balance luôn đối soát được không?  
4. User có cần xem account đã đóng không, hay chỉ cần lịch sử giao dịch? Quyết định này có nhất quán với UC-07 không?  
5. Endpoint nào tối thiểu chứng minh đủ POST, GET, DELETE và ít nhất một GET/POST có authentication theo đề bài?  
6. Khi không được quyền truy cập account, tại sao trả `404` thay vì `403`? Nhóm có hiểu mục tiêu tránh lộ sự tồn tại của tài khoản không?  
7. Có use case nào đang lén đưa tính năng personal finance như category, goal hoặc report vào phạm vi Pha 1 không?  
8. Nhóm có thể demo trọn luồng register → login → open account → deposit → withdraw → transfer → history → close account không?  
9. Khi quên mật khẩu, nhóm có thể gửi email thật hoặc dùng mail-catcher trong Docker để demo token reset mà không log token ra console không?  
10. MFA sẽ dùng TOTP authenticator, không dùng OTP tự chế; login có thật sự bị chặn trước khi verify TOTP không?  
11. `BANK_STAFF` cần làm được gì ngoài xem dữ liệu? Nếu chỉ đọc, các quyền ghi có được chặn và audit đầy đủ chưa?

## 7\. Câu hỏi phản biện sau khi chốt business rules và acceptance criteria

1. Chúng ta có cột/constraint database nào thật sự bảo đảm email và account number unique khi có hai request đồng thời không?  
2. Số tiền có bao giờ đi qua `float` ở DTO, service hoặc database không? Nếu có, sửa bằng integer VND hoặc `NUMERIC` thế nào?  
3. Việc update balance và insert transaction có dùng cùng database transaction không? Test rollback đã chứng minh điều đó chưa?  
4. Khi hai request `DEBIT` cùng đến, query nào hoặc lock nào ngăn balance âm?  
5. Service có tự kiểm tra ownership, hay controller/guard đang mang business logic? Có test một User truy cập account của User khác chưa?  
6. Hệ thống có cho client truyền `currentBalance`, `userId` hoặc `accountNumber` để giả mạo không?  
7. Khi account đóng, API nào còn đọc được và API nào phải từ chối? Test có khớp business rule không?  
8. DELETE có thực sự là hard delete/cascade ở ORM không? Nếu có, nó mâu thuẫn với quy tắc giữ audit history.  
9. Mọi lỗi có response nhất quán và không vô tình trả password hash, database error hoặc JWT secret không?  
10. Acceptance criteria nào được tự động hóa bằng test; acceptance criteria nào chỉ đang là mô tả trên giấy?  
11. Docker compose từ máy trống có chạy migration, tạo database và mở Swagger được không?  
12. Baseline load test trên Kaggle CPU gồm workload nào: login, list account, và concurrent debit? Các chỉ số latency/error rate được lưu ra sao để Pha 2 so sánh?  
13. Cùng `Idempotency-Key` có thể tạo hai transfer không? Test retry sau timeout và key reuse payload khác đã có chưa?  
14. Transfer nguồn/đích có dùng cùng database transaction và lock thứ tự cố định không? Tổng tiền trước/sau tải đồng thời có bằng nhau không?  
15. Refresh token có bị lưu plaintext, đặt trong localStorage hoặc dùng lại sau rotation không? Reset password/logout có revoke token cũ không?  
16. TOTP secret và password-reset token có bị trả qua API/log/database ở dạng plaintext không?  
17. Customer có thể gọi endpoint staff hoặc tự sửa role trong JWT/request body không? Audit log staff có đủ định danh người truy cập và target không?

## 8\. Definition of Done cho Pha 1

- Tất cả endpoint trong mục API tối thiểu hoạt động và xuất hiện trong Swagger/OpenAPI.  
- Bốn lớp API, service, repository interface, repository implementation được tách rõ; service không import web framework hoặc ORM.  
- JWT guard dùng chung cho protected routes; ownership được test tại service.  
- Migration dựng được users, accounts, transactions, transfers, refresh\_tokens, password\_reset\_tokens, audit\_logs và schema metadata.  
- Unit test bao phủ AuthService, AccountService, TransactionService và TransferService; integration test bao phủ authentication, ownership, insufficient funds, rollback, idempotent transfer, refresh rotation, MFA và staff authorization.  
- `docker compose up --build` dựng được app và PostgreSQL trên máy sạch.  
- README có scope, ERD, sơ đồ kiến trúc, API, hướng dẫn chạy Docker, cách seed `BANK_STAFF`, cách cấu hình email/MFA development và kịch bản test/load test Kaggle CPU.

&nbsp;