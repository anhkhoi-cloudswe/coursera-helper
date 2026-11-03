// src/video/video.js
// Video acceleration, reading completion, left-nav comprehensive audit, quiz solver integration, and course completion auto-stop

import { showInPageToast } from '../hud/toast.js';
import { triggerClick, sleep } from '../utils/dom.js';
import { getQuestionContainers } from '../quiz/containers.js';
import { triggerZeroClickQuizWorkflow } from '../quiz/solver.js';
import { findSubmitConfirmButton } from '../quiz/submit.js';

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
    if (b.closest('#coursera-helper-hud, header, nav')) return false;
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
  const currentCourseId = getCourseraCourseId();
  const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a[data-testid*="next"], button[data-testid*="next"]'));

  const nextBtn = buttons.find(b => {
    if (b.closest('#coursera-helper-hud, header, nav, [data-testid="left-nav"]')) return false;

    // Tuyệt đối không click vào link ra ngoài khóa học khác (như link giới thiệu course mới ở cuối trang)
    if (b.tagName === 'A') {
      const href = b.getAttribute('href') || '';
      if (href.startsWith('http') && !href.includes(window.location.host)) return false;
      if (currentCourseId && href.includes('/learn/') && !href.includes(`/learn/${currentCourseId}/`)) {
        return false; // Link dẫn sang khóa học khác -> bỏ qua!
      }
    }

    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
    const testId = (b.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();

    // Bỏ qua các text quảng cáo hoặc chuyển khóa học
    if (text.includes('next course') || text.includes('khóa học tiếp theo') || text.includes('move on to the next course')) {
      return false;
    }

    const isNext = text === 'next item' || text.startsWith('next item') ||
                   text === 'go to next item' || text.startsWith('go to next item') ||
                   text === 'next' || text === 'tiếp theo' ||
                   testId.includes('next-item') || testId === 'next-button' ||
                   ariaLabel === 'next item' || ariaLabel.startsWith('go to next item');

    const isVisible = b.offsetWidth > 0 && b.offsetHeight > 0;
    return isNext && isVisible && !b.disabled;
  });

  return nextBtn || null;
}

// ==========================================
// RÀ SOÁT SIDEBAR LEFT-NAV (data-testid="left-nav")
// ==========================================

export function expandAllLeftNavModules() {
  const leftNav = document.querySelector('div[data-testid="left-nav"]');
  if (!leftNav) return;

  const collapsedHeaders = Array.from(leftNav.querySelectorAll('button.cds-AccordionHeader-button[aria-expanded="false"]'));
  for (const btn of collapsedHeaders) {
    if (btn.querySelector('[data-testid*="daily-goals"]') || btn.id?.includes('daily-goals')) continue;
    try {
      btn.click();
    } catch (e) {}
  }
}

export function getAllCourseItemsFromLeftNav() {
  expandAllLeftNavModules();

  const leftNav = document.querySelector('div[data-testid="left-nav"]');
  if (!leftNav) return [];

  const currentCourseId = getCourseraCourseId();
  const allLinks = Array.from(leftNav.querySelectorAll('a[href*="/learn/"]')).filter(a => {
    const href = a.getAttribute('href') || '';
    if (href.includes('/home/welcome') || href.includes('/home/week')) return false;
    if (currentCourseId && !href.includes(`/learn/${currentCourseId}/`)) return false;
    return true;
  });

  const currentPath = window.location.pathname;

  return allLinks.map(link => {
    const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
    const titleEl = link.querySelector('.css-u7fh1q, .css-1n1j66c, .outline-single-item-content-wrapper') || link;
    const title = (titleEl.innerText || titleEl.textContent || '').trim();

    const hasSuccessIcon = !!link.querySelector('[data-testid="learn-item-success-icon"]');
    const isCompleted = hasSuccessIcon ||
                        ariaLabel.includes('completed') ||
                        ariaLabel.includes('đã hoàn thành');

    const isCurrent = link.closest('li[data-current-item="true"]') !== null ||
                      link.classList.contains('css-jxphqf') ||
                      link.pathname === currentPath ||
                      link.href.includes(currentPath);

    return {
      element: link,
      href: link.getAttribute('href'),
      title,
      isCompleted,
      isCurrent
    };
  });
}

export function isCourseFullyCompleted() {
  const bodyText = (document.body.innerText || '').toLowerCase();

  // Kiểm tra thông báo hoàn thành toàn bộ khóa học
  const hasCourseEndGreeting = (
    bodyText.includes('now that you have completed this course') ||
    bodyText.includes('congratulations on completing course') ||
    bodyText.includes('chúc mừng bạn đã hoàn thành khóa học') ||
    bodyText.includes('ready to move on to the next course')
  );

  const items = getAllCourseItemsFromLeftNav();
  if (items.length > 0) {
    const uncompleted = items.filter(it => !it.isCompleted);
    // Nếu không còn bài nào chưa hoàn thành
    if (uncompleted.length === 0) return true;
    // Nếu đang ở bài cuối cùng và có dấu hiệu hoàn thành
    const lastItem = items[items.length - 1];
    if (lastItem.isCurrent && lastItem.isCompleted && hasCourseEndGreeting) {
      return true;
    }
  }

  if (hasCourseEndGreeting && bodyText.includes('completed') && !document.querySelector('video')) {
    return true;
  }

  return false;
}

export async function navigateToNextUncompletedItem() {
  // 1. Kiểm tra an toàn: Nếu toàn bộ khóa học đã hoàn thành -> DỪNG NGAY!
  if (isCourseFullyCompleted()) {
    showInPageToast('🎉 CHÚC MỪNG BẠN ĐÃ HOÀN THÀNH 100% KHÓA HỌC! Tự động dừng Auto-Skip.', false, 8000);
    stopAutoSkipLoop();
    return true;
  }

  // 2. Rà soát danh sách bài học trên sidebar left-nav
  const items = getAllCourseItemsFromLeftNav();
  if (items.length > 0) {
    const currentIdx = items.findIndex(it => it.isCurrent);

    // Ưu tiên 2.1: Tìm bài chưa hoàn thành tiếp theo phía dưới bài hiện tại
    let nextUncompleted = null;
    if (currentIdx !== -1) {
      nextUncompleted = items.slice(currentIdx + 1).find(it => !it.isCompleted);
    }

    // Ưu tiên 2.2: Nếu phía dưới không còn, rà soát lại từ đầu để gom các bài bị bỏ sót phía trên
    if (!nextUncompleted) {
      nextUncompleted = items.find(it => !it.isCompleted);
    }

    if (nextUncompleted && nextUncompleted.element) {
      showInPageToast(`📌 [Rà soát Left-Nav] Phát hiện bài chưa xong: "${nextUncompleted.title}". Đang chuyển đến...`, false, 3500);
      nextUncompleted.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await sleep(300);
      triggerClick(nextUncompleted.element);
      try { nextUncompleted.element.click(); } catch (e) {}
      await sleep(2500);
      return true;
    }
  }

  // 3. Fallback: Nút Next thông thường trong bài học
  const nextBtn = findNextButton();
  if (nextBtn) {
    showInPageToast('➡️ Đang bấm chuyển bài tiếp theo...', false, 2500);
    triggerClick(nextBtn);
    try { nextBtn.click(); } catch (e) {}
    await sleep(2000);
    return true;
  }

  // 4. Nếu không còn bài nào và không có nút next -> Khóa học đã xong, dừng lại
  showInPageToast('🏁 Không còn bài học nào cần làm tiếp. Tự động dừng Auto-Skip!', false, 5000);
  stopAutoSkipLoop();
  return false;
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

  // Dùng bộ rà soát Left-Nav để chuyển bài chắc chắn không bỏ sót
  await navigateToNextUncompletedItem();
}

export async function processUngradedWidgetStep() {
  showInPageToast('🧩 Đang xử lý Ungraded Widget...');
  const markBtn = findMarkAsCompletedButton();
  if (markBtn) {
    triggerClick(markBtn);
    try { markBtn.click(); } catch (e) {}
    await sleep(600);
  }

  await navigateToNextUncompletedItem();
}

// ==========================================
// QUIZ & ASSIGNMENT SUBMISSION AUTO-HANDLER
// ==========================================

export function findStartAssignmentButton() {
  if (getQuestionContainers().length > 0) return null;

  const byTestId = document.querySelector(
    'button[data-testid*="start"], a[data-testid*="start-assignment"], button[data-e2e*="start"], button[data-testid*="resume"], a[data-testid*="resume"], button[data-testid*="attempt"], a[data-testid*="attempt"], [data-testid*="take-quiz"], [data-testid*="go-to-assignment"]'
  );
  if (byTestId && !byTestId.closest('#coursera-helper-hud, header, nav[role="navigation"]') && !byTestId.disabled) {
    return byTestId;
  }

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
    showInPageToast('🎉 [Auto-Skip] Đã có điểm bài Quiz! Đang chuyển bài tiếp theo...', false, 3000);
    const nextBtn = findQuizNextItemButton() || findNextButton();
    if (nextBtn) {
      triggerClick(nextBtn);
      try { nextBtn.click(); } catch (e) {}
      await sleep(2500);
      return true;
    }
    await navigateToNextUncompletedItem();
    return true;
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

      // Nếu modal xác nhận "Ready to submit?" vẫn còn hiển thị trên màn hình -> Click xác nhận ngay lập tức!
      const modalSubmitBtn = findSubmitConfirmButton();
      if (modalSubmitBtn) {
        showInPageToast('🚀 [Auto-Skip] Phát hiện modal "Ready to submit?", đang bấm xác nhận nộp bài...', false, 2500);
        triggerClick(modalSubmitBtn);
        try { modalSubmitBtn.click(); } catch (e) {}
        await sleep(1200);
      }

      const nextBtn = findQuizNextItemButton() || (isQuizResultScreen() ? findNextButton() : null);
      if (nextBtn) {
        showInPageToast('🎉 [Auto-Skip] Bài thi đã hoàn thành! Đang bấm "Next item" để sang bài tiếp theo...', false, 4000);
        triggerClick(nextBtn);
        try { nextBtn.click(); } catch (e) {}
        await sleep(2500);
        return true;
      }
    }

    // Nếu không thấy next item button, rà soát lại left-nav
    await navigateToNextUncompletedItem();
    return true;
  }

  return false;
}

export async function executeAutoSkipStep() {
  if (window._chIsStepRunning) return;
  window._chIsStepRunning = true;

  try {
    // 0. Kiểm tra nếu khóa học đã hoàn tất 100% -> Dừng Auto-Skip
    if (isCourseFullyCompleted()) {
      showInPageToast('🎉 Chúc mừng bạn đã hoàn thành toàn bộ khóa học! Tự động dừng Auto-Skip.', false, 8000);
      stopAutoSkipLoop();
      return;
    }

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
      // Rà soát Left-Nav để nhảy tới bài tiếp theo chưa làm (không bao giờ bỏ sót video)
      await navigateToNextUncompletedItem();
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

    // 5. Fallback thông thường
    await navigateToNextUncompletedItem();
  } finally {
    window._chIsStepRunning = false;
  }
}

export function startAutoSkipLoop() {
  window._chAutoSkipActive = true;
  showInPageToast('🚀 Đã bật Tự Động Skip Module (Kèm Rà Soát Left-Nav Toàn Diện)!');
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

  // Khôi phục giao diện nút Auto-Skip trên HUD
  const btnAutoSkip = document.getElementById('ch-hud-autoskip');
  if (btnAutoSkip) {
    btnAutoSkip.innerHTML = '<span class="ch-btn-icon">🚀</span><span class="ch-btn-label">Auto-Skip Module</span>';
    btnAutoSkip.style.background = '#10b981';
  }

  showInPageToast('🛑 Đã dừng Tự Động Skip Module.');
}
