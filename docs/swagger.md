# Hướng dẫn sử dụng và kiểm thử API với Swagger UI

Tài liệu hướng dẫn cách khởi chạy và thao tác kiểm thử trực quan toàn bộ hệ thống API thông qua giao diện Swagger UI.

## 1. Thông tin truy cập

Khi hệ thống khởi chạy ở chế độ phát triển (`NODE_ENV=development`):
– **Giao diện Swagger UI:** `http://localhost:3000/api/docs`  
– **Tài liệu OpenAPI Spec:** `http://localhost:3000/api/docs.json`  
– **Tiền tố đường dẫn API:** `/api/v1`  

> [!NOTE]
> Khi ứng dụng chạy ở môi trường production (`NODE_ENV=production`), Swagger UI và endpoint tài liệu OpenAPI sẽ tự động bị vô hiệu hóa để đảm bảo an toàn bảo mật.

## 2. Kịch bản thử nghiệm hoàn chỉnh

Bạn có thể thực hiện kiểm thử nhanh toàn bộ luồng nghiệp vụ trên trình duyệt theo 5 bước sau:

### Bước 1: Đăng ký tài khoản người dùng
1. Mở nhóm **Identity** $\rightarrow$ chọn `POST /auth/register` $\rightarrow$ bấm **Try it out**.
2. Nhập thông tin đăng ký (email hợp lệ, mật khẩu đủ mạnh 8-72 ký tự).
3. Bấm **Execute** $\rightarrow$ Nhận phản hồi HTTP 201 Created.

### Bước 2: Đăng nhập và lấy bearer token
1. Chọn `POST /auth/login` $\rightarrow$ nhập email và mật khẩu vừa tạo $\rightarrow$ bấm **Execute**.
2. Sao chép chuỗi `accessToken` trong phần kết quả trả về tại `data.accessToken`.
3. Cuộn lên đầu trang Swagger, bấm nút **Authorize 🔓** (hình ổ khóa màu xanh lá bên phải).
4. Dán token vừa copy vào ô **Value** *(chỉ dán chuỗi token, không cần gõ thêm chữ `Bearer`)* $\rightarrow$ Bấm **Authorize** $\rightarrow$ Bấm **Close**.
5. Kể từ lúc này, mọi request gửi từ Swagger sẽ tự động được đính kèm token hợp lệ.

### Bước 3: Mở tài khoản ngân hàng
1. Mở nhóm **Accounts** $\rightarrow$ chọn `POST /accounts`.
2. Nhập tên tài khoản, loại tài khoản `PAYMENT` hoặc `SAVINGS` và số tiền gửi ban đầu `initialDeposit` (ví dụ `"5000000"`).
3. Bấm **Execute** $\rightarrow$ Nhận 201 Created. Lưu lại trường `"id"` của tài khoản để sử dụng cho các bước tiếp theo.

### Bước 4: Thực hiện nạp tiền và kiểm tra chống rút quá số dư
1. Chọn `POST /accounts/{accountId}/transactions`.
2. Điền `accountId` vừa tạo:
   – **Nạp tiền:** Nhập `type: "CREDIT"`, `amount: "2000000"` $\rightarrow$ Nhận 201 Created, số dư tăng lên tương ứng.  
   – **Thử rút quá số dư:** Nhập `type: "DEBIT"` với số tiền lớn hơn số dư hiện có $\rightarrow$ Nhận lỗi HTTP 409 Conflict kèm mã `INSUFFICIENT_FUNDS`.  

### Bước 5: Chuyển tiền và kiểm chứng cơ chế Idempotency
1. Chọn `POST /transfers`.
2. **Điền header Idempotency-Key:** Nhập một chuỗi ký tự duy nhất dài từ 16 đến 128 ký tự (ví dụ: `transfer-demo-key-2026-001`).
3. Điền thông tin chuyển khoản: `sourceAccountId` (tài khoản nguồn), `destinationAccountNumber` (số tài khoản nhận), `amount` và `description`.
4. **Bấm Execute lần 1:** Giao dịch thành công, hệ thống trả về mã 201 Created.
5. **Bấm Execute lần 2 với cùng key và body:** Hệ thống nhận diện giao dịch đã thực hiện, trả về mã 200 OK kèm thông tin cũ mà không trừ tiền thêm lần nào.

## 3. Quy ước dữ liệu và cấu trúc phản hồi

– **Giá trị tiền tệ:** Số tiền VND luôn được truyền và nhận dưới dạng chuỗi số nguyên để đảm bảo không bị sai lệch số học.  
– **Envelope chuẩn cho phản hồi thành công:**  
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "requestId": "1b6be851-86bf-4fc0-9e80-0208088f8e69" }
  }
  ```
– **Envelope cho danh sách phân trang:** Bổ sung thêm trường `pagination: { page, limit, total, totalPages }`.  
– **Envelope khi có lỗi:**  
  ```json
  {
    "success": false,
    "error": {
      "code": "MÃ_LỖI_NGHIỆP_VỤ",
      "message": "Thông điệp mô tả lỗi thân thiện",
      "details": [ { "field": "tên_trường", "reason": "lý_do_lỗi" } ]
    },
    "meta": { "requestId": "1b6be851-86bf-4fc0-9e80-0208088f8e69" }
  }
  ```
– **Thao tác đóng tài khoản thành công:** Trả về HTTP 204 No Content với body rỗng.  

## 4. Kiểm thử hợp đồng Swagger tự động

Để đảm bảo tài liệu Swagger luôn đồng bộ 100% với mã nguồn hiện tại của các Controller và DTO, nhóm đã thiết lập kịch bản kiểm thử hợp đồng tự động:

```powershell
npm run test:swagger
```

Lệnh này sẽ khởi chạy một máy chủ HTTP loopback tạm thời, sinh cấu trúc OpenAPI Schema từ các controller thực tế và đối chiếu tính toàn vẹn của schema mà không cần kết nối tới database.
