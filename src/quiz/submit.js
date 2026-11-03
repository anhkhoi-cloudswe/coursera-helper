// src/quiz/submit.js
// Honor Code agreement, quiz submission, and 2-step modal confirmation

import { showInPageToast } from '../hud/toast.js';
import { triggerClick, sleep } from '../utils/dom.js';
import { getQuestionContainers, isQuestionContainerAnswered } from './containers.js';

export function isHonorCodeChecked(checkbox) {
  if (!checkbox) return false;
  if (checkbox.checked) return true;
  if (checkbox.getAttribute('aria-checked') === 'true') return true;
  const parent = checkbox.closest('label') || checkbox.parentElement;
  if (parent && (parent.classList.contains('cds-checkboxAndRadio-checked') || parent.getAttribute('aria-checked') === 'true')) {
    return true;
  }
  return false;
}

export function tickHonorCodeAgreement() {
  const checkbox = document.querySelector('#agreement-checkbox-base') ||
                   document.querySelector('input[type="checkbox"][id*="agreement"]') ||
                   document.querySelector('input[type="checkbox"][name*="agreement"]') ||
                   document.querySelector('[data-testid*="honor-code"] input[type="checkbox"]');

  if (!checkbox) {
    const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    for (const chk of allCheckboxes) {
      const parentText = (chk.closest('label, div')?.innerText || '').toLowerCase();
      if (parentText.includes('understand and agree') || parentText.includes('honor code') || parentText.includes('confirm this work is your own')) {
        return tickCheckboxElement(chk);
      }
    }
    return false;
  }

  return tickCheckboxElement(checkbox);
}

function tickCheckboxElement(checkbox) {
  if (isHonorCodeChecked(checkbox)) return true;

  const label = checkbox.closest('label') || checkbox.parentElement;

  // Cuộn vào tầm nhìn
  try {
    (label || checkbox).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {}

  // Click trực tiếp
  try { checkbox.click(); } catch (e) {}
  if (label && !isHonorCodeChecked(checkbox)) {
    try { label.click(); } catch (e) {}
  }

  // React synthetic click
  if (!isHonorCodeChecked(checkbox)) {
    triggerClick(checkbox);
    if (label && !isHonorCodeChecked(checkbox)) triggerClick(label);
  }

  // Prototype setter cho React
  if (!isHonorCodeChecked(checkbox)) {
    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
      if (setter) {
        setter.call(checkbox, true);
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {}
  }

  return isHonorCodeChecked(checkbox);
}

export function findQuizSubmitButton() {
  const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
  const submitBtn = buttons.find(b => {
    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
    const isSaveDraft = text.includes('draft') || text.includes('lưu nháp');
    const isBack = text.includes('back') || text.includes('quay lại');
    const isSubmit = text === 'submit' || text === 'nộp bài' || text.startsWith('submit ') || text.includes('submit assignment');
    const isVisible = b.offsetWidth > 0 && b.offsetHeight > 0;
    return isSubmit && !isSaveDraft && !isBack && isVisible && !b.disabled;
  });
  return submitBtn || null;
}

export function findSubmitConfirmButton() {
  const dialog = document.querySelector('[role="dialog"], [role="alertdialog"], .cds-Modal-container, .rc-ModalDialog, div[data-testid*="modal"]');
  if (!dialog) return null;

  const buttons = Array.from(dialog.querySelectorAll('button, a[role="button"]'));
  const confirmBtn = buttons.find(b => {
    const text = (b.innerText || b.textContent || '').trim().toLowerCase();
    const isCancel = text.includes('cancel') || text.includes('hủy') || text.includes('back') || text.includes('quay lại');
    const isConfirm = text.includes('submit') || text.includes('nộp') || text.includes('yes') || text.includes('đồng ý') || text.includes('confirm') || text.includes('xác nhận');
    return isConfirm && !isCancel && b.offsetWidth > 0 && !b.disabled;
  });

  return confirmBtn || null;
}

export async function completeHonorCodeAndSubmitQuiz() {
  // 1. Kiểm tra an toàn: Nếu còn bất kỳ câu nào chưa trả lời, dừng nộp ngay lập tức để bảo vệ điểm số
  const containers = getQuestionContainers();
  const unansweredContainers = containers.filter(c => !isQuestionContainerAnswered(c));
  if (unansweredContainers.length > 0) {
    showInPageToast(`⛔ Dừng nộp bài: Còn ${unansweredContainers.length} câu chưa có đáp án!`, true, 6000);
    return false;
  }

  // 2. Tick Honor Code Agreement
  const agreed = tickHonorCodeAgreement();
  if (agreed) {
    showInPageToast('✅ Đã tự động cam kết Coursera Honor Code!');
    await sleep(400);
  }

  // 3. Tìm và click nút Submit lần 1
  const submitBtn = findQuizSubmitButton();
  if (!submitBtn) {
    showInPageToast('⚠️ Không tìm thấy nút Nộp bài trên trang Quiz!', true);
    return false;
  }

  submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(300);
  triggerClick(submitBtn);
  try { submitBtn.click(); } catch (e) {}

  showInPageToast('🚀 Đã bấm Nộp bài! Đang kiểm tra hộp thoại xác nhận...');

  // 4. Xử lý Modal Popup xác nhận lần thứ hai (Coursera 2-step submit confirmation modal)
  for (let wait = 0; wait < 15; wait++) {
    await sleep(400);
    const modalConfirmBtn = findSubmitConfirmButton();
    if (modalConfirmBtn) {
      modalConfirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(200);
      triggerClick(modalConfirmBtn);
      try { modalConfirmBtn.click(); } catch (e) {}
      showInPageToast('🎉 Đã xác nhận nộp bài trong hộp thoại thành công!');
      return true;
    }
  }

  return true;
}
