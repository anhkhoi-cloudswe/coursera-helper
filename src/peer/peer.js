// src/peer/peer.js
// Automated Peer Review scoring, feedback generation, and submission

import { showInPageToast } from '../hud/toast.js';
import { triggerClick, sleep } from '../utils/dom.js';

export function setFeedbackInputValue(textarea, text) {
  if (!textarea) return;
  textarea.focus();
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // React setter fallback
  try {
    const proto = window.HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(textarea, text);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (e) {}
}

export async function gradeCurrentPeerReview() {
  // 1. Tick điểm cao nhất cho từng tiêu chí đánh giá
  const rubricGroups = Array.from(document.querySelectorAll('[role="radiogroup"], .rc-RubricCriterion, [data-testid*="rubric"]'));
  for (const group of rubricGroups) {
    const radios = Array.from(group.querySelectorAll('input[type="radio"], [role="radio"]'));
    if (radios.length > 0) {
      // Chọn mức điểm cao nhất (thường là option cuối cùng hoặc đầu tiên tùy rubric)
      const bestRadio = radios[radios.length - 1];
      const label = bestRadio.closest('label') || bestRadio;
      triggerClick(label);
      try { bestRadio.click(); } catch (e) {}
    }
  }

  // 2. Điền nhận xét tích cực vào tất cả textarea
  const textareas = Array.from(document.querySelectorAll('textarea'));
  const POSITIVE_FEEDBACKS = [
    'Great job! The submission meets all the requirements clearly and concisely. Well-structured and easy to follow.',
    'Excellent work! Very well thought out, thorough analysis, and clear explanation of concepts.',
    'Strong submission! Demonstrated a deep understanding of the subject matter with practical insights.'
  ];

  for (let i = 0; i < textareas.length; i++) {
    const ta = textareas[i];
    const fb = POSITIVE_FEEDBACKS[i % POSITIVE_FEEDBACKS.length];
    setFeedbackInputValue(ta, fb);
  }

  await sleep(400);
}

export function findPeerSubmitButton() {
  const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
  return buttons.find(b => {
    const t = (b.innerText || b.textContent || '').trim().toLowerCase();
    const isSubmit = t.includes('submit review') || t === 'submit' || t.includes('nộp đánh giá');
    return isSubmit && b.offsetWidth > 0 && !b.disabled;
  }) || null;
}

export async function runAutoPeerReviewWorkflow(btn) {
  const origText = btn ? btn.innerHTML : '⭐ Chấm Điểm Peer';
  if (btn) {
    btn.innerHTML = '⏳ Đang chấm...';
    btn.style.opacity = '0.7';
  }

  try {
    showInPageToast('⭐ Đang tự động chấm điểm và viết nhận xét bài đồng cấp...');
    await gradeCurrentPeerReview();

    await sleep(600);
    const submitBtn = findPeerSubmitButton();
    if (submitBtn) {
      triggerClick(submitBtn);
      try { submitBtn.click(); } catch (e) {}
      showInPageToast('🎉 Đã nộp bài chấm Peer Review thành công!');
    } else {
      showInPageToast('✅ Đã điền xong điểm và nhận xét! Vui lòng kiểm tra lại.', false, 4000);
    }
  } catch (err) {
    showInPageToast(`❌ Lỗi chấm Peer: ${err.message}`, true);
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.style.opacity = '1';
    }
  }
}

