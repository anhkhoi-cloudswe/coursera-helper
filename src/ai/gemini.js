// src/ai/gemini.js
// Gemini API client, key rotation, rate limit handling, and response parsing

const DEPRECATED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro'
];

export function isSupportedModel(name) {
  return name && !DEPRECATED_MODELS.includes(name);
}

export function parseAnswersFromText(aiText) {
  if (!aiText) return [];

  // 1. Parse khối JSON
  try {
    const jsonMatch = aiText.match(/```(?:json:answers|json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i) ||
                      aiText.match(/(\[\s*\{\s*"q"[\s\S]*?\}\s*\])/i);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => {
          const rawAns = Array.isArray(item.answers) ? item.answers : [item.answer || item.text];
          const cleanAns = rawAns.filter(Boolean).map(a => typeof a === 'string' ? a.trim() : String(a));
          const optIdxs = (Array.isArray(item.option_indices) ? item.option_indices : (typeof item.opt_index === 'number' ? [item.opt_index] : [])).map(Number);
          const lts = (Array.isArray(item.letters) ? item.letters : (item.letter ? [item.letter] : [])).map(l => String(l).trim());
          return {
            q: Number(item.q || item.question || 0),
            answers: cleanAns,
            option_indices: optIdxs,
            letters: lts
          };
        }).filter(item => item.answers.length > 0 || item.option_indices.length > 0 || item.letters.length > 0);
      }
    }
  } catch (e) {
    console.warn('CourseraHelper: JSON parse error, switching to regex fallback:', e);
  }

  // 2. Fallback: Parse theo cấu trúc câu hỏi
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

  // 3. Fallback: Summary lines
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

export async function callGeminiDirectParts(keys, model, parts) {
  let keysToTry = [...keys];
  window._chKeyIndex = window._chKeyIndex || 0;
  if (window._chKeyIndex >= keysToTry.length) window._chKeyIndex = 0;

  keysToTry = [...keysToTry.slice(window._chKeyIndex), ...keysToTry.slice(0, window._chKeyIndex)];

  const selectedModel = isSupportedModel(model) ? model : 'gemini-3.6-flash';
  const modelsToTry = [
    selectedModel,
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro'
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  let lastErrorMessage = '';

  for (let k = 0; k < keysToTry.length; k++) {
    const key = keysToTry[k];
    for (const curModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              topK: 20,
              topP: 0.8,
              maxOutputTokens: 8192
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;
          if (text) {
            window._chLastGeminiError = null;
            return text;
          }
        }

        const errData = await response.json().catch(() => ({}));
        const status = response.status;
        const msg = errData?.error?.message || response.statusText;
        lastErrorMessage = `HTTP ${status}: ${msg}`;

        if (status === 429) {
          let retryAfter = 20;
          const retryMatch = msg.match(/retry in\s*(\d+)/i) || msg.match(/wait for\s*(\d+)/i);
          if (retryMatch) retryAfter = parseInt(retryMatch[1], 10) + 2;
          lastErrorMessage = `API Key chạm Rate Limit (429). Cần đợi ${retryAfter}s.`;
          break; // Đổi sang API key khác
        }

        if (status === 400 && (msg.includes('API_KEY_INVALID') || msg.includes('not valid'))) {
          break; // Key hỏng, đổi key khác
        }
      } catch (networkErr) {
        lastErrorMessage = networkErr.message || 'Lỗi mạng khi kết nối Gemini API';
      }
    }
  }

  window._chLastGeminiError = lastErrorMessage;
  return '';
}

