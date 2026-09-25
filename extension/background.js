// Coursera Helper — Background Service Worker
// Tab-Specific Side Panel (Bấm 1 lần mở ngay, Tab nào ra tab đó, chuyển sang tab khác tự động ẩn)

const openSidePanelTabs = new Set();

// 1. Khi người dùng click vào icon Extension:
// Bấm 1 LẦN ăn ngay -> Mở / Đóng Side Panel chỉ riêng cho Tab hiện tại
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  const tabId = tab.id;

  if (openSidePanelTabs.has(tabId)) {
    // Nếu đang mở trên tab này -> Bấm lần nữa để đóng Side Panel
    openSidePanelTabs.delete(tabId);
    try {
      await chrome.sidePanel.setOptions({ tabId: tabId, enabled: false });
    } catch (e) {}
  } else {
    // Nhấn 1 LẦN ăn ngay: Kích hoạt & Mở Side Panel riêng cho Tab hiện tại
    openSidePanelTabs.add(tabId);
    try {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      });
      await chrome.sidePanel.open({ tabId: tabId });
    } catch (err) {
      console.error("Lỗi mở Side Panel:", err);
    }
  }
});

// 2. Khi tab bị đóng: Xóa tabId khỏi danh sách theo dõi
chrome.tabs.onRemoved.addListener((tabId) => {
  openSidePanelTabs.delete(tabId);
});

// 3. Lắng nghe yêu cầu mở Side Panel từ Content Script (khi bấm nút trên HUD nổi Coursera)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_side_panel") {
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      openSidePanelTabs.add(tabId);
      chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      }).then(() => {
        return chrome.sidePanel.open({ tabId: tabId });
      }).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // Asynchronous response
    }
  }
  return false;
});

// 4. Tự động nạp lại content.js vào các tab Coursera đang mở khi tiện ích được Reload / Cập nhật
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
