# Đánh giá hệ thống đầu pha 2

Đánh giá dựa trên code ở commit `c347c92`. Số đo pha 1 chạy trên commit `a4a0f83` của repo gốc, lấy từ [phase1-load-test.md](../performance/phase1-load-test.md) (Kaggle CPU, 4 vCPU, 28/10 và 31/10/2026).

## Những gì đã tốt, cần giữ

- Ranh giới lớp sạch. Domain không import framework, application không import adapter. `npm run check:harness` giữ điều này trong CI.
- Tính đúng của tiền đã được kiểm chứng dưới tải: 27 lượt đo rút tiền đồng thời đều khớp sổ cái, bài test 20 lệnh rút trên số dư 100.000 ra đúng 10 thành công và số dư 0.
- Chuyển khoản khoá hai tài khoản theo thứ tự UUID, có `Idempotency-Key` với ràng buộc duy nhất trong DB.
- Có 25 bộ unit test, integration test với Postgres thật (gồm 9 ràng buộc CHECK), e2e qua HTTP, test hợp đồng Swagger.

## Điểm nghẽn đo được

### 1. Đăng nhập bị giới hạn bởi CPU

| VU | req/s | p50 | p99 | CPU app |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 11.19 | 341 ms | 399 ms | 368% |
| 20 | 11.75 | 1.59 s | 1.68 s | 390% |
| 80 | 11.72 | 6.68 s | 6.79 s | 390% |

Mỗi lần `bcrypt.compare` với cost 12 tốn khoảng 300 ms CPU. 4 lõi cho trần lý thuyết khoảng 13 req/s, thực tế đạt 11.7. Sau điểm bão hoà, thêm client chỉ làm hàng đợi dài ra: độ trễ tăng tuyến tính, throughput đứng yên. Hệ thống không từ chối request nào, nên client ở 80 VU chờ gần 7 giây cho một lần đăng nhập.

Không giải quyết bằng cách hạ cost bcrypt (đổi bảo mật) hay thêm tiến trình trên cùng máy (không thêm CPU). Hướng kiến trúc hợp lý là giới hạn đồng thời và từ chối sớm khi quá tải (bulkhead, load shedding), xem P2-03.

Chưa biết: tải đăng nhập có làm chậm các endpoint khác không. bcrypt chạy trên threadpool của libuv (`UV_THREADPOOL_SIZE=4`) chứ không chặn event loop, nhưng CPU đã kín 4 lõi nên Postgres và k6 cũng bị tranh. Pha 1 không đo tải hỗn hợp nên chưa có số. P2-01 phải đo điều này trước khi P2-03 chọn mục tiêu.

### 2. Rút tiền trên một tài khoản nóng

| VU | req/s | p50 | p95 | p99 |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 44.52 | 10.8 ms | 13.3 ms | 21.3 ms |
| 20 | 99.44 | 44.7 ms | 324 ms | 583 ms |

CPU app chỉ 62% ở 20 VU, nên đây không phải nghẽn CPU. Mọi request đều `SELECT ... FOR UPDATE` cùng một dòng, giữ khoá suốt ba câu lệnh (khoá, cập nhật số dư, ghi sổ cái) cộng các vòng round trip giữa Node và Postgres. Request sau xếp hàng chờ khoá, nên đuôi phân phối (p95, p99) phình ra nhanh hơn p50.

Hướng có thể cân nhắc trong ADR của P2-02: rút ngắn đoạn giữ khoá (một câu `UPDATE ... WHERE balance >= amount RETURNING` thay cho đọc rồi ghi), hoặc xếp hàng theo tài khoản ở tầng ứng dụng để chỉ một request mỗi tài khoản xuống DB tại một thời điểm. Cách nào cũng phải giữ nguyên bất biến tiền trong `AGENTS.md`.

### 3. Đọc danh sách tài khoản không phải vấn đề

p50 khoảng 4 ms ở mọi mức tải, throughput tăng tuyến tính tới 188 req/s ở 20 VU, CPU app 50%. Thêm cache ở đây sẽ thêm độ phức tạp (vô hiệu hoá cache khi số dư đổi) mà không có số đo nào cho thấy cần. Không làm, trừ khi baseline v2 ở 50 hoặc 100 VU cho thấy khác.

## Khoảng trống trong số đo pha 1

- Không có kịch bản chuyển khoản, trong khi đây là luồng phức tạp nhất (khoá hai dòng, idempotency).
- Rút tiền chỉ đo trên một tài khoản, nên chưa tách được chi phí ghi nói chung với chi phí tranh khoá.
- Tối đa 20 VU cho rút tiền và xem tài khoản.
- Không có tải hỗn hợp.
- k6, Node và Postgres chạy chung 4 vCPU. Kết quả vẫn so sánh được nếu trước và sau giữ cùng cách chạy, nhưng con số tuyệt đối thấp hơn khi tách máy. Ghi rõ điều này trong báo cáo.

P2-01 lấp các khoảng trống này.

## Phát hiện khác

- `README.md` (mục chạy bằng Docker) in sẵn một mật khẩu DB và một `JWT_ACCESS_SECRET` trông như giá trị thật. Nếu đã dùng ở đâu thì coi như lộ: đổi giá trị và thay trong README bằng chỗ trống như `.env.example`.
- Healthcheck của `Dockerfile` coi mã 401 từ `/api/v1/accounts` là sống. Nó không kiểm tra được DB, và sẽ gãy nếu ai đổi luật xác thực. P2-04 thay bằng health endpoint riêng (mẫu Health Endpoint Monitoring trong case study 3 của môn).
- `prisma-unit-of-work.ts` ép kiểu bản ghi Prisma thẳng sang kiểu của port, nên `amount` và `balanceAfter` là `Decimal` thay vì `string`. Integration test `banking-flow.spec.ts` bắt được, HTTP thì không vì JSON tự đổi sang chuỗi. Đã sửa trong P2-00.
- Repo chưa có CI, nên test integration đỏ ở trên không ai thấy. P2-00 thêm CI.

## Liên hệ với case study của môn

| Case study | Áp dụng ở đây |
| --- | --- |
| CS1: cải thiện hiệu năng bằng pattern kiến trúc | P2-02, P2-03 |
| CS2, CS4: hàng đợi, publish-subscribe | Chỉ cân nhắc trong P2-02 nếu chọn xếp hàng theo tài khoản. Đổi API sang bất đồng bộ cần cả nhóm đồng ý vì đổi hợp đồng với client. |
| CS3: Health Endpoint Monitoring | P2-04 |
| CS5: chống chặn, so sánh giải pháp | ADR của P2-02 và P2-03 phải so sánh ít nhất hai phương án bằng số đo hoặc lập luận cụ thể |
