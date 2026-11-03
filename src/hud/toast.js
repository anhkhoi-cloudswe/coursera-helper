// src/hud/toast.js
// In-page Toast notification system

export function showInPageToast(msg, isError = false, duration = 3500) {
  let toast = document.getElementById('ch-inline-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ch-inline-toast';
    toast.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'z-index: 2147483647',
      'background: rgba(15, 23, 42, 0.94)',
      'color: #ffffff',
      'padding: 12px 18px',
      'border-radius: 8px',
      'font-size: 13px',
      'font-weight: 500',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      'backdrop-filter: blur(8px)',
      'transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      'max-width: 420px',
      'line-height: 1.4',
      'pointer-events: none',
      'opacity: 0',
      'transform: translateY(10px)'
    ].join(';');
    document.body.appendChild(toast);
  }

  toast.innerText = msg;
  if (isError) {
    toast.style.borderLeft = '4px solid #ef4444';
    toast.style.boxShadow = '0 10px 25px -5px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(239, 68, 68, 0.2)';
  } else {
    toast.style.borderLeft = '4px solid #10b981';
    toast.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(16, 185, 129, 0.2)';
  }

  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(window._chToastTimeout);
  window._chToastTimeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }
  }, duration);
}
