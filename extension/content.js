// Coursera Helper — Content Script (Chạy trực tiếp trên trang Coursera)
// Tự động loại bỏ prompt injection & điểm số khi bạn bôi đen/copy câu hỏi

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

// 1. Tự động xử lý khi người dùng nhấn phím tắt Ctrl + C
document.addEventListener('copy', (event) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const selectedText = selection.toString();
  if (!selectedText) return;

  if (selectedText.includes('You are a helpful AI assistant') && selectedText.includes('Coursera')) {
    const cleaned = cleanCourseraQuiz(selectedText);
    
    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', cleaned);
      event.preventDefault();
      
      showInPageToast('⚡ Coursera Helper: Đã tự động lọc sạch bẫy Prompt Injection!');
    }
  }
});

// 2. Nút nổi thông minh xuất hiện khi bôi đen câu hỏi
let floatingButton = null;

function createFloatingButton() {
  floatingButton = document.createElement('button');
  floatingButton.id = 'coursera-helper-floating-pill';
  floatingButton.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 4px;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
    Copy sạch
  `;
  floatingButton.style.cssText = `
    position: absolute;
    z-index: 2147483647;
    background: linear-gradient(135deg, #6366f1 0%, #9333ea 100%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11.5px;
    font-weight: 700;
    padding: 5px 11px;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45);
    cursor: pointer;
    display: none;
    transition: transform 0.15s ease, opacity 0.15s ease;
    user-select: none;
  `;

  floatingButton.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const selection = window.getSelection();
    const rawText = selection.toString();
    if (rawText) {
      const cleaned = cleanCourseraQuiz(rawText);
      try {
        await navigator.clipboard.writeText(cleaned);
        showInPageToast('✓ Đã sao chép văn bản sạch vào Clipboard!');
      } catch (err) {
        console.error(err);
      }
    }
    hideFloatingButton();
  });

  document.body.appendChild(floatingButton);
}

function showFloatingButton(x, y) {
  if (!floatingButton) createFloatingButton();
  floatingButton.style.left = `${Math.max(10, x - 40)}px`;
  floatingButton.style.top = `${Math.max(10, y - 36)}px`;
  floatingButton.style.display = 'block';
  floatingButton.style.opacity = '1';
}

function hideFloatingButton() {
  if (floatingButton) {
    floatingButton.style.display = 'none';
  }
}

document.addEventListener('mouseup', (e) => {
  setTimeout(() => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text.length > 20 && (text.includes('Question') || text.includes('Coursera') || text.includes('You are a helpful AI'))) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showFloatingButton(rect.left + window.scrollX + rect.width / 2, rect.top + window.scrollY);
        return;
      }
    }
    hideFloatingButton();
  }, 30);
});

document.addEventListener('mousedown', (e) => {
  if (floatingButton && e.target !== floatingButton) {
    hideFloatingButton();
  }
});

// Toast thông báo nhỏ gọn tinh tế ở góc dưới màn hình
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
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      transform: translateY(14px);
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(window._chToastTimer);
  window._chToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(14px)';
  }, 2600);
}

// ==========================================
// 3. TÍNH NĂNG SKIP VIDEO & TĂNG TỐC VIDEO
// ==========================================

function completeCourseraVideo() {
  const video = document.querySelector('video');
  if (video && video.duration) {
    video.playbackRate = 16;
    video.currentTime = Math.max(0, video.duration - 0.5);
    video.play();
    showInPageToast('⏩ Đã tua Video tới giây cuối để đánh dấu hoàn thành!');
    return true;
  }
  showInPageToast('⚠️ Không tìm thấy thẻ Video trên trang này!');
  return false;
}

function setCourseraVideoSpeed(rate) {
  const video = document.querySelector('video');
  if (video) {
    video.playbackRate = rate;
    showInPageToast(`⚡ Đã đổi tốc độ phát Video thành ${rate}x!`);
    return true;
  }
  showInPageToast('⚠️ Không tìm thấy Video trên trang này!');
  return false;
}

// ==========================================
// 4. CHẾ ĐỘ AUTO-SKIP TOÀN BỘ MODULE (HANDS-FREE)
// ==========================================

async function startAutoSkipModule() {
  // 1. Nếu đang ở trang tổng quan Module (như /home/module/1)
  const isOverview = window.location.href.includes('/home/module/') || window.location.href.includes('/module/');
  
  if (isOverview) {
    // Tìm tất cả các đường dẫn bài học/video trong Module hiện tại
    const links = Array.from(document.querySelectorAll('a[href*="/lecture/"], a[href*="/item/"]'));
    const urls = Array.from(new Set(links.map(a => a.href))).filter(u => u.includes('/learn/'));
    
    if (urls.length === 0) {
      showInPageToast('⚠️ Không tìm thấy bài học nào trong Module này!');
      return;
    }

    showInPageToast(`🚀 Đã tìm thấy ${urls.length} bài học! Đang bắt đầu Auto-Skip...`);
    
    // Lưu danh sách URL và bật chế độ Auto Skip
    chrome.storage.local.set({
      'auto_skip_active': true,
      'auto_skip_queue': urls,
      'auto_skip_index': 0
    }, () => {
      window.location.href = urls[0];
    });
  } else {
    // Nếu đang ở sẵn trong một bài học
    const nextLink = document.querySelector('a[href*="/lecture/"], a[href*="/item/"]');
    chrome.storage.local.set({
      'auto_skip_active': true,
      'auto_skip_queue': [],
      'auto_skip_index': 0
    }, () => {
      runAutoSkipStep();
    });
  }
}

function stopAutoSkipModule() {
  chrome.storage.local.set({ 'auto_skip_active': false }, () => {
    showInPageToast('🛑 Đã dừng Auto-Skip Module!');
  });
}

function runAutoSkipStep() {
  chrome.storage.local.get(['auto_skip_active', 'auto_skip_queue', 'auto_skip_index'], (data) => {
    if (!data.auto_skip_active) return;

    let index = data.auto_skip_index || 0;
    const queue = data.auto_skip_queue || [];
    const total = queue.length > 0 ? queue.length : '?';

    showInPageToast(`🚀 Auto-Skip đang chạy (${index + 1}/${total})... Bấm 'Stop' để dừng.`);

    setTimeout(() => {
      // 1. Nếu trang có Video: Tua tới cuối
      const video = document.querySelector('video');
      if (video && video.duration) {
        video.playbackRate = 16;
        video.currentTime = Math.max(0, video.duration - 0.5);
        video.play();
      } else {
        // Nếu là bài đọc (Reading): Cuộn xuống cuối trang
        window.scrollTo(0, document.body.scrollHeight);
      }

      // 2. Chờ 2 giây để Coursera ghi nhận bài hoàn thành (tick xanh)
      setTimeout(() => {
        // Tìm nút Next
        const nextBtn = document.querySelector(
          'button[data-testid="next-item-button"], a[data-testid="next-item-button"], button[aria-label*="Next"], a[aria-label*="Next"]'
        );

        if (queue.length > 0 && index + 1 < queue.length) {
          index++;
          chrome.storage.local.set({ 'auto_skip_index': index }, () => {
            if (nextBtn) {
              nextBtn.click();
            } else {
              window.location.href = queue[index];
            }
          });
        } else if (nextBtn) {
          // Vẫn còn nút Next tiếp theo
          nextBtn.click();
        } else {
          // Đã duyệt hết toàn bộ Module!
          chrome.storage.local.set({ 'auto_skip_active': false }, () => {
            showInPageToast('🎉 HOÀN THÀNH! Đã tự động Skip hết tất cả Video trong Module!');
          });
        }
      }, 2200);
    }, 1200);
  });
}

// Tự động kích hoạt khi trang tải xong nếu Chế độ Auto-Skip đang BẬT
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndRunAutoSkip);
} else {
  checkAndRunAutoSkip();
}

function checkAndRunAutoSkip() {
  chrome.storage.local.get(['auto_skip_active'], (data) => {
    if (data.auto_skip_active) {
      runAutoSkipStep();
    }
  });
}

// Lắng nghe lệnh điều khiển từ Side Panel
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'skip_video') {
      const success = completeCourseraVideo();
      sendResponse({ success });
    } else if (request.action === 'set_video_speed') {
      const success = setCourseraVideoSpeed(request.speed || 16);
      sendResponse({ success });
    } else if (request.action === 'start_auto_skip_module') {
      startAutoSkipModule();
      sendResponse({ success: true });
    } else if (request.action === 'stop_auto_skip_module') {
      stopAutoSkipModule();
      sendResponse({ success: true });
    }
    return true;
  });
}
