# SpeeGo UPS Runner 0.4.1

Máy nhà đề xuất: Windows, 6 nhân/12 luồng, RAM 16 GB. Bắt đầu 1 profile × 6 tab.
Không có kết luận máy đạt 2.000 đơn/30 phút trước khi đo UPS thật.

## Dùng máy nhà và laptop cùng lúc

- Máy nhà chạy bộ Runner và profile UPS. Laptop chỉ cần mở website và đăng nhập tài khoản được cấp quyền; không cần cài Node hoặc extension để xem kết quả. Dữ liệu nằm chung trên Supabase, không phụ thuộc laptop có đang mở hay không.
- Website đang mở làm mới danh sách khoảng 15 giây/lần khi không chạy tác vụ thủ công. Tab bị trình duyệt cho ngủ có thể cập nhật trễ; mở lại hoặc tải lại trang để lấy dữ liệu mới.
- Runner đọc lại danh sách đơn trong `speego` khoảng 60 giây/lần khi kết nối bình thường. 100 mã + 100 mã mới = theo dõi 200; thêm 200 nữa = theo dõi 400. Không cần dừng hoặc khởi động lại. Chỉ giữ số tab tối đa đã đặt, không mở 400 tab.
- Đơn mới phải **đã lưu vào bảng speego**. Nếu chỉ thêm trong hệ thống nguồn, bấm **Đồng bộ đơn tháng 9** trên web để đưa vào SpeeGo. Runner không tự gọi luồng nhập nguồn; bộ lọc nguồn hiện vẫn là tháng 9/2026.
- Mỗi đơn thành công có lịch riêng sau 30 phút. Khi lượng việc vượt khả năng máy, các mã chờ đến lượt và có thể trễ hơn 30 phút; không mở thêm tab vượt mức để cố bù. Thêm mã mới không xóa kết quả hoặc đặt lại lịch của các mã đang có.
- Mã trùng không được tạo thành hai dòng UPS trong bảng đích. Nếu nguồn có mã trùng/khớp mâu thuẫn, thao tác đồng bộ báo lỗi để xử lý, không âm thầm ghi đè đơn khác.

## Các tình huống đã gia cố trong 0.4.1

| Tình huống | Hành vi |
|---|---|
| Thêm 100 rồi 200 mã trong lúc tra | Nhận mã mới ở lượt làm mới; giữ công việc đang chạy và lịch cũ |
| Đồng bộ lại cùng danh sách | Cập nhật cùng các đơn, không nhân đôi hàng đợi |
| Đơn mới liên tục xuất hiện | Xếp theo thời điểm đến hạn; mã cũ đã quá hạn không bị mã mới chen mãi |
| Thay mã UPS của một đơn | Supabase lưu quan sát mã cũ vào `speego_tracking_archive`, xóa trạng thái tracking hiện tại để tra đầy đủ mã mới; giữ thông tin khách và thu tiền |
| Mã cũ trả kết quả sau khi đổi mã | Bỏ kết quả không còn khớp; không gán lịch sử mã cũ cho mã mới |
| Xóa đơn khi tab còn đang tra | Không tạo lại đơn; tab đang chạy vẫn được tính vào giới hạn cho đến khi kết thúc/hết hạn |
| Lỗi cũ về sau một kết quả thành công mới | Không ghi lỗi cũ đè lên kết quả mới |
| Làm mới danh sách khi đang đọc nhanh | Giữ nguyên thông tin của lượt đã nhận, không đổi nhầm chế độ đọc |
| Laptop tắt/mất mạng | Máy nhà tiếp tục nếu còn mạng; laptop đọc lại dữ liệu khi kết nối |
| Máy nhà mất mạng/điện hoặc Windows restart | Mạng mất: giữ outbox, ngừng nhận việc mới khi mất liên lạc quá hạn; mở lại tiếp tục từ SQLite. Tự khởi động yêu cầu đã cài task và đăng nhập Windows |
| Mở thêm Runner trên laptop | Chỉ một coordinator được giữ quyền chạy cho project; nên dùng laptop để xem và điều khiển web |

Không có hệ thống nào bảo đảm không gián đoạn do mất điện, hỏng ổ đĩa, CAPTCHA hoặc UPS thay giao diện. Không xóa `.runner-data` khi nâng cấp; đây là nơi giữ lịch và kết quả chưa gửi.

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
- Nhiều profile trên cùng máy dùng chung hàng đợi SQLite. Mỗi project chỉ một coordinator nhận quyền chạy; máy thứ hai chờ heartbeat máy trước hết hạn 5 phút, đủ thời gian cho lượt cũ hết hạn. Khởi động lại đột ngột cũng có thể phải chờ khoảng này. Không chạy hai bản bằng data directory khác nhau để tăng tải.

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
