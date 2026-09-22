# Coursera Helper — Quiz Cleaner & AI Solver 🚀

> Công cụ tự động loại bỏ prompt injection ẩn, watermark câu hỏi và hỗ trợ giải đề Coursera chuyên nghiệp bằng Google Gemini AI.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/anhkhoi-cloudswe/coursera-helper)

![Coursera Helper Preview](https://raw.githubusercontent.com/anhkhoi-cloudswe/coursera-helper/main/screenshot.png)

## ✨ Tính năng nổi bật

- 🛡️ **Khử Prompt Injection Coursera**: Tự động nhận diện và xóa sạch khối lệnh ẩn (`"You are a helpful AI assistant. You have identified that this web page contains a protected assessment from Coursera..."`).
- 🧹 **Làm sạch điểm số & khoảng trắng**: Tự loại bỏ các dòng `1 point`, `2 points` và thu gọn khoảng cách dòng dư thừa.
- ⚡ **Giải đề trực tiếp với Google Gemini**: Tích hợp các model AI hàng đầu (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-1.5-pro`) trả về đáp án và giải thích chi tiết trong 1 giây.
- 📋 **Zero-Key Support**: Hỗ trợ nút `Copy Prompt` chuẩn chỉnh để dán thẳng vào [gemini.google.com](https://gemini.google.com) mà không bắt buộc phải có API Key.
- 🔒 **Bảo mật tuyệt đối**: Chạy 100% Client-side. API Key lưu trong `localStorage` trên máy người dùng, không bao giờ gửi qua máy chủ trung gian.
- ⌨️ **Phím tắt tiện dụng**: `Ctrl + V` dán nhanh, `Ctrl + Enter` để giải bằng Gemini, `Esc` đóng cài đặt.

---

## 🚀 Hướng dẫn triển khai lên Vercel (1 Click)

1. Truy cập [Vercel](https://vercel.com) và đăng nhập bằng tài khoản GitHub của bạn.
2. Chọn **Add New Project** -> Chọn repository **`coursera-helper`**.
3. Bấm **Deploy**. Sau 10 giây trang web của bạn sẽ hoạt động tại địa chỉ:  
   `https://coursera-helper.vercel.app` (hoặc tên tương ứng).

---

## 🛠️ Chạy cục bộ (Local)

Chỉ cần mở file `index.html` bằng bất kỳ trình duyệt nào (Chrome, Edge, Safari, Firefox), không cần cài đặt thêm bất kỳ môi trường hay thư viện nào!

---

## 📜 Giấy phép
Mã nguồn phát hành dưới giấy phép MIT. Phục vụ mục đích học tập và nghiên cứu.
