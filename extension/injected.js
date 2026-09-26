// Coursera Helper - Main World Injection Script
// Runs in the MAIN world to directly access Coursera's player, DOM, and React Fiber
// Key: Extract userId & courseId, execute 3-step backend completion via Main World fetch, and update React state

(function() {
  if (window.__COURSERA_HELPER_INJECTED__) return;
  window.__COURSERA_HELPER_INJECTED__ = true;

  console.log('[CourseraHelper] Main-world engine v4 initialized.');

  const unlockedSet = new WeakSet();

  // === Helper: Trích xuất CSRF Token từ Cookie trang chính (Main World) ===
  function getCookieCsrf() {
    try {
      const parts = document.cookie.split(';');
      for (let i = 0; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (!k || !v) continue;
        const key = k.trim().toLowerCase();
        if (key === 'csrf3-token' || key === 'csrf2-token' || key === 'csrf-token' || key === 'csrf') {
          return decodeURIComponent(v.trim());
        }
      }
    } catch (e) {}
    return '';
  }

  // === Helper: Trích xuất User ID từ Cookie trang chính (Main World) ===
  function getCookieUserId() {
    try {
      const parts = document.cookie.split(';');
      for (let i = 0; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (!k || !v) continue;
        const key = k.trim().toLowerCase();
        if (key === '__204u') {
          const m = v.trim().match(/^(\d{5,})/);
          if (m) return m[1];
        } else if (key === 'cauth') {
          try {
            const dec = decodeURIComponent(v.trim());
            const m = dec.match(/"id"\s*:\s*(\d+)/);
            if (m) return m[1];
          } catch (e) {}
        }
      }
    } catch (e) {}
    return '';
  }

  // === Helper: Trích xuất ngữ cảnh Coursera (userId, courseId, trackingId) ===
  function extractCourseraContext() {
    const ds = document.documentElement.dataset;
    let userId = ds.chUserId || '';
    let courseId = ds.chCourseId || '';
    let trackingId = ds.chTrackingId || '';
    let csrf = ds.chCsrf || getCookieCsrf();

    if (!csrf) csrf = getCookieCsrf();
    if (csrf) ds.chCsrf = csrf;

    // 1. Thử lấy userId từ Cookie (__204u hoặc CAUTH)
    if (!userId) {
      userId = getCookieUserId();
    }

    // 2. Thử lấy từ window.App / Flux Stores
    if (!userId && window.App?.context?.dispatcher?.stores) {
      const stores = window.App.context.dispatcher.stores;
      userId = stores.ApplicationStore?.userData?.id || stores.UserStore?.currentUserId || '';
      if (userId) userId = String(userId);
    }

    // 3. Thử lấy từ window.__PRELOADED_STATE__
    if (!userId && window.__PRELOADED_STATE__) {
      try {
        const s = JSON.stringify(window.__PRELOADED_STATE__);
        const m = s.match(/"userId"\s*:\s*"?(\d{5,})"?/) || s.match(/"id"\s*:\s*(\d{6,})/);
        if (m) userId = m[1];
      } catch (e) {}
    }

    // 4. Trích xuất từ React Fiber trên phần tử video
    const video = document.querySelector('video');
    if (video) {
      try {
        const fk = Object.keys(video).find(k => k.startsWith('__reactFiber'));
        let cur = fk ? video[fk] : null;
        let d = 0;
        while (cur && d < 50) {
          if (cur.memoizedProps) {
            const p = cur.memoizedProps;
            if (!userId && p.userId) userId = String(p.userId);
            if (!userId && p.user?.id) userId = String(p.user.id);
            if (!courseId && p.courseId) courseId = String(p.courseId);
            if (!trackingId && p.trackingId) trackingId = String(p.trackingId);
            if (!trackingId && p.videoId) trackingId = String(p.videoId);
          }
          cur = cur.return;
          d++;
        }
      } catch (e) {}
    }

    // 5. Lưu vào dataset để Content Script (Isolated World) có thể đọc tức thì
    if (userId) ds.chUserId = userId;
    if (courseId) ds.chCourseId = courseId;
    if (trackingId) ds.chTrackingId = trackingId;

    return { userId, courseId, trackingId, csrf };
  }

  // Định kỳ cập nhật ngữ cảnh Coursera
  setInterval(extractCourseraContext, 1000);
  extractCourseraContext();

  // === CORE: Gỡ bỏ khóa tua seek-lock trên phần tử video ===
  function addSeekBypassListeners(v) {
    if (unlockedSet.has(v)) return;
    unlockedSet.add(v);

    v.addEventListener('seeking', function(e) {
      if (v._ch_allow_seek) e.stopImmediatePropagation();
    }, { capture: true, passive: false });

    v.addEventListener('seeked', function(e) {
      if (v._ch_allow_seek) e.stopImmediatePropagation();
    }, { capture: true, passive: false });

    patchReactFiber(v);
  }

  // Mở khóa React Fiber props
  function patchReactFiber(video) {
    try {
      const fiberKey = Object.keys(video).find(k => k.startsWith('__reactFiber'));
      let cur = fiberKey ? video[fiberKey] : null;
      let depth = 0;
      while (cur && depth < 40) {
        if (cur.memoizedProps) {
          if ('maxWatchedTime' in cur.memoizedProps) cur.memoizedProps.maxWatchedTime = 9999999;
          if ('disableSeeking' in cur.memoizedProps) cur.memoizedProps.disableSeeking = false;
          if (cur.memoizedProps.playbackRestrictions) {
            cur.memoizedProps.playbackRestrictions.allowFastForward = true;
            cur.memoizedProps.playbackRestrictions.isLocked = false;
            cur.memoizedProps.playbackRestrictions.disableSeeking = false;
          }
        }
        if (cur.memoizedState && typeof cur.memoizedState === 'object') {
          if ('maxWatchedTime' in cur.memoizedState) cur.memoizedState.maxWatchedTime = 9999999;
        }
        cur = cur.return;
        depth++;
      }
    } catch (e) {}
  }

  setInterval(() => {
    document.querySelectorAll('video').forEach(v => {
      addSeekBypassListeners(v);
    });
  }, 800);

  // === QUY TRÌNH HOÀN THÀNH VIDEO QUA API TRỰC TIẾP TRONG MAIN WORLD ===
  async function performMainWorldCompletion(slug, itemId) {
    const ctx = extractCourseraContext();
    let userId = ctx.userId;
    let courseId = ctx.courseId;
    let trackingId = ctx.trackingId || itemId;
    let csrf = ctx.csrf || getCookieCsrf();

    console.log('[CourseraHelper-Main] performMainWorldCompletion start:', { slug, itemId, userId, courseId, trackingId, csrf: !!csrf });

    // Fallback 1: Nếu chưa có userId, gọi API người dùng
    if (!userId) {
      try {
        const uRes = await fetch('/api/userPreferences.v1?q=my', {
          headers: { 'Accept': 'application/json', 'x-csrf3-token': csrf, 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include'
        });
        if (uRes.ok) {
          const uData = await uRes.json();
          userId = uData?.elements?.[0]?.id || '';
        }
      } catch (e) {}
    }
    if (!userId) {
      try {
        const uRes = await fetch('/api/adminUserPermissions.v1?q=my', {
          headers: { 'Accept': 'application/json', 'x-csrf3-token': csrf, 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include'
        });
        if (uRes.ok) {
          const uData = await uRes.json();
          userId = uData?.elements?.[0]?.id || '';
        }
      } catch (e) {}
    }

    // Fallback 2: Nếu chưa có courseId, gọi API courses hoặc onDemandCourseMaterials
    if (!courseId && slug) {
      try {
        const cRes = await fetch(`/api/onDemandCourseMaterials.v2/?q=slug&slug=${encodeURIComponent(slug)}&fields=id`, {
          headers: { 'Accept': 'application/json', 'x-csrf3-token': csrf, 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include'
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          courseId = cData?.elements?.[0]?.id || '';
        }
      } catch (e) {}
      if (!courseId) {
        try {
          const cRes2 = await fetch(`/api/courses.v1?q=slug&slug=${encodeURIComponent(slug)}&fields=id`, {
            headers: { 'Accept': 'application/json', 'x-csrf3-token': csrf, 'x-requested-with': 'XMLHttpRequest' },
            credentials: 'include'
          });
          if (cRes2.ok) {
            const cData2 = await cRes2.json();
            courseId = cData2?.elements?.[0]?.id || '';
          }
        } catch (e) {}
      }
    }

    if (userId) document.documentElement.dataset.chUserId = userId;
    if (courseId) document.documentElement.dataset.chCourseId = courseId;

    if (!userId || !courseId) {
      console.warn('[CourseraHelper-Main] Cannot resolve userId or courseId:', { userId, courseId });
      return false;
    }

    // Lấy metadata bài giảng video (disableSkippingForward, trackingId, endMs)
    let canSkip = true;
    let durationMs = 1200000;
    try {
      const metaRes = await fetch(`/api/onDemandLectureVideos.v1/${courseId}~${itemId}?includes=video&fields=disableSkippingForward,startMs,endMs`, {
        headers: { 'Accept': 'application/json', 'x-csrf3-token': csrf, 'x-requested-with': 'XMLHttpRequest' },
        credentials: 'include'
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const elem = metaData?.elements?.[0];
        if (elem && elem.disableSkippingForward === true) {
          canSkip = false;
        }
        const tid = metaData?.linked?.['onDemandVideos.v1']?.[0]?.id;
        if (tid) trackingId = tid;
        if (elem?.endMs && elem.endMs > 0) durationMs = elem.endMs;
      }
    } catch (e) {}

    const videoEl = document.querySelector('video');
    if (videoEl && videoEl.duration && !isNaN(videoEl.duration) && isFinite(videoEl.duration) && videoEl.duration > 2) {
      durationMs = Math.ceil(videoEl.duration * 1000);
    }
    const viewedUpToMs = durationMs + 2000;

    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      'Accept': 'application/json, text/plain, */*',
      'x-coursera-application': 'ondemand',
      'x-requested-with': 'XMLHttpRequest'
    };
    if (csrf) {
      headers['x-csrf3-token'] = csrf;
      headers['x-csrf2-token'] = csrf;
    }

    console.log('[CourseraHelper-Main] Executing completion calls:', { canSkip, trackingId, viewedUpToMs });

    if (canSkip) {
      await fetch(`/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ contentRequestBody: {} })
      }).catch(() => {});
    } else {
      // 3-step completion flow chuẩn
      try {
        await fetch(`/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/play?autoEnroll=false`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ contentRequestBody: {} })
        });
      } catch (e) {}

      try {
        const progRes = await fetch(`/api/onDemandVideoProgresses.v1/${userId}~${courseId}~${trackingId}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            videoProgressId: `${userId}~${courseId}~${trackingId}`,
            viewedUpTo: viewedUpToMs
          })
        });
        console.log('[CourseraHelper-Main] onDemandVideoProgresses response status:', progRes.status);
      } catch (e) {}

      try {
        const endRes = await fetch(`/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ contentRequestBody: {} })
        });
        console.log('[CourseraHelper-Main] videoEvents/ended response status:', endRes.status);
      } catch (e) {}
    }

    // Kích hoạt React Fiber completion handlers
    if (videoEl) {
      try {
        const fk = Object.keys(videoEl).find(k => k.startsWith('__reactFiber'));
        let cur = fk ? videoEl[fk] : null;
        let d = 0;
        while (cur && d < 40) {
          if (cur.memoizedProps) {
            if (typeof cur.memoizedProps.onEnded === 'function') {
              try { cur.memoizedProps.onEnded(); } catch (e) {}
            }
            if (typeof cur.memoizedProps.onComplete === 'function') {
              try { cur.memoizedProps.onComplete(); } catch (e) {}
            }
            if (typeof cur.memoizedProps.markCompleted === 'function') {
              try { cur.memoizedProps.markCompleted(); } catch (e) {}
            }
          }
          cur = cur.return;
          d++;
        }
      } catch (e) {}
    }

    return true;
  }

  // === LẮNG NGHE SỰ KIỆN TỪ CONTENT SCRIPT ĐỂ TUA VIDEO ===
  window.addEventListener('COURSERA_HELPER_SKIP_VIDEO', async (event) => {
    const path = window.location.pathname;
    const m = path.match(/\/learn\/([^/]+)\/(?:lecture|supplement|item)\/([^/?#]+)/);
    const slug = m ? m[1] : '';
    const itemId = m ? m[2] : '';

    const videos = Array.from(document.querySelectorAll('video'));
    for (const v of videos) {
      addSeekBypassListeners(v);
      patchReactFiber(v);
    }

    let success = false;
    if (slug && itemId) {
      success = await performMainWorldCompletion(slug, itemId);
    }

    window.dispatchEvent(new CustomEvent('COURSERA_HELPER_VIDEO_SKIPPED', {
      detail: { success, slug, itemId }
    }));
  });

})();
