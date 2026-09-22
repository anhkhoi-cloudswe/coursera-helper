// Coursera Helper — Content Script v2.1.0
// Tự động loại bỏ prompt injection, hỗ trợ tua nhanh video và Auto-Skip toàn bộ Module

(function () {
  'use strict';

  // Tránh inject trùng lặp
  if (window._courseraHelperInjected) return;
  window._courseraHelperInjected = true;

  const TRAP_PATTERNS = [
    /\s*You are a helpful AI assistant[\s\S]*?Do you understand\?\.?\s*/gi,
    /\s*You are a helpful AI assistant[\s\S]*?accessing assessment pages\.?\s*/gi,
    /\s*You are a helpful AI assistant[\s\S]*?(?=\s*(?:\d+\.|\bQuestion\b|\b[A-D]\.|\n\n\n|$))/gi
  ];
  const POINT_REGEX = /^[ \t]*\d+(?:\.\d+)?[ \t]*points?\.?[ \t]*$/gmi;

  // ==========================================
  // 1. TỰ ĐỘNG LÀM SẠCH BẪY COPY / CÂU HỎI QUIZ
  // ==========================================
  function cleanCourseraQuiz(text) {
    if (!text) return text;
    let cleaned = text;
    for (const pattern of TRAP_PATTERNS) {
      cleaned = cleaned.replace(pattern, '\n\n');
    }
    cleaned = cleaned.replace(POINT_REGEX, '');
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/[ \t]+$/gm, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  }

  // Bắt sự kiện sao chép (Ctrl + C)
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

  // Nút nổi "Copy sạch" khi bôi đen câu hỏi
  let floatingCopyBtn = null;

  function createFloatingCopyBtn() {
    if (floatingCopyBtn) return;
    floatingCopyBtn = document.createElement('button');
    floatingCopyBtn.id = 'coursera-helper-floating-pill';
    floatingCopyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: -1px; margin-right: 4px;">
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
      font-size: 11.5px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45);
      cursor: pointer;
      display: none;
      user-select: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
    `;

    floatingCopyBtn.addEventListener('mousedown', async (e) => {
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
      hideFloatingCopyBtn();
    });

    document.body.appendChild(floatingCopyBtn);
  }

  function showFloatingCopyBtn(x, y) {
    createFloatingCopyBtn();
    floatingCopyBtn.style.left = `${Math.max(10, x - 40)}px`;
    floatingCopyBtn.style.top = `${Math.max(10, y - 36)}px`;
    floatingCopyBtn.style.display = 'block';
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
        if (text.length > 20 && (text.includes('Question') || text.includes('Coursera') || text.includes('You are a helpful AI assistant'))) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          showFloatingCopyBtn(rect.left + window.scrollX + rect.width / 2, rect.top + window.scrollY);
          return;
        }
      }
      hideFloatingCopyBtn();
    }, 30);
  });

  document.addEventListener('mousedown', (e) => {
    if (floatingCopyBtn && e.target !== floatingCopyBtn) {
      hideFloatingCopyBtn();
    }
  });

  // ==========================================
  // 2. TOAST THÔNG BÁO NỔI TRÊN COURSERA
  // ==========================================
  function showInPageToast(message, isWarning = false) {
    let toast = document.getElementById('coursera-helper-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'coursera-helper-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 28px;
        right: 28px;
        background: #0f172a;
        color: #38bdf8;
        border: 1px solid #6366f1;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
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
        transform: translateY(15px);
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }

    if (isWarning) {
      toast.style.borderColor = '#f59e0b';
      toast.style.color = '#fef08a';
    } else {
      toast.style.borderColor = '#6366f1';
      toast.style.color = '#38bdf8';
    }

    toast.innerHTML = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(window._chToastTimer);
    window._chToastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
    }, 2800);
  }

  // ==========================================
  // 3. CÁC HÀM XỬ LÝ SỰ KIỆN CHUỘT & DOM COURSERA
  // ==========================================
  function triggerClick(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    // Gửi đầy đủ chuỗi sự kiện chuột để React SyntheticEvent nhận diện
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.click();
      return true;
    } catch (err) {
      try {
        el.click();
        return true;
      } catch (e2) {
        console.error('CourseraHelper: Click error', e2);
        return false;
      }
    }
  }

  // Tìm tất cả video trên trang (kể cả shadow DOM)
  function findVideos() {
    const videos = Array.from(document.querySelectorAll('video'));
    // Quét thêm shadow roots nếu có
    const allCustomElements = Array.from(document.querySelectorAll('*'));
    for (const el of allCustomElements) {
      if (el.shadowRoot) {
        const shadowVideos = el.shadowRoot.querySelectorAll('video');
        shadowVideos.forEach(sv => videos.push(sv));
      }
    }
    return videos;
  }

  // ==========================================
  // 3. CÁC HÀM TÌM KIẾM NÚT & ĐIỀU HƯỚNG COURSERA (CỰC KỲ CHÍNH XÁC)
  // ==========================================

  // A. Tìm nút "Mark as completed" (cho bài đọc / Reading / Supplement)
  function findMarkAsCompletedButton() {
    // 1. Selector trực tiếp data-testid / data-e2e
    const directBtn = document.querySelector(
      'button[data-testid="mark-complete-button"], button[data-testid*="mark-complete"], button[data-e2e="mark-complete-button"], [data-testid*="mark-complete"], button[aria-label*="mark as complete" i], button[aria-label*="đánh dấu" i]'
    );
    if (directBtn && !isButtonAlreadyCompleted(directBtn)) return directBtn;

    // 2. Quét tất cả button / thẻ click trên trang tìm theo text
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"], a.cds-button'));
    for (const btn of allButtons) {
      const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      if (!txt || txt.length > 50) continue;
      
      // Bỏ qua nếu là nút đã hoàn thành
      if (txt === 'completed' || txt === 'đã hoàn thành' || txt.includes('completed ✓') || txt.includes('✓')) {
        continue;
      }

      if (
        txt === 'mark as completed' ||
        txt === 'mark as complete' ||
        txt === 'mark complete' ||
        txt.includes('mark as completed') ||
        txt.includes('mark as complete') ||
        txt.includes('đánh dấu đã hoàn thành') ||
        txt.includes('đánh dấu là đã hoàn thành') ||
        txt.includes('đánh dấu hoàn thành')
      ) {
        return btn;
      }
    }

    return null;
  }

  function isButtonAlreadyCompleted(btn) {
    if (!btn) return false;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return true;
    const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    return txt === 'completed' || txt.includes('completed') || txt.includes('đã hoàn thành');
  }

  // B. Tìm nút "Go to next item" hoặc nút chuyển bài ở cuối trang
  function findNextButton() {
    // 1. Theo testid chuẩn của Coursera
    const testIdBtn = document.querySelector(
      'button[data-testid="next-item-button"], a[data-testid="next-item-button"], [data-testid*="next-item"], [data-testid*="navigation-next"], button[data-e2e="next-item-button"], a[data-e2e="next-item-button"]'
    );
    if (testIdBtn) return testIdBtn;

    // 2. Tìm theo text "Go to next item", "Next item", "Tiếp theo"
    const allClickables = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (
        txt === 'go to next item' ||
        txt.startsWith('go to next item') ||
        txt === 'next item' ||
        txt.startsWith('next item') ||
        txt === 'chuyển sang bài tiếp theo' ||
        txt === 'bài tiếp theo' ||
        txt.includes('go to next item') ||
        txt.includes('next item')
      ) {
        return el;
      }
    }

    // 3. Tìm theo aria-label
    const byAria = document.querySelector('button[aria-label*="next" i], a[aria-label*="next" i]');
    if (byAria) return byAria;

    return null;
  }

  // C. Tìm link bài học tiếp theo trên Menu điều hướng bên trái (Left Sidebar Navigation)
  // Đây là cứu cánh tối thượng giúp không bao giờ bị kẹt dù nút dưới cùng có bị ẩn hay disable
  function findNextSidebarLink() {
    try {
      const allLessonLinks = Array.from(document.querySelectorAll(
        'nav a[href*="/learn/"], aside a[href*="/learn/"], [role="navigation"] a[href*="/learn/"], .rc-ItemLink, a[href*="/lecture/"], a[href*="/supplement/"], a[href*="/item/"], a[href*="/quiz/"], a[href*="/exam/"]'
      ));

      if (allLessonLinks.length === 0) return null;

      // Lọc bỏ các href trùng lặp
      const uniqueLinks = [];
      const seenPaths = new Set();
      for (const link of allLessonLinks) {
        const href = link.getAttribute('href') || '';
        const cleanPath = href.split('?')[0].split('#')[0];
        if (cleanPath && !seenPaths.has(cleanPath)) {
          seenPaths.add(cleanPath);
          uniqueLinks.push(link);
        }
      }

      const currentPath = window.location.pathname;

      // Tìm vị trí bài học hiện tại trong danh sách
      let currentIndex = uniqueLinks.findIndex(link => {
        const href = link.getAttribute('href') || '';
        const cleanPath = href.split('?')[0].split('#')[0];
        return cleanPath === currentPath || currentPath.endsWith(cleanPath) || (cleanPath.length > 5 && currentPath.includes(cleanPath));
      });

      // Nếu không khớp URL tuyệt đối, thử tìm theo thuộc tính active của DOM
      if (currentIndex === -1) {
        currentIndex = uniqueLinks.findIndex(link => {
          return (
            link.getAttribute('aria-current') === 'true' ||
            link.getAttribute('aria-current') === 'page' ||
            link.classList.contains('active') ||
            link.classList.contains('selected') ||
            link.closest('.active') !== null ||
            link.closest('[aria-current="true"]') !== null
          );
        });
      }

      // Trả về link bài học liền kề tiếp theo
      if (currentIndex !== -1 && currentIndex + 1 < uniqueLinks.length) {
        return uniqueLinks[currentIndex + 1];
      }
    } catch (err) {
      console.warn('CourseraHelper: Lỗi khi tìm link sidebar tiếp theo', err);
    }
    return null;
  }

  // D. Chuyển sang bài học tiếp theo (Ưu tiên nút Next -> fallback Sidebar)
  function navigateToNextLesson() {
    // 1. Thử nút Go to next item
    const nextBtn = findNextButton();
    if (nextBtn && !nextBtn.disabled && nextBtn.getAttribute('aria-disabled') !== 'true') {
      showInPageToast('➡️ Đang chuyển sang bài học tiếp theo...');
      triggerClick(nextBtn);
      return true;
    }

    // 2. Thử link bài tiếp theo trên menu bên trái
    const nextSidebarLink = findNextSidebarLink();
    if (nextSidebarLink) {
      const linkText = (nextSidebarLink.innerText || nextSidebarLink.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 35);
      showInPageToast(`➡️ Đang mở bài tiếp theo: ${linkText || 'Bài học tiếp'}...`);
      triggerClick(nextSidebarLink);
      return true;
    }

    // 3. Nếu nút nextBtn bị disabled hoặc chưa bấm được, vẫn click thử
    if (nextBtn) {
      showInPageToast('➡️ Thử bấm nút chuyển tiếp...');
      triggerClick(nextBtn);
      return true;
    }

    // Không còn bài nào tiếp theo -> Hoàn thành Module!
    showInPageToast('🎉 CHÚC MỪNG! Đã hoàn thành tất cả bài học trong Module!');
    chrome.storage.local.set({ auto_skip_active: false });
    updateFloatingHUD(false);
    return false;
  }

  // E. Tìm nút bắt đầu trên trang tổng quan Module (Overview page: /home/module/1)
  function findOverviewStartElement() {
    const clickables = Array.from(document.querySelectorAll('button, a, [role="button"], span'));
    const startBtn = clickables.find(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (el.children.length > 2) return false;
      return t === 'get started' || t === 'bắt đầu' || t.startsWith('get started') || t.startsWith('bắt đầu');
    });

    if (startBtn) {
      return startBtn.closest('button, a, [role="button"]') || startBtn;
    }

    const firstLecture = document.querySelector(
      'a[href*="/lecture/"], a[href*="/item/"], a[href*="/supplement/"]'
    );
    if (firstLecture) return firstLecture;

    return null;
  }

  // ==========================================
  // 4. HÀNH ĐỘNG TUA 1 BÀI (VIDEO HOẶC READING)
  // ==========================================
  function completeCourseraVideo() {
    const currentUrl = window.location.href;

    // 1. Nếu ở trang tổng quan Module
    if (currentUrl.includes('/home/module/') || currentUrl.includes('/module/')) {
      const startEl = findOverviewStartElement();
      if (startEl) {
        showInPageToast('🚀 Đang mở bài học đầu tiên trong Module...');
        triggerClick(startEl);
        return true;
      }
      showInPageToast('⚠️ Không tìm thấy nút bắt đầu!', true);
      return false;
    }

    // 2. Nếu có Video trên trang
    const videos = findVideos();
    if (videos.length > 0) {
      for (const v of videos) {
        try {
          v.muted = true;
          v.playbackRate = 16;
          if (v.duration && !isNaN(v.duration) && isFinite(v.duration)) {
            v.currentTime = Math.max(0, v.duration - 0.2);
          } else {
            v.currentTime = 999999;
          }
          v.play().catch(() => {});
          v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
          v.dispatchEvent(new Event('ended', { bubbles: true }));
        } catch (e) {
          console.error(e);
        }
      }

      showInPageToast('⏩ Đã tua Video tới cuối! Đang chuyển bài tiếp...');
      setTimeout(() => {
        const markBtn = findMarkAsCompletedButton();
        if (markBtn) triggerClick(markBtn);

        setTimeout(() => {
          navigateToNextLesson();
        }, 500);
      }, 1200);
      return true;
    }

    // 3. Nếu là bài đọc Reading / Supplement có nút "Mark as completed"
    const markBtn = findMarkAsCompletedButton();
    if (markBtn) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      showInPageToast('✅ Đã bấm "Mark as completed"! Đang chuyển bài tiếp...');
      triggerClick(markBtn);
      setTimeout(() => {
        navigateToNextLesson();
      }, 1000);
      return true;
    }

    // 4. Nếu là bài đọc Reading nói chung (đã hoàn thành hoặc không có nút mark)
    if (currentUrl.includes('/supplement/') || currentUrl.includes('/item/')) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      showInPageToast('📖 Đang chuyển sang bài tiếp theo...');
      setTimeout(() => {
        navigateToNextLesson();
      }, 600);
      return true;
    }

    // 5. Thử chuyển tiếp trực tiếp
    const ok = navigateToNextLesson();
    if (ok) return true;

    showInPageToast('⚠️ Không tìm thấy bài học hoặc nút chuyển tiếp!', true);
    return false;
  }

  // Chỉnh tốc độ phát video (16x)
  function setCourseraVideoSpeed(rate = 16) {
    const videos = findVideos();
    if (videos.length > 0) {
      for (const v of videos) {
        v.playbackRate = rate;
        v.play().catch(() => {});
      }
      showInPageToast(`⚡ Đã tăng tốc độ Video lên ${rate}x!`);
      return true;
    }
    showInPageToast('⚠️ Không tìm thấy Video trên trang này!', true);
    return false;
  }

  // ==========================================
  // 5. ENGINE AUTO-SKIP HẾT TOÀN BỘ MODULE (TỰ ĐỘNG BỀN VỮNG)
  // Xử lý thông minh Video, Reading (Mark as completed) và SPA Routing
  // ==========================================
  let isStepInProgress = false;
  let autoSkipHeartbeat = null;
  let lastEvaluatedUrl = '';
  let lastActionTimestamp = 0;

  function executeAutoSkipStep() {
    chrome.storage.local.get(['auto_skip_active'], (res) => {
      if (!res.auto_skip_active) {
        stopAutoSkipLoop();
        return;
      }

      updateFloatingHUD(true);

      // Nếu bước trước đang trong quá trình thực thi (chưa hết timeout), không ngắt
      if (isStepInProgress) {
        // Tự động gỡ khóa nếu kẹt quá 10 giây
        if (Date.now() - lastActionTimestamp > 10000) {
          isStepInProgress = false;
        } else {
          return;
        }
      }

      const currentUrl = window.location.href;
      const now = Date.now();

      // TRƯỜNG HỢP A: Gặp Quiz / Exam / Assignment -> Dừng an toàn để người dùng làm hoặc AI giải
      if (
        currentUrl.includes('/quiz/') ||
        currentUrl.includes('/exam/') ||
        currentUrl.includes('/assignment/') ||
        currentUrl.includes('/ungradedLti/')
      ) {
        showInPageToast('⏸️ Gặp bài Quiz / Bài tập! Tạm dừng Auto-Skip để bạn làm hoặc giải với AI.', true);
        chrome.storage.local.set({ auto_skip_active: false });
        updateFloatingHUD(false);
        stopAutoSkipLoop();
        return;
      }

      // TRƯỜNG HỢP B: Đang ở trang tổng quan Module (/home/module/...)
      if (currentUrl.includes('/home/module/') || currentUrl.includes('/module/')) {
        isStepInProgress = true;
        lastActionTimestamp = now;
        lastEvaluatedUrl = currentUrl;

        const startEl = findOverviewStartElement();
        if (startEl) {
          showInPageToast('🚀 [Auto-Skip] Bấm "Get started" để vào bài học...');
          triggerClick(startEl);
        }
        setTimeout(() => {
          isStepInProgress = false;
        }, 2500);
        return;
      }

      // TRƯỜNG HỢP C: Là bài giảng Video (/lecture/)
      if (currentUrl.includes('/lecture/')) {
        isStepInProgress = true;
        lastActionTimestamp = now;
        lastEvaluatedUrl = currentUrl;
        processVideoLectureStep(0);
        return;
      }

      // TRƯỜNG HỢP D: Bài đọc Reading / Supplement (/supplement/, /item/, /ungradedWidget/)
      // hoặc trang có nút Mark as completed
      const isReadingUrl = currentUrl.includes('/supplement/') || currentUrl.includes('/item/') || currentUrl.includes('/ungradedWidget/');
      const hasMarkBtn = findMarkAsCompletedButton() !== null;

      if (isReadingUrl || hasMarkBtn) {
        isStepInProgress = true;
        lastActionTimestamp = now;
        lastEvaluatedUrl = currentUrl;
        processReadingStep();
        return;
      }

      // TRƯỜNG HỢP E: Trang có thẻ Video bất kể URL nào
      const videos = findVideos();
      if (videos.length > 0) {
        isStepInProgress = true;
        lastActionTimestamp = now;
        lastEvaluatedUrl = currentUrl;
        processVideoLectureStep(0);
        return;
      }

      // TRƯỜNG HỢP F: Thử chuyển tiếp nếu trang không xác định
      isStepInProgress = true;
      lastActionTimestamp = now;
      lastEvaluatedUrl = currentUrl;
      setTimeout(() => {
        navigateToNextLesson();
        setTimeout(() => {
          isStepInProgress = false;
        }, 1200);
      }, 1500);
    });
  }

  // Xử lý bài Video với cơ chế chờ video mount vào DOM (React SPA)
  function processVideoLectureStep(retryCount = 0) {
    const videos = findVideos();
    if (videos.length === 0) {
      if (retryCount < 8) {
        showInPageToast(`⏳ [Auto-Skip] Đang tải Video... (${retryCount + 1}/8)`);
        setTimeout(() => {
          processVideoLectureStep(retryCount + 1);
        }, 450);
        return;
      }
      // Nếu sau 8 lần (khoảng 3.6s) vẫn không thấy video, có thể là bài text nằm trong URL /lecture/
      showInPageToast('ℹ️ Không thấy Video, chuyển sang kiểm tra bài đọc...');
      processReadingStep();
      return;
    }

    // Đã có Video
    for (const v of videos) {
      try {
        v.muted = true;
        v.playbackRate = 16;
        if (v.duration && !isNaN(v.duration) && isFinite(v.duration)) {
          v.currentTime = Math.max(0, v.duration - 0.2);
        } else {
          v.currentTime = 999999;
        }
        v.play().catch(() => {});
        v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
        v.dispatchEvent(new Event('ended', { bubbles: true }));
      } catch (e) {
        console.error(e);
      }
    }

    showInPageToast('⏩ [Auto-Skip] Đã tua hết Video! Đang lưu tiến độ...');

    setTimeout(() => {
      // Bấm Mark as completed nếu có nút phụ
      const markBtn = findMarkAsCompletedButton();
      if (markBtn) triggerClick(markBtn);

      setTimeout(() => {
        navigateToNextLesson();
        setTimeout(() => {
          isStepInProgress = false;
        }, 1500);
      }, 500);
    }, 1500);
  }

  // Xử lý bài đọc Reading (Tự động bấm Mark as completed và chuyển tiếp)
  function processReadingStep() {
    showInPageToast('📖 [Auto-Skip] Đang đọc tài liệu...');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    setTimeout(() => {
      const markBtn = findMarkAsCompletedButton();
      if (markBtn) {
        showInPageToast('✅ [Auto-Skip] Đã bấm "Mark as completed"!');
        triggerClick(markBtn);

        // Chờ 1.2s để Coursera tick xanh và lưu tiến độ lên máy chủ
        setTimeout(() => {
          navigateToNextLesson();
          setTimeout(() => {
            isStepInProgress = false;
          }, 1500);
        }, 1200);
      } else {
        showInPageToast('📖 Đã đọc xong! Đang chuyển bài tiếp theo...');
        setTimeout(() => {
          navigateToNextLesson();
          setTimeout(() => {
            isStepInProgress = false;
          }, 1500);
        }, 800);
      }
    }, 800);
  }

  // Bắt sự kiện chuyển trang trong React Single Page App (SPA)
  function setupSpaUrlWatcher() {
    const handleUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastEvaluatedUrl) {
        isStepInProgress = false; // Reset cờ khóa để trang mới được xử lý ngay
        chrome.storage.local.get(['auto_skip_active'], (res) => {
          if (res.auto_skip_active) {
            // Chờ 800ms để DOM trang mới render
            setTimeout(() => {
              executeAutoSkipStep();
            }, 800);
          }
        });
      }
    };

    // Hook HTML5 History API
    const origPush = history.pushState;
    history.pushState = function(...args) {
      const ret = origPush.apply(this, args);
      setTimeout(handleUrlChange, 100);
      return ret;
    };

    const origReplace = history.replaceState;
    history.replaceState = function(...args) {
      const ret = origReplace.apply(this, args);
      setTimeout(handleUrlChange, 100);
      return ret;
    };

    window.addEventListener('popstate', () => {
      setTimeout(handleUrlChange, 100);
    });
  }

  setupSpaUrlWatcher();

  function startAutoSkipLoop() {
    if (autoSkipHeartbeat) clearInterval(autoSkipHeartbeat);
    isStepInProgress = false;
    executeAutoSkipStep();
    autoSkipHeartbeat = setInterval(executeAutoSkipStep, 1800);
    updateFloatingHUD(true);
    showInPageToast('🚀 Chế độ Auto-Skip Module đã BẬT!');
  }

  function stopAutoSkipLoop() {
    if (autoSkipHeartbeat) {
      clearInterval(autoSkipHeartbeat);
      autoSkipHeartbeat = null;
    }
    isStepInProgress = false;
    updateFloatingHUD(false);
  }

  // Khởi động kiểm tra trạng thái khi tải trang
  chrome.storage.local.get(['auto_skip_active'], (res) => {
    if (res.auto_skip_active) {
      startAutoSkipLoop();
    } else {
      createFloatingHUD();
    }
  });

  // Lắng nghe thay đổi trạng thái từ Side Panel hoặc HUD
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.auto_skip_active !== undefined) {
      if (changes.auto_skip_active.newValue) {
        startAutoSkipLoop();
      } else {
        stopAutoSkipLoop();
        showInPageToast('🛑 Đã dừng Auto-Skip!');
      }
    }
  });

  // ==========================================
  // 6. THANH ĐIỀU KHIỂN NỔI (HUD) TRỰC TIẾP TRÊN COURSERA
  // Giúp người dùng click trực tiếp ngay trên trang Coursera không cần mở Side Panel
  // ==========================================
  let floatingHUD = null;

  function createFloatingHUD() {
    if (document.getElementById('coursera-helper-hud')) return;

    floatingHUD = document.createElement('div');
    floatingHUD.id = 'coursera-helper-hud';
    floatingHUD.style.cssText = `
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 2147483646;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(99, 102, 241, 0.4);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      border-radius: 9999px;
      padding: 4px 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    `;

    floatingHUD.innerHTML = `
      <button id="ch-hud-solvequiz" style="
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
        padding: 5px 12px;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 10px rgba(99, 102, 241, 0.45);
        transition: all 0.15s ease;
      " title="Tự động quét toàn bộ câu hỏi (kèm hình ảnh), gọi Gemini giải và tự tick cả bài!">
        ⚡ Tự Giải Cả Bài
      </button>

      <button id="ch-hud-autoskip" style="
        background: #10b981;
        color: #064e3b;
        font-weight: 700;
        font-size: 11px;
        padding: 5px 11px;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s ease;
      ">
        🚀 Auto-Skip Module
      </button>

      <button id="ch-hud-skipone" style="
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        font-weight: 600;
        font-size: 11px;
        padding: 5px 10px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s ease;
      " title="Tua video này tới cuối và sang bài tiếp">
        ⏩ Tua 1 bài
      </button>

      <button id="ch-hud-speed" style="
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        font-weight: 600;
        font-size: 11px;
        padding: 5px 8px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        cursor: pointer;
        transition: all 0.15s ease;
      " title="Tăng tốc video lên 16x">
        ⚡ 16x
      </button>
    `;

    document.body.appendChild(floatingHUD);

    // Bắt sự kiện click trên HUD
    const btnSolveQuiz = floatingHUD.querySelector('#ch-hud-solvequiz');
    const btnAuto = floatingHUD.querySelector('#ch-hud-autoskip');
    const btnSkipOne = floatingHUD.querySelector('#ch-hud-skipone');
    const btnSpeed = floatingHUD.querySelector('#ch-hud-speed');

    if (btnSolveQuiz) {
      btnSolveQuiz.addEventListener('click', () => {
        triggerZeroClickQuizWorkflow();
      });
    }

    btnAuto.addEventListener('click', () => {
      chrome.storage.local.get(['auto_skip_active'], (res) => {
        const nextState = !res.auto_skip_active;
        chrome.storage.local.set({ 'auto_skip_active': nextState });
      });
    });

    btnSkipOne.addEventListener('click', () => {
      completeCourseraVideo();
    });

    btnSpeed.addEventListener('click', () => {
      setCourseraVideoSpeed(16);
    });

    // Cập nhật giao diện theo trạng thái ban đầu
    chrome.storage.local.get(['auto_skip_active'], (res) => {
      updateFloatingHUD(!!res.auto_skip_active);
    });
  }

  function updateFloatingHUD(isActive) {
    createFloatingHUD();
    const btnAuto = document.getElementById('ch-hud-autoskip');
    if (!btnAuto) return;

    if (isActive) {
      btnAuto.style.background = '#f43f5e';
      btnAuto.style.color = '#ffffff';
      btnAuto.innerText = '🛑 Dừng Auto-Skip';
    } else {
      btnAuto.style.background = '#10b981';
      btnAuto.style.color = '#064e3b';
      btnAuto.innerText = '🚀 Auto-Skip Module';
    }
  }

  // ==========================================
  // 7. LẮNG NGHE LỆNH TRỰC TIẾP TỪ SIDE PANEL
  // ==========================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'skip_video') {
      const ok = completeCourseraVideo();
      sendResponse({ success: ok });
    } else if (request.action === 'set_video_speed') {
      const ok = setCourseraVideoSpeed(request.speed || 16);
      sendResponse({ success: ok });
    } else if (request.action === 'toggle_auto_skip') {
      chrome.storage.local.get(['auto_skip_active'], (res) => {
        const nextState = !res.auto_skip_active;
        chrome.storage.local.set({ 'auto_skip_active': nextState });
        sendResponse({ active: nextState });
      });
    } else if (request.action === 'auto_fill_quiz') {
      autoFillCourseraQuiz(request.answers || []).then(result => {
        sendResponse(result);
      });
      return true;
    } else if (request.action === 'extract_all_quiz_questions') {
      extractAllQuizQuestionsFromDOM().then(questions => {
        sendResponse({ questions: questions });
      });
      return true;
    } else if (request.action === 'show_in_page_toast') {
      showInPageToast(request.message || '', request.isWarning || false);
      sendResponse({ ok: true });
      return true;
    }
    return true;
  });

  // ==========================================
  // 7.1 TOAST THÔNG BÁO NỔI TRÊN TRANG COURSERA
  // ==========================================
  function showInPageToast(message, isError = false, duration = 4000) {
    try {
      let toast = document.getElementById('ch-floating-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ch-floating-toast';
        toast.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          background: rgba(15, 23, 42, 0.95);
          color: #f8fafc;
          padding: 12px 20px;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 10px;
          backdrop-filter: blur(10px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          transform: translateY(20px);
          opacity: 0;
          pointer-events: none;
          max-width: 440px;
          line-height: 1.4;
        `;
        document.body.appendChild(toast);
      }

      toast.style.borderLeft = isError ? '4px solid #ef4444' : '4px solid #6366f1';
      toast.style.boxShadow = isError 
        ? '0 10px 25px -5px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(239, 68, 68, 0.3)' 
        : '0 10px 25px -5px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.3)';
      toast.innerHTML = message;
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';

      if (window._chToastTimeout) clearTimeout(window._chToastTimeout);
      window._chToastTimeout = setTimeout(() => {
        if (toast) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(20px)';
        }
      }, duration);
    } catch (e) {
      console.log('CourseraHelper Toast:', message);
    }
  }

  // ==========================================
  // 8. TỰ ĐỘNG TICK CHỌN ĐÁP ÁN QUIZ COURSERA
  // ==========================================
  function normalizeQuizText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isOptionMatch(el, targetAnswer) {
    const rawText = (el.innerText || el.textContent || '').trim();
    if (!rawText || rawText.length > 500) return false;

    const opt = normalizeQuizText(rawText);
    const ans = normalizeQuizText(targetAnswer);
    if (!opt || !ans) return false;

    // 1. Trùng khớp hoàn toàn
    if (opt === ans) return true;

    // 2. Chứa nhau với độ dài đáng kể từ 12 ký tự
    if (ans.length >= 12 && opt.includes(ans)) return true;
    if (opt.length >= 12 && ans.includes(opt)) return true;

    // 3. Khớp tỷ lệ từ khóa chính (trùng >= 70% từ vựng)
    const optWords = new Set(opt.split(' ').filter(w => w.length >= 3));
    const ansWords = new Set(ans.split(' ').filter(w => w.length >= 3));
    if (ansWords.size >= 2) {
      let overlap = 0;
      for (const w of ansWords) {
        if (optWords.has(w)) overlap++;
      }
      if (overlap / ansWords.size >= 0.7) return true;
    }

    return false;
  }

  function isOptionChecked(el, input) {
    if (input && input.checked) return true;
    if (el.getAttribute('aria-checked') === 'true') return true;
    if (input && input.getAttribute('aria-checked') === 'true') return true;
    if (el.classList.contains('cds-checkboxAndRadio-checked')) return true;
    const parentLabel = el.closest('label');
    if (parentLabel) {
      if (parentLabel.classList.contains('cds-checkboxAndRadio-checked') || parentLabel.getAttribute('aria-checked') === 'true') {
        return true;
      }
    }
    return false;
  }

  function highlightOptionCard(el) {
    const card = el.closest('label, li, .rc-Option, [role="radio"], [role="checkbox"]') || el;
    card.style.transition = 'all 0.3s ease';
    card.style.outline = '2px solid #10b981';
    card.style.background = 'rgba(16, 185, 129, 0.14)';
    card.style.borderRadius = '6px';
    card.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.45)';
  }

  function tickOptionElement(el) {
    try {
      const input = el.tagName === 'INPUT' 
        ? el 
        : el.querySelector('input[type="radio"], input[type="checkbox"]');

      // Cuộn vào tầm nhìn
      const scrollTarget = input || el;
      try {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {}

      // Nếu ĐÃ được check rồi -> giữ nguyên, tuyệt đối không click lại (tránh toggle tắt checkbox)
      if (isOptionChecked(el, input)) {
        highlightOptionCard(el);
        return true;
      }

      // Chưa check -> Tiến hành kích hoạt đúng 1 lần duy nhất
      let ticked = false;

      // Bước 1: Thử click trực tiếp vào <input> (chuẩn nhất cho React controlled checkbox/radio)
      if (input) {
        try {
          input.click();
          if (isOptionChecked(el, input)) ticked = true;
        } catch (e) {}
      }

      // Bước 2: Nếu chưa checked (hoặc không có input), click vào <label> hoặc container
      if (!ticked && !isOptionChecked(el, input)) {
        const clickable = el.closest('label') || el;
        try {
          clickable.click();
          if (isOptionChecked(el, input)) ticked = true;
        } catch (e) {}
      }

      // Bước 3: Gửi sự kiện MouseEvent chuẩn cho React SyntheticEvent nếu vẫn chưa checked
      if (!ticked && !isOptionChecked(el, input)) {
        const target = input || el.closest('label') || el;
        try {
          ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evt => {
            target.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
          });
          if (isOptionChecked(el, input)) ticked = true;
        } catch (e) {}
      }

      // Bước 4: React controlled component prototype setter dự phòng tối thượng
      if (!isOptionChecked(el, input) && input) {
        try {
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
          if (setter) {
            setter.call(input, true);
          } else {
            input.checked = true;
          }
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {}
      }

      // Hiệu ứng viền phát sáng xanh lục
      highlightOptionCard(el);

      return true;
    } catch (err) {
      console.warn('CourseraHelper: Lỗi tick option:', err);
      return false;
    }
  }

  async function autoFillCourseraQuiz(answersList) {
    if (!answersList || !Array.isArray(answersList) || answersList.length === 0) {
      return { success: false, tickedCount: 0, totalQuestions: 0 };
    }

    let tickedCount = 0;

    for (let i = 0; i < answersList.length; i++) {
      const item = answersList[i];
      const qNum = item.q || (i + 1);
      const targetAnswers = item.answers || [];
      if (targetAnswers.length === 0) continue;

      // Tìm container câu hỏi trong DOM hiện tại (fresh query để không bị ảnh hưởng bởi React re-render)
      const questionContainers = Array.from(document.querySelectorAll(
        'div[data-testid="part-container"], fieldset, .rc-FormPartsQuestion, .rc-QuizQuestion, div[role="group"]'
      )).filter((c, idx, arr) => !arr.some(other => other !== c && other.contains(c)));

      let container = null;
      if (questionContainers.length > 0) {
        container = questionContainers.find(c => {
          const txt = c.innerText || c.textContent || '';
          const regex = new RegExp(`(?:Question\\s+${qNum}\\b|\\b${qNum}\\.\\s+|\\bCâu\\s+${qNum}\\b)`, 'i');
          return regex.test(txt);
        }) || questionContainers[qNum - 1] || questionContainers[i];
      }

      for (const ansText of targetAnswers) {
        let matchedOption = null;

        // 1. Tìm trong container câu hỏi
        if (container) {
          const optsInContainer = Array.from(container.querySelectorAll(
            'label, li.rc-Option, div[data-testid="option-label"], [role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]'
          ));
          matchedOption = optsInContainer.find(el => isOptionMatch(el, ansText));
        }

        // 2. Tìm toàn trang nếu chưa thấy
        if (!matchedOption) {
          const allOptionElements = Array.from(document.querySelectorAll(
            'label, li.rc-Option, div[data-testid="option-label"], [role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]'
          ));
          matchedOption = allOptionElements.find(el => isOptionMatch(el, ansText));
        }

        if (matchedOption) {
          const ok = tickOptionElement(matchedOption);
          if (ok) tickedCount++;

          // Giãn cách ngắn giữa các lần tick để React kịp cập nhật state của checkbox trong multi-select
          await new Promise(resolve => setTimeout(resolve, 80));
        }
      }
    }

    if (tickedCount > 0) {
      showInPageToast(`🎉 Coursera Helper: Đã tự động tick chọn ${tickedCount} đáp án thành công!`);
    } else {
      showInPageToast('⚠️ Đã thử tick nhưng không tìm thấy câu hỏi khớp trên trang!', true);
    }

    return { success: tickedCount > 0, tickedCount, totalAnswers: answersList.length };
  }

  // ==========================================
  // 9. HỆ THỐNG ZERO-CLICK: TỰ ĐỘNG BÓC TÁCH CÂU HỎI, HỖ TRỢ HÌNH ẢNH & BATCH SOLVER
  // ==========================================

  // Trích xuất ảnh sang dạng Base64 (hỗ trợ cả canvas & fetch blob)
  async function extractImageBase64(img) {
    if (!img) return null;
    const src = img.src || img.getAttribute('src') || '';
    if (!src || src.startsWith('data:image/svg') || src.includes('.svg')) return null;

    if (src.startsWith('data:image')) {
      const parts = src.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      return { mime_type: mime, data: parts[1] };
    }

    // Cách 1: Vẽ qua Canvas ngầm, giới hạn chiều dài tối đa 1000px để tối ưu tốc độ
    try {
      if (img.complete && img.naturalWidth > 15) {
        const maxDim = 1000;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        return { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] };
      }
    } catch (e) {}

    // Cách 2: Fetch Blob trực tiếp
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string' && result.includes(',')) {
            const parts = result.split(',');
            const mime = blob.type || 'image/jpeg';
            resolve({ mime_type: mime, data: parts[1] });
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  }

  // Tự động quét toàn bộ bài trắc nghiệm trên DOM Coursera (kèm trích xuất hình ảnh)
  async function extractAllQuizQuestionsFromDOM() {
    let containers = Array.from(document.querySelectorAll(
      'div[data-testid="part-container"], fieldset.rc-FormPartsQuestion, fieldset, .rc-FormPartsQuestion, .rc-QuizQuestion, div[role="group"]'
    )).filter((c, idx, arr) => !arr.some(other => other !== c && other.contains(c)));

    // Fallback nếu không khớp class chuẩn
    if (containers.length === 0) {
      const allInputs = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      const parentSet = new Set();
      allInputs.forEach(inp => {
        const group = inp.closest('fieldset, form, div[role="group"], .rc-QuizQuestion') || inp.parentElement?.parentElement;
        if (group) parentSet.add(group);
      });
      containers = Array.from(parentSet);
    }

    const questions = [];

    for (let idx = 0; idx < containers.length; idx++) {
      const container = containers[idx];

      // 1. Số thứ tự câu
      let qNum = idx + 1;
      const testId = container.getAttribute('data-testid') || '';
      const matchTestId = testId.match(/\d+/);
      if (matchTestId) {
        qNum = parseInt(matchTestId[0], 10);
      } else {
        const cTxt = container.innerText || '';
        const matchNum = cTxt.match(/(?:Question\s+(\d+)|\b(\d+)\.|\bCâu\s+(\d+))/i);
        if (matchNum) {
          qNum = parseInt(matchNum[1] || matchNum[2] || matchNum[3], 10);
        }
      }

      // 2. Thân câu hỏi (Prompt)
      let promptText = '';
      const titleEl = container.querySelector(
        'legend, h2, h3, [data-testid*="question-title"], [data-testid*="prompt"], .rc-FormPartsQuestion__title, .c-question-body'
      );
      if (titleEl) {
        promptText = titleEl.innerText || titleEl.textContent || '';
      } else {
        const firstOpt = container.querySelector('label, li.rc-Option, [role="radio"], [role="checkbox"]');
        if (firstOpt) {
          const fullTxt = container.innerText || '';
          const optTxt = firstOpt.innerText || '';
          const splitIdx = fullTxt.indexOf(optTxt);
          promptText = splitIdx > 0 ? fullTxt.slice(0, splitIdx) : fullTxt;
        } else {
          promptText = container.innerText || '';
        }
      }

      promptText = cleanCourseraQuiz(promptText);
      promptText = promptText
        .replace(/\b\d+\s*points?\b/gi, '')
        .replace(/\b\d+\s*điểm\b/gi, '')
        .replace(/Unanswered|Chưa trả lời/gi, '')
        .trim();

      // 3. Trích xuất hình ảnh trong câu hỏi (Sơ đồ, bảng biểu, ảnh code)
      const promptImgs = Array.from(container.querySelectorAll('img:not([alt*="avatar"]):not([src*="icon"])'));
      const images = [];
      for (const img of promptImgs) {
        if (img.closest('label, li.rc-Option, [role="radio"], [role="checkbox"]')) continue;
        if (img.naturalWidth > 0 && (img.naturalWidth < 25 || img.naturalHeight < 25)) continue;
        const b64 = await extractImageBase64(img);
        if (b64) images.push(b64);
      }

      // 4. Trích xuất các phương án lựa chọn
      const optEls = Array.from(container.querySelectorAll(
        'label.cds-checkboxAndRadio-label, label, li.rc-Option, div[data-testid="option-label"], [role="radio"], [role="checkbox"]'
      ));

      const options = [];
      const seenTexts = new Set();
      let qType = 'radio';

      for (const optEl of optEls) {
        const rawOptText = (optEl.innerText || optEl.textContent || '').trim();
        const cleanOpt = rawOptText.replace(/\s+/g, ' ').trim();
        if (!cleanOpt || cleanOpt.length > 500) continue;
        if (seenTexts.has(cleanOpt.toLowerCase())) continue;
        seenTexts.add(cleanOpt.toLowerCase());

        const inp = optEl.querySelector('input');
        if (inp && inp.type === 'checkbox') qType = 'checkbox';

        let optImg = null;
        const optImgEl = optEl.querySelector('img');
        if (optImgEl && optImgEl.naturalWidth > 25) {
          optImg = await extractImageBase64(optImgEl);
        }

        options.push({
          text: cleanOpt,
          image: optImg
        });
      }

      // 5. Trích xuất phản hồi từ lần làm bài trước nếu có (để AI học hỏi và không lặp lại lỗi sai)
      let prevFeedback = '';
      let prevWrongAnswer = '';
      let prevCorrectAnswer = '';

      const feedbackEl = container.querySelector(
        '.rc-FormPartsQuestion__feedback, [data-testid*="feedback"], .c-feedback, [role="alert"], div[class*="feedback"]'
      );
      if (feedbackEl) {
        prevFeedback = feedbackEl.innerText.trim().replace(/\s+/g, ' ');
      }

      const checkedInputs = Array.from(container.querySelectorAll('input:checked, [aria-checked="true"]'));
      for (const inp of checkedInputs) {
        const parentOpt = inp.closest('label, li.rc-Option, div[data-testid="option-label"]');
        if (parentOpt) {
          const optText = (parentOpt.innerText || '').trim().replace(/\s+/g, ' ');
          if (container.innerText.includes('Try again') || container.innerText.includes('0 / 1') || container.innerText.includes('0/1') || container.innerText.includes('Incorrect')) {
            prevWrongAnswer = optText;
          } else if (container.innerText.includes('Nice work') || container.innerText.includes('1 / 1') || container.innerText.includes('1/1') || container.innerText.includes('Correct')) {
            prevCorrectAnswer = optText;
          }
        }
      }

      if (options.length > 0) {
        questions.push({
          q: qNum,
          text: promptText,
          images: images,
          options: options,
          type: qType,
          prevFeedback: prevFeedback,
          prevWrongAnswer: prevWrongAnswer,
          prevCorrectAnswer: prevCorrectAnswer
        });
      }
    }

    return questions;
  }

  // Khởi động quy trình giải tự động 1-Click (Zero-Click)
  async function triggerZeroClickQuizWorkflow() {
    const btnSolve = document.getElementById('ch-hud-solvequiz');
    const origBtnText = btnSolve ? btnSolve.innerHTML : '⚡ Tự Giải Cả Bài';

    if (btnSolve) {
      btnSolve.innerHTML = '⏳ Đang quét...';
      btnSolve.style.opacity = '0.75';
    }

    try {
      showInPageToast('🔍 Đang quét câu hỏi và hình ảnh trên trang...');
      const questions = await extractAllQuizQuestionsFromDOM();

      if (!questions || questions.length === 0) {
        const retryBtn = Array.from(document.querySelectorAll('button, a')).find(b => 
          /retry|làm lại|try again/i.test(b.innerText || '')
        );
        if (retryBtn) {
          showInPageToast('💡 Bạn đang ở trang xem kết quả! Hãy bấm nút [Retry] màu xanh trước để mở bài thi mới, sau đó bấm Tự Giải nhé!', true, 6000);
        } else {
          showInPageToast('⚠️ Không tìm thấy câu hỏi trắc nghiệm nào trên trang này! (Hãy mở bài Quiz trước)', true, 5000);
        }
        if (btnSolve) {
          btnSolve.innerHTML = origBtnText;
          btnSolve.style.opacity = '1';
        }
        return;
      }

      const totalImages = questions.reduce((acc, q) => acc + (q.images ? q.images.length : 0), 0);
      showInPageToast(`🚀 Tìm thấy ${questions.length} câu hỏi (${totalImages} ảnh)! Đang bắt đầu giải tự động...`);

      // Chạy bộ giải tự động (chạy độc lập, không phụ thuộc vào việc Side Panel mở hay đóng)
      await runInlineBatchSolver(questions, btnSolve, origBtnText);

    } catch (err) {
      console.error('Trigger Zero-Click Error:', err);
      showInPageToast(`❌ Lỗi khi tự giải: ${err.message}`, true, 5000);
      if (btnSolve) {
        btnSolve.innerHTML = origBtnText;
        btnSolve.style.opacity = '1';
      }
    }
  }

  // Bộ giải nội tuyến độc lập (hoạt động 100% không cần mở Side Panel)
  async function runInlineBatchSolver(questions, btnSolve, origBtnText) {
    const { gemini_api_key: apiKey, gemini_model: savedModel } = await chrome.storage.local.get(['gemini_api_key', 'gemini_model']);
    if (!apiKey) {
      showInPageToast('⚠️ Chưa có Gemini API Key! Hãy bấm vào icon Extension để cài đặt API Key.', true, 6000);
      chrome.runtime.sendMessage({ action: 'open_side_panel' });
      if (btnSolve) {
        btnSolve.innerHTML = origBtnText;
        btnSolve.style.opacity = '1';
      }
      return;
    }

    const model = savedModel || 'gemini-3.6-flash';
    const BATCH_SIZE = 5;
    const totalQuestions = questions.length;
    const totalBatches = Math.ceil(totalQuestions / BATCH_SIZE);
    const allAnswers = [];
    let accumulatedMarkdown = '';

    for (let b = 0; b < totalBatches; b++) {
      const startIdx = b * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalQuestions);
      const batchQuestions = questions.slice(startIdx, endIdx);

      const statusMsg = `⏳ Đang giải câu ${startIdx + 1} - ${endIdx} / ${totalQuestions}...`;
      showInPageToast(statusMsg);
      if (btnSolve) btnSolve.innerHTML = `⏳ Giải ${startIdx + 1}-${endIdx}...`;

      const parts = buildMultimodalBatchParts(batchQuestions, startIdx + 1, endIdx);

      try {
        const text = await callGeminiDirectParts(apiKey, model, parts);
        if (text) {
          accumulatedMarkdown += `\n\n## 📝 Nhóm câu ${startIdx + 1} - ${endIdx}\n\n` + text;
          const answers = parseAnswersFromText(text);
          if (answers.length > 0) {
            allAnswers.push(...answers);
            await autoFillCourseraQuiz(answers);
          }
        }
      } catch (err) {
        console.error('CourseraHelper Inline Solver Error:', err);
      }

      if (b < totalBatches - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Lưu kết quả vào storage để khi người dùng mở Side Panel vẫn xem được chi tiết
    chrome.storage.local.set({
      'saved_ai_answers': allAnswers,
      'saved_ai_raw': accumulatedMarkdown
    });

    showInPageToast(`🎉 HOÀN THÀNH! Đã giải và tự động tick xong tất cả ${totalQuestions} câu hỏi!`, false, 5000);
    if (btnSolve) {
      btnSolve.innerHTML = '✅ Đã Giải Xong!';
      setTimeout(() => {
        if (btnSolve) {
          btnSolve.innerHTML = origBtnText;
          btnSolve.style.opacity = '1';
        }
      }, 3000);
    }
  }

  function buildMultimodalBatchParts(batchQuestions, startNum, endNum) {
    const parts = [];

    const pageTitle = document.title ? document.title.replace(/\s*\|\s*Coursera/i, '').trim() : '';
    const pageHeading = document.querySelector('h1')?.innerText?.trim() || '';
    const courseContext = [pageHeading, pageTitle].filter(Boolean).join(' - ') || 'Coursera Academic Course';

    let text = `Bạn là giáo sư học thuật và chuyên gia hàng đầu về các chương trình đào tạo của Coursera.\n`;
    text += `Chủ đề khóa học & bài thi: "${courseContext}".\n\n`;
    text += `MỤC TIÊU: Đạt điểm tuyệt đối 100% cho nhóm câu hỏi trắc nghiệm từ câu ${startNum} đến câu ${endNum}.\n\n`;

    text += `NGUYÊN TẮC GIẢI & PHÂN TÍCH BẪY HỌC THUẬT COURSERA (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):\n`;
    text += `1. BẪY TRIẾT LÝ VS THỰC THI (PHILOSOPHY VS PRACTICE):\n`;
    text += `   - Triết lý tổ chức (Philosophy) chỉ bao gồm tầm nhìn, định hướng cốt lõi và lường trước các hệ quả tương lai (anticipating future implications). Triết lý KHÔNG đi vào chi tiết thực thi nguyên tắc (putting into practice) vì thực thi là thuộc về chính sách và chiến thuật (policy/tactics).\n`;
    text += `   - Không chọn các phương án bề ngoài có vẻ tốt nhưng sai phạm vi định nghĩa học thuật của câu hỏi.\n`;
    text += `2. BẪY TUYÊN BỐ SUÔNG (SUPERFICIAL/PR TRAPS):\n`;
    text += `   - Luôn ưu tiên hành động thực chất (xây dựng văn hóa tổ chức, sự cam kết nội bộ, sự tham gia của các bên liên quan) thay vì tuyên bố PR trấn an bề ngoài (reassuring customers).\n`;
    text += `3. BẪY TỪ HẠN ĐỊNH CỰC ĐOAN (EXTREME DISTRACTORS):\n`;
    text += `   - Cảnh giác cao độ với các lựa chọn chứa từ ngữ cực đoan như: "above all else", "cannot be modified", "exclusively", "must be self-sustaining", "internal only". Đa phần đây là bẫy sai.\n`;
    text += `4. SUY LUẬN TỪNG BƯỚC (STEP-BY-STEP REASONING):\n`;
    text += `   Với mỗi câu hỏi:\n`;
    text += `   - Xác định trọng tâm kiến thức giáo trình Coursera đang muốn hỏi.\n`;
    text += `   - Loại trừ từng phương án sai (chỉ rõ điểm bẫy distractor).\n`;
    text += `   - Chọn phương án chính xác nhất 100% theo đúng giáo trình.\n`;
    text += `   - Nếu câu hỏi yêu cầu chọn nhiều (Select two / Select all that apply): Bắt buộc chọn ĐỦ tất cả các đáp án đúng.\n`;
    text += `5. CUỐI CÙNG, BẮT BUỘC XUẤT KHỐI JSON:ANSWERS ĐỂ HỆ THỐNG TỰ ĐỘNG ĐIỀN:\n`;
    text += "```json:answers\n";
    text += "[\n  {\"q\": " + startNum + ", \"answers\": [\"Tên chính xác 100% của đáp án đúng 1\", \"Tên đáp án đúng 2 nếu có\"]}\n]\n";
    text += "```\n\n";

    text += `--- DANH SÁCH CÂU HỎI TRONG NHÓM NÀY ---\n\n`;

    for (const q of batchQuestions) {
      text += `### Question ${q.q}\n${q.text}\n`;
      if (q.prevFeedback) {
        text += `> [LƯU Ý TỪ LẦN THI TRƯỚC]: Câu này từng chọn "${q.prevWrongAnswer}" và bị báo SAI: "${q.prevFeedback}". TUYỆT ĐỐI KHÔNG CHỌN LẠI "${q.prevWrongAnswer}"! Hãy chọn phương án đúng khác phù hợp với giải thích.\n`;
      } else if (q.prevCorrectAnswer) {
        text += `> [LƯU Ý TỪ LẦN THI TRƯỚC]: Câu này đã chọn ĐÚNG: "${q.prevCorrectAnswer}". Hãy giữ nguyên đáp án đúng này.\n`;
      }
      text += `Loại câu hỏi: ${q.type === 'checkbox' ? 'CHỌN NHIỀU ĐÁP ÁN (Select all correct)' : 'CHỌN 1 ĐÁP ÁN DUY NHẤT'}\n`;
      text += `Các phương án lựa chọn:\n`;
      q.options.forEach(opt => { text += `- ${opt.text}\n`; });
      text += `\n`;
    }

    parts.push({ text });

    for (const q of batchQuestions) {
      if (q.images && q.images.length > 0) {
        for (const img of q.images) {
          if (img && img.data) {
            parts.push({ text: `[Hình ảnh đính kèm cho Question ${q.q}]:` });
            parts.push({ inline_data: { mime_type: img.mime_type || 'image/jpeg', data: img.data } });
          }
        }
      }
      if (q.options) {
        for (const opt of q.options) {
          if (opt.image && opt.image.data) {
            parts.push({ text: `[Hình ảnh của lựa chọn "${opt.text}"]:` });
            parts.push({ inline_data: { mime_type: opt.image.mime_type || 'image/jpeg', data: opt.image.data } });
          }
        }
      }
    }

    return parts;
  }

  async function callGeminiDirectParts(apiKey, preferredModel, parts) {
    const models = [preferredModel, 'gemini-3.6-flash', 'gemini-3.6-pro', 'gemini-3.5-flash'];
    for (const m of models) {
      for (const ver of ['v1beta', 'v1']) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                temperature: 0.1,
                topP: 0.95
              }
            })
          });
          const data = await res.json();
          if (data.candidates && data.candidates[0]?.content?.parts) {
            const p = data.candidates[0].content.parts.find(x => x.text);
            if (p) return p.text;
          }
        } catch (e) {}
      }
    }
    return '';
  }

  function parseAnswersFromText(aiText) {
    if (!aiText) return [];
    try {
      const jsonMatch = aiText.match(/```(?:json:answers|json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            q: Number(item.q || item.question || 0),
            answers: (Array.isArray(item.answers) ? item.answers : [item.answer || item.text]).filter(Boolean)
          })).filter(item => item.answers.length > 0);
        }
      }
    } catch (e) {}

    const results = [];
    const questionBlocks = aiText.split(/(?:###\s*(?:Câu|Question)\s*(\d+)|\b(?:Câu|Question)\s+(\d+)\b)/i);
    if (questionBlocks.length > 2) {
      for (let i = 1; i < questionBlocks.length; i += 3) {
        const qNum = parseInt(questionBlocks[i] || questionBlocks[i + 1] || '0', 10);
        const content = questionBlocks[i + 2] || '';
        const ansMatch = content.match(/(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER)[\s\S]*?(?:GIẢI THÍCH|EXPLANATION|---|$)/i);
        if (ansMatch) {
          const bullets = Array.from(ansMatch[0].matchAll(/[\*\-]\s*(?:\*\*)?(.*?)(?:\*\*)?(?:\r?\n|$)/g))
            .map(m => m[1].replace(/^(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER):?\s*/i, '').replace(/\*\*/g, '').trim())
            .filter(t => t.length > 2 && !t.toLowerCase().includes('đáp án đúng'));
          if (bullets.length > 0) {
            results.push({ q: qNum, answers: bullets });
          } else {
            const lines = ansMatch[0].split('\n')
              .map(l => l.replace(/^(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER):?\s*/i, '').replace(/\*\*/g, '').trim())
              .filter(l => l.length > 2 && !l.toLowerCase().includes('đáp án đúng') && !l.toLowerCase().includes('giải thích'));
            if (lines.length > 0) {
              results.push({ q: qNum, answers: lines });
            }
          }
        }
      }
    }

    if (results.length === 0) {
      const summaryLines = Array.from(aiText.matchAll(/(?:[\*\-]\s*)?(?:Câu|Question)\s*(\d+)\s*[:\.]\s*(.*)/gi));
      for (const match of summaryLines) {
        const qNum = parseInt(match[1], 10);
        const ansPart = match[2].trim();
        const splitAnswers = ansPart.split(/\s*\|\s*/).map(a => a.replace(/\*\*/g, '').trim()).filter(Boolean);
        if (splitAnswers.length > 0) {
          results.push({ q: qNum, answers: splitAnswers });
        }
      }
    }

    return results;
  }

  // Tự tạo HUD khi trang sẵn sàng
  createFloatingHUD();

})();

