# Bộ Công Cụ Userscripts (Automation & Monitoring Suite)

Kho lưu trữ mã nguồn mở các Userscript (Tampermonkey) hỗ trợ học tập, làm việc và tương tác tự động trên nền tảng Web.

---

## 📦 Danh sách công cụ

### 1. Giám Sát Moodle (`giam-sat-moodle.user.js` & `giam-sat-moodle-alarm.user.js`)
- **Mục đích**: Tự động phát hiện Bài tập (Assignment) và Quiz mới, theo dõi hạn chót (Deadline), cảnh báo hết hạn session và tự động đăng nhập duy trì kết nối trên Moodle HCMUS (`courses.hcmus.edu.vn`, `moodle.hcmus.edu.vn`).
- **Phiên bản Alarm**: Tích hợp chuông báo thức liên tục (sawtooth wave qua Web Audio API) kèm popup cảnh báo trực quan cho đến khi được tắt hoặc hết hạn quiz.
- **Tính năng**:
  - Quét ngầm nền không cần F5 trang.
  - Chụp ảnh màn hình bài tập/quiz bằng iframe và `html2canvas`.
  - Báo cáo đa kênh: Discord Webhook, Telegram Bot, Pushbullet.
  - Floating UI: Thanh điều khiển nổi đếm ngược thời gian quét, nút Tạm dừng (Pause), Tiếp tục (Resume), Đặt lại cache (Reset).

### 2. Hỗ Trợ Quiz Moodle (`ho-tro-quiz-moodle.user.js`)
- **Mục đích**: Hỗ trợ giải bài tập trắc nghiệm và câu hỏi quiz Moodle song song qua AI.
- **Tính năng**:
  - Đọc đề bài, hình ảnh câu hỏi, các lựa chọn đáp án tự động.
  - Mở nhiều tab xử lý song song để tiết kiệm thời gian.
  - Tự động điền đáp án an toàn, có cơ chế xác nhận trước khi nộp.
  - Toast thông báo trạng thái trực quan.

### 3. Tự Động Đăng Ký Học Phần (`auto-dang-ky-hoc-phan.user.js`)
- **Mục đích**: Tự động nhận diện môn học, ưu tiên xếp lớp và đăng ký học phần trên Portal trường (`new-portal*.hcmus.edu.vn`).
- **Tính năng**:
  - Cơ chế ưu tiên lớp (Priority 1, Priority 2) dựa trên số lượng slot còn lại.
  - Chế độ **Sniper Mode**: Tự động canh slot và refresh thông minh với backoff chống rate-limit khi các lớp mong muốn bị đầy.
  - Tự động dừng để người dùng nhập CAPTCHA an toàn trước khi bấm xác nhận đăng ký.
  - Thông báo kết quả ngay lập tức qua Discord, Telegram, Pushbullet.

### 4. Facebook Auto Comment & Interaction Bot (`fb-auto-comment.user.js`)
- **Mục đích**: Bot tự động tương tác và bình luận bài viết theo từ khóa trong nhóm Facebook.
- **Tính năng**:
  - Giao diện điều khiển nổi (Floating Panel) hiện đại, có thể thu nhỏ.
  - Chia tách 2 pha: Tìm nút kích hoạt (Activator) và Điền nội dung vào composer (Opened Composer).
  - Tự động phát hiện tạm khóa hoặc checkpoint để dừng bot an toàn.
  - Cơ chế retry tối đa 3 lần cho mỗi bài viết, tránh lặp vô hạn.

### 5. 9Router Auto Login (`9router-autologin.user.js`)
- **Mục đích**: Tự động điền mật khẩu và đăng nhập trang quản trị 9Router trên `localhost:20128`.
- **Tính năng**:
  - Bypass React value tracker bằng prototype setter gốc.
  - Tự động dừng interval khi phát hiện form đăng nhập đã unmount thành công.

---

## ⚙️ Hướng dẫn cài đặt chung

1. Cài đặt tiện ích mở rộng [Tampermonkey](https://www.tampermonkey.net/) trên trình duyệt (Chrome, Edge, Firefox, Brave,...).
2. Mở file script `.user.js` tương ứng trong thư mục này.
3. Sao chép nội dung script, vào Tampermonkey -> **Tạo script mới** (Create a new script) -> Dán đè toàn bộ nội dung -> Nhấn **Ctrl + S** để lưu.
4. Đối với các script có gửi thông báo (Discord, Telegram, Pushbullet), bạn có thể cấu hình token và URL webhook thông qua tab **Values** (Cài đặt lưu trữ) của script trong Tampermonkey hoặc điền vào biến cấu hình ở đầu file.
