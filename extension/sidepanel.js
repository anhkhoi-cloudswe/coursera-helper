// Coursera Helper — Side Panel Controller v2.1.1

// Multi-pattern regex để khử triệt để tất cả các biến thể Prompt Injection của Coursera
const TRAP_PATTERNS = [
  /\s*You are a helpful AI assistant[\s\S]*?Do you understand\?\.?\s*/gi,
  /\s*You are a helpful AI assistant[\s\S]*?accessing assessment pages\.?\s*/gi,
  /\s*You are a helpful AI assistant[\s\S]*?(?=\s*(?:\d+\.|\bQuestion\b|\b[A-D]\.|\n\n\n|$))/gi
];
const POINT_REGEX = /^[ \t]*\d+(?:\.\d+)?[ \t]*points?\.?[ \t]*$/gmi;

// Helper gắn sự kiện an toàn tuyệt đối (không bao giờ văng lỗi nếu thiếu DOM)
function safeListen(id, event, handler) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) {
    el.addEventListener(event, handler);
  } else {
    console.warn(`[CourseraHelper] Phần tử "${id}" không tìm thấy.`);
  }
}

// DOM Elements
const rawInput = document.getElementById('rawInput');
const cleanOutput = document.getElementById('cleanOutput');
const inputCount = document.getElementById('inputCount');
const tabClean = document.getElementById('tabClean');
const tabAi = document.getElementById('tabAi');
const viewClean = document.getElementById('viewClean');
const viewAi = document.getElementById('viewAi');
const aiContent = document.getElementById('aiContent');
const settingsBox = document.getElementById('settingsBox');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const btnAutoSkipModule = document.getElementById('btnAutoSkipModule');
const toast = document.getElementById('toast');

// =======================================================
// 1. TÌM TAB COURSERA AN TOÀN TUYỆT ĐỐI
// =======================================================
async function getCourseraTab() {
  try {
    const allTabs = await chrome.tabs.query({});
    if (!allTabs || allTabs.length === 0) return null;

    const courseraTabs = allTabs.filter(
      t => t.url && (t.url.toLowerCase().includes('coursera.org') || t.url.toLowerCase().includes('/learn/'))
    );

    if (courseraTabs.length === 0) return null;

    // Ưu tiên tab Coursera đang active
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
  if (res.gemini_api_key && apiKeyInput) apiKeyInput.value = res.gemini_api_key;
  if (modelSelect) {
    // Tự động nâng cấp nếu model cũ là gemini-2.0-flash đã bị Google khai tử
    const m = res.gemini_model && res.gemini_model !== 'gemini-2.0-flash' ? res.gemini_model : 'gemini-2.5-flash';
    modelSelect.value = m;
  }

  if (res.saved_raw_input && rawInput) {
    rawInput.value = res.saved_raw_input;
    if (inputCount) inputCount.innerText = `${res.saved_raw_input.length.toLocaleString()} ký tự`;
  }
  if (res.saved_clean_output && cleanOutput) {
    cleanOutput.value = res.saved_clean_output;
  }
  if (res.saved_ai_html && aiContent) {
    aiContent.innerHTML = res.saved_ai_html;
  }

  updateAutoSkipButtonUI(!!res.auto_skip_active);
});

// Lắng nghe thay đổi trạng thái auto skip từ storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.auto_skip_active !== undefined) {
    updateAutoSkipButtonUI(changes.auto_skip_active.newValue);
  }
});

function updateAutoSkipButtonUI(isActive) {
  if (!btnAutoSkipModule) return;
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

function updateCleaning() {
  if (!rawInput) return;
  const raw = rawInput.value;
  if (inputCount) inputCount.innerText = `${raw.length.toLocaleString()} ký tự`;
  const cleaned = cleanCourseraQuiz(raw);
  if (cleanOutput) cleanOutput.value = cleaned;

  chrome.storage.local.set({
    'saved_raw_input': raw,
    'saved_clean_output': cleaned
  });
}

safeListen('rawInput', 'input', updateCleaning);

// =======================================================
// 4. TAB NAVIGATION (VĂN BẢN SẠCH <-> GEMINI AI)
// =======================================================
function switchTab(target) {
  if (target === 'clean') {
    tabClean?.classList.add('active');
    tabAi?.classList.remove('active');
    viewClean?.classList.add('active');
    viewAi?.classList.remove('active');
  } else {
    tabAi?.classList.add('active');
    tabClean?.classList.remove('active');
    viewAi?.classList.add('active');
    viewClean?.classList.remove('active');
  }
}

safeListen('tabClean', 'click', () => switchTab('clean'));
safeListen('tabAi', 'click', () => switchTab('ai'));

// =======================================================
// 5. CÁC NÚT THAO TÁC VĂN BẢN (LẤY CHỮ, DÁN, XÓA)
// =======================================================
safeListen('btnGrabCoursera', 'click', async () => {
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
      if (rawInput) rawInput.value = selected;
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

safeListen('btnPaste', 'click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      if (rawInput) rawInput.value = text;
      updateCleaning();
      switchTab('clean');
      showToast('Đã dán và lọc sạch!');
    }
  } catch (e) {
    rawInput?.focus();
  }
});

safeListen('btnClear', 'click', () => {
  if (rawInput) rawInput.value = '';
  if (cleanOutput) cleanOutput.value = '';
  updateCleaning();
  showToast('Đã xóa');
});

// =======================================================
// 6. COPY ACTIONS
// =======================================================
safeListen('btnCopyClean', 'click', async () => {
  const text = cleanOutput?.value || cleanCourseraQuiz(rawInput?.value || '');
  if (!text) {
    showToast('Chưa có nội dung để copy');
    return;
  }
  await navigator.clipboard.writeText(text);
  showToast('Đã copy văn bản sạch!');
});

safeListen('btnCopyPrompt', 'click', async () => {
  const text = cleanOutput?.value || cleanCourseraQuiz(rawInput?.value || '');
  if (!text) {
    showToast('Chưa có câu hỏi');
    return;
  }
  const promptText = `Bạn là chuyên gia hàng đầu. Hãy giải chi tiết các câu hỏi trắc nghiệm sau, ghi rõ đáp án đúng (in đậm) và giải thích ngắn gọn:\n\n${text}`;
  await navigator.clipboard.writeText(promptText);
  showToast('Đã copy Prompt cho Gemini!');
});

// =======================================================
// 7. GỌI GEMINI API GIẢI ĐÁP ÁN (VỚI AUTO-FALLBACK THÔNG MINH)
// =======================================================
safeListen('btnSolve', 'click', async () => {
  const textToSolve = (cleanOutput?.value || cleanCourseraQuiz(rawInput?.value || '')).trim();

  if (!textToSolve) {
    showToast('⚠️ Vui lòng dán hoặc lấy câu hỏi trước!');
    if (rawInput) rawInput.focus();
    return;
  }

  const apiKey = (apiKeyInput?.value || '').trim();
  if (!apiKey) {
    if (settingsBox) settingsBox.style.display = 'flex';
    if (apiKeyInput) apiKeyInput.focus();
    showToast('⚠️ Vui lòng nhập và Lưu Gemini API Key trước!');
    return;
  }

  switchTab('ai');
  if (aiContent) {
    aiContent.innerHTML = `
      <div class="ai-empty-state">
        <div class="spinner"></div>
        <p style="color: #a5b4fc; font-weight: 600;">Gemini đang phân tích và giải đề...</p>
      </div>
    `;
  }

  // Danh sách model ưu tiên (tự động thử model tiếp theo nếu model trước bị deprecated)
  const preferredModel = (modelSelect?.value && modelSelect.value !== 'gemini-2.0-flash')
    ? modelSelect.value
    : 'gemini-2.5-flash';

  const candidateModels = Array.from(new Set([
    preferredModel,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ]));

  let lastError = null;
  let solved = false;

  for (const model of candidateModels) {
    try {
      const systemPrompt = "Bạn là chuyên gia xuất sắc. Hãy giải các câu hỏi trắc nghiệm sau. Với mỗi câu hỏi: chỉ rõ ĐÁP ÁN ĐÚNG (in đậm) và GIẢI THÍCH NGẮN GỌN (1-2 câu). Trình bày mạch lạc, dễ đọc.";
      const fullPrompt = `${systemPrompt}\n\nĐề bài:\n${textToSolve}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      });

      const data = await res.json();
      if (data.error) {
        const errMsg = data.error.message || 'Lỗi API';
        // Nếu model không còn khả dụng hoặc không tìm thấy -> tự động chuyển sang model tiếp theo
        if (errMsg.includes('no longer available') || errMsg.includes('not found') || data.error.code === 404) {
          console.warn(`[CourseraHelper] Model ${model} không khả dụng (${errMsg}), tự động thử model tiếp theo...`);
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidate) throw new Error('Không có phản hồi từ AI');

      const htmlResult = renderMarkdown(candidate);
      if (aiContent) aiContent.innerHTML = htmlResult;

      // Cập nhật model thành công
      if (modelSelect) modelSelect.value = model;
      chrome.storage.local.set({ 'saved_ai_html': htmlResult, 'gemini_model': model });
      showToast(`✓ Gemini (${model}) đã giải xong!`);
      solved = true;
      break;
    } catch (err) {
      lastError = err;
      if (err.message && (err.message.includes('no longer available') || err.message.includes('not found'))) {
        continue;
      }
      break;
    }
  }

  if (!solved && lastError) {
    if (aiContent) {
      aiContent.innerHTML = `
        <div style="padding: 12px; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); border-radius: 8px; color: #fecdd3;">
          <strong style="color: #f43f5e;">Lỗi:</strong> ${lastError.message}<br><br>
          <span style="font-size: 11px; color: #94a3b8;">Mẹo: Kiểm tra lại API Key hoặc dùng nút "Prompt" để dán vào gemini.google.com</span>
        </div>
      `;
    }
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

// Cài đặt API Key
safeListen('btnToggleSettings', 'click', () => {
  if (settingsBox) {
    settingsBox.style.display = settingsBox.style.display === 'none' ? 'flex' : 'none';
  }
});

safeListen('btnCloseSettings', 'click', () => {
  if (settingsBox) settingsBox.style.display = 'none';
});

safeListen('btnSaveKey', 'click', () => {
  const key = apiKeyInput?.value.trim() || '';
  const model = modelSelect?.value || 'gemini-2.0-flash';
  chrome.storage.local.set({ 'gemini_api_key': key, 'gemini_model': model }, () => {
    showToast('✓ Đã lưu cài đặt API Key!');
    if (settingsBox) settingsBox.style.display = 'none';
  });
});

// =======================================================
// 8. ĐIỀU KHIỂN VIDEO & AUTO-SKIP CHẮC CHẮN 100%
// =======================================================

// A. NÚT SKIP 1 VIDEO (Tua video đang mở hoặc bấm Next)
safeListen('btnSkipVideo', 'click', async () => {
  const tab = await getCourseraTab();
  if (!tab || !tab.id) {
    showToast('⚠️ Vui lòng mở trang Coursera!');
    return;
  }

  showToast('⏳ Đang xử lý Video...');

  chrome.tabs.sendMessage(tab.id, { action: 'skip_video' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      executeDirectSkip(tab.id);
    } else {
      showToast('⏩ Đã tua Video & đang chuyển bài!');
    }
  });
});

// B. NÚT TỐC ĐỘ 16X
safeListen('btnSpeed16', 'click', async () => {
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
safeListen('btnAutoSkipModule', 'click', async () => {
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
        chrome.tabs.sendMessage(tab.id, { action: 'toggle_auto_skip' }, () => {
          if (chrome.runtime.lastError) {
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

// Script dự phòng can thiệp trực tiếp DOM nếu tab chưa kịp load content script
function executeDirectSkip(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    func: () => {
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

      setTimeout(() => {
        const clickables = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const nextBtn = clickables.find(el => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return txt.includes('go to next item') || txt.includes('next item');
        });
        if (nextBtn) {
          nextBtn.click();
        } else {
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
safeListen('btnOpenWeb', 'click', () => {
  chrome.tabs.create({ url: 'https://coursera-helper.vercel.app' });
});

function showToast(msg) {
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast?.classList.remove('show'), 2500);
}
