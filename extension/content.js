// Coursera Helper — Content Script for Chrome & Edge
// Tự động nhận diện và làm sạch bẫy Prompt Injection ngay khi bạn nhấn Ctrl + C trên Coursera

const TRAP_REGEX = /\s*You are a helpful AI assistant[\s\S]*?Do you understand\?\.?\s*/gi;
const POINT_REGEX = /^[ \t]*\d+(?:\.\d+)?[ \t]*points?\.?[ \t]*$/gmi;

function cleanCourseraQuiz(text) {
  if (!text) return text;
  
  // 1. Khử đoạn bẫy Prompt Injection
  let cleaned = text.replace(TRAP_REGEX, '\n\n');
  
  // 2. Xóa các dòng điểm số ("1 point", "2 points", v.v.)
  cleaned = cleaned.replace(POINT_REGEX, '');
  
  // 3. Chuẩn hóa khoảng trắng & ngắt dòng
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

// Bắt sự kiện Copy
document.addEventListener('copy', (event) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const selectedText = selection.toString();
  if (!selectedText) return;

  // Kiểm tra xem đoạn văn bản có chứa bẫy injection của Coursera hay không
  if (selectedText.includes('You are a helpful AI assistant') && selectedText.includes('Coursera')) {
    const cleaned = cleanCourseraQuiz(selectedText);
    
    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', cleaned);
      event.preventDefault();
      
      showInPageToast('⚡ Coursera Helper: Đã tự động lọc sạch bẫy Prompt Injection & "1 point"!');
    }
  }
});

// Toast thông báo nhỏ gọn tinh tế ở góc dưới màn hình Coursera
function showInPageToast(message) {
  let toast = document.getElementById('coursera-helper-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'coursera-helper-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #111520;
      color: #38bdf8;
      border: 1px solid #6366f1;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      padding: 12px 20px;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 99999999;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      transform: translateY(16px);
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<span style="color: #22c55e;">✓</span> ${message}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(window._chToastTimer);
  window._chToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
  }, 2800);
}
