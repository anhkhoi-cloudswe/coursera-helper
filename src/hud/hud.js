// src/hud/hud.js
// Neo Brutalist Floating HUD Controller: Draggable, Collapsible, and Action Bindings

import { triggerZeroClickQuizWorkflow } from '../quiz/solver.js';
import { runAutoPeerReviewWorkflow } from '../peer/peer.js';
import { completeCourseraVideo, startAutoSkipLoop, stopAutoSkipLoop } from '../video/video.js';
import { showInPageToast } from './toast.js';

let floatingHUD = null;
let isDraggingHUD = false;
let hudDragStartX = 0;
let hudDragStartY = 0;
let hudInitialLeft = 0;
let hudInitialTop = 0;
let hasMovedHUD = false;

export function createFloatingHUD() {
  const existingHUD = document.getElementById('coursera-helper-hud');
  if (existingHUD) existingHUD.remove();

  // 1. Chèn Stylesheet Neo Brutalist nguyên bản
  if (!document.getElementById('coursera-helper-hud-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'coursera-helper-hud-styles';
    styleTag.textContent = `
      #coursera-helper-hud, #coursera-helper-hud * {
        box-sizing: border-box !important;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        line-height: 1 !important;
        color: #ffffff !important;
      }

      #coursera-helper-hud {
        position: fixed !important;
        z-index: 2147483646 !important;
        background: #161b26 !important;
        border: 2.5px solid #000000 !important;
        box-shadow: 4px 4px 0px #000000 !important;
        border-radius: 9999px !important;
        padding: 6px 8px !important;
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 8px !important;
        user-select: none !important;
        cursor: grab !important;
        transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease !important;
        width: auto !important;
        height: 56px !important;
        max-width: none !important;
        white-space: nowrap !important;
        touch-action: none !important;
      }

      #coursera-helper-hud:hover {
        box-shadow: 5.5px 5.5px 0px #000000 !important;
      }

      #coursera-helper-hud.is-dragging,
      #coursera-helper-hud.is-dragging #ch-hud-header {
        cursor: grabbing !important;
        box-shadow: 6px 6px 0px #000000 !important;
      }

      /* Header Pill / Logo Trigger */
      #ch-hud-header {
        display: inline-flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 9px !important;
        padding: 0 14px !important;
        height: 42px !important;
        border-radius: 9999px !important;
        background: #242c3d !important;
        border: 2px solid #000000 !important;
        box-shadow: 2.5px 2.5px 0px #000000 !important;
        cursor: pointer !important;
        transition: all 0.12s ease !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
      }

      #ch-hud-header:hover {
        background: #2d374d !important;
        transform: translate(-1px, -1px) !important;
        box-shadow: 3.5px 3.5px 0px #000000 !important;
      }

      .ch-hud-logo-svg {
        width: 23px !important;
        height: 23px !important;
        min-width: 23px !important;
        min-height: 23px !important;
        display: inline-block !important;
        flex-shrink: 0 !important;
      }

      #coursera-helper-hud .ch-hud-logo-svg path {
        fill: url(#ch-grad-cyan) !important;
      }

      #coursera-helper-hud .ch-hud-brand-text,
      #coursera-helper-hud .ch-hud-brand-text span {
        font-size: 14.5px !important;
        font-weight: 800 !important;
        color: #ffffff !important;
        letter-spacing: -0.01em !important;
        white-space: nowrap !important;
        display: inline-block !important;
        vertical-align: middle !important;
      }

      #coursera-helper-hud .ch-hud-brand-accent {
        color: #818cf8 !important;
        font-weight: 800 !important;
        display: inline !important;
      }

      /* Status Dot */
      .ch-hud-status-dot {
        width: 8px !important;
        height: 8px !important;
        min-width: 8px !important;
        border-radius: 50% !important;
        background: #10b981 !important;
        box-shadow: 0 0 8px #10b981 !important;
        border: 1.5px solid #000000 !important;
        transition: all 0.2s ease !important;
        display: inline-block !important;
        flex-shrink: 0 !important;
      }

      /* Chevron Icon */
      .ch-hud-chevron-wrap {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #818cf8 !important;
        flex-shrink: 0 !important;
      }

      #ch-hud-expand-indicator {
        color: #818cf8 !important;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease !important;
        display: inline-block !important;
        flex-shrink: 0 !important;
      }

      #ch-hud-header:hover #ch-hud-expand-indicator {
        color: #ffffff !important;
      }

      /* Divider */
      .ch-hud-divider {
        width: 2px !important;
        height: 24px !important;
        background: #000000 !important;
        margin: 0 3px !important;
        flex-shrink: 0 !important;
        display: block !important;
      }

      /* Collapsed Mode */
      #coursera-helper-hud.is-collapsed {
        padding: 0 !important;
        height: 46px !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }

      #coursera-helper-hud.is-collapsed #ch-hud-header {
        background: #161b26 !important;
        border: 2.5px solid #000000 !important;
        box-shadow: 4px 4px 0px #000000 !important;
        padding: 0 16px !important;
        height: 46px !important;
      }

      #coursera-helper-hud.is-collapsed #ch-hud-header:hover {
        background: #1e2433 !important;
        transform: translate(-1px, -1px) !important;
        box-shadow: 5px 5px 0px #000000 !important;
      }

      #coursera-helper-hud.is-collapsed .ch-hud-divider,
      #coursera-helper-hud.is-collapsed #ch-hud-buttons {
        display: none !important;
      }

      #coursera-helper-hud.is-collapsed #ch-hud-expand-indicator {
        transform: rotate(180deg) !important;
      }

      /* Expanded Buttons Container */
      #ch-hud-buttons {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 8px !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
      }

      /* Buttons Styling - Neo Brutalist */
      .ch-hud-btn {
        border: 2px solid #000000 !important;
        box-shadow: 2.5px 2.5px 0px #000000 !important;
        cursor: pointer !important;
        display: inline-flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 7px !important;
        font-size: 14.5px !important;
        font-weight: 800 !important;
        line-height: 1 !important;
        height: 42px !important;
        padding: 0 16px !important;
        border-radius: 9999px !important;
        transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease !important;
        letter-spacing: -0.01em !important;
        white-space: nowrap !important;
        text-decoration: none !important;
        outline: none !important;
        flex-shrink: 0 !important;
        color: #ffffff !important;
      }

      .ch-hud-btn span {
        white-space: nowrap !important;
        display: inline-block !important;
      }

      .ch-hud-btn .ch-btn-icon {
        font-size: 16px !important;
      }

      .ch-hud-btn:hover {
        transform: translate(-1px, -1px) !important;
        box-shadow: 3.5px 3.5px 0px #000000 !important;
      }

      .ch-hud-btn:active {
        transform: translate(1.5px, 1.5px) !important;
        box-shadow: 1px 1px 0px #000000 !important;
      }

      .ch-btn-primary {
        background: #6366f1 !important;
        color: #ffffff !important;
      }

      .ch-btn-primary:hover {
        background: #4f46e5 !important;
      }

      .ch-btn-purple {
        background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%) !important;
        color: #ffffff !important;
      }

      .ch-btn-purple:hover {
        background: linear-gradient(135deg, #9333ea 0%, #db2777 100%) !important;
      }

      .ch-btn-green {
        background: #10b981 !important;
        color: #000000 !important;
        font-weight: 800 !important;
      }

      .ch-btn-green span {
        color: #000000 !important;
      }

      .ch-btn-green:hover {
        background: #34d399 !important;
        color: #000000 !important;
      }

      .ch-btn-ghost {
        background: #242c3d !important;
        color: #ffffff !important;
      }

      .ch-btn-ghost:hover {
        background: #2d374d !important;
      }
    `;
    document.head.appendChild(styleTag);
  }

  // 2. Tạo phần tử floating HUD
  floatingHUD = document.createElement('div');
  floatingHUD.id = 'coursera-helper-hud';

  floatingHUD.innerHTML = `
    <div id="ch-hud-header" title="Nhấn 1 lần để thu nhỏ / mở rộng • Kéo giữ để di chuyển tự do">
      <svg class="ch-hud-logo-svg" width="23" height="23" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18C5 19.94 8.13 22 12 22C15.87 22 19 19.94 19 17.18V13.18L12 17L5 13.18Z" fill="url(#ch-grad-cyan)"/>
        <defs>
          <linearGradient id="ch-grad-cyan" x1="1" y1="3" x2="23" y2="22" gradientUnits="userSpaceOnUse">
            <stop stop-color="#818cf8"/>
            <stop offset="1" stop-color="#38bdf8"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="ch-hud-brand-text">Coursera <span class="ch-hud-brand-accent">Helper</span></span>
      <span id="ch-hud-status-dot" class="ch-hud-status-dot" title="Trạng thái tiện ích"></span>
      <span class="ch-hud-chevron-wrap">
        <svg id="ch-hud-expand-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </span>
    </div>

    <div id="ch-hud-divider" class="ch-hud-divider"></div>

    <div id="ch-hud-buttons">
      <button id="ch-hud-solvequiz" class="ch-hud-btn ch-btn-primary" title="Tự động quét toàn bộ câu hỏi (kèm hình ảnh), gọi Gemini giải, tick đáp án và tự động nộp bài! (Alt+Q)">
        <span class="ch-btn-icon">⚡</span>
        <span class="ch-btn-label">Giải Quiz</span>
      </button>

      <button id="ch-hud-peerreview" class="ch-hud-btn ch-btn-purple" title="Tự động chấm điểm Peer Review: chọn điểm cao nhất và viết nhận xét chi tiết!">
        <span class="ch-btn-icon">⭐</span>
        <span class="ch-btn-label">Chấm Điểm Peer</span>
      </button>

      <button id="ch-hud-autoskip" class="ch-hud-btn ch-btn-green" title="Tự động duyệt bài: tua video, đọc bài, tự giải quiz và nộp bài liên tục">
        <span class="ch-btn-icon">🚀</span>
        <span class="ch-btn-label">Auto-Skip Module</span>
      </button>

      <button id="ch-hud-skipone" class="ch-hud-btn ch-btn-ghost" title="Tua video này tới cuối và sang bài tiếp (Alt+V)">
        <span class="ch-btn-icon">⏩</span>
        <span class="ch-btn-label">Skip Video</span>
      </button>

      <button id="ch-hud-guide" class="ch-hud-btn ch-btn-ghost" title="Mở sổ tay hướng dẫn sử dụng và cài đặt API Key">
        <span class="ch-btn-label">Hướng dẫn</span>
      </button>
    </div>
  `;

  document.body.appendChild(floatingHUD);

  // 3. Khôi phục vị trí lưu trữ
  restoreHUDPosition();

  // 4. Gắn sự kiện kéo thả 360 độ & click thu nhỏ
  setupHUDInteractions();

  // 5. Gắn sự kiện các nút hành động
  setupHUDButtonActions();
}

function restoreHUDPosition() {
  if (!floatingHUD) return;
  try {
    const saved = sessionStorage.getItem('ch_hud_pos');
    if (saved) {
      const pos = JSON.parse(saved);
      if (typeof pos.left === 'number' && typeof pos.top === 'number') {
        const clampLeft = Math.max(10, Math.min(window.innerWidth - 200, pos.left));
        const clampTop = Math.max(10, Math.min(window.innerHeight - 60, pos.top));
        floatingHUD.style.left = `${clampLeft}px`;
        floatingHUD.style.top = `${clampTop}px`;
        floatingHUD.style.transform = 'none';
        return;
      }
    }
  } catch (e) {}

  // Mặc định ở đỉnh giữa màn hình
  floatingHUD.style.top = '12px';
  floatingHUD.style.left = '50%';
  floatingHUD.style.transform = 'translateX(-50%)';
}

function setupHUDInteractions() {
  const header = document.getElementById('ch-hud-header');
  if (!header || !floatingHUD) return;

  const onPointerDown = (e) => {
    isDraggingHUD = true;
    hasMovedHUD = false;
    hudDragStartX = e.clientX;
    hudDragStartY = e.clientY;

    const rect = floatingHUD.getBoundingClientRect();
    hudInitialLeft = rect.left;
    hudInitialTop = rect.top;

    floatingHUD.style.transform = 'none';
    floatingHUD.style.left = `${hudInitialLeft}px`;
    floatingHUD.style.top = `${hudInitialTop}px`;
    floatingHUD.classList.add('is-dragging');
  };

  const onPointerMove = (e) => {
    if (!isDraggingHUD) return;
    const dx = e.clientX - hudDragStartX;
    const dy = e.clientY - hudDragStartY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedHUD = true;
    }

    const newLeft = Math.max(8, Math.min(window.innerWidth - floatingHUD.offsetWidth - 8, hudInitialLeft + dx));
    const newTop = Math.max(8, Math.min(window.innerHeight - floatingHUD.offsetHeight - 8, hudInitialTop + dy));

    floatingHUD.style.left = `${newLeft}px`;
    floatingHUD.style.top = `${newTop}px`;
  };

  const onPointerUp = () => {
    if (!isDraggingHUD) return;
    isDraggingHUD = false;
    floatingHUD.classList.remove('is-dragging');

    if (hasMovedHUD) {
      // Lưu vị trí khi kết thúc kéo
      const rect = floatingHUD.getBoundingClientRect();
      try {
        sessionStorage.setItem('ch_hud_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (e) {}
    } else {
      // Click thuần túy vào Coursera Helper: Thu nhỏ / Mở rộng (Collapse / Expand)
      toggleHUDCollapse();
    }
  };

  header.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
}

export function toggleHUDCollapse() {
  if (!floatingHUD) return;
  const isCollapsed = floatingHUD.classList.toggle('is-collapsed');
  try {
    sessionStorage.setItem('ch_hud_collapsed', isCollapsed ? '1' : '0');
  } catch (e) {}
}

function setupHUDButtonActions() {
  const btnSolve = document.getElementById('ch-hud-solvequiz');
  btnSolve?.addEventListener('click', () => {
    triggerZeroClickQuizWorkflow(btnSolve);
  });

  const btnPeer = document.getElementById('ch-hud-peerreview');
  btnPeer?.addEventListener('click', () => {
    runAutoPeerReviewWorkflow(btnPeer);
  });

  const btnAutoSkip = document.getElementById('ch-hud-autoskip');
  btnAutoSkip?.addEventListener('click', () => {
    if (window._chAutoSkipActive) {
      stopAutoSkipLoop();
    } else {
      startAutoSkipLoop();
    }
  });

  const btnSkipOne = document.getElementById('ch-hud-skipone');
  btnSkipOne?.addEventListener('click', () => {
    completeCourseraVideo();
  });

  const btnGuide = document.getElementById('ch-hud-guide');
  btnGuide?.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'open_side_panel' });
    } catch (e) {
      showInPageToast('💡 Bấm vào biểu tượng tiện ích Coursera Helper ở góc trình duyệt để mở Side Panel!');
    }
  });
}

export function updateHUDForCurrentPage() {
  // Giữ nguyên giao diện đầy đủ các nút theo đúng yêu cầu người dùng
}
