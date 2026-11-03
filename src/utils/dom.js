// src/utils/dom.js
// Utility functions for DOM interaction, Extension context validation, and UI helpers

export function isExtensionContextValid() {
  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

export function showReloadPrompt(reason) {
  if (document.getElementById('ch-reload-toast')) return;
  const t = document.createElement('div');
  t.id = 'ch-reload-toast';
  t.style.cssText = [
    'position: fixed',
    'bottom: 24px',
    'right: 24px',
    'z-index: 2147483647',
    'background: #111827',
    'color: #f9fafb',
    'border: 1px solid #374151',
    'border-radius: 10px',
    'padding: 14px 18px',
    'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5)',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font-size: 13px',
    'line-height: 1.5',
    'max-width: 360px',
    'display: flex',
    'flex-direction: column',
    'gap: 10px'
  ].join(';');

  t.innerHTML = `
    <div style="font-weight: 600; color: #fbbf24; display: flex; align-items: center; gap: 6px;">
      <span>⚠️</span><span>Coursera Helper cần tải lại trang</span>
    </div>
    <div style="color: #d1d5db;">${reason || 'Tiện ích vừa được cập nhật hoặc tải lại.'} Vui lòng F5 trang Coursera để tiếp tục sử dụng đầy đủ tính năng.</div>
    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
      <button id="ch-reload-btn" style="background: #2563eb; color: #fff; border: 0; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Tải lại trang ngay</button>
      <button id="ch-dismiss-reload-btn" style="background: transparent; color: #9ca3af; border: 1px solid #374151; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Đóng</button>
    </div>
  `;

  document.body.appendChild(t);
  t.querySelector('#ch-reload-btn')?.addEventListener('click', () => location.reload());
  t.querySelector('#ch-dismiss-reload-btn')?.addEventListener('click', () => t.remove());
}

export function showApiKeyPromptModal(onSaved) {
  if (document.getElementById('ch-api-key-modal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'ch-api-key-modal';
  overlay.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100vw',
    'height: 100vh',
    'background: rgba(0, 0, 0, 0.65)',
    'z-index: 2147483647',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ].join(';');

  overlay.innerHTML = `
    <div style="background: #1e293b; color: #f8fafc; border-radius: 12px; width: 440px; max-width: 90vw; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); border: 1px solid #334155;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #60a5fa; display: flex; align-items: center; gap: 8px;">
        🔑 Cấu hình Gemini API Key
      </h3>
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Bạn chưa cấu hình Gemini API Key để giải Quiz. Hãy dán API Key của bạn vào bên dưới (Key hoàn toàn miễn phí tại Google AI Studio).
      </p>
      <input type="password" id="ch-modal-key-input" placeholder="AIzaSy..." style="width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; font-size: 13px; margin-bottom: 16px; outline: none;" />
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button id="ch-modal-close-btn" style="background: #334155; color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer;">Hủy</button>
        <button id="ch-modal-save-btn" style="background: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">Lưu Key & Tiếp tục</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const input = overlay.querySelector('#ch-modal-key-input');
  input?.focus();

  overlay.querySelector('#ch-modal-close-btn')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#ch-modal-save-btn')?.addEventListener('click', () => {
    const key = input?.value?.trim();
    if (key) {
      if (isExtensionContextValid()) {
        chrome.storage.local.set({ gemini_api_key: key, gemini_api_keys: [key] }, () => {
          overlay.remove();
          if (typeof onSaved === 'function') onSaved(key);
        });
      }
    }
  });
}

export function triggerClick(el) {
  if (!el) return;
  const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  events.forEach(evt => {
    el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
  });
}

export function normalizeQuizText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[“”"']/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[a-d][\.\:\)]\s*/i, '')
    .trim();
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

