# SpeeGo UPS Runner 0.4.0

Máy nhà đề xuất: Windows, 6 nhân/12 luồng, RAM 16 GB. Bắt đầu 1 profile × 6 tab.
Không có kết luận máy đạt 2.000 đơn/30 phút trước khi đo UPS thật.

## Cài lần đầu

1. Cài Node.js **24 LTS** và Edge hoặc Chrome. Giải nén toàn bộ gói vào thư mục cố định, ví dụ `C:\SpeeGo`.
2. Chạy `runner\start.cmd`. Điền `.env.runner` bằng URL và **service_role key của Supabase đích `skcnduuulyjeexwavbnd`**. Key chỉ ở chương trình Node trên máy nhà, không gửi vào trình duyệt. Không dùng key của project nguồn.
3. Cửa sổ profile riêng sẽ mở. Edge có thể tải tiện ích qua launcher. Nếu báo chưa kết nối, mở trang quản lý tiện ích của chính profile đó → Developer mode → Load unpacked → chọn thư mục `ups-browser-extension`. Chrome có thể yêu cầu thao tác này. Tải lại trang điều khiển; phải thấy extension **0.4.0**.
4. Bấm **Bật tự động** ở trang điều khiển hoặc website `/tracking-ups`. Sau khi đã bật, chương trình tự tiếp tục khi mở lại. Mặc định migration để tạm dừng nhằm tránh chạy trước khi cài xong.
5. Cài tự khởi động, từ PowerShell ở thư mục gói:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\runner\install-startup.ps1
```

Task chạy khi **đăng nhập Windows**, không chạy trước màn hình đăng nhập. Không tự cấu hình auto-login. Tắt chế độ Sleep trong Windows; có thể tắt màn hình. Thử khởi động lại máy và xác nhận heartbeat trên web trước khi để máy chạy lâu.

## Điều khiển và bảo mật

- Web cho biết máy online trong 60 giây gần nhất, trạng thái profile, số đơn đến hạn, tab đang chạy, số kết quả chờ gửi và tốc độ trung bình cửa sổ 15 phút. Chỉ admin được đổi bật/tắt và số tab.
- Trên máy, mở `.runner-data\open-dashboard.url` để vào bảng điều khiển. Link có khóa cục bộ, không chia sẻ.
- Không copy `.runner-data`, `.env.runner`, profile trình duyệt hoặc log lên Git/Vercel. Chúng có dữ liệu vận đơn và thông tin kết nối. Đặt thư mục trên tài khoản Windows riêng, chỉ người vận hành được truy cập.
- Chương trình chỉ nghe `127.0.0.1`, kiểm tra Host, Origin và Bearer token; không mở cổng ra mạng.
- Nhiều profile trên cùng máy dùng chung hàng đợi SQLite. Mỗi project chỉ một coordinator nhận quyền chạy; máy thứ hai chờ heartbeat máy trước hết hạn 2 phút. Không chạy hai bản bằng data directory khác nhau để tăng tải.

## Hành vi

- Không chờ cả lô. Tab hoàn tất sẽ nhường chỗ cho mã tiếp theo. Tổng tải mặc định 6, giới hạn 12; mỗi profile có giới hạn riêng trong env.
- Profile mới chưa bao giờ kết nối không bị mở lặp vô hạn. Profile đã kết nối rồi ngắt được thử mở lại sau ít nhất 3 phút. Nếu cần cài lại extension, vào đúng profile để xử lý.
- Mỗi đơn tra lại 30 phút sau khi lưu thành công. Lần đầu bộ chạy gặp đơn: lấy đầy đủ lịch sử; tiếp theo đọc nhanh trạng thái/EDD/sự kiện hiện tại hiển thị. Nếu thông tin thay đổi, lịch sử đầy đủ được xếp lượt tiếp theo. Đối soát đầy đủ ít nhất mỗi 6 giờ khi hàng đợi theo kịp.
- Sự kiện không hiển thị trong phần tóm tắt chỉ được phát hiện khi đọc đầy đủ. Không coi trạng thái không đổi là lịch sử không đổi.
- Không xóa lịch sử cũ khi đọc nhanh; lịch sử đầy đủ được gộp, không cắt bỏ dữ liệu đã lưu ở Supabase. UI hiện hiển thị tối đa 100 sự kiện/đơn.
- Đơn lỗi chờ 1, 2, 4… phút, tối đa 6 giờ giữa hai lượt. UPS yêu cầu xác minh: toàn bộ máy nghỉ 30 phút, hạ tải về 1 tab. Không tự vượt CAPTCHA.
- SQLite WAL lưu lease và outbox. Kết quả được ghi xuống đĩa trước khi báo đã nhận; lỗi mạng sẽ gửi lại. Lease 120 giây; kết quả quá hạn không thay kết quả của lượt mới. Tab của bộ chạy được đóng cả khi lỗi để không tích tụ RAM; tab UPS người dùng đã mở không bị đóng.
- Kết quả cũ không ghi đè quan sát mới hơn. Chỉ ghi trường tracking, không ghi lại dữ liệu khách hàng hoặc thu tiền. Thay đổi thu tiền trên web chỉ cập nhật trường thu tiền.
- Khi mất liên lạc điều khiển quá 60 giây, ngừng nhận việc mới. Kết quả đã nhận vẫn được giữ để gửi sau. Tạm dừng từ web có độ trễ tối đa khoảng 10 giây khi mạng bình thường.
- Mặc định tiếp tục tra đơn đã giao. Có thể đặt `SPEEGO_RUNNER_STOP_DELIVERED=true` để sau 2 lần xác nhận Delivered, giãn lịch còn mỗi tuần.

## Đổi profile / tải

Sửa `.env.runner`, dừng chương trình rồi mở lại. Ví dụ 2 profile, mỗi profile 4 tab: `SPEEGO_RUNNER_PROFILES=2`, `SPEEGO_RUNNER_TABS=4`; trên web đặt tối đa 8. Mỗi profile phải thấy extension 0.4.0. Chỉ tạo profile dành riêng SpeeGo, không dùng profile cá nhân.

Tự điều chỉnh tải: RAM trống dưới 1 GB thì hạ về 1 tab ngay, không chờ đủ mẫu. Mỗi phút, sau ít nhất 10 kết quả trong 2 phút gần nhất, giảm một nửa nếu lỗi >15% hoặc RAM trống <2 GB; tăng một tab nếu lỗi <5%, không vượt cấu hình. Đây là điều chỉnh theo lỗi/RAM, không phải cam kết tìm được tốc độ tối ưu. So sánh 6 → 8 → 12 bằng đơn thành công/phút và tỷ lệ lỗi, không bằng số tab mở.

## Dữ liệu và chẩn đoán

`.runner-data\queue.sqlite` là lịch, công việc đang làm, outbox và số đo 7 ngày. `runner.log` xoay vòng ở 5 MB, không ghi key hay thông tin khách hàng. Giữ nguyên thư mục này khi nâng cấp; không xóa để khắc phục lỗi mạng.

Nếu muốn dừng hẳn: tạm dừng trên web, chờ số tab và chờ lưu về 0, đóng chương trình. Gỡ tự khởi động bằng `runner\remove-startup.ps1`. Việc tắt chương trình không xóa dữ liệu.

## Phát triển

Migration đích: `supabase/migrations/20260910020000_speego_runner.sql` và các bản bổ sung. Chạy `npm test`, `npm run lint`, `npm run build`. Tạo gói tải xuống bằng `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/package-runner.ps1`.
