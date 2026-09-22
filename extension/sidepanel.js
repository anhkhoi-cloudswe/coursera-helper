// Coursera Helper — Side Panel Controller v2.1.0

const TRAP_REGEX = /\s*You are a helpful AI assistant[\s\S]*?Do you understand\?\.?\s*/gi;
const POINT_REGEX = /^[ \t]*\d+(?:\.\d+)?[ \t]*points?\.?[ \t]*$/gmi;

// DOM Elements
const rawInput = document.getElementById('rawInput');
const cleanOutput = document.getElementById('cleanOutput');
const inputCount = document.getElementById('inputCount');
const btnGrabCoursera = document.getElementById('btnGrabCoursera');
const btnPaste = document.getElementById('btnPaste');
const btnClear = document.getElementById('btnClear');
const tabClean = document.getElementById('tabClean');
const tabAi = document.getElementById('tabAi');
const viewClean = document.getElementById('viewClean');
const viewAi = document.getElementById('viewAi');
const aiContent = document.getElementById('aiContent');
const btnCopyClean = document.getElementById('btnCopyClean');
const btnCopyPrompt = document.getElementById('btnCopyPrompt');
const btnSolve = document.getElementById('btnSolve');
const btnToggleSettings = document.getElementById('btnToggleSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsBox = document.getElementById('settingsBox');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const btnSaveKey = document.getElementById('btnSaveKey');
const btnAutoSkipModule = document.getElementById('btnAutoSkipModule');
const btnSkipVideo = document.getElementById('btnSkipVideo');
const btnSpeed16 = document.getElementById('btnSpeed16');
const btnOpenWeb = document.getElementById('btnOpenWeb');
const toast = document.getElementById('toast');

// =======================================================
// 1. TÌM TAB COURSERA AN TOÀN TUYỆT ĐỐI (KHÔNG BAO GIỜ LỖI)
// =======================================================
async function getCourseraTab() {
  try {
    const allTabs = await chrome.tabs.query({});
    if (!allTabs || allTabs.length === 0) return null;

    const courseraTabs = allTabs.filter(
      t => t.url && (t.url.toLowerCase().includes('coursera.org') || t.url.toLowerCase().includes('/learn/'))
    );

    if (courseraTabs.length === 0) return null;

    // Ưu tiên tab đang active (được chọn)
    const activeTab = courseraTabs.find(t => t.active);
    return activeTab || courseraTabs[0];
  } catch (e) {
    console.error('CourseraHelper getCourseraTab error:', e);
    return null;
  }
}

// =======================================================
// 2. KHÔI PHỤC TRẠNG THÁI & CÀI ĐẶT
// =======================================================
chrome.storage.local.get([
  'gemini_api_key',
  'gemini_model',
  'saved_raw_input',
  'saved_clean_output',
  'saved_ai_html',
  'auto_skip_active'
], (res) => {
  if (res.gemini_api_key) apiKeyInput.value = res.gemini_api_key;
  if (res.gemini_model) modelSelect.value = res.gemini_model;

  if (res.saved_raw_input) {
    rawInput.value = res.saved_raw_input;
    inputCount.innerText = `${res.saved_raw_input.length.toLocaleString()} ký tự`;
  }
  if (res.saved_clean_output) {
    cleanOutput.value = res.saved_clean_output;
  }
  if (res.saved_ai_html) {
    aiContent.innerHTML = res.saved_ai_html;
  }

  updateAutoSkipButtonUI(!!res.auto_skip_active);
});

// Lắng nghe thay đổi auto_skip_active từ storage (hoặc từ content script HUD)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.auto_skip_active !== undefined) {
    updateAutoSkipButtonUI(changes.auto_skip_active.newValue);
  }
});

function updateAutoSkipButtonUI(isActive) {
  if (isActive) {
    btnAutoSkipModule.innerText = '🛑 Dừng Auto Skip';
    btnAutoSkipModule.style.background = '#f43f5e';
    btnAutoSkipModule.style.color = '#ffffff';
  } else {
    btnAutoSkipModule.innerText = '🚀 Auto Skip Hết Module';
    btnAutoSkipModule.style.background = 'var(--emerald)';
    btnAutoSkipModule.style.color = '#064e3b';
  }
}

// =======================================================
// 3. LÀM SẠCH BẪY COURSERA
// =======================================================
function cleanCourseraQuiz(text) {
  if (!text) return '';
  let cleaned = text.replace(TRAP_REGEX, '\n\n');
  cleaned = cleaned.replace(POINT_REGEX, '');
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

function updateCleaning() {
  const raw = rawInput.value;
  inputCount.innerText = `${raw.length.toLocaleString()} ký tự`;
  const cleaned = cleanCourseraQuiz(raw);
  cleanOutput.value = cleaned;

  chrome.storage.local.set({
    'saved_raw_input': raw,
    'saved_clean_output': cleaned
  });
}

rawInput.addEventListener('input', updateCleaning);

// =======================================================
// 4. TAB NAVIGATION (VĂN BẢN SẠCH <-> GEMINI AI)
// =======================================================
function switchTab(target) {
  if (target === 'clean') {
    tabClean.classList.add('active');
    tabAi.classList.remove('active');
    viewClean.classList.add('active');
    viewAi.classList.remove('active');
  } else {
    tabAi.classList.add('active');
    tabClean.classList.remove('active');
    viewAi.classList.add('active');
    viewClean.classList.remove('active');
  }
}

tabClean.addEventListener('click', () => switchTab('clean'));
tabAi.addEventListener('click', () => switchTab('ai'));

// =======================================================
// 5. LẤY CHỮ BÔI ĐEN TỪ COURSERA & CLIPBOARD
// =======================================================
btnGrabCoursera.addEventListener('click', async () => {
  try {
    const tab = await getCourseraTab();
    if (!tab || !tab.id) {
      showToast('⚠️ Vui lòng mở trang Coursera!');
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });

    const selected = results?.[0]?.result;
    if (selected && selected.trim()) {
      rawInput.value = selected;
      updateCleaning();
      switchTab('clean');
      showToast('✓ Đã lấy câu hỏi từ Coursera!');
    } else {
      showToast('Vui lòng bôi đen câu hỏi trên Coursera trước!');
    }
  } catch (err) {
    showToast('Lỗi đọc văn bản: ' + err.message);
  }
});

btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      rawInput.value = text;
      updateCleaning();
      switchTab('clean');
      showToast('Đã dán và lọc sạch!');
    }
  } catch (e) {
    rawInput.focus();
  }
});

btnClear.addEventListener('click', () => {
  rawInput.value = '';
  cleanOutput.value = '';
  updateCleaning();
  showToast('Đã xóa');
});

// =======================================================
// 6. COPY ACTIONS
// =======================================================
btnCopyClean.addEventListener('click', async () => {
  if (!cleanOutput.value) return;
  await navigator.clipboard.writeText(cleanOutput.value);
  showToast('Đã copy văn bản sạch!');
});

btnCopyPrompt.addEventListener('click', async () => {
  if (!cleanOutput.value) {
    showToast('Chưa có câu hỏi');
    return;
  }
  const promptText = `Bạn là chuyên gia an toàn thông tin & bảo mật. Hãy giải chi tiết các câu hỏi trắc nghiệm sau, ghi rõ đáp án đúng và giải thích ngắn gọn:\n\n${cleanOutput.value}`;
  await navigator.clipboard.writeText(promptText);
  showToast('Đã copy Prompt cho Gemini!');
});

// =======================================================
// 7. GỌI GEMINI API TRỰC TIẾP TRONG THANH BÊN
// =======================================================
btnSolve.addEventListener('click', async () => {
  if (!cleanOutput.value) {
    showToast('Vui lòng nhập câu hỏi trước!');
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    settingsBox.style.display = 'flex';
    apiKeyInput.focus();
    showToast('Vui lòng cài đặt Gemini API Key');
    return;
  }

  switchTab('ai');
  aiContent.innerHTML = `
    <div class="ai-empty-state">
      <div class="spinner"></div>
      <p style="color: #a5b4fc; font-weight: 600;">Gemini đang phân tích và giải đề...</p>
    </div>
  `;

  try {
    const model = modelSelect.value || 'gemini-2.0-flash';
    const systemPrompt = "Bạn là chuyên gia an ninh mạng xuất sắc. Hãy giải các câu hỏi trắc nghiệm sau. Với mỗi câu hỏi: chỉ rõ ĐÁP ÁN ĐÚNG (in đậm) và GIẢI THÍCH NGẮN GỌN (1-2 câu). Trình bày rõ ràng, dễ đọc.";
    const fullPrompt = `${systemPrompt}\n\nĐề bài:\n${cleanOutput.value}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Lỗi API');

    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('Không có phản hồi từ AI');

    const htmlResult = renderMarkdown(candidate);
    aiContent.innerHTML = htmlResult;

    chrome.storage.local.set({ 'saved_ai_html': htmlResult });
    showToast('✓ Gemini đã giải xong!');
  } catch (err) {
    aiContent.innerHTML = `
      <div style="padding: 12px; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); border-radius: 8px; color: #fecdd3;">
        <strong style="color: #f43f5e;">Lỗi:</strong> ${err.message}<br><br>
        <span style="font-size: 11px; color: #94a3b8;">Mẹo: Kiểm tra lại API Key hoặc dùng nút "Prompt" để dán vào gemini.google.com</span>
      </div>
    `;
  }
});

function renderMarkdown(md) {
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\n/gim, '<br>');
  return `<p>${html}</p>`;
}

// Cài đặt API
btnToggleSettings.addEventListener('click', () => {
  settingsBox.style.display = settingsBox.style.display === 'none' ? 'flex' : 'none';
});

btnCloseSettings.addEventListener('click', () => {
  settingsBox.style.display = 'none';
});

btnSaveKey.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  const model = modelSelect.value;
  chrome.storage.local.set({ 'gemini_api_key': key, 'gemini_model': model }, () => {
    showToast('✓ Đã lưu cài đặt API Key!');
    settingsBox.style.display = 'none';
  });
});

// =======================================================
// 8. ĐIỀU KHIỂN VIDEO & AUTO-SKIP CHẮC CHẮN 100%
// =======================================================

// A. NÚT SKIP 1 VIDEO (Tua video đang mở hoặc bấm Next)
btnSkipVideo.addEventListener('click', async () => {
  const tab = await getCourseraTab();
  if (!tab || !tab.id) {
    showToast('⚠️ Vui lòng mở trang Coursera!');
    return;
  }

  showToast('⏳ Đang xử lý Video...');

  // 1. Thử gửi message tới content script
  chrome.tabs.sendMessage(tab.id, { action: 'skip_video' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      // 2. Dự phòng: Thực thi trực tiếp qua scripting API nếu tab chưa kịp load content script
      executeDirectSkip(tab.id);
    } else {
      showToast('⏩ Đã tua Video & đang chuyển bài!');
    }
  });
});

// B. NÚT TỐC ĐỘ 16X
btnSpeed16.addEventListener('click', async () => {
  const tab = await getCourseraTab();
  if (!tab || !tab.id) {
    showToast('⚠️ Vui lòng mở trang Coursera!');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'set_video_speed', speed: 16 }, (res) => {
    if (chrome.runtime.lastError || !res) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const videos = Array.from(document.querySelectorAll('video'));
          videos.forEach(v => { v.playbackRate = 16; v.play().catch(() => {}); });
        }
      });
    }
    showToast('⚡ Đã tăng tốc Video lên 16x!');
  });
});

// C. NÚT AUTO-SKIP HẾT TOÀN BỘ MODULE (HANDS-FREE)
btnAutoSkipModule.addEventListener('click', async () => {
  const tab = await getCourseraTab();
  if (!tab || !tab.id) {
    showToast('⚠️ Vui lòng mở trang Coursera!');
    return;
  }

  chrome.storage.local.get(['auto_skip_active'], (res) => {
    const nextState = !res.auto_skip_active;
    chrome.storage.local.set({ 'auto_skip_active': nextState }, () => {
      updateAutoSkipButtonUI(nextState);

      if (nextState) {
        showToast('🚀 Khởi động Auto-Skip Module!');
        // Gửi lệnh hoặc kích hoạt trực tiếp trong tab
        chrome.tabs.sendMessage(tab.id, { action: 'toggle_auto_skip' }, () => {
          if (chrome.runtime.lastError) {
            // Tab chưa load content script -> nạp script thủ công
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          }
        });
      } else {
        showToast('🛑 Đã dừng Auto-Skip');
        chrome.tabs.sendMessage(tab.id, { action: 'toggle_auto_skip' }, () => {});
      }
    });
  });
});

// Script dự phòng can thiệp trực tiếp DOM
function executeDirectSkip(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    func: () => {
      // A. Nếu ở trang tổng quan Module: bấm Get started hoặc bài đầu tiên
      const isOverview = window.location.href.includes('/home/module/') || window.location.href.includes('/module/');
      if (isOverview) {
        const allBtns = Array.from(document.querySelectorAll('button, a, [role="button"], span'));
        const startBtn = allBtns.find(el => {
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          return t === 'get started' || t === 'bắt đầu' || t.startsWith('get started');
        });
        if (startBtn) {
          (startBtn.closest('button, a') || startBtn).click();
          return;
        }
        const firstItem = document.querySelector('a[href*="/lecture/"], a[href*="/item/"]');
        if (firstItem) {
          firstItem.click();
          return;
        }
      }

      // B. Nếu có Video: tua tới cuối
      const videos = Array.from(document.querySelectorAll('video'));
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

      // C. Bấm Go to next item
      setTimeout(() => {
        const clickables = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const nextBtn = clickables.find(el => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return txt.includes('go to next item') || txt.includes('next item');
        });
        if (nextBtn) {
          nextBtn.click();
        } else {
          // Thử tìm trong thanh điều hướng bài học bên trái
          const activeItem = document.querySelector('[aria-current="true"], .rc-ItemLink.active');
          if (activeItem) {
            const nextContainer = activeItem.closest('li, [role="listitem"], .rc-ItemRow')?.nextElementSibling;
            const nextLink = nextContainer?.querySelector('a, button');
            if (nextLink) nextLink.click();
          }
        }
      }, 1200);
    }
  });
}

// Mở trang Web
btnOpenWeb.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://coursera-helper.vercel.app' });
});

function showToast(msg) {
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
