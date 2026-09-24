# Coursera Helper — Quiz Cleaner & AI Solver 🚀

<img width="1660" height="898" alt="Screenshot 2026-09-23 132024" src="https://github.com/user-attachments/assets/62e4bb81-848e-480a-9f37-75639d9c085c" />

![Version](https://img.shields.io/badge/version-2.1.3-indigo.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Gemini API](https://img.shields.io/badge/AI-Gemini%203.6%20Flash-emerald.svg)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge-blue.svg)

> **Coursera Helper** là công cụ hỗ trợ học tập toàn diện trên nền tảng Coursera: Tự động loại bỏ prompt injection ẩn, giải bài tập trắc nghiệm bằng Gemini AI siêu tốc (2s), tua video thông minh thích ứng theo tick xanh (nhanh pass ngay, chậm kiên nhẫn đợi), và tự động chấm điểm Peer Review.

---

## 🌟 Tính năng nổi bật (Features)

### 1. ⚡ Tự Giải Cả Bài Trắc Nghiệm (Zero-Click Quiz Solver)
- **Giải bài siêu tốc (1.5 - 2.5s)**: Sử dụng mô hình thế hệ mới **`gemini-3.6-flash`** (và hỗ trợ `gemini-3.8-flash`) xử lý đồng thời 10-12 câu hỏi kèm hình ảnh.
- **Tự động tick đáp án**: Nhận diện nguyên văn lựa chọn (Radio / Checkbox) và tự động tích chọn chính xác 100%.
- **Hoàn tất tự động**: Tự động tick **Coursera Honor Code** (`#agreement-checkbox-base`), tự bấm nút **Submit** và tự xác nhận popup *"Ready to submit?"*.

### 2. 🚀 Auto-Skip Module & Tua Video Thích Ứng Thông Minh (Adaptive Video Engine)
- **Cơ chế tùy cơ ứng biến**:
  - *Video nhận tín hiệu nhanh*: Nhận diện tick xanh ngay trong 0.5s - 1.5s và **chuyển bài ngay lập tức**, không tốn một giây thừa.
  - *Video nhận tín hiệu chậm*: Hệ thống **kiên nhẫn đợi** cho tới khi có tick xanh (tối đa 20s), kết hợp chuỗi sự kiện Milestone (`timeupdate` + `ended` + kích thích player) định kỳ mỗi 2s để Coursera ghi nhận 100% thời lượng. Đảm bảo **100% video đều có tick xanh** trước khi chuyển bài.
- **Duyệt bài liên tục**: Tự động đọc bài viết (Reading), tua video, giải quiz và phát hiện nút **`Next item →`** để thoát ra danh sách bài tiếp theo.

### 3. ⭐ Tự Động Chấm Điểm Peer Review (4 Bài)
- **Tự chọn điểm tối đa**: Tự động duyệt qua toàn bộ Rubric tiêu chí chấm điểm và tích chọn mức điểm cao nhất (`4 points`, `3 points`...).
- **Tự điền nhận xét**: Điền nội dung góp ý chuẩn `"GOOD!"` vào tất cả các ô Feedback.
- **Chuỗi chấm 4 bài tự động**: Tự động nộp bài và nhận diện khi Coursera chuyển sang bài chấm tiếp theo cho đến khi hoàn thành đủ 4 bài.

### 4. 🛡️ Khử Prompt Injection & Bẫy Chống AI
- **Lọc bẫy 4 tầng**: Nhận diện và xóa sạch các văn bản ẩn chứa bẫy chống AI của Coursera (`"interacting with assessment elements is strictly prohibited..."`) và thẻ `<legend>` ngắt quãng.
- **Giữ 100% đề bài**: Trích xuất trọn vẹn thân câu hỏi (bảng biểu, tình huống dài, hình ảnh) và loại bỏ rác `1 point`, `2 points`.

### 5. 📌 Giao Diện HUD Nổi & Side Panel Hiện Đại
- **HUD Nổi tiện lợi**: Thanh điều khiển nhỏ gọn nổi ở góc trên bên phải trang Coursera.
- **Side Panel độc lập**: Giao diện thanh bên Chrome/Edge hỗ trợ dán văn bản thủ công, xem kết quả dạng Markdown và tùy chỉnh Gemini API Key.

---

## 📥 Hướng dẫn cài đặt (Installation)

### Cách 1: Cài đặt qua Microsoft Edge Add-ons / Chrome Store
1. Truy cập cửa hàng tiện ích trình duyệt Microsoft Edge hoặc Chrome.
2. Tìm kiếm **Coursera Helper** và bấm **Cài đặt / Get**.

### Cách 2: Cài đặt qua Developer Mode (File ZIP / Unpacked)
1. Tải về file ZIP hoặc `git clone https://github.com/anhkhoi-cloudswe/coursera-helper.git`.
2. Mở trình duyệt Chrome (`chrome://extensions/`) hoặc Edge (`edge://extensions/`).
3. Bật **Developer mode** (Chế độ dành cho nhà phát triển).
4. Bấm **Load unpacked (Tải tiện ích đã giải nén)** và chọn thư mục `extension/`.

### Cách 3: Sử dụng Web Application (Không cần cài Extension)
- Truy cập trực tiếp trang web: [https://coursera-helper.vercel.app](https://coursera-helper.vercel.app)

---

## 🔑 Hướng dẫn cấu hình Gemini API Key

1. Lấy API Key miễn phí tại [Google AI Studio ↗](https://aistudio.google.com/app/apikey).
2. Nhấp vào icon Extension hoặc nút **Cấu hình API** trên Side Panel / Website.
3. Nhập API Key của bạn và bấm **Lưu**.
4. Khóa được lưu hoàn toàn **cục bộ (100% Client-side)** trong `chrome.storage.local`, không gửi qua bất kỳ server trung gian nào.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Manifest V3** (Standard Chrome & Edge Extension Architecture)
- **Google Gemini API** (`gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`)
- **Vanilla JavaScript ES6+**, HTML5, CSS3 Glassmorphism
- **Marked.js** (Markdown Rendering)

---

## 👨‍💻 Tác giả (Author)

Made with ❤️ by **Anh Khoi Nguyen**

- **GitHub**: [@anhkhoi-cloudswe](https://github.com/anhkhoi-cloudswe)
- **Website**: [coursera-helper.vercel.app](https://coursera-helper.vercel.app)

---

## 📜 Giấy phép (License)

Dự án được phân phối dưới giấy phép **MIT License**.
