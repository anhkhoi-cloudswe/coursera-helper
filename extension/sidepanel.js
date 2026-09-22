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
const chkAutoFillQuiz = document.getElementById('chkAutoFillQuiz');
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
  'auto_skip_active',
  'auto_fill_quiz_enabled'
], (res) => {
  if (res.gemini_api_key && apiKeyInput) apiKeyInput.value = res.gemini_api_key;
  const deprecated = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
  if (modelSelect) {
    const isOld = !res.gemini_model || deprecated.includes(res.gemini_model);
    const m = isOld ? 'gemini-3.6-flash' : res.gemini_model;
    modelSelect.value = m;
    if (isOld) {
      chrome.storage.local.set({ 'gemini_model': 'gemini-3.6-flash' });
    }
  }

  if (chkAutoFillQuiz) {
    chkAutoFillQuiz.checked = res.auto_fill_quiz_enabled !== false; // Mặc định là bật
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

safeListen('chkAutoFillQuiz', 'change', () => {
  if (chkAutoFillQuiz) {
    chrome.storage.local.set({ 'auto_fill_quiz_enabled': chkAutoFillQuiz.checked });
  }
});


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
// 7. GỌI GEMINI API GIẢI ĐÁP ÁN (DÙNG MODEL THỰC TẾ CỦA KEY)
// =======================================================

// Lấy danh sách các model khả dụng trực tiếp từ Google API cho API Key này
async function getAvailableGeminiModels(apiKey) {
  for (const apiVer of ['v1beta', 'v1']) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${apiVer}/models?key=${apiKey}`);
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const supported = data.models
          .filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
          .map(m => ({
            name: m.name.replace(/^models\//, ''),
            displayName: m.displayName || m.name.replace(/^models\//, ''),
            version: apiVer
          }));
        if (supported.length > 0) return supported;
      }
    } catch (e) {
      console.warn(`Lỗi list models ${apiVer}:`, e);
    }
  }
  return [];
}

function selectOptimalModel(supportedModels, userPreferred) {
  const deprecated = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
  if (!supportedModels || supportedModels.length === 0) {
    return { name: 'gemini-3.6-flash', version: 'v1beta' };
  }

  // Loại bỏ các model đã khai tử
  const validModels = supportedModels.filter(m => !deprecated.includes(m.name));
  if (validModels.length === 0) {
    return { name: 'gemini-3.6-flash', version: 'v1beta' };
  }

  // 1. Nếu user từng chọn một model hợp lệ và model đó có trong danh sách
  if (userPreferred && !deprecated.includes(userPreferred)) {
    const found = validModels.find(m => m.name === userPreferred);
    if (found) return found;
  }

  // 2. Ưu tiên model chuẩn 2026
  const priorities = [
    'gemini-3.6-flash',
    'gemini-3.6-pro',
    'gemini-3.5-flash'
  ];

  for (const p of priorities) {
    const match = validModels.find(m => m.name === p);
    if (match) return match;
  }

  // 3. Tìm bất kỳ model nào có chữ "flash"
  const anyFlash = validModels.find(m => m.name.toLowerCase().includes('flash'));
  if (anyFlash) return anyFlash;

  // 4. Tìm bất kỳ model nào có chữ "gemini"
  const anyGemini = validModels.find(m => m.name.toLowerCase().includes('gemini'));
  if (anyGemini) return anyGemini;

  return validModels[0] || { name: 'gemini-3.6-flash', version: 'v1beta' };
}

function populateModelSelect(supportedModels, activeModelName) {
  if (!modelSelect || !supportedModels || supportedModels.length === 0) return;
  modelSelect.innerHTML = '';
  supportedModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.dataset.version = m.version;
    opt.innerText = m.displayName !== m.name ? `${m.displayName} (${m.name})` : m.name;
    if (m.name === activeModelName) opt.selected = true;
    modelSelect.appendChild(opt);
  });
}

// =======================================================
// TRÍCH XUẤT ĐÁP ÁN ĐỂ TỰ ĐỘNG TICK TRÊN COURSERA
// =======================================================
function extractAnswers(aiText) {
  if (!aiText) return [];

  // 1. Khối json:answers chuẩn máy đọc
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
  } catch (e) {
    console.warn('JSON parse fallback:', e);
  }

  // 2. Quét regex chi tiết từng câu trong Markdown
  const results = [];
  const questionBlocks = aiText.split(/(?:###\s*(?:Câu|Question)\s*(\d+)|\b(?:Câu|Question)\s+(\d+)\b)/i);
  if (questionBlocks.length > 2) {
    for (let i = 1; i < questionBlocks.length; i += 3) {
      const qNum = parseInt(questionBlocks[i] || questionBlocks[i + 1] || '0', 10);
      const content = questionBlocks[i + 2] || '';
      
      const ansMatch = content.match(/(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER)[\s\S]*?(?:GIẢI THÍCH|EXPLANATION|---|$)/i);
      if (ansMatch) {
        const ansSection = ansMatch[0];
        const bullets = Array.from(ansSection.matchAll(/[\*\-]\s*(?:\*\*)?(.*?)(?:\*\*)?(?:\r?\n|$)/g))
          .map(m => m[1].replace(/^(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER):?\s*/i, '').replace(/\*\*/g, '').trim())
          .filter(t => t.length > 2 && !t.toLowerCase().includes('đáp án đúng'));
        
        if (bullets.length > 0) {
          results.push({ q: qNum, answers: bullets });
        } else {
          const lines = ansSection.split('\n')
            .map(l => l.replace(/^(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER):?\s*/i, '').replace(/\*\*/g, '').trim())
            .filter(l => l.length > 2 && !l.toLowerCase().includes('đáp án đúng') && !l.toLowerCase().includes('giải thích'));
          if (lines.length > 0) {
            results.push({ q: qNum, answers: lines });
          }
        }
      }
    }
  }

  // 3. Quét bảng tóm tắt nhanh
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

// Gửi lệnh tự động tick đáp án tới tab Coursera
async function sendAutoFillToCoursera(answers) {
  if (!answers || !Array.isArray(answers) || answers.length === 0) return;

  const tab = await getCourseraTab();
  if (!tab || !tab.id) {
    showToast('⚠️ Vui lòng mở trang Coursera để tự động điền!');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'auto_fill_quiz', answers: answers }, (res) => {
    if (chrome.runtime.lastError || !res) {
      executeDirectAutoFill(tab.id, answers);
    } else if (res && res.tickedCount > 0) {
      showToast(`🎯 Đã tự động tick ${res.tickedCount} đáp án trên Coursera!`);
    } else {
      showToast('⚠️ Đã thử điền nhưng không tìm thấy trắc nghiệm tương ứng!');
    }
  });
}

// Hàm dự phòng can thiệp DOM trang nếu content script chưa gắn kịp
function executeDirectAutoFill(tabId, answers) {
  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    func: async (answersList) => {
      function normalizeText(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      }

      function isMatch(el, targetAnswer) {
        const rawText = (el.innerText || el.textContent || '').trim();
        if (!rawText || rawText.length > 500) return false;
        const opt = normalizeText(rawText);
        const ans = normalizeText(targetAnswer);
        if (!opt || !ans) return false;
        if (opt === ans) return true;
        if (ans.length >= 12 && opt.includes(ans)) return true;
        if (opt.length >= 12 && ans.includes(opt)) return true;
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

      function isChecked(el, input) {
        if (input && input.checked) return true;
        if (el.getAttribute('aria-checked') === 'true') return true;
        if (input && input.getAttribute('aria-checked') === 'true') return true;
        if (el.classList.contains('cds-checkboxAndRadio-checked')) return true;
        const parentLabel = el.closest('label');
        if (parentLabel && (parentLabel.classList.contains('cds-checkboxAndRadio-checked') || parentLabel.getAttribute('aria-checked') === 'true')) {
          return true;
        }
        return false;
      }

      let count = 0;
      for (const item of answersList) {
        for (const ansText of (item.answers || [])) {
          const allOptions = Array.from(document.querySelectorAll(
            'label, li.rc-Option, div[data-testid="option-label"], [role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]'
          ));
          const matched = allOptions.find(el => isMatch(el, ansText));
          if (matched) {
            const input = matched.tagName === 'INPUT' ? matched : matched.querySelector('input');
            const target = input || matched;
            try { target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}

            // Chỉ click đúng 1 lần nếu chưa được tick
            if (!isChecked(matched, input)) {
              if (input) {
                try { input.click(); } catch (e) {}
              }
              if (!isChecked(matched, input)) {
                const clickable = matched.closest('label') || matched;
                try { clickable.click(); } catch (e) {}
              }
              if (!isChecked(matched, input) && input) {
                try {
                  const proto = window.HTMLInputElement.prototype;
                  const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
                  if (setter) setter.call(input, true);
                  else input.checked = true;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (e) {}
              }
            }

            const card = matched.closest('label, li, [role="radio"], [role="checkbox"]') || matched;
            card.style.transition = 'all 0.3s ease';
            card.style.outline = '2px solid #10b981';
            card.style.background = 'rgba(16, 185, 129, 0.14)';
            card.style.borderRadius = '6px';
            card.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.45)';
            count++;

            await new Promise(r => setTimeout(r, 80));
          }
        }
      }
    },
    args: [answers]
  });
}

// Bắt sự kiện click vào các nút trong khung kết quả AI
if (aiContent) {
  aiContent.addEventListener('click', async (e) => {
    // 1. Nút Copy tất cả
    const targetCopy = e.target.closest('#btnQuickCopyAi');
    if (targetCopy) {
      chrome.storage.local.get(['saved_ai_raw'], async (res) => {
        const textToCopy = res.saved_ai_raw || aiContent.innerText;
        await navigator.clipboard.writeText(textToCopy);
        showToast('✓ Đã copy toàn bộ đáp án!');
      });
      return;
    }

    // 2. Nút Tự động tick lại Coursera
    const targetFill = e.target.closest('#btnQuickFillCoursera');
    if (targetFill) {
      chrome.storage.local.get(['saved_ai_answers'], async (res) => {
        if (res.saved_ai_answers && res.saved_ai_answers.length > 0) {
          showToast('🎯 Đang tự động tick chọn trên Coursera...');
          sendAutoFillToCoursera(res.saved_ai_answers);
        } else {
          showToast('⚠️ Chưa có danh sách đáp án để điền!');
        }
      });
      return;
    }
  });
}

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
        <p style="color: #a5b4fc; font-weight: 600;">Gemini đang giải đề siêu tốc...</p>
        <p style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Đang phân tích và xuất đáp án chuẩn xác nhất</p>
      </div>
    `;
  }

  const systemPrompt = `Bạn là trợ lý giải trắc nghiệm Coursera chuyên sâu. Hãy giải các câu hỏi sau với quy tắc:
1. KHÔNG mở đầu hay kết bài bằng lời chào xã giao (không có "Chào bạn", "Dưới đây là...", v.v.). Bắt đầu ngay lập tức.
2. PHẦN 1: BẢNG TÓM TẮT ĐÁP ÁN NHANH (QUICK KEY):
   Liệt kê nhanh từng câu để người dùng tick bài thi trong 30 giây:
   - Câu 1: [Đáp án A] | [Đáp án B (nếu chọn 2)]
   - Câu 2: [Đáp án]
   ...
3. PHẦN 2: CHI TIẾT TỪNG CÂU & GIẢI THÍCH:
   Mỗi câu trình bày theo format:
   ### Câu [X] (Ghi rõ "(Chọn 2)" nếu câu hỏi yêu cầu Select two)
   ĐÁP ÁN ĐÚNG:
   * **[Nguyên văn nội dung đáp án đúng]**
   GIẢI THÍCH: [1-2 câu giải thích ngắn gọn, súc tích bản chất chuyên môn]
   ---
4. PHẦN 3: DỮ LIỆU ĐIỀN ĐÁP ÁN (BẮT BUỘC ĐẶT Ở CUỐI CÙNG):
\`\`\`json:answers
[
  {"q": 1, "answers": ["Nguyên văn đáp án 1", "Nguyên văn đáp án 2 nếu có"]},
  {"q": 2, "answers": ["Nguyên văn đáp án"]}
]
\`\`\`
`;
  const fullPrompt = `${systemPrompt}\n\nĐề bài:\n${textToSolve}`;

  const deprecated = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
  let chosenModel = modelSelect?.value || 'gemini-3.6-flash';
  if (deprecated.includes(chosenModel)) chosenModel = 'gemini-3.6-flash';

  const modelsToTry = Array.from(new Set([
    chosenModel,
    'gemini-3.6-flash',
    'gemini-3.6-pro',
    'gemini-3.5-flash'
  ])).filter(m => m && !deprecated.includes(m));

  const startTime = performance.now();
  let solved = false;
  let lastError = null;
  let solvedText = '';
  let successfulModel = '';

  for (const model of modelsToTry) {
    // 1. Thử qua Google Interactions API (chuẩn chính thức khuyến nghị 2026 cho gemini-3.6-flash)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      const resInteractions = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          model: model,
          input: fullPrompt
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const dataInteractions = await resInteractions.json();
      if (!dataInteractions.error) {
        const text = getAiResponseText(dataInteractions);
        if (text) {
          solvedText = text;
          successfulModel = model;
          solved = true;
          break;
        }
      } else {
        lastError = new Error(dataInteractions.error.message || `Lỗi Interactions API (${model})`);
      }
    } catch (e) {
      lastError = e;
    }

    if (solved) break;

    // 2. Thử qua generateContent endpoint
    for (const ver of ['v1beta', 'v1']) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
        const resGen = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const dataGen = await resGen.json();
        if (dataGen.error) {
          lastError = new Error(dataGen.error.message || `Lỗi API (${model})`);
          continue;
        }

        const text = getAiResponseText(dataGen);
        if (text) {
          solvedText = text;
          successfulModel = model;
          solved = true;
          break;
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (solved) break;
  }

  if (solved && solvedText) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const htmlHeader = `
      <div class="ai-result-header">
        <span class="ai-time-badge">⚡ Đã giải trong ${elapsed}s (${successfulModel})</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn-copy-quick" id="btnQuickFillCoursera" title="Tự động tick các đáp án này vào bài trắc nghiệm Coursera">🎯 Tự tick Coursera</button>
          <button class="btn-copy-quick" id="btnQuickCopyAi" title="Copy toàn bộ đáp án">📋 Copy tất cả</button>
        </div>
      </div>
    `;
    const htmlBody = renderMarkdown(solvedText);
    const fullHtml = htmlHeader + htmlBody;

    if (aiContent) {
      aiContent.innerHTML = fullHtml;
    }

    if (modelSelect) modelSelect.value = successfulModel;

    const parsedAnswers = extractAnswers(solvedText);
    chrome.storage.local.set({
      'saved_ai_html': fullHtml,
      'saved_ai_raw': solvedText,
      'saved_ai_answers': parsedAnswers,
      'gemini_model': successfulModel
    });

    showToast(`✓ Gemini (${successfulModel}) giải xong trong ${elapsed}s!`);

    // Tự động điền đáp án vào Coursera ngay sau khi giải nếu bật tùy chọn
    chrome.storage.local.get(['auto_fill_quiz_enabled'], (res) => {
      const isAutoFillEnabled = res.auto_fill_quiz_enabled !== false;
      if (isAutoFillEnabled && parsedAnswers.length > 0) {
        sendAutoFillToCoursera(parsedAnswers);
      }
    });

  } else if (lastError) {
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

// Trích xuất văn bản câu trả lời từ bất kỳ định dạng nào của Google AI (Interactions API hoặc generateContent)
function getAiResponseText(data) {
  if (!data) return '';

  // 1. Google Interactions API (chuẩn 2026): mảng steps
  if (Array.isArray(data.steps)) {
    for (let i = data.steps.length - 1; i >= 0; i--) {
      const step = data.steps[i];
      if (Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item && item.text) return item.text;
        }
      }
      if (typeof step.output === 'string') return step.output;
      if (typeof step.text === 'string') return step.text;
    }
  }

  // 2. Các trường output trực tiếp của Interactions API
  if (typeof data.output === 'string') return data.output;
  if (typeof data.output_text === 'string') return data.output_text;
  if (Array.isArray(data.outputs) && data.outputs[0]?.text) {
    return data.outputs[0].text;
  }

  // 3. Chuẩn generateContent: data.candidates
  if (Array.isArray(data.candidates) && data.candidates[0]?.content?.parts) {
    const parts = data.candidates[0].content.parts;
    const textPart = parts.find(p => p.text);
    if (textPart) return textPart.text;
  }

  return '';
}

function renderMarkdown(md) {
  // Loại bỏ khối json:answers nếu có để giao diện luôn sạch đẹp
  let cleanMd = md.replace(/```(?:json:answers|json)?\s*\[\s*\{[\s\S]*?\}\s*\]\s*```/gi, '').trim();

  let html = cleanMd
    .replace(/^### (.*$)/gim, '<h3 class="ai-q-title">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="ai-sec-title">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="ai-main-title">$1</h1>')
    .replace(/^(?:---|___|\*\*\*)$/gim, '<hr class="ai-divider">')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/(?:ĐÁP ÁN ĐÚNG|CORRECT ANSWER):?/gi, '<span class="ai-badge-correct">✅ ĐÁP ÁN ĐÚNG:</span>')
    .replace(/(?:GIẢI THÍCH|EXPLANATION):?/gi, '<span class="ai-badge-explain">💡 GIẢI THÍCH:</span>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="ai-li">$1</li>')
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\n/gim, '<br>');
  return `<div class="ai-rendered-body"><p>${html}</p></div>`;
}

// Cài đặt API Key
safeListen('btnToggleSettings', 'click', async () => {
  if (settingsBox) {
    const isOpening = settingsBox.style.display === 'none';
    settingsBox.style.display = isOpening ? 'flex' : 'none';
    if (isOpening && apiKeyInput?.value.trim()) {
      const models = await getAvailableGeminiModels(apiKeyInput.value.trim());
      if (models.length > 0) populateModelSelect(models, modelSelect?.value);
    }
  }
});

safeListen('btnCloseSettings', 'click', () => {
  if (settingsBox) settingsBox.style.display = 'none';
});

safeListen('btnSaveKey', 'click', async () => {
  const key = apiKeyInput?.value.trim() || '';
  if (!key) {
    showToast('Vui lòng nhập API Key');
    return;
  }

  showToast('🔍 Đang kiểm tra API Key...');
  const available = await getAvailableGeminiModels(key);

  if (available.length > 0) {
    populateModelSelect(available, modelSelect?.value);
    const best = selectOptimalModel(available, modelSelect?.value);
    if (modelSelect) modelSelect.value = best.name;
    chrome.storage.local.set({ 'gemini_api_key': key, 'gemini_model': best.name }, () => {
      showToast(`✓ Đã kết nối! Model: ${best.name}`);
      if (settingsBox) settingsBox.style.display = 'none';
    });
  } else {
    // Nếu không list được models, vẫn lưu key với model mặc định
    const fallbackModel = modelSelect?.value || 'gemini-3.6-flash';
    chrome.storage.local.set({ 'gemini_api_key': key, 'gemini_model': fallbackModel }, () => {
      showToast(`✓ Đã lưu cài đặt (${fallbackModel})!`);
      if (settingsBox) settingsBox.style.display = 'none';
    });
  }
});


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
