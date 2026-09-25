// Coursera Helper — Background Service Worker
// Quản lý Side Panel độc lập theo từng Tab (Per-Tab Isolation)
// Chỉ hiển thị trên tab Coursera, khi chuyển sang tab khác Side Panel tự động ẩn

// 1. Cấu hình hành vi click icon mở Side Panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Lỗi cấu hình Side Panel:", error));

// 2. Hàm kích hoạt Side Panel chỉ riêng trên Tab Coursera, vô hiệu hóa trên tab khác
async function configureTabSidePanel(tabId, url) {
  if (!tabId) return;
  const isCoursera = url && (
    url.includes('coursera.org') || 
    url.startsWith('https://www.coursera.org') || 
    url.startsWith('https://coursera.org')
  );

  try {
    if (isCoursera) {
      // Tab Coursera: Bật Side Panel riêng cho tab này
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      });
    } else {
      // Tab khác: Tắt Side Panel để không hiển thị khi user chuyển tab
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
    }
  } catch (err) {
    // Bỏ qua nếu tab đã bị đóng
  }
}

// 3. Lắng nghe khi tab tải trang hoặc chuyển hướng URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    configureTabSidePanel(tabId, tab.url || changeInfo.url);
  }
});

// 4. Lắng nghe khi người dùng chuyển qua lại giữa các tab (Tab Switch / Activation)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.id) {
      await configureTabSidePanel(tab.id, tab.url);
    }
  } catch (e) {}
});

// 5. Lắng nghe yêu cầu mở Side Panel từ Content Script nếu có
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

// 6. Khởi tạo cấu hình cho tất cả các tab khi Extension khởi động / nạp lại
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
      if (tab.id) {
        configureTabSidePanel(tab.id, tab.url);
      }
    }

    // Tự động nạp lại content.js vào các tab Coursera đang mở
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
