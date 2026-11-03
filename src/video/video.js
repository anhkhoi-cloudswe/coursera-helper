// src/video/video.js
// Video playback acceleration, bypass, reading auto-completion, and auto-skip module engine (with Quiz Solver integration)

import { showInPageToast } from '../hud/toast.js';
import { triggerClick, sleep } from '../utils/dom.js';
import { getQuestionContainers } from '../quiz/containers.js';
import { triggerZeroClickQuizWorkflow } from '../quiz/solver.js';

export function getCourseraCSRFToken() {
  const match = document.cookie.match(/(?:^|;\s*)CSRF3-Token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;
  return null;
}

export function getCourseraHeaders() {
  const csrf = getCourseraCSRFToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
  if (csrf) {
    headers['X-CSRF3-Token'] = csrf;
  }
  return headers;
}

export function getCourseraUserId() {
  const cookies = ['CAUTH', 'c_user', 'userId'];
  for (const name of cookies) {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const idMatch = decoded.match(/(\d{6,10})/);
        if (idMatch) return idMatch[1];
      } catch (e) {}
    }
  }

  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const text = s.textContent || '';
    const m = text.match(/"userId":\s*"?(\d+)"?/);
    if (m) return m[1];
  }
  return null;
}

export function getCourseraCourseId() {
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const text = s.textContent || '';
    const m = text.match(/"courseId":\s*"?([a-zA-Z0-9_-]+)"?/);
    if (m) return m[1];
  }
  const courseMatch = window.location.pathname.match(/\/learn\/([^\/]+)/);
  if (courseMatch) return courseMatch[1];
  return null;
}

export function findVideos() {
  return Array.from(document.querySelectorAll('video'));
}

export function findMarkAsCompletedButton() {
  const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
  const markBtn = buttons.find(b => {
    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
    const isCompleted = text.includes('mark as completed') ||
                        text.includes('marked as completed') ||
                        text.includes('đánh dấu đã hoàn thành') ||
                        text.includes('complete and continue') ||
                        text.includes('hoàn thành và tiếp tục');
    const isVisible = b.offsetWidth > 0 && b.offsetHeight > 0;
    return isCompleted && isVisible && !b.disabled;
  });
  return markBtn || null;
}

export function findNextButton() {
  const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a[data-testid*="next"], button[data-testid*="next"]'));
  const nextBtn = buttons.find(b => {
    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
    const testId = (b.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
    const isNext = text.includes('next') || text.includes('tiếp theo') ||
                   text.includes('go to next item') ||
                   testId.includes('next') || ariaLabel.includes('next');
    const isVisible = b.offsetWidth > 0 && b.offsetHeight > 0;
    return isNext && isVisible && !b.disabled;
  });
  return nextBtn || null;
}

export function findNextSidebarLink() {
  const currentPath = window.location.pathname;
  const links = Array.from(document.querySelectorAll('a[href*="/learn/"]'));
  const currentIdx = links.findIndex(a => a.pathname === currentPath || a.href.includes(currentPath));

  if (currentIdx !== -1 && currentIdx < links.length - 1) {
    return links[currentIdx + 1];
  }
  return null;
}

export function unlockVideo(video) {
  if (!video) return;
  try {
    video.playbackRate = 16.0;
  } catch (e) {}

  try {
    const playerContainer = video.closest('.vjs-v6, .video-js, [data-testid="video-player"]');
    if (playerContainer) {
      playerContainer.querySelectorAll('[disabled]').forEach(el => el.removeAttribute('disabled'));
    }
  } catch (e) {}
}

export function skipVideoViaMainWorld(video) {
  if (!video) return;
  try {
    if (video.duration && isFinite(video.duration)) {
      video.currentTime = Math.max(0, video.duration - 0.5);
    }
  } catch (e) {}

  window.postMessage({
    type: 'COURSERA_HELPER_SEEK_END'
  }, '*');

  try {
    video.playbackRate = 16.0;
    if (video.paused) video.play();
  } catch (e) {}
}

export async function completeCourseraVideo() {
  const videos = findVideos();
  if (videos.length === 0) {
    showInPageToast('⚠️ Không tìm thấy video trên trang!', true);
    return false;
  }

  showInPageToast('⚡ Đang kích hoạt tua video siêu tốc...');
  for (const v of videos) {
    unlockVideo(v);
    skipVideoViaMainWorld(v);
  }

  await sleep(1200);

  const markBtn = findMarkAsCompletedButton();
  if (markBtn) {
    triggerClick(markBtn);
    try { markBtn.click(); } catch (e) {}
    await sleep(600);
  }

  return true;
}

export async function processReadingStep() {
  showInPageToast('📖 Đang xử lý bài đọc Reading...');

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await sleep(600);

  const markBtn = findMarkAsCompletedButton();
  if (markBtn) {
    triggerClick(markBtn);
    try { markBtn.click(); } catch (e) {}
    showInPageToast('✅ Đã đánh dấu hoàn thành bài đọc!');
    await sleep(800);
  }

  const nextBtn = findNextButton() || findNextSidebarLink();
  if (nextBtn) {
    triggerClick(nextBtn);
    try { nextBtn.click(); } catch (e) {}
    return true;
  }

  return false;
}

export async function processUngradedWidgetStep() {
  showInPageToast('🧩 Đang xử lý Ungraded Widget...');
  const markBtn = findMarkAsCompletedButton();
  if (markBtn) {
    triggerClick(markBtn);
    try { markBtn.click(); } catch (e) {}
    await sleep(600);
  }

  const nextBtn = findNextButton() || findNextSidebarLink();
  if (nextBtn) {
    triggerClick(nextBtn);
    try { nextBtn.click(); } catch (e) {}
    return true;
  }
  return false;
}

// ==========================================
// QUIZ & ASSIGNMENT SUBMISSION AUTO-HANDLER
// ==========================================

export function findStartAssignmentButton() {
  // Nếu đã có câu hỏi trắc nghiệm trên DOM thì không tìm nút Start nữa
  if (getQuestionContainers().length > 0) return null;

  // 1. Data-testid / test-hook của Coursera
  const byTestId = document.querySelector(
    'button[data-testid*="start"], a[data-testid*="start-assignment"], button[data-e2e*="start"], button[data-testid*="resume"], a[data-testid*="resume"], button[data-testid*="attempt"], a[data-testid*="attempt"], [data-testid*="take-quiz"], [data-testid*="go-to-assignment"]'
  );
  if (byTestId && !byTestId.closest('#coursera-helper-hud, header, nav[role="navigation"]') && !byTestId.disabled) {
    return byTestId;
  }

  // 2. Tìm theo text nút (Hỗ trợ toàn diện màn hình /assignment-submission/)
  const allBtns = Array.from(document.querySelectorAll('button, a[role="button"], a.cds-button, a[href*="/attempt"], a[href*="/exam/"]'));
  for (const btn of allBtns) {
    if (btn.closest('#coursera-helper-hud, header, nav[role="navigation"]')) continue;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;

    const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    if (
      txt === 'start assignment' ||
      txt === 'resume assignment' ||
      txt === 'resume' ||
      txt === 'start quiz' ||
      txt === 'take quiz' ||
      txt === 'start' ||
      txt === 'attempt' ||
      txt === 'start attempt' ||
      txt === 'resume attempt' ||
      txt === 'retake' ||
      txt === 'try again' ||
      txt === 'bắt đầu làm bài' ||
      txt === 'tiếp tục' ||
      txt === 'làm bài' ||
      txt.includes('start assignment') ||
      txt.includes('resume assignment') ||
      txt.includes('begin assignment') ||
      txt.includes('start attempt') ||
      txt.includes('take assignment') ||
      txt.includes('go to assignment')
    ) {
      return btn;
    }
  }
  return null;
}

export function isQuizResultScreen() {
  const bodyText = (document.body.innerText || '').toLowerCase();
  const hasGradeKeywords = (
    bodyText.includes('your grade:') ||
    bodyText.includes('your grade') ||
    bodyText.includes('điểm của bạn:') ||
    bodyText.includes('your latest:') ||
    bodyText.includes('your highest:') ||
    bodyText.includes('to pass you need') ||
    bodyText.includes('we keep your highest score') ||
    bodyText.includes('nice work') ||
    bodyText.includes('passed')
  );

  const hasNextBtn = findQuizNextItemButton() !== null;
  const hasGradeContainer = document.querySelector(
    '[class*="grade" i], [class*="score" i], [data-testid*="grade"], [data-testid*="score"]'
  ) !== null;

  return (hasGradeKeywords && hasNextBtn) || (hasGradeKeywords && hasGradeContainer);
}

export function findQuizNextItemButton() {
  const excludeSelector = '#coursera-helper-hud, header, nav[role="navigation"], [class*="video-player"], [class*="vjs-"], [data-testid*="player"]';

  const testIdBtn = document.querySelector(
    'button[data-testid="quiz-next-button"], a[data-testid="quiz-next-button"], button[data-testid="next-item-button"], a[data-testid="next-item-button"]'
  );
  if (testIdBtn && !testIdBtn.disabled && !testIdBtn.closest(excludeSelector)) {
    return testIdBtn;
  }

  const allBtns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  for (const btn of allBtns) {
    if (btn.closest(excludeSelector)) continue;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;

    const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    if (
      txt === 'next item' ||
      txt.startsWith('next item') ||
      txt === 'go to next item' ||
      txt.startsWith('go to next item') ||
      txt === 'tiếp theo' ||
      txt === 'bài tiếp theo'
    ) {
      return btn;
    }
  }

  return null;
}

export async function processQuizStep() {
  showInPageToast('🧩 [Auto-Skip] Phát hiện Quiz / Assignment! Đang kiểm tra...', false, 4000);
  await sleep(1000);

  // 1. Kiểm tra nếu đang ở màn hình kết quả điểm ("Your grade: ...")
  if (isQuizResultScreen()) {
    const nextBtn = findQuizNextItemButton() || findNextButton();
    if (nextBtn) {
      showInPageToast('🎉 [Auto-Skip] Đã có kết quả bài Quiz! Bấm "Next item" để chuyển tiếp...', false, 4000);
      triggerClick(nextBtn);
      try { nextBtn.click(); } catch (e) {}
      await sleep(2500);
      return true;
    }
  }

  // 2. Kiểm tra nếu đang ở màn hình landing page /assignment-submission/ có nút "Start Assignment" / "Resume"
  const startBtn = findStartAssignmentButton();
  if (startBtn) {
    showInPageToast(`🚀 [Auto-Skip] Tự động bấm "${startBtn.innerText || 'Start Assignment'}" để vào làm bài!`, false, 4000);
    triggerClick(startBtn);
    try { startBtn.click(); } catch (e) {}
    await sleep(2500);
    return true;
  }

  // 3. Nếu đang ở trang làm Quiz (có câu hỏi trắc nghiệm)
  let containers = getQuestionContainers();
  if (containers.length > 0) {
    showInPageToast(`⚡ [Auto-Skip] Tìm thấy ${containers.length} câu hỏi! Bắt đầu tự động giải và nộp bài...`, false, 5000);
    const btnSolve = document.getElementById('ch-hud-solvequiz');
    await triggerZeroClickQuizWorkflow(btnSolve);

    // Chờ hệ thống nộp bài xong và chờ màn hình kết quả hoặc nút "Next item" xuất hiện
    showInPageToast('⏳ [Auto-Skip] Đang chờ kết quả nộp bài...', false, 4000);
    for (let w = 0; w < 50; w++) {
      await sleep(500);
      const nextBtn = findQuizNextItemButton() || (isQuizResultScreen() ? findNextButton() : null);
      if (nextBtn) {
        showInPageToast('🎉 [Auto-Skip] Bài thi đã hoàn thành! Đang bấm "Next item" để sang bài tiếp theo...', false, 4000);
        triggerClick(nextBtn);
        try { nextBtn.click(); } catch (e) {}
        await sleep(2500);
        return true;
      }
    }
    return true;
  }

  return false;
}

export async function executeAutoSkipStep() {
  if (window._chIsStepRunning) return;
  window._chIsStepRunning = true;

  try {
    const path = window.location.pathname;

    // 1. Kiểm tra màn hình Quiz / Assignment / Exam hoặc landing page /assignment-submission/
    const isQuizPage = path.includes('/assignment-submission/') ||
                       path.includes('/exam/') ||
                       path.includes('/quiz/') ||
                       getQuestionContainers().length > 0 ||
                       findStartAssignmentButton() !== null ||
                       isQuizResultScreen();

    if (isQuizPage) {
      await processQuizStep();
      return;
    }

    // 2. Màn hình Video (/lecture/)
    if (path.includes('/lecture/')) {
      await completeCourseraVideo();
      await sleep(1500);
      const nextBtn = findNextButton() || findNextSidebarLink();
      if (nextBtn) {
        triggerClick(nextBtn);
        try { nextBtn.click(); } catch (e) {}
      }
      return;
    }

    // 3. Màn hình Reading (/supplement/)
    if (path.includes('/supplement/')) {
      await processReadingStep();
      return;
    }

    // 4. Màn hình Ungraded Widget (/ungradedWidget/)
    if (path.includes('/ungradedWidget/')) {
      await processUngradedWidgetStep();
      return;
    }

    // 5. Fallback thông thường: Nút Next hoặc Sidebar Link
    const nextBtn = findNextButton() || findNextSidebarLink();
    if (nextBtn) {
      triggerClick(nextBtn);
      try { nextBtn.click(); } catch (e) {}
    }
  } finally {
    window._chIsStepRunning = false;
  }
}

export function startAutoSkipLoop() {
  window._chAutoSkipActive = true;
  showInPageToast('🚀 Đã bật Tự Động Skip Module (Kèm Giải Quiz & Nộp Bài)!');
  executeAutoSkipStep();

  clearInterval(window._chAutoSkipInterval);
  window._chAutoSkipInterval = setInterval(() => {
    if (!window._chAutoSkipActive) {
      clearInterval(window._chAutoSkipInterval);
      return;
    }
    executeAutoSkipStep();
  }, 4000);
}

export function stopAutoSkipLoop() {
  window._chAutoSkipActive = false;
  clearInterval(window._chAutoSkipInterval);
  showInPageToast('🛑 Đã dừng Tự Động Skip Module.');
}
