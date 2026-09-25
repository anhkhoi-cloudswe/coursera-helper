// Coursera Helper — Background Service Worker
// Quản lý Side Panel hoàn toàn độc lập theo từng Tab (Strict Tab Isolation)
// Khi mở Side Panel ở Tab A, chỉ Tab A hiển thị. Khi chuyển sang Tab B, Side Panel tự động biến mất!

// Tập hợp lưu danh sách các tabId đang được người dùng chủ động mở Side Panel
const activeSidePanelTabs = new Set();

// 1. Tắt Side Panel mặc định trên toàn bộ tab khi Extension khởi động
async function initTabSidePanels() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        await chrome.sidePanel.setOptions({
          tabId: tab.id,
          enabled: false
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Init side panel error:", err);
  }
}

// Khởi chạy khi cài đặt hoặc reload extension
chrome.runtime.onInstalled.addListener(async () => {
  await initTabSidePanels();

  // Tự động nạp lại content.js vào các tab Coursera đang mở
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

// Khởi chạy khi service worker thức dậy
chrome.runtime.onStartup.addListener(() => {
  initTabSidePanels();
});

// 2. Khi tạo tab mới: Mặc định tắt Side Panel trên tab mới
chrome.tabs.onCreated.addListener((tab) => {
  if (tab && tab.id) {
    chrome.sidePanel.setOptions({
      tabId: tab.id,
      enabled: false
    }).catch(() => {});
  }
});

// 3. Khi đóng tab: Xóa tabId khỏi danh sách đang mở
chrome.tabs.onRemoved.addListener((tabId) => {
  activeSidePanelTabs.delete(tabId);
});

// 4. Khi người dùng CHUYỂN TAB (Tab Switch):
// Nếu tab đích có trong danh sách -> Bật Side Panel
// Nếu tab đích KHÔNG có trong danh sách -> Tắt Side Panel (Tự động biến mất ngay lập tức!)
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    if (activeSidePanelTabs.has(tabId)) {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      });
    } else {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
    }
  } catch (e) {}
});

// 5. Khi người dùng CLICK VÀO BIỂU TƯỢNG EXTENSION:
// Bật/Tắt Side Panel riêng cho Tab hiện tại
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  if (activeSidePanelTabs.has(tab.id)) {
    // Nếu đang mở mà bấm lại icon -> Đóng Side Panel trên tab này
    activeSidePanelTabs.delete(tab.id);
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      enabled: false
    }).catch(() => {});
  } else {
    // Nếu chưa mở -> Kích hoạt và mở Side Panel chỉ riêng trên tab này
    activeSidePanelTabs.add(tab.id);
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel.html',
      enabled: true
    }).catch(() => {});
    await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});

// 6. Lắng nghe yêu cầu mở Side Panel từ Content Script (khi bấm nút trên HUD nổi Coursera)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_side_panel") {
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      activeSidePanelTabs.add(tabId);
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
