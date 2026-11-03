// src/quiz/submit.js
// Honor Code agreement, quiz submission, and 2-step modal confirmation

import { showInPageToast } from '../hud/toast.js';
import { triggerClick, sleep } from '../utils/dom.js';
import { getQuestionContainers, isQuestionContainerAnswered } from './containers.js';

export function isHonorCodeChecked(input) {
  if (!input) return false;
  if (input.checked === true) return true;
  if (input.getAttribute('aria-checked') === 'true') return true;
  if (input.classList.contains('cds-checkboxAndRadio-checked')) return true;
  const parent = input.closest('.cds-choiceInput-root, .cds-checkboxAndRadio-input, label');
  if (parent && (parent.getAttribute('aria-checked') === 'true' || parent.classList.contains('cds-checkboxAndRadio-checked'))) return true;
  const label = document.querySelector(`label[for="${input.id}"]`);
  if (label && (label.getAttribute('aria-checked') === 'true' || label.classList.contains('cds-checkboxAndRadio-checked'))) return true;
  return false;
}

export async function tickHonorCodeAgreement() {
  const agreementInput = document.getElementById('agreement-checkbox-base') ||
                         document.querySelector('input[type="checkbox"][id*="agreement"]') ||
                         document.querySelector('input[type="checkbox"][name*="agreement"]') ||
                         document.querySelector('[data-testid*="honor-code"] input[type="checkbox"]');

  if (agreementInput && isHonorCodeChecked(agreementInput)) return true;

  if (agreementInput) {
    const parentLabel = agreementInput.closest('label') ||
                        document.querySelector(`label[for="${agreementInput.id}"]`) ||
                        agreementInput.parentElement;

    if (parentLabel) {
      try { parentLabel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
      triggerClick(parentLabel);
      try { parentLabel.click(); } catch (e) {}
    }

    try {
      agreementInput.click();
    } catch (e) {}

    try {
      if (agreementInput._valueTracker) agreementInput._valueTracker.setValue(!agreementInput.checked);
      const proto = window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
      if (setter) {
        setter.call(agreementInput, true);
      } else {
        agreementInput.checked = true;
      }
      agreementInput.dispatchEvent(new Event('input', { bubbles: true }));
      agreementInput.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}

    await sleep(150);
    if (isHonorCodeChecked(agreementInput)) return true;
  }

  // Fallback quét tất cả checkbox có text honor code
  const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  for (const chk of allCheckboxes) {
    const parentText = (chk.closest('label, div')?.innerText || '').toLowerCase();
    if (parentText.includes('understand and agree') || parentText.includes('honor code') || parentText.includes('confirm this work is your own')) {
      if (isHonorCodeChecked(chk)) return true;
      const lbl = chk.closest('label') || chk.parentElement;
      if (lbl) {
        triggerClick(lbl);
        try { lbl.click(); } catch (e) {}
      }
      try { chk.click(); } catch (e) {}
      await sleep(150);
      if (isHonorCodeChecked(chk)) return true;
    }
  }

  return false;
}

export function findQuizSubmitButton(onlyEnabled = false) {
  const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
  const submitBtns = allButtons.filter(btn => {
    if (btn.closest('#coursera-helper-hud, header, nav')) return false;
    const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    const isSaveDraft = txt.includes('draft') || txt.includes('nháp');
    const isBack = txt.includes('back') || txt.includes('quay lại');
    const isCancel = txt.includes('cancel') || txt.includes('hủy');
    const isSubmit = txt === 'submit' || txt === 'nộp bài' || txt.startsWith('submit ') || txt.includes('submit assignment');
    if (!isSubmit || isSaveDraft || isBack || isCancel) return false;
    if (btn.offsetWidth === 0 || btn.offsetHeight === 0) return false;
    if (onlyEnabled && (btn.disabled || btn.getAttribute('aria-disabled') === 'true')) return false;
    return true;
  });

  return submitBtns[submitBtns.length - 1] || null;
}

export function findSubmitConfirmButton(originalSubmitBtn = null) {
  // Chiến lược 1: Tìm nút Submit nằm trong cùng Modal với nút "Cancel"
  // Mọi modal popup của Coursera ("Ready to submit?") đều có 1 nút "Submit" đứng cạnh 1 nút "Cancel"
  const allCancelBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
    if (b.closest('#coursera-helper-hud, header, nav')) return false;
    const t = (b.innerText || b.textContent || '').trim().toLowerCase();
    return t === 'cancel' || t === 'hủy';
  });

  for (const cancelBtn of allCancelBtns) {
    // Leo lên container chung của modal (khoảng 1-4 cấp cha)
    let p = cancelBtn.parentElement;
    for (let depth = 0; depth < 5 && p && p !== document.body; depth++) {
      const modalBtns = Array.from(p.querySelectorAll('button, [role="button"]'));
      const submitInModal = modalBtns.find(b => {
        if (b === cancelBtn) return false;
        if (originalSubmitBtn && (b === originalSubmitBtn || originalSubmitBtn.contains(b))) return false;
        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        return (
          txt === 'submit' ||
          txt === 'nộp bài' ||
          txt === 'yes, submit' ||
          txt === 'submit quiz' ||
          txt === 'submit assignment' ||
          txt.includes('submit') ||
          txt.includes('nộp')
        );
      });

      if (submitInModal) {
        return submitInModal;
      }
      p = p.parentElement;
    }
  }

  // Chiến lược 2: Tìm theo container modal chứa text "ready to submit" hoặc "sure you want to submit"
  const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
    if (el.tagName === 'BODY' || el.tagName === 'HTML' || el.children.length === 0) return false;
    if (el.closest('#coursera-helper-hud, header, nav')) return false;
    const text = (el.innerText || '').toLowerCase();
    return (
      text.includes('ready to submit') ||
      text.includes('are you sure you want to submit') ||
      text.includes('sẵn sàng nộp bài') ||
      text.includes('xác nhận nộp')
    );
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    // Leo lên thẻ cha bao bọc cả header lẫn button của modal
    let modalBox = candidates[0];
    while (modalBox && modalBox !== document.body && modalBox.querySelectorAll('button').length < 2) {
      modalBox = modalBox.parentElement;
    }

    if (modalBox) {
      const modalBtns = Array.from(modalBox.querySelectorAll('button, [role="button"]'));
      const submitBtn = modalBtns.find(b => {
        if (originalSubmitBtn && (b === originalSubmitBtn || originalSubmitBtn.contains(b))) return false;
        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
        const t = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (t.includes('cancel') || t.includes('hủy') || t.includes('back')) return false;
        return t.includes('submit') || t.includes('nộp') || t.includes('confirm') || t.includes('yes');
      });
      if (submitBtn) return submitBtn;
    }
  }

  // Chiến lược 3: Tìm bất kỳ button nào có chữ "Submit" hiển thị trên trang mà KHÁC originalSubmitBtn
  const allSubmitBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
    if (b.closest('#coursera-helper-hud, header, nav')) return false;
    if (originalSubmitBtn && (b === originalSubmitBtn || originalSubmitBtn.contains(b))) return false;
    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
    if (b.offsetWidth === 0 || b.offsetHeight === 0) return false;
    const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
    if (txt.includes('cancel') || txt.includes('draft') || txt.includes('nháp') || txt.includes('back')) return false;
    return (
      txt === 'submit' ||
      txt === 'submit assignment' ||
      txt === 'yes, submit' ||
      txt === 'nộp bài' ||
      txt.includes('submit') ||
      txt.includes('nộp')
    );
  });

  // Nút submit trong modal thường xuất hiện sau cùng trên DOM
  if (allSubmitBtns.length > 0) {
    return allSubmitBtns[allSubmitBtns.length - 1];
  }

  return null;
}

export async function completeHonorCodeAndSubmitQuiz() {
  // 1. Kiểm tra an toàn: Nếu còn bất kỳ câu nào chưa trả lời, dừng nộp ngay lập tức để bảo vệ điểm số
  const containers = getQuestionContainers();
  if (!containers || containers.length === 0) {
    showInPageToast('❌ Không tìm thấy câu hỏi trắc nghiệm nào trên trang! Tuyệt đối không nộp bài.', true, 8000);
    return false;
  }

  const unansweredList = [];
  containers.forEach((c, idx) => {
    if (!isQuestionContainerAnswered(c)) {
      const txt = c.innerText || '';
      const m = txt.match(/(?:Question\s+(\d+)|\b(\d+)\.|\bCâu\s+(\d+))/i);
      const qNum = m ? parseInt(m[1] || m[2] || m[3], 10) : (idx + 1);
      unansweredList.push({ qNum, container: c });
    }
  });

  const bodyText = document.body.innerText || '';
  const hasUnansweredWarning = bodyText.includes("haven't answered this question") ||
                               bodyText.includes("You haven't answered") ||
                               bodyText.includes("chưa trả lời câu hỏi này");

  if (unansweredList.length > 0 || hasUnansweredWarning) {
    const qNames = unansweredList.map(u => u.qNum).join(', ');
    showInPageToast(`⛔ [CHƯA XONG] Còn câu ${qNames || 'chưa chọn đáp án'}! Tuyệt đối không được nộp bài khi chưa làm xong!`, true, 8000);
    if (unansweredList.length > 0 && unansweredList[0].container) {
      unansweredList[0].container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      unansweredList[0].container.style.outline = '3px solid #ef4444';
    }
    return false;
  }

  showInPageToast('📝 Đang xác nhận Coursera Honor Code...');

  // Cuộn xuống cuối trang
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await sleep(600);

  // 2. Kích hoạt ô Honor Code
  let isTicked = await tickHonorCodeAgreement();
  if (isTicked) {
    showInPageToast('✅ Đã tích chọn Coursera Honor Code!');
  } else {
    showInPageToast('⏳ Đang mở khóa Honor Code...', false, 2000);
  }

  // 3. Chờ nút Submit chuyển từ disabled sang enabled
  showInPageToast('🔍 Đang kiểm tra nút Submit...');
  let submitBtn = null;
  for (let attempts = 0; attempts < 25; attempts++) {
    submitBtn = findQuizSubmitButton(true);
    if (submitBtn) break;

    if (attempts === 5 || attempts === 12 || attempts === 18) {
      await tickHonorCodeAgreement();
    }
    await sleep(300);
  }

  if (!submitBtn) {
    submitBtn = findQuizSubmitButton(false);
  }

  if (!submitBtn) {
    showInPageToast('⚠️ Không tìm thấy nút Nộp bài trên trang Quiz! Vui lòng nộp bằng tay.', true, 6000);
    return false;
  }

  // 4. Bấm nút Submit lần 1
  submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(400);

  submitBtn.style.outline = '3px solid #22c55e';
  submitBtn.style.boxShadow = '0 0 16px rgba(34, 197, 94, 0.6)';

  triggerClick(submitBtn);
  try { submitBtn.click(); } catch (e) {}

  showInPageToast('🚀 Đã bấm nút Submit! Đang chờ popup xác nhận...', false, 3000);

  // 5. Chờ popup/modal xác nhận xuất hiện ("Ready to submit?") và TỰ ĐỘNG BẤM XÁC NHẬN LẦN 2
  showInPageToast('⏳ Đang chờ xác nhận "Ready to submit?"...', false, 4000);
  let confirmBtn = null;

  for (let i = 0; i < 80; i++) {
    await sleep(300);
    confirmBtn = findSubmitConfirmButton(submitBtn);
    if (confirmBtn) break;
  }

  if (confirmBtn) {
    confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200);

    confirmBtn.style.outline = '3px solid #3b82f6';
    confirmBtn.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.85)';

    // Kích hoạt click đầy đủ SyntheticEvent + native click
    triggerClick(confirmBtn);
    try {
      confirmBtn.click();
    } catch (e) {}

    showInPageToast('🎉 ĐÃ BẤM XÁC NHẬN SUBMIT MODAL THÀNH CÔNG! Đang nộp bài...', false, 4000);
    await sleep(1000);
    return true;
  } else {
    // Dự phòng tìm lại lần nữa
    await sleep(600);
    confirmBtn = findSubmitConfirmButton(submitBtn);
    if (confirmBtn) {
      triggerClick(confirmBtn);
      try { confirmBtn.click(); } catch (e) {}
      showInPageToast('🎉 Đã bấm xác nhận Submit modal thành công!');
      return true;
    }
  }

  return true;
}
