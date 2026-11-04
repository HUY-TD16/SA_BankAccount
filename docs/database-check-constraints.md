# Ràng buộc kiểm tra toàn vẹn cơ sở dữ liệu

Tài liệu mô tả chi tiết các ràng buộc kiểm tra toàn vẹn CHECK constraints được cài đặt trực tiếp trong PostgreSQL thông qua bản migration `20261020000000_add_domain_check_constraints`.

## 1. Lý do cài đặt CHECK constraint ở tầng cơ sở dữ liệu

Mặc dù hệ thống đã có tầng Domain và tầng Application kiểm tra dữ liệu đầu vào rất kỹ, nhưng nhóm vẫn quyết định bổ sung thêm các ràng buộc CHECK trực tiếp ở mức bảng cơ sở dữ liệu:
– **Nguyên tắc phòng vệ đa tầng:** Ngay cả khi xảy ra lỗi lập trình ở tầng backend hoặc có can thiệp trực tiếp bằng câu lệnh SQL vào database, dữ liệu vẫn được bảo vệ nguyên vẹn.  
– **Bù đắp giới hạn của Prisma:** Prisma Schema không hỗ trợ khai báo cú pháp CHECK constraint trực tiếp trong file schema. Do đó, các ràng buộc này được viết bằng câu lệnh SQL thuần và thực thi thông qua cơ chế Prisma Migration.  

## 2. Danh sách các ràng buộc CHECK constraint

| Bảng dữ liệu | Biểu thức SQL | Mục đích bảo vệ |
| :--- | :--- | :--- |
| `users` | `email = lower(btrim(email))` | Đảm bảo email luôn được chuẩn hóa (chữ thường, không có khoảng trắng thừa) trước khi lưu. |
| `bank_accounts` | `current_balance >= 0` | Ngăn chặn tuyệt đối việc tài khoản bị số dư âm ở tầng vật lý. |
| `bank_accounts` | `currency = 'VND'` | Đảm bảo đơn vị tiền tệ chỉ chấp nhận duy nhất là VND. |
| `bank_accounts` | `(status = 'CLOSED') = (closed_at IS NOT NULL)` | Đảm bảo tính nhất quán: tài khoản đóng thì bắt buộc phải có thời điểm đóng `closed_at`, và ngược lại. |
| `financial_transactions` | `amount > 0` | Số tiền giao dịch bắt buộc phải là số nguyên dương. |
| `financial_transactions` | `balance_after >= 0` | Số dư sau giao dịch ghi nhận trong sổ cái không bao giờ được phép âm. |
| `financial_transactions` | Khớp loại giao dịch: <br>– `CREDIT` chỉ đi với `OPENING_DEPOSIT`, `CASH_DEPOSIT`, `TRANSFER_IN`<br>– `DEBIT` chỉ đi với `CASH_WITHDRAWAL`, `TRANSFER_OUT` | Ngăn chặn việc ghi sai lệch sổ cái như rút tiền mà lại đánh dấu là tăng tiền. |
| `transfers` | `amount > 0` | Số tiền chuyển khoản phải là số nguyên dương. |
| `transfers` | `source_account_id <> destination_account_id` | Ngăn chặn việc chuyển tiền cho chính tài khoản nguồn. |

## 3. Cách thức áp dụng migration

Để chạy bản migration này vào cơ sở dữ liệu, đảm bảo biến môi trường `DATABASE_URL` trong file `.env` đang trỏ đúng tới database đích, sau đó chạy lệnh:

```powershell
npx prisma migrate deploy
```

> [!NOTE]
> Bản migration được bọc trong một transaction SQL tường minh. Nếu trong database đã tồn tại bất kỳ dòng dữ liệu nào vi phạm các ràng buộc trên, PostgreSQL sẽ từ chối áp dụng và rollback toàn bộ, không gây hỏng cấu trúc bảng hiện tại.

## 4. Kiểm thử tự động các ràng buộc

Nhóm đã xây dựng riêng một bộ kiểm thử tích hợp chuyên biệt để kiểm chứng từng ràng buộc CHECK constraint này:
– **File kiểm thử:** `test/integration/database/check-constraints.spec.ts`  
– **Cơ chế hoạt động:** Test suite tự động tạo một schema tạm thời trên PostgreSQL, áp dụng toàn bộ các file migration SQL, sau đó cố tình chạy các câu lệnh chèn dữ liệu vi phạm ràng buộc như số dư âm, email viết hoa, chuyển tiền cùng tài khoản.  
– **Xác thực:** Kiểm tra xem PostgreSQL có trả về đúng mã lỗi `23514` (`check_violation`) kèm theo tên constraint tương ứng hay không.  

### Lệnh chạy kiểm thử
```powershell
npx jest --config jest.integration.config.js --runInBand test/integration/database/check-constraints.spec.ts
```
