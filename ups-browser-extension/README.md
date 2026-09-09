# SpeeGo UPS Tracking — bản thử nghiệm 0.3.0

## Bản 0.3.0

Website chỉ gửi các vận đơn chưa có lần tra thành công. Toàn bộ vận đơn mới được mở và đọc đồng thời trên các tab UPS nền riêng; mỗi kết quả được lưu ngay khi trả về. Bỏ giới hạn một mã mỗi lượt và khoảng nghỉ ba giây. Hãng vận chuyển trên bảng được cố định là UPS.

Sau cập nhật ZIP, dòng kết nối phải hiện **Đã kết nối UPS 0.3.0**. Với 20 vận đơn chưa tra, nút chính phải hiện **Tra 20 đơn chưa tra** và cả 20 tab UPS được mở trong cùng lượt.

## Bản 0.2.1

Đọc riêng vùng **Package History** của UPS và chỉ nhận các dòng có giờ thực tế. Loại các mốc tiến trình tổng quát, chữ điều khiển (`Copy Tracking Number`, `completed`, `To:`), bản ghi lồng nhau và thời gian tóm tắt khác múi giờ. Các sự kiện thật trùng giờ nhưng khác nội dung như **Dropped off** và **Drop-Off** vẫn được giữ riêng.

Sau cập nhật ZIP, dòng kết nối phải hiện **Đã kết nối UPS 0.2.1**. Chạy lại **Cập nhật tracking** để thay lịch sử 26 dòng cũ bằng danh sách Package History đã làm sạch.

## Bản 0.2.0

Tự mở **Show Details** và đọc toàn bộ lịch sử hành trình UPS có ngày, giờ, địa điểm và chi tiết; trạng thái gần nhất vẫn chỉ lấy từ vùng trạng thái hiện tại để không đọc nhầm mốc tương lai. Website lưu tối đa 100 sự kiện cho mỗi mã, hiển thị dạng timeline và xuất mỗi sự kiện thành một dòng CSV.

Sau cập nhật ZIP, giải nén thay toàn bộ bản cũ, mở quản lý tiện ích và bấm **Tải lại**, sau đó tải lại trang Hà Hoà. Dòng kết nối phải hiện **Đã kết nối UPS 0.2.0**; website sẽ chặn tra bằng extension cũ vì bản cũ không trả lịch sử.

## Bản 0.1.9

Bổ sung quyền kết nối website cho deployment mới `https://cong-no-ha-hoa-v2.vercel.app`.

## Bản 0.1.8

Chẩn đoán thực tế `browser=complete method=inject INJECT_TIMEOUT content=Could not establish connection. Receiving end does not exist.` cho thấy tab UPS đã có kết quả nhưng listener của extension chưa được gắn. Bản này gắn reader từ `document_start`; nếu gặp một tab cũ chưa có listener, background tự chèn `reader.js` và `ups-content.js`, rồi gửi lại lệnh đọc trước khi dùng fallback một lần.

Sau cập nhật ZIP, mở quản lý tiện ích và bấm **Tải lại**, sau đó tải lại trang Hà Hoà. Dòng kết nối phải hiện **Đã kết nối UPS 0.1.8**; tab UPS cũ có thể giữ nguyên vì tiện ích sẽ tự gắn reader khi tra.

## Bản 0.1.7

Chẩn đoán thực tế `method=inject reader=0.1.6 INJECT_TIMEOUT` cho thấy content script chưa chạy trên tab UPS, sau đó fallback inject bị treo. Bản này tự reload tab UPS một lần để content script được gắn lại, rồi đọc tiếp; nếu vẫn lỗi sẽ ghi thêm `content=` và `reload=` trong chẩn đoán.

## Bản 0.1.6

Khi web đã báo **Đã kết nối UPS 0.1.5** nhưng chạy mã rồi hết thời gian với lỗi "Tiện ích không phản hồi", nghĩa là lệnh `track` trong background không trả lời kịp cho web. Bản này thêm timeout riêng cho từng bước Chrome API và trả chẩn đoán `0.1.6` trước khi web tự hết 60 giây.

## Bản 0.1.5

Nếu tab UPS đã hiển thị `Delivered` nhưng web Hà Hoà vẫn chạy mãi, bản này đọc qua content script cài trực tiếp trên tab UPS trước, rồi mới dùng `scripting.executeScript` làm dự phòng. Bổ sung quyền cho cả `ups.com` và `www.ups.com`, đồng thời link tải trên web có tham số phiên bản để tránh tải nhầm ZIP cũ từ cache.

Sau cập nhật ZIP, mở quản lý tiện ích và bấm Tải lại. Nếu Chrome hỏi quyền mới, xác nhận quyền UPS. Tải lại tab UPS và tab Hà Hoà; dòng kết nối phải hiện **Đã kết nối UPS 0.1.5**.

## Bản 0.1.4

Chẩn đoán thực tế 0.1.3 ghi `browser=complete WAIT_URL; reads=0`: chưa từng chạy reader vì metadata URL không khả dụng. Bổ sung quyền `tabs` để đọc URL tab, bỏ chờ vô hạn khi `Tab.url` bị ẩn, và kiểm tra origin/mã trực tiếp trong trang trước khi đọc DOM. Nếu Chrome không cấp quyền chạy script trên UPS, trả lỗi quyền ngay. 18 test UPS và lint qua, gồm URL bị ẩn, quyền UPS bị từ chối và trang chuyển sang mã khác.

Sau cập nhật ZIP, mở quản lý tiện ích và Tải lại. Nếu Chrome yêu cầu xác nhận quyền mới, xác nhận để bật lại tiện ích. Trong Chi tiết → Quyền truy cập trang web, cho phép trên `https://www.ups.com/*` và domain Hà Hoà (hoặc mọi trang được tiện ích yêu cầu). Tải lại cả tab UPS và Hà Hoà, kiểm tra **Đã kết nối UPS 0.1.4** rồi thử lại. Quyền tabs không thay thế quyền đọc nội dung UPS.

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
4. Tải lại website SpeeGo, đăng nhập, mở **Đơn hàng UPS** (`/tracking-ups`).
5. Dán cột mã từ Excel → **Thêm vào bảng** → **Tra các đơn chưa tra**.

Tiện ích này cài riêng với Zalo Bridge. Chỉ cho phép hai domain Hà Hoà được khai báo trong manifest và localhost/127.0.0.1. Preview/custom domain khác cần được thêm vào cả manifest và `allowedSender`.

## Hoạt động và giới hạn

- Các mã chưa tra chạy đồng thời; mỗi mã chờ tối đa khoảng 45 giây sau khi tạo tab. Số tab nền mở cùng lúc bằng số vận đơn trong lượt tra.
- Dùng lại tab UPS đúng mã nếu đang mở, nếu chưa có thì mở tab ở nền, không giành focus. Chỉ tab do tiện ích tạo mới tự đóng khi thành công. Khi UPS yêu cầu xác minh, chuyển trang hoặc không xác định được trạng thái, giữ tab để người dùng kiểm tra.
- Trạng thái gần nhất chỉ đọc từ vùng trạng thái riêng hoặc dấu `aria-current`. Lịch sử đọc riêng từ các dòng chi tiết có ngày/giờ sau khi mở **Show Details**; các nhãn tiến trình không có thời gian không được coi là lịch sử. Phải thấy đúng mã vận đơn trong nội dung trang.
- Không đọc cookie/token, không gọi API riêng của UPS và không vượt CAPTCHA. Có thể cần người dùng xử lý cookie/xác minh tại tab UPS.
- Giữ trang SpeeGo và trình duyệt mở cho tới khi cả lượt hoàn tất. Các mã đã tra thành công được lưu và không tự động tra lại ở lượt sau.
- Bảng tối đa 500 mã, lưu localStorage theo user ID trên trình duyệt. Không chia sẻ sang máy khác hoặc ghi trạng thái vào công nợ. Lỗi lần tra mới không xóa trạng thái thành công cũ; bảng hiển thị rõ thời gian và lỗi.
- **Delivered** là đã giao hàng, không phải đã thanh toán. Ngày/giờ trong timeline là dữ liệu UPS hiển thị; cột “Lần tra thành công” là thời gian tiện ích đọc dữ liệu.

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
