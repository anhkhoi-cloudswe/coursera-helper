// src/hud/hud.js
// Modern floating HUD controller, draggable interface, and action bindings

import { triggerZeroClickQuizWorkflow } from '../quiz/solver.js';
import { runAutoPeerReviewWorkflow } from '../peer/peer.js';
import { completeCourseraVideo, startAutoSkipLoop, stopAutoSkipLoop } from '../video/video.js';
import { showInPageToast } from './toast.js';

export function createFloatingHUD() {
  if (document.getElementById('ch-floating-hud')) return;

  const hud = document.createElement('div');
  hud.id = 'ch-floating-hud';
  hud.style.cssText = [
    'position: fixed',
    'top: 14px',
    'left: 50%',
    'transform: translateX(-50%)',
    'z-index: 2147483640',
    'background: rgba(15, 23, 42, 0.94)',
    'border: 1px solid rgba(255, 255, 255, 0.15)',
    'border-radius: 9999px',
    'padding: 5px 8px',
    'display: flex',
    'align-items: center',
    'gap: 6px',
    'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45)',
    'backdrop-filter: blur(12px)',
    'user-select: none',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'transition: box-shadow 0.2s ease, opacity 0.2s ease'
  ].join(';');

  hud.innerHTML = `
    <!-- Header Handle -->
    <div id="ch-hud-drag-handle" style="cursor: grab; display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.08);">
      <span style="font-size: 14px;">🎓</span>
      <span style="font-size: 12px; font-weight: 700; color: #60a5fa; letter-spacing: 0.3px;">Coursera Helper</span>
      <span id="ch-hud-collapse-btn" style="cursor: pointer; font-size: 10px; color: #94a3b8; margin-left: 2px;">◀</span>
    </div>

    <!-- Actions Container -->
    <div id="ch-hud-actions" style="display: flex; align-items: center; gap: 6px;">
      <!-- Quiz Solver Button -->
      <button id="ch-btn-solve-quiz" title="Tự động giải Quiz trắc nghiệm bằng Gemini AI (Alt+Q)" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; border: 0; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35); transition: all 0.15s ease;">
        ⚡ Giải Quiz
      </button>

      <!-- Peer Review Button -->
      <button id="ch-btn-peer-review" title="Tự động chấm điểm và viết nhận xét bài đồng cấp" style="background: linear-gradient(135deg, #ec4899, #db2777); color: #ffffff; border: 0; padding: 6px 13px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(236, 72, 153, 0.35); transition: all 0.15s ease;">
        ⭐ Chấm Điểm Peer
      </button>

      <!-- Auto-Skip Module Button -->
      <button id="ch-btn-auto-skip" title="Tự động skip video, hoàn thành reading và chuyển bài" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: 0; padding: 6px 13px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35); transition: all 0.15s ease;">
        🚀 Auto-Skip Module
      </button>

      <!-- Skip Video Button -->
      <button id="ch-btn-skip-video" title="Tua nhanh video hiện tại (Alt+V)" style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #ffffff; border: 0; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35); transition: all 0.15s ease;">
        ⏩ Skip Video
      </button>

      <!-- Help Button -->
      <button id="ch-btn-help" title="Mở Side Panel hướng dẫn và cài đặt API Key" style="background: rgba(30, 41, 59, 0.8); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.12); padding: 6px 11px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;">
        Hướng dẫn
      </button>
    </div>
  `;

  document.body.appendChild(hud);

  // Gắn sự kiện cho các nút
  const btnSolve = hud.querySelector('#ch-btn-solve-quiz');
  btnSolve?.addEventListener('click', () => {
    triggerZeroClickQuizWorkflow(btnSolve);
  });

  const btnPeer = hud.querySelector('#ch-btn-peer-review');
  btnPeer?.addEventListener('click', () => {
    runAutoPeerReviewWorkflow(btnPeer);
  });

  const btnAutoSkip = hud.querySelector('#ch-btn-auto-skip');
  btnAutoSkip?.addEventListener('click', () => {
    if (window._chAutoSkipActive) {
      stopAutoSkipLoop();
      btnAutoSkip.innerHTML = '🚀 Auto-Skip Module';
      btnAutoSkip.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else {
      startAutoSkipLoop();
      btnAutoSkip.innerHTML = '🛑 Dừng Auto-Skip';
      btnAutoSkip.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    }
  });

  const btnSkipVideo = hud.querySelector('#ch-btn-skip-video');
  btnSkipVideo?.addEventListener('click', () => {
    completeCourseraVideo();
  });

  const btnHelp = hud.querySelector('#ch-btn-help');
  btnHelp?.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'open_side_panel' });
    } catch (e) {
      showInPageToast('💡 Bấm vào biểu tượng extension trên thanh tiện ích để mở Cài đặt!');
    }
  });

  // Kéo thả 360 độ tự do
  setupHUDDragging(hud);

  // Thu gọn / Mở rộng
  setupHUDCollapse(hud);

  // Cập nhật hiển thị theo từng trang
  updateHUDForCurrentPage();
}

function setupHUDDragging(hud) {
  const handle = hud.querySelector('#ch-hud-drag-handle');
  if (!handle) return;

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.id === 'ch-hud-collapse-btn') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = hud.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    hud.style.transform = 'none';
    hud.style.left = `${initialLeft}px`;
    hud.style.top = `${initialTop}px`;
    handle.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const newLeft = Math.max(10, Math.min(window.innerWidth - hud.offsetWidth - 10, initialLeft + dx));
    const newTop = Math.max(10, Math.min(window.innerHeight - hud.offsetHeight - 10, initialTop + dy));

    hud.style.left = `${newLeft}px`;
    hud.style.top = `${newTop}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    handle.style.cursor = 'grab';
    document.body.style.userSelect = '';
  });
}

function setupHUDCollapse(hud) {
  const collapseBtn = hud.querySelector('#ch-hud-collapse-btn');
  const actions = hud.querySelector('#ch-hud-actions');
  if (!collapseBtn || !actions) return;

  let isCollapsed = false;
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isCollapsed = !isCollapsed;
    actions.style.display = isCollapsed ? 'none' : 'flex';
    collapseBtn.innerText = isCollapsed ? '▶' : '◀';
  });
}

export function updateHUDForCurrentPage() {
  const path = window.location.pathname;
  const isQuiz = path.includes('/exam/') || path.includes('/quiz/') || path.includes('/assignment-submission/');
  const isPeer = path.includes('/peer-review/') || path.includes('/peerReview/');
  const isVideo = path.includes('/lecture/');

  const btnSolve = document.getElementById('ch-btn-solve-quiz');
  const btnPeer = document.getElementById('ch-btn-peer-review');
  const btnSkipVideo = document.getElementById('ch-btn-skip-video');

  if (btnSolve) btnSolve.style.display = isQuiz ? 'flex' : 'none';
  if (btnPeer) btnPeer.style.display = isPeer ? 'flex' : 'none';
  if (btnSkipVideo) btnSkipVideo.style.display = isVideo ? 'flex' : 'none';
}
