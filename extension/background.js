// Coursera Helper — Background Service Worker
// Tự động mở Side Panel cố định khi người dùng bấm vào biểu tượng Extension

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Lỗi cấu hình Side Panel:", error));

// Lắng nghe yêu cầu từ content script nếu có
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_side_panel") {
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id })
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Asynchronous response
    }
  }
  return false;
});

// Tự động nạp lại content.js vào các tab Coursera đang mở khi người dùng bấm Tải lại (Reload) Extension
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ['*://*.coursera.org/*', '*://coursera.org/*'] });
    for (const tab of tabs) {
      if (tab.id && !tab.url.startsWith('chrome://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch((e) => console.warn('Auto re-injection skipped for tab:', tab.id, e.message));
      }
    }
  } catch (err) {
    console.warn('Auto-inject on reload warning:', err);
  }
});

