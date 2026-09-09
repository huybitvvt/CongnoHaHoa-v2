# Hà Hoà UPS Tracking — bản thử nghiệm 0.1.3

## Bản 0.1.3

Bỏ điều kiện `tabs.status === complete`, dùng `injectImmediately` để thử đọc DOM khi tài nguyên khác vẫn đang tải. Timeout ghi tab ID, trạng thái trình duyệt, số lần đọc, phiên bản reader và điều kiện chưa đạt (mã chưa hiển thị / trạng thái chưa xác định). Chưa xác nhận đây là nguyên nhân trên máy người dùng; đây là sửa điều kiện chờ và bổ sung bằng chứng chẩn đoán.

Đã qua 15 test UPS, lint và kiểm tra toàn bộ website bridge → extension Edge → DOM thực tế người dùng cung cấp với `tabs.status` giả lập là `loading`: trả Delivered đúng mã. Sau khi cập nhật thư mục extension, bấm Tải lại tiện ích và website; phải hiện **Đã kết nối UPS 0.1.3**.

## Bản 0.1.2

Đọc đúng `app-header-tile #stApp_nameKey` trong DOM UPS người dùng cung cấp, loại chữ biểu tượng `check_circle` trên bản sao DOM. Bỏ selector tiền tố `st_App_PkgSts` vì nó trỏ cả ngày/giờ giao, không phải trạng thái. Kiểm tra trên Edge với toàn bộ DOM đã cung cấp: bản cũ trả null, bản mới trả Delivered; đổi trạng thái sang On the Way được đọc đúng, mã khác bị từ chối. 13 test UPS qua. File DOM riêng của người dùng không đưa vào repo hoặc bản cài.

Để cập nhật: thay file trong thư mục tiện ích đã cài bằng ZIP mới, bấm Tải lại tiện ích và tải lại website; phải hiện **Đã kết nối UPS 0.1.2**.

## Cập nhật từ 0.1.0

Tải ZIP mới, giải nén và thay toàn bộ file trong thư mục tiện ích đã cài. Mở trang quản lý tiện ích, bấm Tải lại, rồi tải lại trang Hà Hoà. Kiểm tra phải hiện **Đã kết nối UPS 0.1.1**. Giữ tab UPS đang hiển thị đúng mã mở rồi bấm **Thử lại mã lỗi**.

Bản 0.1.1 dùng lại tab đúng mã, không đóng tab người dùng; đọc DOM trong một lần chèn script để tránh mất hàm khi trang điều hướng; thử lại lỗi frame tạm thời trong 45 giây; hiển thị chi tiết lỗi quyền/truy cập; hỗ trợ tiêu đề trạng thái trong banner nhỏ chứa đúng mã. Đã qua 12 test UPS và test bridge Edge với DOM giả lập. Chưa xác nhận trên phiên UPS thật của người dùng.

Không cần UPS API key. Extension đọc DOM hiển thị trên trang tracking công khai, chỉ khi người dùng bấm cập nhật. Cần kiểm chứng selector trên UPS thực tế trước khi coi là dùng ổn định.

## Cài đặt

1. Tải `/ups-tracking-extension.zip` từ web hoặc dùng thư mục `ups-browser-extension` trong repo.
2. Giải nén. Mở `edge://extensions` hoặc `chrome://extensions`, bật Developer mode.
3. Load unpacked → chọn thư mục chứa `manifest.json`.
4. Tải lại website Hà Hoà, đăng nhập, mở **Tracking UPS** (`/tracking-ups`).
5. Dán cột mã từ Excel → **Thêm vào bảng** → **Cập nhật tracking**.

Tiện ích này cài riêng với Zalo Bridge. Chỉ cho phép hai domain Hà Hoà được khai báo trong manifest và localhost/127.0.0.1. Preview/custom domain khác cần được thêm vào cả manifest và `allowedSender`.

## Hoạt động và giới hạn

- Một mã một lần trên toàn extension; khoảng cách bắt đầu ít nhất 3 giây. Mỗi mã chờ tối đa khoảng 45 giây sau khi tạo tab.
- Dùng lại tab UPS đúng mã nếu đang mở, nếu chưa có thì mở tab ở nền, không giành focus. Chỉ tab do tiện ích tạo mới tự đóng khi thành công. Khi UPS yêu cầu xác minh, chuyển trang hoặc không xác định được trạng thái, giữ tab để người dùng kiểm tra và dừng hàng đợi.
- Chỉ đọc trạng thái từ vùng trạng thái riêng hoặc dấu `aria-current`; không suy luận từ danh sách các mốc tiến trình. Phải thấy đúng mã vận đơn trong nội dung trang. Trạng thái mới/lạ báo không đọc được, không đoán.
- Không đọc cookie/token, không gọi API riêng của UPS và không vượt CAPTCHA. Có thể cần người dùng xử lý cookie/xác minh tại tab UPS.
- Giữ trang Hà Hoà và trình duyệt mở; rời trang dừng các mã tiếp theo. Nút Dừng chờ mã hiện tại kết thúc. Không tự chạy lại sau khi đóng/mở trình duyệt.
- Bảng tối đa 500 mã, lưu localStorage theo user ID trên trình duyệt. Không chia sẻ sang máy khác hoặc ghi trạng thái vào công nợ. Lỗi lần tra mới không xóa trạng thái thành công cũ; bảng hiển thị rõ thời gian và lỗi.
- **Delivered** là đã giao hàng, không phải đã thanh toán. Thời gian trên bảng là lần tra thành công, không phải thời gian giao hàng.

## Kiểm tra thủ công bắt buộc trước khi dùng thật

Tra một mã còn hoạt động trên UPS, so sánh trạng thái bảng với tab UPS; tiếp tục với mã chưa giao và mã sai. Kiểm tra cookie/CAPTCHA, đóng tab giữa chừng, dừng hàng đợi và thử đồng thời từ hai tab Hà Hoà. Test tự động dùng DOM giả lập để kiểm tra chống đọc nhầm, không chứng minh UPS thực tế cho phép chạy nền.

### Kết quả kiểm tra ngày 09/09/2026

- `npm.cmd test`: 25/25 test qua, trong đó 9 test mới cho UPS.
- `npm.cmd run lint` và `npm.cmd run build`: qua; build có route `/tracking-ups`.
- Edge headless nạp extension thật: website gửi mã → service worker mở tab → đọc DOM giả lập UPS → trả đúng `On the Way` dù có mốc `Delivered` → đóng tab thành công. Trong bài kiểm tra, tab được mở about:blank trước để Playwright kịp gắn bộ chặn request; không sửa luồng production vì mục đích này.
- UPS thật: HTTP trực tiếp timeout; Edge báo `ERR_HTTP2_PROTOCOL_ERROR`. Chưa có bằng chứng selector khớp UPS hiện tại hoặc chạy ổn định với mã thật. Đây là bản cài thử, chưa triển khai Vercel.

## Đóng gói lại sau thay đổi

Tại thư mục gốc repo, PowerShell:

```powershell
Compress-Archive -Path ups-browser-extension/* -DestinationPath public/ups-tracking-extension.zip -Force
```
