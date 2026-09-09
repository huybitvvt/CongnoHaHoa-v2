# Kiểm chứng ngày 10/09/2026

## Phạm vi

Đã thử trên máy phát triển Intel Core i3-1215U, 6 nhân/8 luồng, khoảng 8 GB RAM, Windows và Edge; không phải máy nhà 6 nhân/12 luồng, RAM 16 GB. Dữ liệu đích có 54 đơn ở thời điểm thử. Không thay đổi project nguồn.

## UPS thật

| Lượt | Kết quả | Thời gian từ nhận việc đến trả kết quả |
|---|---|---|
| Ban đầu, 6 tab rồi tự giảm tải | 25 lượt: 16 thành công, 9 lỗi | Một số trang trắng/tải chậm, có lượt hết hạn 45 giây; RAM trống từng xuống khoảng 0,3 GB |
| Đọc nhanh, 1 tab, 8 mã đã đọc đầy đủ | 8/8 thành công | Trung bình 6,5 giây; khoảng 5,5–8,1 giây |
| Đọc đầy đủ lại cùng nhóm 8 mã, 1 tab | 8/8 thành công | Trung bình 11,6 giây; khoảng 9,3–20,2 giây |

Lượt đọc nhanh còn kích hoạt một lượt bổ sung lịch sử đầy đủ thành công, khoảng 10,3 giây. Tất cả kết quả đã nhận trong các lượt này được gửi về Supabase; outbox về 0 sau khi tạm dừng.

Thời gian đọc nhanh trung bình thấp hơn khoảng 44% so với lượt đầy đủ trên mẫu này. Các lượt chạy nối tiếp, không ngẫu nhiên hóa thứ tự, và bộ nhớ/mạng có thể khác nhau giữa các lượt. Đây là bằng chứng chế độ đọc nhanh có tác dụng, không phải benchmark có kiểm soát hoặc cam kết tốc độ toàn hệ thống. Không nhân tuyến tính số tab để dự đoán máy nhà.

Chưa kiểm chứng 1.000–2.000 mã thật, tải 8–12 tab trên máy 16 GB, hoặc vận hành 24 giờ liên tục. Mục tiêu 2.000 mã/30 phút cần ít nhất khoảng 67 kết quả thành công/phút, chưa được chứng minh trong lần thử này.

## Kiểm thử phần mềm

- Hàng đợi 2.000 công việc mô phỏng qua 6 vị trí xử lý: không giao trùng mã đang chạy, không mất kết quả, không tồn đọng outbox sau khi hoàn tất. Đây là kiểm thử bộ điều phối, không phải tốc độ UPS.
- Lease hết hạn, kết quả trả muộn, sai worker, gửi trùng; khởi động lại từ SQLite trên đĩa khi có outbox; thử lại có khoảng chờ; đơn bị xóa; đọc nhanh yêu cầu đối soát đầy đủ khi quan sát thay đổi.
- Reader: trạng thái đúng mã, lịch sử không bị gán nhầm, bỏ mở chi tiết khi đọc nhanh, không trả history rỗng để ghi đè, tab tự động luôn đóng sau lỗi.
- Supabase thật: lời gọi heartbeat bằng anon bị từ chối; coordinator thứ hai không chiếm quyền khi coordinator thứ nhất còn hoạt động.
- HTTP cục bộ: không có token nhận 401; Origin khác nhận 403.
- Hai profile riêng đã tự mở và tải extension; khởi động lại coordinator không tạo thêm cửa sổ worker trong profile đang hoạt động. Đã đóng toàn bộ trình duyệt profile-1 qua CDP; supervisor mở lại và profile-1 kết nối trở lại, profile-2 vẫn online.
- Đã đăng nhập trang production bằng phiên kiểm thử của admin hiện có (không gửi email), xác nhận panel, trạng thái hai profile, nút điều khiển và nút tải gói hiện đúng; đã kiểm tra ảnh chụp panel.
- 55 test tự động; build Next.js, TypeScript và ESLint đã chạy thành công. Vercel production build cũng thành công.

## Cấu hình bàn giao

Mặc định 1 profile × 6 tab; RAM trống dưới 1 GB tự hạ về 1 tab. Tự động được tạm dừng sau mỗi lượt đo; bộ chạy và trình duyệt thử được đóng khi bàn giao. Không cài Scheduled Task hoặc đổi cấu hình Sleep trên máy phát triển. Máy nhà cần cài gói, điền kết nối đích, kiểm tra extension và bật tự động một lần. Thư mục riêng `E:\SpeeGo-home-0.4.0` đã có cấu hình đích, chỉ dùng để chuyển riêng sang máy nhà; gói tải công khai không chứa khóa.
