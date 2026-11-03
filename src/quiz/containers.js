// src/quiz/containers.js
// Question container detection, isolation, answer status check, and session state

export function isHonorCodeOrPolicyElement(el) {
  if (!el) return false;
  if (el.id === 'agreement-checkbox-base' || el.id?.includes('agreement')) return true;
  if (el.closest && el.closest('#agreement-checkbox-base, [class*="HonorCode"], [data-testid*="honor-code"]')) return true;
  const txt = (el.innerText || el.textContent || '').trim();
  if (txt.includes('Coursera Honor Code') || txt.includes('understand and agree')) return true;
  if (txt.includes('By clicking Submit, you confirm this work is your own')) return true;
  if (el.getAttribute('data-testid') === 'honor-code-agreement') return true;
  return false;
}

export function getQuestionContainers() {
  // 1. Selector kinh điển của Coursera (nếu còn tồn tại trên các bài quiz cũ)
  let containers = Array.from(document.querySelectorAll(
    'div[data-testid="part-container"], .rc-FormPartsQuestion, fieldset.rc-FormPartsQuestion, .rc-QuizQuestion, [data-testid*="quiz-question"], [data-testid*="question-container"]'
  ));
  if (containers.length > 0) {
    containers = containers
      .filter((c, idx, arr) => !arr.some(other => other !== c && c.contains(other)))
      .filter(c => {
        if (isHonorCodeOrPolicyElement(c)) return false;
        return c.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], label.cds-checkboxAndRadio-label, li.rc-Option');
      });
    if (containers.length > 0) return containers;
  }

  // 2. Modern CDS Architecture: Tìm tất cả [role="radiogroup"] hoặc [role="group"]
  const groupEls = Array.from(document.querySelectorAll(
    '[role="radiogroup"], [role="group"]'
  )).filter(g => !isHonorCodeOrPolicyElement(g));

  if (groupEls.length > 0) {
    const qContainers = [];
    const seenContainers = new Set();

    for (const group of groupEls) {
      if (isHonorCodeOrPolicyElement(group)) continue;
      const hasOptions = group.querySelector('label.cds-checkboxAndRadio-label, input[type="radio"], input[type="checkbox"]');
      if (!hasOptions) continue;

      let qBox = group.parentElement;
      let cur = group;
      for (let d = 0; d < 4 && cur && cur !== document.body && cur.tagName !== 'FORM' && !cur.classList.contains('cds-FullscreenDialog-scrollContainer'); d++) {
        if (isHonorCodeOrPolicyElement(cur)) {
          qBox = null;
          break;
        }
        const text = (cur.innerText || '').trim();
        if (/^(?:\d+\.|\bQuestion\s+\d+\b|\bCâu\s+\d+\b)/im.test(text) || text.includes('1 point') || text.includes('point')) {
          qBox = cur;
        }
        cur = cur.parentElement;
      }

      if (qBox && !isHonorCodeOrPolicyElement(qBox) && !seenContainers.has(qBox)) {
        seenContainers.add(qBox);
        qContainers.push(qBox);
      }
    }

    if (qContainers.length > 0) {
      qContainers.sort((a, b) => {
        return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });
      return qContainers;
    }
  }

  // 3. Fallback: Nhóm theo input[type="radio"], input[type="checkbox"]
  const allInputs = Array.from(document.querySelectorAll(
    'input[type="radio"], input[type="checkbox"]'
  )).filter(inp => !isHonorCodeOrPolicyElement(inp));

  if (allInputs.length > 0) {
    const qContainers = [];
    const seenContainers = new Set();
    const nameGroups = new Map();

    allInputs.forEach(inp => {
      if (isHonorCodeOrPolicyElement(inp)) return;
      const name = inp.name || 'unnamed_' + Math.random();
      if (!nameGroups.has(name)) nameGroups.set(name, []);
      nameGroups.get(name).push(inp);
    });

    nameGroups.forEach(inputs => {
      let container = inputs[0].closest('[role="radiogroup"], [role="group"]') ||
                      inputs[0].closest('fieldset') ||
                      inputs[0].closest('label')?.parentElement?.parentElement;
      let p = container?.parentElement;
      if (p && p !== document.body && p.tagName !== 'FORM' && !p.classList.contains('cds-FullscreenDialog-scrollContainer')) {
        const pTxt = (p.innerText || '').trim();
        if (/(?:\d+\.|\bQuestion\s+\d+\b|\bCâu\s+\d+\b)/im.test(pTxt)) {
          container = p;
        }
      }
      if (container && !isHonorCodeOrPolicyElement(container) && !seenContainers.has(container)) {
        seenContainers.add(container);
        qContainers.push(container);
      }
    });

    if (qContainers.length > 0) {
      qContainers.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
      return qContainers;
    }
  }

  return [];
}

export function findQuestionContainerByNumber(containers, qNum, idx = null) {
  if (!containers || containers.length === 0) return null;
  const cleanNum = parseInt(qNum, 10);
  if (!isNaN(cleanNum)) {
    // 1. Tìm container khớp số thứ tự trong nội dung text bằng regex bao quát mọi biến thể Coursera
    const found = containers.find(c => {
      const txt = c.innerText || c.textContent || '';
      const regex = new RegExp(`(?:Question\\s*${cleanNum}\\b|(?:^|[\\r\\n\\s\\u00A0])${cleanNum}[\\.\\:\\)][\\s\\u00A0]|\\bCâu\\s*${cleanNum}\\b)`, 'i');
      return regex.test(txt);
    });
    if (found) return found;

    // 2. Tìm container có data-testid hoặc id chứa số
    const byAttr = containers.find(c => {
      const testId = c.getAttribute('data-testid') || '';
      const id = c.id || '';
      return new RegExp(`(?:question|part)[-_]?0*${cleanNum}(?:[-_]|$)`, 'i').test(testId + ' ' + id);
    });
    if (byAttr) return byAttr;

    // 3. Fallback vị trí theo index (1-based)
    if (cleanNum >= 1 && cleanNum <= containers.length) {
      return containers[cleanNum - 1];
    }
  }

  if (idx !== null && idx >= 0 && idx < containers.length) {
    return containers[idx];
  }
  return null;
}

// Kiểm tra xem 1 câu hỏi cụ thể đã được tick chọn phương án nào trên DOM chưa
export function isQuestionContainerAnswered(container) {
  if (!container) return false;
  const checkedInput = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:not(#agreement-checkbox-base):checked');
  if (checkedInput) return true;
  const ariaChecked = container.querySelector('[aria-checked="true"]:not(#agreement-checkbox-base)');
  if (ariaChecked && !ariaChecked.closest('#agreement-checkbox-base, [class*="HonorCode"]')) return true;
  const cdsChecked = container.querySelector('.cds-checkboxAndRadio-checked, [data-checked="true"], [data-state="checked"]');
  if (cdsChecked && !cdsChecked.closest('#agreement-checkbox-base, [class*="HonorCode"]')) return true;
  return false;
}

export function getBotSolvedSet() {
  window._chBotSolvedQuestions = window._chBotSolvedQuestions || new Set();
  try {
    const saved = sessionStorage.getItem('ch_bot_solved_' + location.pathname);
    if (saved) {
      JSON.parse(saved).forEach(n => window._chBotSolvedQuestions.add(n));
    }
  } catch (e) {}
  return window._chBotSolvedQuestions;
}

export function markQuestionBotSolved(container, qNum) {
  if (container) {
    container.setAttribute('data-ch-bot-solved', 'true');
  }
  const set = getBotSolvedSet();
  if (qNum) set.add(qNum);
  try {
    sessionStorage.setItem('ch_bot_solved_' + location.pathname, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function clearQuestionBotSolved(container, qNum) {
  if (container) {
    container.removeAttribute('data-ch-bot-solved');
  }
  const set = getBotSolvedSet();
  if (qNum) set.delete(qNum);
  try {
    sessionStorage.setItem('ch_bot_solved_' + location.pathname, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function isQuestionBotSolved(container, qNum) {
  if (!container) return false;
  // BẮT BUỘC: Nếu trên DOM chưa có lựa chọn nào được tick, không thể coi là đã giải xong!
  if (!isQuestionContainerAnswered(container)) {
    clearQuestionBotSolved(container, qNum);
    return false;
  }
  if (container.getAttribute('data-ch-bot-solved') === 'true') return true;
  if (container.querySelector('[data-ch-bot-picked="true"], .ch-bot-badge')) return true;
  const set = getBotSolvedSet();
  if (qNum && set.has(qNum)) return true;
  return false;
}

export function needsBotSolving(q, container) {
  if (!container) return true;
  // 1. Chưa trả lời câu nào trên DOM -> BẮT BUỘC GIẢI (xóa cache bẩn nếu có)
  if (!isQuestionContainerAnswered(container)) {
    clearQuestionBotSolved(container, q?.q);
    return true;
  }
  // 2. Đã được bot giải và thẩm định trước đó -> Tự động SKIP!
  if (isQuestionBotSolved(container, q?.q)) return false;
  // 3. Có đáp án nhưng DO NGƯỜI DÙNG TỰ CHỌN -> BẮT BUỘC THẨM ĐỊNH LẠI
  return true;
}

export function getUnansweredQuestions(allQuestions) {
  if (!allQuestions || allQuestions.length === 0) return [];
  const containers = getQuestionContainers();
  const unanswered = [];
  for (let idx = 0; idx < allQuestions.length; idx++) {
    const q = allQuestions[idx];
    const qNum = q.q || (idx + 1);
    const container = findQuestionContainerByNumber(containers, qNum, idx);
    if (!container || !isQuestionContainerAnswered(container)) {
      unanswered.push(q);
    }
  }
  return unanswered;
}
