// src/quiz/extractor.js
// DOM quiz question & option extraction, image conversion, lazy load handling

import { isHonorCodeOrPolicyElement, getQuestionContainers } from './containers.js';
import { cleanCourseraQuiz } from '../ai/prompt.js';

export function extractOptionPureText(el) {
  if (!el) return '';
  const contentEl = el.querySelector('.cds-checkboxAndRadio-labelContent, [data-testid="option-label"], .rc-Option__inputImageText') || el;
  let text = (contentEl.innerText || contentEl.textContent || '').trim();
  text = text
    .replace(/Do you understand\?\.?\s*I understand\.?/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*points?\b/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

export async function extractImageBase64(imgEl) {
  if (!imgEl) return null;
  const src = imgEl.currentSrc || imgEl.src;
  if (!src) return null;

  if (src.startsWith('data:image/')) {
    const parts = src.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    return {
      mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
      data: parts[1]
    };
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const parts = dataUrl.split(',');
          resolve({
            mimeType: 'image/jpeg',
            data: parts[1]
          });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch (e) {
      resolve(null);
    }
  });
}

export async function ensureAllQuizQuestionsLoaded() {
  const scrollContainer = document.querySelector('.cds-FullscreenDialog-scrollContainer') ||
                          document.querySelector('[data-testid="quiz-dialog-scroll-container"]') ||
                          window;

  const getScrollHeight = () => scrollContainer === window
    ? (document.documentElement.scrollHeight || document.body.scrollHeight)
    : scrollContainer.scrollHeight;

  const scrollToY = (y) => {
    if (scrollContainer === window) {
      window.scrollTo({ top: y, behavior: 'instant' });
    } else {
      scrollContainer.scrollTop = y;
    }
  };

  const initialTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
  const totalHeight = getScrollHeight();
  const step = Math.max(window.innerHeight * 0.75, 400);

  for (let y = 0; y < totalHeight; y += step) {
    scrollToY(y);
    await new Promise(r => setTimeout(r, 60));
  }
  scrollToY(getScrollHeight());
  await new Promise(r => setTimeout(r, 120));

  scrollToY(initialTop);
  await new Promise(r => setTimeout(r, 80));
}

export async function extractAllQuizQuestionsFromDOM() {
  await ensureAllQuizQuestionsLoaded();

  const containers = getQuestionContainers();
  const questions = [];

  for (let i = 0; i < containers.length; i++) {
    const container = containers[i];
    if (isHonorCodeOrPolicyElement(container)) continue;

    // Xác định số câu hỏi
    const cText = (container.innerText || container.textContent || '').trim();
    let qNum = i + 1;
    const numMatch = cText.match(/^(?:Question\s*(\d+)|\b(\d+)\.|\bCâu\s*(\d+))/i);
    if (numMatch) {
      qNum = parseInt(numMatch[1] || numMatch[2] || numMatch[3], 10);
    }

    // Xác định loại câu hỏi
    const hasRadio = !!container.querySelector('input[type="radio"], [role="radio"]');
    const hasCheckbox = !!container.querySelector('input[type="checkbox"]:not(#agreement-checkbox-base), [role="checkbox"]');
    const isMultiExplicit = /select (all|two|three|\d)|choose (all|two|three|\d)|which (two|three|\d)|multiple answers/i.test(cText);
    const type = hasCheckbox || isMultiExplicit ? 'checkbox' : 'radio';

    // Bóc tách thân câu hỏi (prompt)
    let promptEl = container.querySelector('[data-testid="prompt-text"], .rc-FormPartsQuestion__contentCell, .rc-FormPartsQuestion__title, legend, h3, h4');
    let promptText = promptEl ? (promptEl.innerText || promptEl.textContent || '') : cText;
    promptText = cleanCourseraQuiz(promptText);

    // Bóc tách hình ảnh trong câu hỏi
    const images = [];
    const imgEls = Array.from(container.querySelectorAll('img')).filter(img => {
      const src = img.src || '';
      return !src.includes('avatar') && !src.includes('icon') && (img.width > 30 || img.naturalWidth > 30);
    });
    for (const img of imgEls) {
      const imgData = await extractImageBase64(img);
      if (imgData) images.push(imgData);
    }

    // Bóc tách options
    const optEls = Array.from(container.querySelectorAll(
      'label.cds-checkboxAndRadio-label, label, [role="radio"], [role="checkbox"], li.rc-Option'
    )).filter(el => !isHonorCodeOrPolicyElement(el))
      .filter((el, idx, arr) => !arr.some(other => other !== el && other.contains(el)));

    const options = [];
    for (const el of optEls) {
      const optText = extractOptionPureText(el);
      if (!optText && !el.querySelector('img')) continue;

      let optImg = null;
      const optImgEl = el.querySelector('img');
      if (optImgEl) {
        optImg = await extractImageBase64(optImgEl);
      }

      options.push({
        text: optText,
        image: optImg,
        element: el
      });
    }

    // Kiểm tra câu hỏi này người dùng đã chọn đáp án chưa
    let userSelectedAnswer = '';
    const checkedInput = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:not(#agreement-checkbox-base):checked');
    if (checkedInput) {
      const checkedLabel = checkedInput.closest('label') || checkedInput.parentElement;
      userSelectedAnswer = extractOptionPureText(checkedLabel);
    }

    // Kiểm tra feedback từ lần submit trước (nếu làm lại)
    let prevFeedback = '';
    let prevWrongAnswer = '';
    let prevCorrectAnswer = '';
    const incorrectBanner = container.querySelector('[class*="incorrect"], [class*="Incorrect"], [aria-label*="Incorrect"], [data-testid*="incorrect"]');
    if (incorrectBanner) {
      prevFeedback = (incorrectBanner.innerText || '').trim();
      if (userSelectedAnswer) prevWrongAnswer = userSelectedAnswer;
    }
    const correctBanner = container.querySelector('[class*="correct"], [class*="Correct"], [aria-label*="Correct"], [data-testid*="correct"]');
    if (correctBanner && !incorrectBanner) {
      prevCorrectAnswer = userSelectedAnswer;
    }

    if (options.length > 0) {
      questions.push({
        q: qNum,
        text: promptText,
        type,
        options,
        images,
        userSelectedAnswer,
        prevFeedback,
        prevWrongAnswer,
        prevCorrectAnswer,
        container
      });
    }
  }

  return questions;
}

