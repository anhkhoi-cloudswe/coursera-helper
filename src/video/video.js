// src/video/video.js
// Video acceleration, reading completion, comprehensive left-nav & overview audit, and smart auto-skip module engine

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
  const currentPath = window.location.pathname;

  // Nếu đang ở màn hình Quiz / Assignment nhưng CHƯA LÀM (có nút Start Assignment hoặc có form làm quiz),
  // tuyệt đối KHÔNG cho phép bấm nút Next để bỏ qua assignment!
  if (
    currentPath.includes('/assignment-submission/') ||
    currentPath.includes('/exam/') ||
    currentPath.includes('/quiz/')
  ) {
    if (!isQuizResultScreen()) {
      return null;
    }
  }

  const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a[data-testid*="next"], button[data-testid*="next"]'));

  const nextBtn = buttons.find(b => {
    if (b.closest('#coursera-helper-hud, header, nav, [data-testid="left-nav"]')) return false;

    // Tuyệt đối không click vào link chuyển sang khóa học khác
    if (b.tagName === 'A') {
      const href = b.getAttribute('href') || '';
      if (href.startsWith('http') && !href.includes(window.location.host)) return false;
      if (currentCourseId && href.includes('/learn/') && !href.includes(`/learn/${currentCourseId}/`)) {
        return false;
      }
    }

    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
    const testId = (b.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();

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
// HỆ THỐNG RÀ SOÁT TRẠNG THÁI BÀI HỌC (TÍCH XANH VS FAILED VS CHƯA LÀM)
// ==========================================

export function isItemNeedsWork(el) {
  if (!el) return false;
  const text = (el.innerText || el.textContent || '').toLowerCase();
  const html = el.innerHTML || '';
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

  // 1. Kiểm tra icon FAILED / WARNING (Icon dấu chấm than cảnh báo của Coursera mà người dùng cung cấp!)
  // Path đặc trưng: M10 19.167A9.167 9.167 0 1010 .834a9.167 9.167 0 000 18.333zm-.445-8.097c...
  if (html.includes('-8.097c') || html.includes('8.097') || html.includes('data-testid="error"') || html.includes('data-testid="warning"')) {
    return true; // Bị FAILED -> BẮT BUỘC LÀM LẠI!
  }

  // 2. Kiểm tra điểm thi dưới 80% (Grade: <80% = Failed, ví dụ Grade: 50% trong ảnh)
  const gradeMatch = text.match(/grade:\s*(\d{1,3})%/i) || ariaLabel.match(/grade:\s*(\d{1,3})%/i);
  if (gradeMatch) {
    const score = parseInt(gradeMatch[1], 10);
    if (score < 80) return true; // Điểm < 80% chưa đạt chuẩn Coursera -> BẮT BUỘC LÀM LẠI!
  }

  // 3. Nếu có icon tích xanh và không bị failed -> ĐÃ ĐẠT
  const hasSuccessIcon = !!el.querySelector('[data-testid="learn-item-success-icon"]');
  if (hasSuccessIcon && (ariaLabel.includes('completed') || text.includes('completed') || text.includes('hoàn thành'))) {
    return false;
  }

  // 4. Các trường hợp Not submitted, vòng tròn xám rỗng, chưa nộp
  if (ariaLabel.includes('not submitted') || ariaLabel.includes('chưa nộp') || ariaLabel.includes('chưa hoàn thành')) {
    return true;
  }

  // 5. Nếu không có success-icon -> Cần làm
  return !hasSuccessIcon;
}

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
    const titleEl = link.querySelector('.css-u7fh1q, .css-1n1j66c, .outline-single-item-content-wrapper') || link;
    const title = (titleEl.innerText || titleEl.textContent || '').trim();
    const needsWork = isItemNeedsWork(link);
    const isCurrent = link.closest('li[data-current-item="true"]') !== null ||
                      link.classList.contains('css-jxphqf') ||
                      link.pathname === currentPath ||
                      link.href.includes(currentPath);

    return {
      element: link,
      href: link.getAttribute('href'),
      title,
      needsWork,
      isCompleted: !needsWork,
      isCurrent
    };
  });
}

export function findOverviewGetStartedButton() {
  // Tìm nút "Get started" hoặc "Start" trên trang tổng quan khóa học (/home/module/, /home/week/)
  const candidateButtons = Array.from(document.querySelectorAll(
    'button, a[role="button"], span[role="button"], a.cds-button, button.cds-button, [class*="cds-button"]'
  ));

  for (const btn of candidateButtons) {
    if (btn.closest('#coursera-helper-hud, header, nav[role="navigation"]')) continue;
    const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    if (txt === 'get started' || txt === 'bắt đầu' || txt === 'continue' || txt === 'tiếp tục học') {
      // Đảm bảo nút đang hiển thị
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return btn;
      }
    }
  }

  // Fallback: Tìm qua selector chính xác người dùng cung cấp
  const specificBtn = document.querySelector('.cds-button-label');
  if (specificBtn && specificBtn.textContent.trim().toLowerCase() === 'get started') {
    const parentBtn = specificBtn.closest('button, a, [role="button"], span.cds-608') || specificBtn;
    return parentBtn;
  }

  return null;
}
export function findFirstItemNeedingWork() {
  const currentPath = window.location.pathname;
  const currentCourseId = getCourseraCourseId();

  // 1. Tầng 1: Rà soát trên Sidebar left-nav (nếu đang ở màn hình học bài)
  const sidebarItems = getAllCourseItemsFromLeftNav();
  if (sidebarItems.length > 0) {
    const currentIdx = sidebarItems.findIndex(it => it.isCurrent);
    // Ưu tiên 1: Bài cần làm tiếp theo phía dưới
    if (currentIdx !== -1) {
      const nextPending = sidebarItems.slice(currentIdx + 1).find(it => it.needsWork);
      if (nextPending) return nextPending;
    }
    // Ưu tiên 2: Rà soát lại từ đầu để gom các bài bị bỏ sót phía trên
    const anyPending = sidebarItems.find(it => it.needsWork);
    if (anyPending) return anyPending;
  }

  // 2. Tầng 2: Rà soát trên Trang Tổng Quan Khóa Học (Course Material, Home, Week, Module Overview như trong hình!)
  // CHỈ tìm các bài học cụ thể trong nội dung module (/lecture/, /supplement/, /assignment-submission/, ...)
  const overviewLinks = Array.from(document.querySelectorAll(
    'a[href*="/lecture/"], a[href*="/supplement/"], a[href*="/assignment-submission/"], a[href*="/quiz/"], a[href*="/exam/"], a[href*="/ungradedWidget/"]'
  )).filter(a => {
    if (a.closest('#coursera-helper-hud, header, nav')) return false;
    const href = a.getAttribute('href') || '';
    if (currentCourseId && !href.includes(`/learn/${currentCourseId}/`)) return false;
    return true;
  });

  for (const link of overviewLinks) {
    // Thẻ bao bọc dòng bài học trên trang tổng quan
    const rowContainer = link.closest('li, tr, [data-testid*="item"], div[class*="item" i]') || link;
    if (isItemNeedsWork(rowContainer) || isItemNeedsWork(link)) {
      const title = (link.innerText || link.textContent || '').trim();
      return {
        element: link,
        href: link.getAttribute('href'),
        title: title || 'Bài học cần hoàn thành',
        needsWork: true,
        isCompleted: false,
        isCurrent: false
      };
    }
  }

  // 3. Tầng 3: TUYỆT ĐỐI KHÔNG tự click chuyển đổi giữa các tab Module menu trái (/home/module/)
  // để tránh việc chuyển qua lại vòng lặp vô tận (Module 1 <-> Module 2) khi chưa hoàn thành bài học.
  // Thay vào đó, nếu trong module hiện tại đã tick hết 100%, mới tìm Module kế tiếp (chỉ số module lớn hơn).
  const currentModuleMatch = currentPath.match(/\/home\/module\/(\d+)/);
  const currentModuleNum = currentModuleMatch ? parseInt(currentModuleMatch[1], 10) : 1;

  const nextModuleLink = Array.from(document.querySelectorAll('a[href*="/home/module/"]')).find(a => {
    const href = a.getAttribute('href') || '';
    const mMatch = href.match(/\/home\/module\/(\d+)/);
    if (!mMatch) return false;
    const mNum = parseInt(mMatch[1], 10);
    // Chỉ chọn module tiếp theo (chỉ số lớn hơn module hiện tại)
    if (mNum <= currentModuleNum) return false;

    const text = (a.innerText || '').toLowerCase();
    const isCompleted = a.querySelector('[data-testid="learn-item-success-icon"]') || text.includes('completed');
    return !isCompleted;
  });

  if (nextModuleLink) {
    return {
      element: nextModuleLink,
      href: nextModuleLink.getAttribute('href'),
      title: (nextModuleLink.innerText || 'Module tiếp theo').trim(),
      needsWork: true,
      isCompleted: false,
      isCurrent: false
    };
  }

  return null;
}

export function isCourseFullyCompleted() {
  const currentPath = window.location.pathname;

  // Nếu đang ở trong một bài học cụ thể (/lecture/, /supplement/, /assignment-submission/, /exam/, /quiz/)
  // thì tuyệt đối KHÔNG coi là hoàn thành khóa học!
  if (
    currentPath.includes('/lecture/') ||
    currentPath.includes('/supplement/') ||
    currentPath.includes('/assignment-submission/') ||
    currentPath.includes('/exam/') ||
    currentPath.includes('/quiz/') ||
    currentPath.includes('/ungradedWidget/')
  ) {
    return false;
  }

  const bodyText = (document.body.innerText || '').toLowerCase();

  // Kiểm tra thông báo hoàn thành toàn bộ khóa học
  const hasCourseEndGreeting = (
    bodyText.includes('now that you have completed this course') ||
    bodyText.includes('congratulations on completing course') ||
    bodyText.includes('chúc mừng bạn đã hoàn thành khóa học') ||
    bodyText.includes('ready to move on to the next course')
  );

  // Phải đảm bảo KHÔNG CÒN BẤT KỲ BÀI NÀO CẦN LÀM / FAILED
  const pendingItem = findFirstItemNeedingWork();
  if (pendingItem) {
    return false; // Vẫn còn bài cần làm -> Chưa xong!
  }

  const items = getAllCourseItemsFromLeftNav();
  if (items.length > 0) {
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
  // 1. Kiểm tra an toàn: Nếu toàn bộ khóa học đã hoàn tất 100% -> Dừng Auto-Skip
  if (isCourseFullyCompleted()) {
    showInPageToast('🎉 CHÚC MỪNG BẠN ĐÃ HOÀN THÀNH 100% TOÀN BỘ KHÓA HỌC! Tự động dừng Auto-Skip.', false, 8000);
    stopAutoSkipLoop();
    return true;
  }

  // 2. Nếu đang ở Trang Tổng Quan (/home/module/, /home/week/), ƯU TIÊN tìm và bấm nút "Get started" / "Continue"
  const currentPath = window.location.pathname;
  if (currentPath.includes('/home/module/') || currentPath.includes('/home/week/') || currentPath.includes('/home/welcome')) {
    const getStartedBtn = findOverviewGetStartedButton();
    if (getStartedBtn) {
      showInPageToast('🚀 [Tổng Quan] Phát hiện nút "Get started"! Đang bấm để vào học ngay...', false, 3500);
      getStartedBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
      triggerClick(getStartedBtn);
      try { getStartedBtn.click(); } catch (e) {}
      await sleep(2500);
      return true;
    }
  }

  // 3. Tìm bài học cần làm (chưa làm hoặc bị failed) trên Left-Nav hoặc Overview
  const targetItem = findFirstItemNeedingWork();
  if (targetItem && targetItem.element) {
    showInPageToast(`📌 [Rà soát Bài Học] Phát hiện bài cần làm: "${targetItem.title}". Đang chuyển đến...`, false, 3500);
    targetItem.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(300);
    triggerClick(targetItem.element);
    try { targetItem.element.click(); } catch (e) {}
    await sleep(2500);
    return true;
  }

  // 4. Fallback: Nút Next thông thường trong bài học
  const nextBtn = findNextButton();
  if (nextBtn) {
    showInPageToast('➡️ Đang bấm chuyển bài tiếp theo...', false, 2500);
    triggerClick(nextBtn);
    try { nextBtn.click(); } catch (e) {}
    await sleep(2000);
    return true;
  }

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

  // Rà soát chuyển bài
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
    'button[data-testid*="start"], a[data-testid*="start-assignment"], button[data-e2e*="start"], button[data-testid*="resume"], a[data-testid*="resume"], button[data-testid*="attempt"], a[data-testid*="attempt"], [data-testid*="take-quiz"], [data-testid*="go-to-assignment"], [data-testid*="practice-assignment"]'
  );
  if (byTestId && !byTestId.closest('#coursera-helper-hud, header, nav[role="navigation"]') && !byTestId.disabled) {
    return byTestId;
  }

  const allBtns = Array.from(document.querySelectorAll('button, a[role="button"], a.cds-button, a[href*="/attempt"], a[href*="/exam/"], span[role="button"]'));
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
      txt.includes('go to assignment') ||
      txt.includes('start practice') ||
      txt.includes('take practice')
    ) {
      return btn;
    }
  }

  // Fallback: Tìm thẻ có class chứa "start-assignment" hoặc role=button chứa text "start"
  const labelEl = Array.from(document.querySelectorAll('.cds-button-label, [class*="button-label"]')).find(el => {
    const t = (el.textContent || '').trim().toLowerCase();
    return t.includes('start') || t.includes('attempt') || t.includes('resume') || t.includes('bắt đầu');
  });
  if (labelEl) {
    const pBtn = labelEl.closest('button, a, [role="button"]') || labelEl;
    if (!pBtn.closest('#coursera-helper-hud, header, nav[role="navigation"]')) {
      return pBtn;
    }
  }

  return null;
}

export function isQuizResultScreen() {
  const currentPath = window.location.pathname;
  // Chỉ kiểm tra màn hình kết quả điểm nếu đang ở các URL liên quan đến Quiz / Assignment
  if (
    !currentPath.includes('/assignment-submission/') &&
    !currentPath.includes('/exam/') &&
    !currentPath.includes('/quiz/')
  ) {
    return false;
  }

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

  // 2. Kiểm tra nếu đang ở màn hình landing page /assignment-submission/ có nút "Start Assignment" / "Resume" / "Try again"
  // Thử lặp lại tối đa 4 lần (trong 2 giây) để đợi giao diện Coursera render xong nút
  let startBtn = null;
  for (let r = 0; r < 4; r++) {
    startBtn = findStartAssignmentButton();
    if (startBtn) break;
    await sleep(500);
  }

  if (startBtn) {
    showInPageToast(`🚀 [Auto-Skip] Tự động bấm "${(startBtn.innerText || 'Start Assignment').trim()}" để vào làm bài!`, false, 4000);
    startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
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

    await navigateToNextUncompletedItem();
    return true;
  }

  // Nếu đang ở URL /assignment-submission/ hoặc /exam/ mà vẫn chưa thấy nút và chưa có điểm,
  // TUYỆT ĐỐI KHÔNG navigate đi nơi khác để tránh skip mất bài! Hãy kiên nhẫn đợi ở chu kỳ sau.
  const currentPath = window.location.pathname;
  if (currentPath.includes('/assignment-submission/') || currentPath.includes('/exam/') || currentPath.includes('/quiz/')) {
    showInPageToast('⏳ [Auto-Skip] Đang đợi trang tải bài tập Assignment...', false, 3000);
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
    const isExplicitQuizUrl = path.includes('/assignment-submission/') ||
                             path.includes('/exam/') ||
                             path.includes('/quiz/');

    const hasQuizDOM = getQuestionContainers().length > 0 ||
                       findStartAssignmentButton() !== null ||
                       isQuizResultScreen();

    // Nếu không phải URL quiz mà là /supplement/ hoặc /lecture/, TUYỆT ĐỐI không gọi processQuizStep trừ khi có question container thực tế
    const isQuizPage = isExplicitQuizUrl || (hasQuizDOM && !path.includes('/supplement/') && !path.includes('/lecture/'));

    if (isQuizPage) {
      await processQuizStep();
      return;
    }

    // 2. Màn hình Video (/lecture/)
    if (path.includes('/lecture/')) {
      await completeCourseraVideo();
      await sleep(1500);
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

    // 5. Nếu đang ở màn hình Trang chủ khóa học / Overview (/home/week/, /home/module/, Course Material như trong hình 1)
    await navigateToNextUncompletedItem();
  } finally {
    window._chIsStepRunning = false;
  }
}

export function startAutoSkipLoop() {
  window._chAutoSkipActive = true;

  // Cập nhật giao diện nút Auto-Skip sang màu đỏ "Dừng Auto-Skip"
  const btnAutoSkip = document.getElementById('ch-hud-autoskip');
  if (btnAutoSkip) {
    btnAutoSkip.innerHTML = '<span class="ch-btn-icon">🛑</span><span class="ch-btn-label">Dừng Auto-Skip</span>';
    btnAutoSkip.style.setProperty('background', '#ef4444', 'important');
    btnAutoSkip.style.setProperty('color', '#ffffff', 'important');
  }

  showInPageToast('🚀 Đã bật Tự Động Skip Module (Kèm Rà Soát Toàn Bộ Khóa Học)!');
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

  // Khôi phục giao diện nút Auto-Skip sang màu xanh ban đầu
  const btnAutoSkip = document.getElementById('ch-hud-autoskip');
  if (btnAutoSkip) {
    btnAutoSkip.innerHTML = '<span class="ch-btn-icon">🚀</span><span class="ch-btn-label">Auto-Skip Module</span>';
    btnAutoSkip.style.setProperty('background', '#10b981', 'important');
    btnAutoSkip.style.setProperty('color', '#000000', 'important');
  }

  showInPageToast('🛑 Đã dừng Tự Động Skip Module.');
}
