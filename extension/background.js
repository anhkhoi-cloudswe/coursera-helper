// Coursera Helper — Background Service Worker
// Best Practice: Tab-Specific Side Panel
// Mở Side Panel gắn liền với Tab hiện tại, tự động ẩn khi người dùng chuyển sang tab khác

// 1. Khi người dùng click vào biểu tượng Extension ở bất kỳ tab nào,
// mở Side Panel RIÊNG cho Tab đó (Tab-Specific Scope)
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.error("Không thể mở Side Panel cho tab:", tab.id, err);
    }
  }
});

// 2. Lắng nghe yêu cầu mở Side Panel từ Content Script (khi người dùng bấm nút trên HUD nổi Coursera)
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

// 3. Tự động nạp lại content.js vào các tab Coursera đang mở khi tiện ích được Reload / Cập nhật
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const courseraTabs = await chrome.tabs.query({ url: ['*://*.coursera.org/*', '*://coursera.org/*'] });
    for (const tab of courseraTabs) {
      if (tab.id && !tab.url.startsWith('chrome://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch((e) => console.warn('Auto re-injection skipped for tab:', tab.id, e.message));
      }
    }
  } catch (err) {
    console.warn('Init tabs warning:', err);
  }
});
