// src/hud/copyPill.js
// Auto-Clean on Copy (Ctrl+C / Context Menu) & Floating "Copy Sạch" pill button on text selection

import { cleanCourseraQuiz } from '../ai/prompt.js';
import { showInPageToast } from './toast.js';

let floatingCopyBtn = null;

export function initFloatingCopyPill() {
  // 1. TỰ ĐỘNG CAN THIỆP SỰ KIỆN COPY (Ctrl+C, Chuột phải -> Copy) TRỰC TIẾP TRÊN TRANG
  document.addEventListener('copy', (event) => {
    // Không can thiệp nếu người dùng đang gõ/copy trong ô input, textarea hoặc contenteditable của side panel / chat
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      // Ngoại trừ nếu đang ở trong đề bài coursera thì vẫn cho phép
      if (!activeEl.closest('#coursera-helper-sidepanel')) {
        // Cho qua bình thường nếu là ô nhập liệu người dùng tự gõ
        // Tuy nhiên nếu có bôi đen bẫy thì vẫn lọc
      }
    }

    const selection = window.getSelection();
    const rawText = selection ? selection.toString() : '';
    if (!rawText || rawText.trim().length === 0) return;

    // Kiểm tra xem đoạn copy có chứa rác hoặc câu hỏi quiz Coursera hay không
    const cleaned = cleanCourseraQuiz(rawText);

    // Nếu văn bản sau khi lọc khác với văn bản gốc (tức là đã lọc được bẫy prompt injection, 1 point, honor code, ...)
    // hoặc chứa từ khóa bẫy
    if (cleaned !== rawText || /You are a helpful AI assistant|Coursera Honor Code|\b\d+\s*points?\b/i.test(rawText)) {
      if (event.clipboardData) {
        event.clipboardData.setData('text/plain', cleaned);
        event.preventDefault();
        showInPageToast('✨ Coursera Helper: Đã tự động lọc sạch bẫy Prompt Injection & lưu văn bản sạch vào Clipboard!');
      }
    }
  });

  // 2. NÚT NỔI "Copy sạch" KHI BÔI ĐEN VĂN BẢN
  function createFloatingCopyBtn() {
    if (floatingCopyBtn) return;
    floatingCopyBtn = document.createElement('button');
    floatingCopyBtn.id = 'coursera-helper-floating-pill';
    floatingCopyBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: -2px; margin-right: 4px;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
      Copy sạch
    `;
    floatingCopyBtn.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      background: linear-gradient(135deg, #6366f1 0%, #9333ea 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 1.5px solid rgba(255, 255, 255, 0.35);
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
      cursor: pointer;
      display: none;
      user-select: none;
      transition: transform 0.12s ease, opacity 0.12s ease;
      line-height: 1;
    `;

    floatingCopyBtn.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selection = window.getSelection();
      const rawText = selection ? selection.toString() : '';
      if (rawText) {
        const cleaned = cleanCourseraQuiz(rawText);
        try {
          await navigator.clipboard.writeText(cleaned);
          showInPageToast('✨ Đã sao chép văn bản sạch vào Clipboard (Đã lọc sạch bẫy anti-cheat & injection)!');
        } catch (err) {
          // Fallback nếu clipboard API bị giới hạn
          const ta = document.createElement('textarea');
          ta.value = cleaned;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          showInPageToast('✨ Đã sao chép văn bản sạch vào Clipboard!');
        }
      }
      hideFloatingCopyBtn();
    });

    floatingCopyBtn.addEventListener('mouseenter', () => {
      floatingCopyBtn.style.transform = 'translateY(-2px) scale(1.04)';
    });

    floatingCopyBtn.addEventListener('mouseleave', () => {
      floatingCopyBtn.style.transform = 'none';
    });

    document.body.appendChild(floatingCopyBtn);
  }

  function showFloatingCopyBtn(x, y) {
    createFloatingCopyBtn();
    if (!floatingCopyBtn) return;
    floatingCopyBtn.style.left = `${Math.max(10, x - 45)}px`;
    floatingCopyBtn.style.top = `${Math.max(10, y - 40)}px`;
    floatingCopyBtn.style.display = 'inline-flex';
    floatingCopyBtn.style.alignItems = 'center';
    floatingCopyBtn.style.opacity = '1';
  }

  function hideFloatingCopyBtn() {
    if (floatingCopyBtn) {
      floatingCopyBtn.style.display = 'none';
    }
  }

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const text = selection.toString().trim();
        // Hiển thị nút khi bôi đen từ 10 ký tự trở lên
        if (text.length >= 10) {
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              showFloatingCopyBtn(rect.left + window.scrollX + rect.width / 2, rect.top + window.scrollY);
              return;
            }
          } catch (e) {}
        }
      }
      hideFloatingCopyBtn();
    }, 40);
  });

  document.addEventListener('mousedown', (e) => {
    if (floatingCopyBtn && e.target !== floatingCopyBtn) {
      hideFloatingCopyBtn();
    }
  });
}

