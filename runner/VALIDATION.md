# Kiểm chứng ngày 10/09/2026

## Bổ sung Runner 0.4.3

Đo lại bằng Google Chrome 152 trên máy test Intel Core i3-1215U, 6 nhân/8 luồng, RAM 7,69 GB. Đây không phải máy nhà 6 nhân/12 luồng, RAM 16 GB. RAM trống thấp nên bộ điều phối áp trần 1 tab ngay từ lúc khởi động; không thử ép 9–30 tab.

| Chế độ, 1 tab | Kết quả | Tốc độ chuỗi | Thời gian từng lượt | Trễ từ nhận kết quả đến Supabase xác nhận |
|---|---:|---:|---:|---:|
| Đọc nhanh | 8/8 thành công | 10,30 đơn/phút | trung bình 4,53 giây; 3,07–6,30 giây | trung bình 1,36 giây; p95 2,26 giây |
| Đọc đầy đủ | 8/8 thành công | 6,11 đơn/phút | trung bình 8,34 giây; 7,34–9,51 giây | trung bình 1,48 giây; p95 2,50 giây |

Trong cửa sổ đo nhanh, toàn bộ tiến trình Chrome/Node trên máy dùng CPU trung bình 18,6%, đỉnh 63%; RAM trống thấp nhất 248 MB, working set cao nhất 2.318 MB. Cửa sổ đầy đủ: CPU trung bình 16,9%, đỉnh 67%; RAM trống thấp nhất 336 MB, working set cao nhất 2.406 MB. Các số CPU/RAM gồm toàn bộ Chrome/Node trên máy test, không phải phép cô lập riêng một tab. Không có lỗi, timeout hoặc trang xác minh UPS trong hai mẫu chuẩn 8 + 8.

Trong lúc runner đang quét, đồng bộ thật chỉ đọc bảng `orders` nguồn và thêm 13 đơn UPS tháng 9 mới vào đích. Hàng đợi tự tăng 54 → 67 sau lượt làm mới, không restart; đối chiếu sau đó cho thấy đủ 39/39 đơn nguồn và không còn đơn nguồn bị thiếu ở đích. Cả 39 dòng đều giữ đủ name, phone, address, delivery staff, amount, unit price và currency khi nguồn có dữ liệu. Schema nguồn thực tế không có cột email nên email của 39 dòng này là `null`; không tự suy đoán dữ liệu. Đóng profile-1 đang rảnh: profile-2 tiếp tục chạy, supervisor mở lại profile-1 sau khoảng 97 giây và extension 0.4.0 tự kết nối.

Đã kiểm tra bundle production `speedgo-os.web.app`: trang settlement đăng nhập Firebase rồi đọc trực tiếp Firestore `orders` và `users`; nút làm mới không gọi API REST danh sách đơn. Dữ liệu thật ngày kiểm tra có 44 đơn tháng 9, 26 đơn có mã UPS nhưng chỉ 23 mã duy nhất. Cả 26 có tên, số điện thoại, địa chỉ, người tạo/người bán, số tiền và tiền tệ; trường email tồn tại nhưng đều trống. Luồng mới chỉ gửi `GET` tới Firestore sau bước đăng nhập, chọn đơn cập nhật mới nhất khi nhiều đơn dùng chung mã, và gộp 23 mã mới vào Supabase đích. Tổng đích tăng 67 → 90; chạy lại cho kết quả thêm 0, cập nhật 62. Supabase nguồn và SpeedGo không nhận thao tác ghi.

Restart bản cũ tái hiện thời gian chờ lease gần 5 phút. Runner 0.4.3 lưu `owner-id` trong `.runner-data`: restart cùng bộ cài nhận lại quyền ngay, còn data directory/máy khác vẫn chờ lease. Thử dừng coordinator khi một lượt UPS đang chạy: profile giữ 1 kết quả trong localStorage; sau restart kết quả được nhận và gửi, localStorage và SQLite outbox đều về 0.

Công cụ benchmark đã sửa hai lỗi phát hiện trong lần đo: quick trước đây có thể bị chạy thành full khi `full_at` quá cũ, và trần điều khiển bị để lại ở 1 sau phép thử. Công cụ hiện ép đúng chế độ, khôi phục trần cũ và ghi thêm tốc độ thành công cùng độ trễ upload. Toàn bộ 71 test tự động và production build đã qua sau thay đổi; lint qua sau khi xóa công cụ phân tích bundle tạm thời.

## Bổ sung Runner 0.4.2

Kiểm thử tự tăng từ 9 đến 30 khi thông lượng tăng, quay lui khi tốc độ không cải thiện, giữ tải khi thiếu mẫu/thiếu việc/tạm dừng/chờ gửi, giảm khi RAM thấp/lỗi cao, và trần từng profile. Mô phỏng 2.000 đơn qua 30 vị trí trên 3 profile không mất hoặc trùng lease; đây là kiểm thử hàng đợi, không phải phép đo tốc độ UPS. Build và lint được kiểm tra khi phát hành.

Chrome thông thường yêu cầu cài extension bằng Load unpacked một lần trong từng profile. Không dùng phép đo Edge cũ để cam kết tốc độ Chrome 30 tab hoặc độ ổn định máy nhà 24 giờ.

Smoke test Chrome trên máy phát triển: mở được profile-1, profile-2, profile-3; kết nối Supabase đích, cấu hình 3 × 10, trần 30. RAM trống đo được 355 MB nên giới hạn tự hạ về 1. Runner giữ tạm dừng; không tra UPS trong phép thử này. Đã đóng các profile thử. Tổng 69 kiểm thử qua.

## Bổ sung Runner 0.4.1

62 test tự động đã qua, gồm 7 kiểm thử mới: tăng 100 → 200 → 400 trong lúc tra, làm mới giữa lượt đọc nhanh, đổi mã khi rảnh/đang chạy, xóa khi đang chạy, kết quả lỗi đến muộn, và thứ tự ưu tiên khi liên tục thêm mã. Migration đích kiểm tra việc lưu trữ quan sát mã cũ và giữ trường thu tiền bằng subtransaction tự rollback; không giữ lại đơn thử. Các số đo UPS thật bên dưới thuộc 0.4.0; lần gia cố này không đo lại tốc độ UPS.

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
