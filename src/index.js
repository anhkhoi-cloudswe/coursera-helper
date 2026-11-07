// src/index.js
// Chrome Extension Content Script Entry Point

import { createFloatingHUD, updateHUDForCurrentPage, updateHUDLanguage } from './hud/hud.js';
import { initFloatingCopyPill } from './hud/copyPill.js';
import { triggerZeroClickQuizWorkflow } from './quiz/solver.js';
import { completeCourseraVideo, startAutoSkipLoop, stopAutoSkipLoop } from './video/video.js';
import { runAutoPeerReviewWorkflow } from './peer/peer.js';
import { isExtensionContextValid } from './utils/dom.js';

(function initCourseraHelper() {
  console.log('🚀 Coursera Helper v2.5.0 Modular Architecture Initialized');

  // 1. Inject Main World script nếu chưa có
  function injectMainWorldScript() {
    try {
      if (document.getElementById('ch-main-world-injected')) return;
      const script = document.createElement('script');
      script.id = 'ch-main-world-injected';
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {}
  }
  injectMainWorldScript();

  // 2. Tạo Floating HUD & Floating Copy Pill khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createFloatingHUD();
      initFloatingCopyPill();
    });
  } else {
    createFloatingHUD();
    initFloatingCopyPill();
  }

  // 3. SPA URL Watcher (Coursera chuyển trang không reload)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      updateHUDForCurrentPage();
    }
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  // 4. Lắng nghe Messages từ Side Panel & Background
  if (isExtensionContextValid()) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'solve_quiz_now') {
        const btn = document.getElementById('ch-hud-solvequiz') || document.getElementById('ch-btn-solve-quiz');
        triggerZeroClickQuizWorkflow(btn);
        sendResponse({ success: true });
      } else if (request.action === 'skip_video_now') {
        completeCourseraVideo();
        sendResponse({ success: true });
      } else if (request.action === 'start_auto_skip') {
        startAutoSkipLoop();
        sendResponse({ success: true });
      } else if (request.action === 'stop_auto_skip') {
        stopAutoSkipLoop();
        sendResponse({ success: true });
      } else if (request.action === 'peer_review_now') {
        const btn = document.getElementById('ch-hud-peerreview') || document.getElementById('ch-btn-peer-review');
        runAutoPeerReviewWorkflow(btn);
        sendResponse({ success: true });
      } else if (request.action === 'set_language') {
        updateHUDLanguage(request.lang);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  // 5. Phím tắt tiện lợi (Hotkeys)
  window.addEventListener('keydown', (e) => {
    // Alt + Q: Giải Quiz nhanh
    if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
      e.preventDefault();
      const btn = document.getElementById('ch-hud-solvequiz') || document.getElementById('ch-btn-solve-quiz');
      triggerZeroClickQuizWorkflow(btn);
    }
    // Alt + V: Tua video nhanh
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      completeCourseraVideo();
    }
  });
})();

