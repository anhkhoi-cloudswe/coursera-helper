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

  // Tìm nút "Go to next item" hoặc nút chuyển bài
  function findNextButton() {
    // 1. Theo testid chuẩn của Coursera
    const testIdBtn = document.querySelector(
      'button[data-testid="next-item-button"], a[data-testid="next-item-button"], [data-testid="navigation-next-button"]'
    );
    if (testIdBtn) return testIdBtn;

    // 2. Tìm theo text "Go to next item", "Next item", "Tiếp theo"
    const allClickables = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const byText = allClickables.find(el => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (
        txt.includes('go to next item') ||
        txt.includes('next item') ||
        txt.includes('chuyển sang bài tiếp') ||
        txt.includes('bài tiếp theo')
      );
    });
    if (byText) return byText;

    // 3. Tìm theo aria-label
    const byAria = document.querySelector('button[aria-label*="next" i], a[aria-label*="next" i]');
    if (byAria) return byAria;

    // 4. Tìm trong thanh điều hướng bài học bên trái (Left Sidebar Navigation)
    const activeItem = document.querySelector('[aria-current="true"], [aria-current="page"], .rc-ItemLink.active, [data-testid*="active-item"]');
    if (activeItem) {
      const nextContainer = activeItem.closest('li, [role="listitem"], .rc-ModuleExam, .rc-ItemRow')?.nextElementSibling;
      if (nextContainer) {
        const nextLink = nextContainer.querySelector('a, button, [role="button"]');
        if (nextLink) return nextLink;
      }
    }

    return null;
  }

  // Tìm nút bắt đầu trên trang tổng quan Module (Overview page: /home/module/1)
  function findOverviewStartElement() {
    // 1. Tìm nút "Get started"
    const clickables = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
    const startBtn = clickables.find(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (el.children.length > 3) return false; // bỏ qua container cha lớn
      return t === 'get started' || t === 'bắt đầu' || t.startsWith('get started') || t.startsWith('bắt đầu');
    });

    if (startBtn) {
      const parentBtn = startBtn.closest('button, a, [role="button"]');
      return parentBtn || startBtn;
    }

    // 2. Tìm liên kết bài học đầu tiên trong danh sách của Module
    const firstLecture = document.querySelector(
      'a[href*="/lecture/"], a[href*="/item/"], a[href*="/supplement/"]'
    );
    if (firstLecture) return firstLecture;

    return null;
  }

  // ==========================================
  // 4. HÀNH ĐỘNG ĐIỀU KHIỂN VIDEO CỤ THỂ
  // ==========================================

  // Tua 1 video tới giây cuối và chuyển bài
  function completeCourseraVideo() {
    const isOverview = window.location.href.includes('/home/module/') || window.location.href.includes('/module/');
    
    // Nếu đang ở trang tổng quan Module: bấm "Get started" để vào bài học
    if (isOverview) {
      const startEl = findOverviewStartElement();
      if (startEl) {
        showInPageToast('🚀 Đang mở bài học đầu tiên trong Module...');
        triggerClick(startEl);
        return true;
      }
      showInPageToast('⚠️ Không tìm thấy nút Get started hoặc bài học!', true);
      return false;
    }

    const videos = findVideos();
    if (videos.length > 0) {
      let found = false;
      for (const v of videos) {
        try {
          v.muted = true; // Bật mute để tránh vi phạm browser autoplay policy
          v.playbackRate = 16;
          if (v.duration && !isNaN(v.duration) && isFinite(v.duration)) {
            v.currentTime = Math.max(0, v.duration - 0.5);
          } else {
            v.currentTime = 999999;
          }
          v.play().catch(() => {});
          v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
          v.dispatchEvent(new Event('ended', { bubbles: true }));
          found = true;
        } catch (e) {
          console.error(e);
        }
      }

      if (found) {
        showInPageToast('⏩ Đã tua video tới cuối! Đang bấm "Go to next item"...');
        setTimeout(() => {
          const nextBtn = findNextButton();
          if (nextBtn) {
            triggerClick(nextBtn);
          } else {
            showInPageToast('ℹ️ Đã tua xong! Vui lòng bấm nút tiếp theo trên màn hình.', true);
          }
        }, 1200);
        return true;
      }
    }

    // Nếu là bài đọc (Reading / Supplement)
    const isReading = window.location.href.includes('/supplement/') || window.location.href.includes('/item/');
    if (isReading) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      showInPageToast('📖 Đã cuộn đọc hết trang! Đang chuyển bài tiếp...');
      setTimeout(() => {
        const nextBtn = findNextButton();
        if (nextBtn) triggerClick(nextBtn);
      }, 1000);
      return true;
    }

    // Thử bấm trực tiếp nút Next nếu có
    const nextBtn = findNextButton();
    if (nextBtn) {
      showInPageToast('⏩ Đang chuyển sang bài tiếp theo...');
      triggerClick(nextBtn);
      return true;
    }

    showInPageToast('⚠️ Không tìm thấy Video hoặc nút Next trên trang này!', true);
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
  // ==========================================
  let autoSkipTimer = null;
  let lastProcessedUrl = '';
  let lastActionTime = 0;

  function runAutoSkipStep() {
    chrome.storage.local.get(['auto_skip_active'], (res) => {
      if (!res.auto_skip_active) {
        stopAutoSkipLoop();
        return;
      }

      updateFloatingHUD(true);

      const currentUrl = window.location.href;
      const now = Date.now();

      // Cooldown chống spam cùng 1 trang trong vòng 3.5 giây
      if (currentUrl === lastProcessedUrl && (now - lastActionTime < 3500)) {
        return;
      }

      // TRƯỜNG HỢP A: Gặp bài kiểm tra / Quiz / Exam -> Tạm dừng an toàn để người dùng làm hoặc dùng AI giải
      if (currentUrl.includes('/quiz/') || currentUrl.includes('/exam/') || currentUrl.includes('/assignment/')) {
        showInPageToast('⚠️ Gặp bài Quiz/Bài tập! Tạm dừng Auto-Skip để bạn kiểm tra hoặc dùng AI giải.', true);
        chrome.storage.local.set({ 'auto_skip_active': false });
        updateFloatingHUD(false);
        return;
      }

      // TRƯỜNG HỢP B: Đang ở trang tổng quan Module (/home/module/1)
      if (currentUrl.includes('/home/module/') || currentUrl.includes('/module/')) {
        const startEl = findOverviewStartElement();
        if (startEl) {
          lastProcessedUrl = currentUrl;
          lastActionTime = now;
          showInPageToast('🚀 [Auto-Skip] Đang bấm "Get started" để vào bài học...');
          triggerClick(startEl);
        }
        return;
      }

      // TRƯỜNG HỢP C: Đang trong bài học (Video)
      const videos = findVideos();
      if (videos.length > 0) {
        lastProcessedUrl = currentUrl;
        lastActionTime = now;

        for (const v of videos) {
          try {
            v.muted = true;
            v.playbackRate = 16;
            if (v.duration && !isNaN(v.duration) && isFinite(v.duration)) {
              v.currentTime = Math.max(0, v.duration - 0.5);
            } else {
              v.currentTime = 999999;
            }
            v.play().catch(() => {});
            v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
            v.dispatchEvent(new Event('ended', { bubbles: true }));
          } catch (e) {}
        }

        showInPageToast('🚀 [Auto-Skip] Đã hoàn thành Video! Đang chuyển bài tiếp theo...');

        // Chờ 2 giây để server Coursera ghi nhận completed tick xanh rồi bấm Next
        setTimeout(() => {
          chrome.storage.local.get(['auto_skip_active'], (r) => {
            if (!r.auto_skip_active) return;
            const nextBtn = findNextButton();
            if (nextBtn) {
              triggerClick(nextBtn);
            } else {
              // Hết bài học trong module
              showInPageToast('🎉 HOÀN THÀNH! Đã tự động duyệt hết toàn bộ bài học trong Module!');
              chrome.storage.local.set({ 'auto_skip_active': false });
              updateFloatingHUD(false);
            }
          });
        }, 2000);

        return;
      }

      // TRƯỜNG HỢP D: Đang trong bài đọc (Reading / Supplement)
      const isContentItem = currentUrl.includes('/supplement/') || currentUrl.includes('/item/') || currentUrl.includes('/lecture/');
      if (isContentItem) {
        lastProcessedUrl = currentUrl;
        lastActionTime = now;

        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        showInPageToast('🚀 [Auto-Skip] Đã đọc xong tài liệu! Đang chuyển tiếp...');

        setTimeout(() => {
          chrome.storage.local.get(['auto_skip_active'], (r) => {
            if (!r.auto_skip_active) return;
            const nextBtn = findNextButton();
            if (nextBtn) {
              triggerClick(nextBtn);
            } else {
              showInPageToast('🎉 HOÀN THÀNH! Đã duyệt hết toàn bộ bài học trong Module!');
              chrome.storage.local.set({ 'auto_skip_active': false });
              updateFloatingHUD(false);
            }
          });
        }, 1800);
      }
    });
  }

  function startAutoSkipLoop() {
    if (autoSkipTimer) clearInterval(autoSkipTimer);
    runAutoSkipStep();
    autoSkipTimer = setInterval(runAutoSkipStep, 1800);
    updateFloatingHUD(true);
    showInPageToast('🚀 Chế độ Auto-Skip Module đã BẬT!');
  }

  function stopAutoSkipLoop() {
    if (autoSkipTimer) {
      clearInterval(autoSkipTimer);
      autoSkipTimer = null;
    }
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

  // Lắng nghe thay đổi trạng thái từ Side Panel
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
    const btnAuto = floatingHUD.querySelector('#ch-hud-autoskip');
    const btnSkipOne = floatingHUD.querySelector('#ch-hud-skipone');
    const btnSpeed = floatingHUD.querySelector('#ch-hud-speed');

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
      const result = autoFillCourseraQuiz(request.answers || []);
      sendResponse(result);
    }
    return true;
  });

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

  function tickOptionElement(el) {
    try {
      const input = el.tagName === 'INPUT' 
        ? el 
        : el.querySelector('input[type="radio"], input[type="checkbox"]');
      const target = input || el;

      // Cuộn vào tầm nhìn
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {}

      // Kiểm tra trạng thái checked
      const isAlreadyChecked = input ? input.checked : (el.getAttribute('aria-checked') === 'true');
      if (!isAlreadyChecked) {
        // Chuỗi sự kiện chuột cho React
        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evt => {
          el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
        });

        if (input && input !== el) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
          try { input.click(); } catch (e) {}
        } else {
          el.click();
        }
      }

      // Hiệu ứng viền xanh lục phát sáng để người dùng dễ quan sát
      const card = el.closest('label, li, .rc-Option, [role="radio"], [role="checkbox"]') || el;
      card.style.transition = 'all 0.3s ease';
      card.style.outline = '2px solid #10b981';
      card.style.background = 'rgba(16, 185, 129, 0.14)';
      card.style.borderRadius = '6px';
      card.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.45)';

      return true;
    } catch (err) {
      console.warn('Lỗi tick option:', err);
      return false;
    }
  }

  function autoFillCourseraQuiz(answersList) {
    if (!answersList || !Array.isArray(answersList) || answersList.length === 0) {
      return { success: false, tickedCount: 0, totalQuestions: 0 };
    }

    let tickedCount = 0;
    const allOptionElements = Array.from(document.querySelectorAll(
      'label, li.rc-Option, div[data-testid="option-label"], [role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]'
    ));

    // Tìm các container câu hỏi nếu có
    let questionContainers = Array.from(document.querySelectorAll(
      'div[data-testid="part-container"], fieldset, .rc-FormPartsQuestion, .rc-QuizQuestion, div[role="group"]'
    )).filter((c, idx, arr) => !arr.some(other => other !== c && other.contains(c)));

    for (let i = 0; i < answersList.length; i++) {
      const item = answersList[i];
      const qNum = item.q || (i + 1);
      const targetAnswers = item.answers || [];
      if (targetAnswers.length === 0) continue;

      let container = null;
      if (questionContainers.length >= answersList.length) {
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
          matchedOption = allOptionElements.find(el => isOptionMatch(el, ansText));
        }

        if (matchedOption) {
          const ok = tickOptionElement(matchedOption);
          if (ok) tickedCount++;
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

  // Tự tạo HUD khi trang sẵn sàng
  createFloatingHUD();

})();
