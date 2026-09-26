// Coursera Helper — Background Service Worker
// Tab-Specific Side Panel (Bấm 1 lần mở ngay, Tab nào ra tab đó, chuyển sang tab khác tự động ẩn)

const openSidePanelTabs = new Set();

// 1. Tự động mở Side Panel khi người dùng click vào icon Extension trên thanh công cụ Chrome
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
  console.warn("setPanelBehavior not supported or failed:", err);
});

// Fallback listener nếu browser cần mở qua programmatic call
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error("Lỗi mở Side Panel:", err);
  }
});

// 2. Khi tab bị đóng: Xóa tabId khỏi danh sách theo dõi
chrome.tabs.onRemoved.addListener((tabId) => {
  openSidePanelTabs.delete(tabId);
});

// 3. Lắng nghe yêu cầu từ Content Script / Injected Script
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

  // Lấy thông tin xác thực Coursera trực tiếp từ Cookie trình duyệt (kể cả HttpOnly)
  if (request.action === "get_coursera_auth") {
    (async () => {
      try {
        const cookies = await chrome.cookies.getAll({ domain: 'coursera.org' });
        let csrf = '';
        let userId = '';
        let cauth = '';

        for (const c of cookies) {
          const name = c.name.toLowerCase();
          if (name === 'csrf3-token' || name === 'csrf2-token' || name === 'csrf-token') {
            csrf = c.value;
          } else if (name === 'cauth') {
            cauth = c.value;
          }
        }

        // 1. Gọi trực tiếp endpoint adminUserPermissions.v1?q=my (chuẩn xác 100% của Coursera để lấy numeric user ID)
        try {
          const adminRes = await fetch('https://www.coursera.org/api/adminUserPermissions.v1?q=my', {
            headers: {
              'Accept': 'application/json',
              'x-csrf3-token': csrf,
              'x-requested-with': 'XMLHttpRequest'
            },
            credentials: 'include'
          });
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            const uid = adminData?.elements?.[0]?.id;
            if (uid) userId = String(uid);
          }
        } catch (e) {}

        console.log('[CourseraHelper-BG] Auth resolved:', { userId, csrf: !!csrf, cauth: !!cauth });

        sendResponse({ success: true, userId, csrf, cauth });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Asynchronous response
  }

  // Hoàn thành video trực tiếp từ Service Worker (không bị cản trở bởi DOM context)
  if (request.action === "complete_video_via_background") {
    (async () => {
      try {
        const { userId, courseId, slug, itemId, trackingId, viewedUpToMs, canSkip } = request;
        const cookies = await chrome.cookies.getAll({ domain: 'coursera.org' });
        let csrf = '';
        for (const c of cookies) {
          const name = c.name.toLowerCase();
          if (name === 'csrf3-token' || name === 'csrf2-token' || name === 'csrf-token') {
            csrf = c.value;
            break;
          }
        }

        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'x-coursera-application': 'ondemand',
          'x-requested-with': 'XMLHttpRequest'
        };
        if (csrf) {
          headers['x-csrf3-token'] = csrf;
          headers['x-csrf2-token'] = csrf;
        }

        if (canSkip) {
          await fetch(`https://www.coursera.org/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ contentRequestBody: {} })
          }).catch(() => {});
        } else {
          // 3-step completion flow
          await fetch(`https://www.coursera.org/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/play?autoEnroll=false`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ contentRequestBody: {} })
          }).catch(() => {});

          await fetch(`https://www.coursera.org/api/onDemandVideoProgresses.v1/${userId}~${courseId}~${trackingId}`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              videoProgressId: `${userId}~${courseId}~${trackingId}`,
              viewedUpTo: viewedUpToMs
            })
          }).catch(() => {});

          await fetch(`https://www.coursera.org/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ contentRequestBody: {} })
          }).catch(() => {});
        }

        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
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
