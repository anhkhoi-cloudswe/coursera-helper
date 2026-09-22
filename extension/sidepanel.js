// Coursera Helper — Side Panel Controller

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
const btnOpenWeb = document.getElementById('btnOpenWeb');
const toast = document.getElementById('toast');

// 1. Khôi phục State & Settings đã lưu
chrome.storage.local.get([
  'gemini_api_key',
  'gemini_model',
  'saved_raw_input',
  'saved_clean_output',
  'saved_ai_html'
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
});

// 2. Thuật toán làm sạch bẫy Coursera
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

  // Lưu tạm vào storage để không bị mất khi thu nhỏ thanh bên
  chrome.storage.local.set({
    'saved_raw_input': raw,
    'saved_clean_output': cleaned
  });
}

rawInput.addEventListener('input', updateCleaning);

// 3. Tab Navigation
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

// 4. Lấy văn bản đang bôi đen trực tiếp từ tab Coursera
btnGrabCoursera.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showToast('Không tìm thấy tab Coursera');
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
      showToast('Vui lòng bôi đen câu hỏi trên trang Coursera trước!');
    }
  } catch (err) {
    showToast('Vui lòng mở một tab Coursera hợp lệ');
  }
});

// 5. Dán nhanh từ Clipboard
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

// 6. Copy Actions
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

// 7. Gọi Gemini API trực tiếp trong thanh bên
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

    // Render markdown sang HTML
    const htmlResult = renderMarkdown(candidate);
    aiContent.innerHTML = htmlResult;

    // Lưu kết quả AI
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

// Trình parse Markdown nhẹ và chuẩn xác
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

// 8. Settings Management
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

// 9. Điều khiển Video Coursera (Skip & Speedup 16x)
const btnAutoSkipModule = document.getElementById('btnAutoSkipModule');
const btnSkipVideo = document.getElementById('btnSkipVideo');
const btnSpeed16 = document.getElementById('btnSpeed16');

// Kiểm tra trạng thái Auto Skip khi mở Side Panel
chrome.storage.local.get(['auto_skip_active'], (data) => {
  if (data.auto_skip_active) {
    btnAutoSkipModule.innerText = '🛑 Dừng Auto Skip';
  }
});

// Hàm gửi message an toàn (Tự nạp content script nếu tab chưa kết nối)
function sendTabMessage(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].id) {
      showToast('⚠️ Vui lòng mở một tab Coursera!');
      return;
    }
    const tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        // Tự động nạp content.js nếu tab Coursera vừa reload Extension
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, message, callback);
          }, 200);
        });
      } else if (callback) {
        callback(response);
      }
    });
  });
}

btnAutoSkipModule.addEventListener('click', () => {
  chrome.storage.local.get(['auto_skip_active'], (data) => {
    if (data.auto_skip_active) {
      sendTabMessage({ action: 'stop_auto_skip_module' });
      btnAutoSkipModule.innerText = '🚀 Auto Skip Hết Module';
      showToast('🛑 Đã dừng Auto-Skip Module');
    } else {
      sendTabMessage({ action: 'start_auto_skip_module' });
      btnAutoSkipModule.innerText = '🛑 Dừng Auto Skip';
      showToast('🚀 Bắt đầu Auto-Skip toàn bộ bài học trong Module...');
    }
  });
});

btnSkipVideo.addEventListener('click', () => {
  sendTabMessage({ action: 'skip_video' });
});

btnSpeed16.addEventListener('click', () => {
  sendTabMessage({ action: 'set_video_speed', speed: 16 });
});

// Mở trang Web
btnOpenWeb.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://coursera-helper.vercel.app' });
});

function showToast(msg) {
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2300);
}
