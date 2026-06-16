# Giam Sat Moodle (Moodle Monitor v4.0)

## 📌 Giới thiệu
**Moodle Monitor v4.0** là script Tampermonkey tối ưu và mạnh mẽ nhất dành riêng cho các hệ thống Moodle (`courses.hcmus.edu.vn` và `moodle.hcmus.edu.vn`). 
Được thiết kế để chạy ngầm, script tự động săn các Bài tập (Assignment) và Quiz mới, phát hiện các thay đổi hạn chót (Deadline) và trạng thái nộp bài. Khi có sự kiện, nó sẽ chụp lại ảnh màn hình bằng `html2canvas` và báo cáo đồng loạt qua đa nền tảng Webhook (Discord, Telegram, Pushbullet) theo thời gian thực!

## ✨ Tính năng nổi bật
1. **Auto-Detect Background (Quét ngầm không cần F5):**
   - Theo dõi các Bài tập và Quiz mới xuất hiện.
   - Check trạng thái cá nhân hóa: "Chưa làm", "Đang làm dở", "Hoàn thành", "Quá hạn".
2. **Session Survival & Auto-Login:**
   - Cảnh báo tức thời nếu phiên (Session) Moodle bị hết hạn.
   - Tự động click chuyển hướng Đăng nhập thông qua nút Microsoft Account để duy trì luồng theo dõi.
3. **Capture & Smart Screenshot:**
   - Ứng dụng iframe cô lập để gọi render lại trang bài tập và chụp ảnh màn hình (Screenshot). 
   - Hình ảnh được tự động đính kèm vào trong các thông báo Telegram và Discord.
4. **Hệ Thống Phân Tán Báo Cáo Đa Kênh:**
   - **Discord:** Embeds tuyệt đẹp, phân màu theo trạng thái (Xanh = Đã nộp, Đỏ = Mới ra, Vàng = Nhắc nhở, Xám = Hết hạn).
   - **Telegram:** Gửi Photo caption siêu nhanh tới thiết bị di động của bạn.
   - **Pushbullet:** Đẩy Notification popup cực nhạy.
5. **Interactive Floating UI:**
   - Thanh trạng thái nổi góc dưới màn hình, hiển thị tiến độ quét và đếm ngược tự động.
   - Bảng điều khiển tích hợp: Tạm dừng (`Pause`), Tiếp tục (`Resume`), và Khôi phục cache (`Reset`).

## ⚙️ Hướng dẫn cài đặt
1. Tải và cài đặt tiện ích mở rộng [Tampermonkey](https://www.tampermonkey.net/).
2. Nhấn vào biểu tượng Tampermonkey -> **Create a new script...**
3. Copy toàn bộ nội dung của tệp `giam-sat-moodle.user.js` nằm trong thư mục này và dán vào, sau đó nhấn `Ctrl + S` để lưu lại.
4. Cấp quyền truy cập `Cross-Origin Request` (Allow Always) khi có popup yêu cầu ở lần chạy đầu tiên trên trang Moodle.

## 🔧 Hướng dẫn tùy chỉnh cấu hình (Config)
Bạn có thể tự mở Script Editor của Tampermonkey để thay đổi các thông số ở mục `CONFIG`:
- **Webhooks URL:** 
  - `DISCORD_WEBHOOK_URL`: (Tùy chọn) Gắn Webhook Channel Discord.
  - `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`: (Tùy chọn) Điền token Bot Father và User ID của bạn.
  - `PUSHBULLET_TOKEN`: (Tùy chọn) API Token của ứng dụng Pushbullet.
- **Tính toán thời gian quét:**
  - `CHECK_INTERVAL_MS`: Thời gian giãn cách giữa các lần Refresh (Khuyên dùng: 60000ms = 1 phút).

## 🛡 Tính năng bảo vệ và Độ ổn định
- Tích hợp hàng đợi Webhook (Queue System) kết hợp `RETRY_DELAY_MS` để chặn việc gửi spam nhiều tin một lúc gây Rate Limit từ API bên thứ 3.
- Xử lý Request HTML tĩnh `fetch(url, { cache: 'no-store' })` giảm thiểu tối đa áp lực tải lên Server nhà trường.
- Tự động xóa dọn bộ nhớ các Quiz cũ quá 30 ngày (Stale Days Clean Up) để trình duyệt không bị đầy RAM.

---
**Phiên bản hiện tại:** 4.0
