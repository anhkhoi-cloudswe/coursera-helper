// src/quiz/solver.js
// AI answer matching, React-compatible option clicking, batch solver, and retry logic

import {
  getQuestionContainers,
  findQuestionContainerByNumber,
  isQuestionContainerAnswered,
  markQuestionBotSolved,
  clearQuestionBotSolved,
  needsBotSolving,
  getUnansweredQuestions
} from './containers.js';
import { extractOptionPureText, extractAllQuizQuestionsFromDOM } from './extractor.js';
import { callGeminiDirectParts, isSupportedModel, parseAnswersFromText } from '../ai/gemini.js';
import { buildMultimodalBatchParts } from '../ai/prompt.js';
import { showInPageToast } from '../hud/toast.js';
import { isExtensionContextValid, showReloadPrompt, showApiKeyPromptModal, normalizeQuizText, sleep } from '../utils/dom.js';
import { completeHonorCodeAndSubmitQuiz } from './submit.js';

export function calculateOptionMatchScore(el, targetAnswer) {
  const rawText = extractOptionPureText(el);
  if (!rawText || rawText.length > 800) return 0;

  const opt = normalizeQuizText(rawText);
  const ans = normalizeQuizText(targetAnswer);
  if (!opt || !ans) return 0;

  // 1. Khớp hoàn toàn 100%
  if (opt === ans) return 1.0;

  // 2. So khớp từ nguyên vẹn với ranh giới từ (word boundary)
  const escapedAns = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundaryRegex = new RegExp(`(^|\\s)${escapedAns}(\\s|$)`, 'i');
  if (wordBoundaryRegex.test(opt)) return 0.98;

  const escapedOpt = opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const optRegex = new RegExp(`(^|\\s)${escapedOpt}(\\s|$)`, 'i');
  if (optRegex.test(ans)) return 0.96;

  // 3. Chuỗi chứa chuỗi con
  if (opt.includes(ans)) return 0.94;
  if (ans.includes(opt)) return 0.92;

  // 4. Token Overlap
  const optWords = new Set(opt.split(' ').filter(w => w.length >= 1));
  const ansWords = new Set(ans.split(' ').filter(w => w.length >= 1));
  if (ansWords.size > 0 && optWords.size > 0) {
    let overlap = 0;
    for (const w of ansWords) {
      if (optWords.has(w)) overlap++;
    }
    const scoreVsAns = overlap / ansWords.size;
    const scoreVsOpt = overlap / optWords.size;
    const maxRatio = Math.max(scoreVsAns, scoreVsOpt);
    if (maxRatio >= 0.5) return maxRatio * 0.92;
  }

  return 0;
}

export function isOptionChecked(el, input) {
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

export function highlightOptionCard(card, isPicked = false) {
  if (!card) return;
  card.style.outline = '2px solid #10b981';
  card.style.outlineOffset = '2px';
  card.style.borderRadius = '6px';
  card.style.background = 'rgba(16, 185, 129, 0.08)';
  card.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.2)';

  if (isPicked && !card.querySelector('.ch-bot-badge')) {
    const badge = document.createElement('span');
    badge.className = 'ch-bot-badge';
    badge.innerText = '🤖 Bot Verified';
    badge.style.cssText = 'display: inline-block; font-size: 11px; font-weight: 600; background: #10b981; color: #ffffff; padding: 1px 7px; border-radius: 4px; margin-left: 8px; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.2);';
    card.appendChild(badge);
  }
}

export async function tickOptionElement(el) {
  if (!el) return false;
  try {
    const label = el.closest('label, [role="radio"], [role="checkbox"], li.rc-Option') || el;
    const input = label.querySelector('input[type="radio"], input[type="checkbox"]') ||
                  (el.tagName === 'INPUT' ? el : el.querySelector('input'));

    // Cuộn vào tầm nhìn
    const scrollTarget = input || label;
    try {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}

    // Nếu đã được check rồi -> giữ nguyên
    if (isOptionChecked(label, input)) {
      highlightOptionCard(label);
      return true;
    }

    // Tiến hành kích hoạt với chuẩn React 18 & Coursera Design System (CDS)
    const clickTargets = [label, input, label.querySelector('.cds-checkboxAndRadio-box')].filter(Boolean);

    // Bước 1: Synthetic Pointer & Mouse events lên label
    const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    mouseEvents.forEach(evt => {
      label.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
    });

    // Bước 2: Kích hoạt click trực tiếp
    try { label.click(); } catch (e) {}
    if (input) {
      try { input.click(); } catch (e) {}
    }

    // Bước 3: Prototype setter cho React Controlled Input
    if (input) {
      try {
        if (input._valueTracker) {
          input._valueTracker.setValue(!input.checked);
        }
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
        if (setter) {
          setter.call(input, true);
        } else {
          input.checked = true;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }

    // Chờ 100ms để React Virtual DOM cập nhật state và re-render
    await sleep(100);

    const selected = isOptionChecked(label, input);
    if (selected) {
      label.setAttribute('data-ch-bot-picked', 'true');
      if (input) input.setAttribute('data-ch-bot-picked', 'true');
      highlightOptionCard(label, true);
      return true;
    }

    // Fallback thử click vào CDS box hiển thị nếu React chưa nhận
    const box = label.querySelector('.cds-checkboxAndRadio-box, svg, span');
    if (box) {
      mouseEvents.forEach(evt => {
        box.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
      });
      try { box.click(); } catch (e) {}
      await sleep(100);
    }

    const finalSelected = isOptionChecked(label, input);
    if (finalSelected) {
      label.setAttribute('data-ch-bot-picked', 'true');
      if (input) input.setAttribute('data-ch-bot-picked', 'true');
      highlightOptionCard(label, true);
      return true;
    }

    return false;
  } catch (err) {
    console.warn('CourseraHelper: Lỗi tick option:', err);
    return false;
  }
}

export function autoPickExistingHighlightedOptions() {
  let pickedCount = 0;
  try {
    const containers = getQuestionContainers();
    for (const container of containers) {
      if (isQuestionContainerAnswered(container)) continue;

      const highlightedEls = Array.from(container.querySelectorAll(
        'label.cds-checkboxAndRadio-label, [role="radio"], [role="checkbox"], li.rc-Option'
      )).filter(el => {
        const bg = (el.style.backgroundColor || window.getComputedStyle(el).backgroundColor || '').toLowerCase();
        const border = (el.style.borderColor || window.getComputedStyle(el).borderColor || '').toLowerCase();
        const outline = (el.style.outlineColor || window.getComputedStyle(el).outlineColor || '').toLowerCase();
        const isGreenish = (str) => str.includes('16, 185, 129') || str.includes('green') || str.includes('rgb(46, 139, 87)');
        const hasBotBadge = !!el.querySelector('.ch-bot-badge');
        const hasPickedAttr = el.getAttribute('data-ch-bot-picked') === 'true';
        return hasBotBadge || hasPickedAttr || isGreenish(bg) || isGreenish(border) || isGreenish(outline);
      });

      for (const hEl of highlightedEls) {
        const input = hEl.querySelector('input') || (hEl.tagName === 'INPUT' ? hEl : null);
        if (input && !input.checked) {
          tickOptionElement(hEl);
          pickedCount++;
        }
      }
    }
  } catch (e) {}
  return pickedCount;
}

export async function autoFillCourseraQuiz(answersList) {
  if (!answersList || !Array.isArray(answersList) || answersList.length === 0) {
    return { success: false, tickedCount: 0, totalQuestions: 0 };
  }

  let tickedCount = 0;
  const containers = getQuestionContainers();

  for (let i = 0; i < answersList.length; i++) {
    const item = answersList[i];
    const qNum = item.q || (i + 1);
    const targetAnswers = item.answers || [];
    const optionIndices = item.option_indices || [];
    const letters = item.letters || [];
    if (targetAnswers.length === 0 && optionIndices.length === 0 && letters.length === 0) continue;

    const container = findQuestionContainerByNumber(containers, qNum, i);
    const searchRoot = container || document;
    const optElements = Array.from(searchRoot.querySelectorAll(
      'label.cds-checkboxAndRadio-label, label, [role="radio"], [role="checkbox"], li.rc-Option'
    )).filter(el => !el.closest('#agreement-checkbox-base, [class*="HonorCode"]'))
      .filter((el, idx, arr) => !arr.some(other => other !== el && other.contains(el)));

    const answersToMatch = targetAnswers.length > 0 ? targetAnswers : letters;
    const cText = (container?.innerText || '') + ' ' + (item.text || '');
    const hasRadio = !!container?.querySelector('input[type="radio"], [role="radio"]');
    const hasCheckbox = !!container?.querySelector('input[type="checkbox"]:not(#agreement-checkbox-base), [role="checkbox"]');
    const isExplicitMulti = /select (all|two|three|\d)|choose (all|two|three|\d)|which (two|three|\d)|multiple answers/i.test(cText);
    const isSingleChoice = (hasRadio && !hasCheckbox) || (!hasCheckbox && !isExplicitMulti) || (!isExplicitMulti && hasRadio);
    const answersToApply = isSingleChoice ? answersToMatch.slice(0, 1) : answersToMatch;

    let matchedAnswers = 0;
    for (let ansIdx = 0; ansIdx < answersToApply.length; ansIdx++) {
      const ansText = answersToApply[ansIdx];
      let bestMatch = null;
      let highestScore = 0;

      // Ưu tiên 1: So khớp nội dung text với từng option element trong container
      for (const el of optElements) {
        const score = calculateOptionMatchScore(el, ansText);
        if (score > highestScore && score >= 0.7) {
          highestScore = score;
          bestMatch = el;
        }
      }

      // Ưu tiên 2: Khớp theo chữ cái [A, B, C, D]
      if (!bestMatch && optElements.length > 0) {
        const letterMatch = ansText.match(/^\s*\[?([A-Ha-h])\]?[\.\:\s]/) || ansText.match(/^\s*\[?([A-Ha-h])\]?\s*$/);
        if (letterMatch) {
          const letterIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
          if (letterIdx >= 0 && letterIdx < optElements.length) {
            bestMatch = optElements[letterIdx];
          }
        }
      }

      // Ưu tiên 3: Khớp theo option_indices từ AI
      if (!bestMatch && optionIndices.length > 0 && optElements.length > 0) {
        const idxVal = optionIndices[ansIdx] ?? optionIndices[0];
        if (typeof idxVal === 'number' && idxVal >= 0 && idxVal < optElements.length) {
          bestMatch = optElements[idxVal];
        }
      }

      // Ưu tiên 4: Khớp theo letters từ AI
      if (!bestMatch && letters.length > 0 && optElements.length > 0) {
        const letVal = letters[ansIdx] ?? letters[0];
        if (typeof letVal === 'string' && letVal.length === 1) {
          const letIdx = letVal.toUpperCase().charCodeAt(0) - 65;
          if (letIdx >= 0 && letIdx < optElements.length) {
            bestMatch = optElements[letIdx];
          }
        }
      }

      // Fallback: Tìm toàn trang nếu trong container chưa thấy
      if (!bestMatch) {
        const allOptions = Array.from(document.querySelectorAll(
          'label.cds-checkboxAndRadio-label, label, [role="radio"], [role="checkbox"], li.rc-Option'
        )).filter((el, idx, arr) => !arr.some(other => other !== el && other.contains(el)));

        for (const el of allOptions) {
          const score = calculateOptionMatchScore(el, ansText);
          if (score > highestScore && score >= 0.7) {
            highestScore = score;
            bestMatch = el;
          }
        }
      }

      if (bestMatch) {
        const ok = await tickOptionElement(bestMatch);
        if (ok) {
          tickedCount++;
          matchedAnswers++;
          if (isSingleChoice) {
            for (const other of optElements) {
              if (other === bestMatch || other.contains(bestMatch) || bestMatch.contains(other)) continue;
              other.removeAttribute('data-ch-bot-picked');
              other.querySelectorAll('[data-ch-bot-picked="true"]').forEach(el => el.removeAttribute('data-ch-bot-picked'));
              other.querySelectorAll('.ch-bot-badge').forEach(el => el.remove());
              other.style.outline = 'none';
              other.style.background = '';
              other.style.boxShadow = '';
            }
          }
        }
        await sleep(80);
      }
    }

    if (container && answersToApply.length > 0 && matchedAnswers === answersToApply.length && isQuestionContainerAnswered(container)) {
      markQuestionBotSolved(container, qNum);
    }
  }

  return { success: tickedCount > 0, tickedCount, totalAnswers: answersList.length };
}

export async function runInlineBatchSolver(questions, btnSolve, origBtnText) {
  if (!isExtensionContextValid()) {
    showReloadPrompt('Tiện ích Coursera Helper vừa được Tải lại trong Chrome.');
    return;
  }

  let keys = [];
  let savedModel = '';
  try {
    const res = await chrome.storage.local.get(['gemini_api_key', 'gemini_api_keys', 'gemini_api_key_1', 'gemini_api_key_2', 'gemini_api_key_3', 'gemini_model']);
    keys = Array.isArray(res?.gemini_api_keys) && res.gemini_api_keys.length > 0
      ? res.gemini_api_keys
      : [res?.gemini_api_key_1, res?.gemini_api_key_2, res?.gemini_api_key_3, res?.gemini_api_key].filter(Boolean);
    keys = Array.from(new Set(keys.filter(Boolean)));
    savedModel = res?.gemini_model;
  } catch (err) {
    if (err.message && err.message.includes('Extension context invalidated')) {
      showReloadPrompt('Tiện ích vừa được Tải lại trong Chrome.');
      return;
    }
    throw err;
  }

  if (keys.length === 0) {
    showInPageToast('⚠️ Chưa có Gemini API Key! Hãy nhập key vào bảng vừa hiện ra.', true, 5000);
    showApiKeyPromptModal((newKey) => {
      runInlineBatchSolver(questions, btnSolve, origBtnText);
    });
    if (btnSolve) {
      btnSolve.innerHTML = origBtnText;
      btnSolve.style.opacity = '1';
    }
    return;
  }

  const model = isSupportedModel(savedModel) ? savedModel : 'gemini-3.6-flash';

  // Tận dụng các đáp án đã có highlight sẵn
  const prePicked = autoPickExistingHighlightedOptions();
  if (prePicked > 0) {
    showInPageToast(`💡 Tận dụng thành công ${prePicked} đáp án đã được highlight sẵn!`, false, 3000);
    await sleep(300);
  }

  const BATCH_SIZE = 15;
  const totalQuestions = questions.length;
  const totalBatches = Math.ceil(totalQuestions / BATCH_SIZE);
  const allAnswers = [];
  let accumulatedMarkdown = '';

  for (let b = 0; b < totalBatches; b++) {
    const startIdx = b * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, totalQuestions);
    const batchQuestions = questions.slice(startIdx, endIdx);

    const currentContainers = getQuestionContainers();
    const needSolvingInBatch = batchQuestions.filter(q => {
      const c = findQuestionContainerByNumber(currentContainers, q.q);
      return needsBotSolving(q, c);
    });

    if (needSolvingInBatch.length === 0) {
      continue;
    }

    const userChosenCount = needSolvingInBatch.filter(q => q.userSelectedAnswer).length;
    const newQsCount = needSolvingInBatch.length - userChosenCount;
    let statusMsg = `⏳ Đang giải câu ${startIdx + 1} - ${endIdx} / ${totalQuestions}...`;
    if (userChosenCount > 0 && newQsCount > 0) {
      statusMsg = `⏳ Đang giải ${newQsCount} câu mới & thẩm định lại ${userChosenCount} câu bạn đã chọn...`;
    }
    showInPageToast(statusMsg);
    if (btnSolve) btnSolve.innerHTML = `⏳ Giải ${startIdx + 1}-${endIdx}...`;

    const parts = buildMultimodalBatchParts(needSolvingInBatch, needSolvingInBatch[0].q, needSolvingInBatch[needSolvingInBatch.length - 1].q);

    let batchSolved = false;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const text = await callGeminiDirectParts(keys, model, parts);
        if (text) {
          accumulatedMarkdown += `\n\n## 📝 Nhóm câu ${startIdx + 1} - ${endIdx}\n\n` + text;
          const answers = parseAnswersFromText(text);
          if (answers.length > 0) {
            allAnswers.push(...answers);
            await autoFillCourseraQuiz(answers);
            batchSolved = true;
            break;
          }
        }
      } catch (err) {
        console.error('CourseraHelper Inline Solver Error:', err);
      }

      if (!batchSolved && retry < 2) {
        let waitSec = 20;
        if (window._chLastGeminiError) {
          const m = window._chLastGeminiError.match(/đợi\s*(\d+)\s*s/i);
          if (m) waitSec = parseInt(m[1], 10) + 2;
        }
        showInPageToast(`⏳ Google chạm Rate Limit. Tạm dừng ${waitSec}s rồi giải tiếp...`, false, waitSec * 1000);
        await sleep(waitSec * 1000);
      }
    }

    if (b < totalBatches - 1) {
      await sleep(300);
    }
  }

  // KIỂM TRA VÉT CÂU THIẾU
  let remainingUnanswered = getUnansweredQuestions(questions);
  if (remainingUnanswered.length > 0) {
    showInPageToast(`🎯 Còn ${remainingUnanswered.length} câu thiếu. Đang giải bổ sung trực tiếp...`, false, 4000);

    for (let pass = 0; pass < 2 && remainingUnanswered.length > 0; pass++) {
      for (const q of remainingUnanswered) {
        const cContainers = getQuestionContainers();
        const targetContainer = findQuestionContainerByNumber(cContainers, q.q);
        if (targetContainer) {
          targetContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetContainer.style.outline = '2px dashed #f59e0b';
          targetContainer.style.borderRadius = '8px';
          await sleep(200);
        }

        const singleParts = buildMultimodalBatchParts([q], q.q, q.q);
        try {
          const singleText = await callGeminiDirectParts(keys, model, singleParts);
          if (singleText) {
            const singleAnswers = parseAnswersFromText(singleText);
            if (singleAnswers.length > 0) {
              allAnswers.push(...singleAnswers);
              await autoFillCourseraQuiz(singleAnswers);
            }
          }
        } catch (e) {}

        await sleep(300);
      }
      remainingUnanswered = getUnansweredQuestions(questions);
    }
  }

  // Đếm số câu còn thiếu thực tế trên DOM
  const finalContainers = getQuestionContainers();
  const finalDomUnanswered = finalContainers.filter(c => !isQuestionContainerAnswered(c));
  const finalUnanswered = getUnansweredQuestions(questions);
  const missingCount = Math.max(finalUnanswered.length, finalDomUnanswered.length);

  if (btnSolve) {
    if (missingCount === 0) {
      btnSolve.innerHTML = '<span class="ch-btn-icon">✅</span><span class="ch-btn-label">Đã Giải Xong!</span>';
      btnSolve.style.background = '#10b981';
      btnSolve.style.opacity = '1';
      setTimeout(() => {
        if (btnSolve) {
          btnSolve.innerHTML = origBtnText;
          btnSolve.style.background = '';
        }
      }, 5000);
    } else {
      // GIỮ NGUYÊN NÚT MÀU CAM KHI CÒN CÂU THIẾU, GẮN HANDLER GIẢI VÉT TRỰC TIẾP
      btnSolve.innerHTML = `<span class="ch-btn-icon">⚠️</span><span class="ch-btn-label">Giải lại ${missingCount} câu thiếu</span>`;
      btnSolve.style.background = '#f59e0b';
      btnSolve.style.opacity = '1';
      btnSolve.title = `Nhấn vào đây để tập trung giải dứt điểm ${missingCount} câu còn thiếu!`;

      // Cuộn đến câu còn thiếu đầu tiên và viền đỏ
      const firstMissingContainer = finalDomUnanswered[0] || (finalUnanswered.length > 0 ? findQuestionContainerByNumber(finalContainers, finalUnanswered[0].q) : null);
      if (firstMissingContainer) {
        firstMissingContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstMissingContainer.style.outline = '3px solid #ef4444';
        firstMissingContainer.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.45)';
        firstMissingContainer.style.borderRadius = '8px';
      }

      showInPageToast(`⚠️ Còn ${missingCount} câu chưa chọn được đáp án. Đã cuộn đến câu còn thiếu! Bấm lại nút cam để giải dứt điểm.`, true, 8000);
      return;
    }
  }

  // Tự động nộp bài nếu đã hoàn thành 100%
  if (missingCount === 0) {
    showInPageToast(`🎉 Đã điền xong tất cả ${questions.length} câu hỏi! Đang tự động nộp bài...`, false, 4000);
    await completeHonorCodeAndSubmitQuiz();
  }
}

export async function triggerZeroClickQuizWorkflow(btn) {
  const origText = btn ? btn.innerHTML : '<span class="ch-btn-icon">⚡</span><span class="ch-btn-label">Giải Quiz</span>';
  if (btn) {
    btn.innerHTML = '<span class="ch-btn-icon">⏳</span><span class="ch-btn-label">Đang quét đề...</span>';
    btn.style.opacity = '0.7';
  }

  try {
    const questions = await extractAllQuizQuestionsFromDOM();
    if (!questions || questions.length === 0) {
      showInPageToast('❌ Không tìm thấy câu hỏi trắc nghiệm nào trên trang!', true);
      if (btn) {
        btn.innerHTML = origText;
        btn.style.opacity = '1';
      }
      return;
    }

    // Nếu nút đang là "Giải lại X câu thiếu", ta ưu tiên truyền danh sách câu còn thiếu
    const unansweredOnly = getUnansweredQuestions(questions);
    const questionsToSolve = (btn?.innerHTML?.includes('Giải lại') && unansweredOnly.length > 0)
      ? unansweredOnly
      : questions;

    await runInlineBatchSolver(questionsToSolve, btn, origText);
  } catch (err) {
    console.error('CourseraHelper Workflow Error:', err);
    showInPageToast(`❌ Lỗi: ${err.message}`, true);
    if (btn) {
      btn.innerHTML = origText;
      btn.style.opacity = '1';
    }
  }
}

