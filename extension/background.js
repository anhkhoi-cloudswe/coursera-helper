// Coursera Helper — Background Service Worker
// Tự động mở Side Panel cố định khi người dùng bấm vào biểu tượng Extension

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Lỗi cấu hình Side Panel:", error));

// Lắng nghe yêu cầu từ content script nếu có
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_side_panel") {
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
  }
  return true;
});
