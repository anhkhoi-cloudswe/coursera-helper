// src/video/video.js
// Video playback acceleration, bypass, reading auto-completion, and auto-skip module engine

import { showInPageToast } from '../hud/toast.js';
import { triggerClick, sleep } from '../utils/dom.js';

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

  // Xóa giới hạn tua thanh trượt
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
    // 1. Thử kéo thanh tiến trình video tới cuối (nếu khóa học không khóa kéo)
    if (video.duration && isFinite(video.duration)) {
      video.currentTime = Math.max(0, video.duration - 0.5);
    }
  } catch (e) {}

  // 2. Gửi message cho injected script (Main World) để tua an toàn theo phương pháp gốc
  window.postMessage({
    type: 'COURSERA_HELPER_SEEK_END'
  }, '*');

  // 3. Tăng tốc playback rate tối đa
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

  // Nhấn Mark as completed nếu có
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

  // Cuộn trang xuống cuối để kích hoạt event đọc
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await sleep(600);

  // Tìm và bấm Mark as Completed
  const markBtn = findMarkAsCompletedButton();
  if (markBtn) {
    triggerClick(markBtn);
    try { markBtn.click(); } catch (e) {}
    showInPageToast('✅ Đã đánh dấu hoàn thành bài đọc!');
    await sleep(800);
  }

  // Chuyển sang bài tiếp theo
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

export async function executeAutoSkipStep() {
  const path = window.location.pathname;

  // 1. Nếu đang ở màn hình Video (/lecture/)
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

  // 2. Nếu đang ở màn hình Reading / Tài liệu (/supplement/)
  if (path.includes('/supplement/')) {
    await processReadingStep();
    return;
  }

  // 3. Nếu đang ở màn hình Widget thực hành (/ungradedWidget/)
  if (path.includes('/ungradedWidget/')) {
    await processUngradedWidgetStep();
    return;
  }

  // 4. Nếu có nút Next thông thường
  const nextBtn = findNextButton() || findNextSidebarLink();
  if (nextBtn) {
    triggerClick(nextBtn);
    try { nextBtn.click(); } catch (e) {}
  }
}

export function startAutoSkipLoop() {
  window._chAutoSkipActive = true;
  showInPageToast('🚀 Đã bật Tự Động Skip Module!');
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

