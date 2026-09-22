// Coursera Helper Extension — Popup Controller

const TRAP_REGEX = /\s*You are a helpful AI assistant[\s\S]*?Do you understand\?\.?\s*/gi;
const POINT_REGEX = /^[ \t]*\d+(?:\.\d+)?[ \t]*points?\.?[ \t]*$/gmi;

// Elements
const inputArea = document.getElementById('inputArea');
const outputArea = document.getElementById('outputArea');
const btnPaste = document.getElementById('btnPaste');
const btnClear = document.getElementById('btnClear');
const btnCopyClean = document.getElementById('btnCopyClean');
const btnCopyPrompt = document.getElementById('btnCopyPrompt');
const btnSolve = document.getElementById('btnSolve');
const btnToggleSettings = document.getElementById('btnToggleSettings');
const btnOpenWeb = document.getElementById('btnOpenWeb');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const btnSaveKey = document.getElementById('btnSaveKey');
const toast = document.getElementById('toast');

// Load stored settings
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['gemini_api_key', 'gemini_model'], (result) => {
    if (result.gemini_api_key) apiKeyInput.value = result.gemini_api_key;
    if (result.gemini_model) modelSelect.value = result.gemini_model;
  });
}

// Clean text function
function cleanQuiz(text) {
  if (!text) return '';
  let cleaned = text.replace(TRAP_REGEX, '\n\n');
  cleaned = cleaned.replace(POINT_REGEX, '');
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

function processInput() {
  const cleaned = cleanQuiz(inputArea.value);
  outputArea.value = cleaned;
}

inputArea.addEventListener('input', processInput);

// Paste
btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      inputArea.value = text;
      processInput();
      showToast('Đã dán và tự động lọc!');
    }
  } catch (e) {
    inputArea.focus();
  }
});

btnClear.addEventListener('click', () => {
  inputArea.value = '';
  outputArea.value = '';
});

// Copy
btnCopyClean.addEventListener('click', async () => {
  if (!outputArea.value) return;
  await navigator.clipboard.writeText(outputArea.value);
  showToast('Đã copy văn bản sạch!');
});

btnCopyPrompt.addEventListener('click', async () => {
  if (!outputArea.value) return;
  const promptText = `Bạn là chuyên gia an toàn thông tin & bảo mật. Hãy giải chi tiết các câu hỏi sau, ghi rõ đáp án đúng và giải thích ngắn gọn:\n\n${outputArea.value}`;
  await navigator.clipboard.writeText(promptText);
  showToast('Đã copy Prompt cho Gemini Web!');
});

// Gemini Solve
btnSolve.addEventListener('click', async () => {
  if (!outputArea.value) {
    showToast('Vui lòng dán câu hỏi trước!');
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    settingsPanel.style.display = 'flex';
    apiKeyInput.focus();
    showToast('Vui lòng nhập API Key để giải');
    return;
  }

  outputArea.value = "⏳ Gemini đang phân tích và giải đề...";
  
  try {
    const model = modelSelect.value;
    const systemPrompt = "Bạn là chuyên gia Cybersecurity xuất sắc. Hãy giải các câu hỏi trắc nghiệm sau. Với mỗi câu hỏi: chỉ rõ ĐÁP ÁN ĐÚNG và GIẢI THÍCH NGẮN GỌN (1-2 câu).";
    const fullPrompt = `${systemPrompt}\n\nĐề bài:\n${inputArea.value}`;

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

    const ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!ans) throw new Error('Không có phản hồi từ AI');

    outputArea.value = ans;
    showToast('Gemini đã giải xong!');
  } catch (err) {
    outputArea.value = `❌ Lỗi: ${err.message}\n\nMẹo: Bạn có thể bấm nút "Prompt" rồi dán vào gemini.google.com!`;
  }
});

// Toggle Settings
btnToggleSettings.addEventListener('click', () => {
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
});

btnSaveKey.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  const model = modelSelect.value;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ 'gemini_api_key': key, 'gemini_model': model }, () => {
      showToast('Đã lưu cài đặt API!');
      settingsPanel.style.display = 'none';
    });
  } else {
    showToast('Đã lưu!');
    settingsPanel.style.display = 'none';
  }
});

// Open Web
btnOpenWeb.addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: 'https://coursera-helper.vercel.app' });
  } else {
    window.open('https://coursera-helper.vercel.app', '_blank');
  }
});

function showToast(msg) {
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
