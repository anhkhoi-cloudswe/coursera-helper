// Coursera Helper - Main World Injection Script
// Runs in the MAIN world to directly access Coursera's player, DOM, and React Fiber
// Key: Extract authentic userId via adminUserPermissions / window.App, resolve true trackingId, and complete video

(function() {
  if (window.__COURSERA_HELPER_INJECTED__) return;
  window.__COURSERA_HELPER_INJECTED__ = true;

  console.log('[CourseraHelper] Main-world engine v4.1 initialized.');

  const unlockedSet = new WeakSet();

  // === Helper: Trích xuất CSRF Token từ Cookie (Main World) ===
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

  // === Helper: Trích xuất User ID đích thực từ window.App hoặc API (TUYỆT ĐỐI không dùng cookie __204u) ===
  async function resolveAuthenticUserId(csrf) {
    const ds = document.documentElement.dataset;
    if (ds.chUserId && /^\d+$/.test(ds.chUserId) && ds.chUserId.length < 11) {
      return ds.chUserId;
    }

    // 1. Thử lấy từ window.App Flux Stores (chứa đúng userId đang đăng nhập)
    try {
      const stores = window.App?.context?.dispatcher?.stores;
      if (stores) {
        const uid = stores.ApplicationStore?.userData?.id ||
                    stores.UserStore?.currentUserId ||
                    stores.ApplicationStore?.getUser?.()?.id;
        if (uid && String(uid).length > 2) {
          const sUid = String(uid);
          ds.chUserId = sUid;
          return sUid;
        }
      }
    } catch (e) {}

    // 2. Thử lấy từ window.__PRELOADED_STATE__
    try {
      if (window.__PRELOADED_STATE__) {
        const s = JSON.stringify(window.__PRELOADED_STATE__);
        const m = s.match(/"userId"\s*:\s*"?(\d+)"?/i) || s.match(/"currentUserId"\s*:\s*"?(\d+)"?/i);
        if (m && m[1]) {
          ds.chUserId = m[1];
          return m[1];
        }
      }
    } catch (e) {}

    // 3. Gọi endpoint chuẩn Coursera adminUserPermissions.v1?q=my (có session cookies)
    try {
      const res = await fetch('/api/adminUserPermissions.v1?q=my', {
        headers: {
          'Accept': 'application/json',
          'x-csrf3-token': csrf,
          'x-requested-with': 'XMLHttpRequest'
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const uid = data?.elements?.[0]?.id;
        if (uid) {
          const sUid = String(uid);
          ds.chUserId = sUid;
          return sUid;
        }
      }
    } catch (e) {}

    return ds.chUserId || '';
  }

  // === Helper: Trích xuất Course ID thực tế (e.g. rwRs6Tn9EeWJaxK5AT4frw) ===
  async function resolveAuthenticCourseId(slug, csrf) {
    const ds = document.documentElement.dataset;
    if (ds.chCourseId && ds.chCourseId.length > 5) {
      return ds.chCourseId;
    }

    // 1. Lấy từ window.App stores
    try {
      const stores = window.App?.context?.dispatcher?.stores;
      if (stores) {
        const cid = stores.CourseStore?.courseId || stores.CourseMaterialsStore?.courseId;
        if (cid) {
          ds.chCourseId = cid;
          return cid;
        }
      }
    } catch (e) {}

    // 2. Gọi onDemandCourseMaterials.v2
    if (slug) {
      try {
        const res = await fetch(`/api/onDemandCourseMaterials.v2/?q=slug&slug=${encodeURIComponent(slug)}&fields=id`, {
          headers: {
            'Accept': 'application/json',
            'x-csrf3-token': csrf,
            'x-requested-with': 'XMLHttpRequest'
          },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const cid = data?.elements?.[0]?.id;
          if (cid) {
            ds.chCourseId = cid;
            return cid;
          }
        }
      } catch (e) {}
    }

    return ds.chCourseId || '';
  }

  // === Helper: Gỡ bỏ khóa tua seek-lock trên phần tử video ===
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

  // === QUY TRÌNH HOÀN THÀNH VIDEO TRỰC TIẾP TRONG MAIN WORLD ===
  async function performMainWorldCompletion(slug, itemId) {
    const csrf = getCookieCsrf();
    const [userId, courseId] = await Promise.all([
      resolveAuthenticUserId(csrf),
      resolveAuthenticCourseId(slug, csrf)
    ]);

    console.log('[CourseraHelper-Main] Auth resolved for completion:', JSON.stringify({ slug, itemId, userId, courseId, hasCsrf: !!csrf }));

    if (!userId || !courseId) {
      console.warn('[CourseraHelper-Main] ABORT: Missing authentic userId or courseId');
      return false;
    }

    // 1. BẮT BUỘC: Lấy đúng trackingId (videoId thật sự như itVp7CuLEeeWMBKl-1Ol3A) từ onDemandLectureVideos.v1
    let canSkip = true;
    let trackingId = '';
    let durationMs = 1044000;

    try {
      const metaRes = await fetch(`/api/onDemandLectureVideos.v1/${courseId}~${itemId}?includes=video&fields=disableSkippingForward,startMs,endMs`, {
        headers: {
          'Accept': 'application/json',
          'x-csrf3-token': csrf,
          'x-requested-with': 'XMLHttpRequest'
        },
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
      } else {
        const err = await metaRes.text();
        console.warn('[CourseraHelper-Main] onDemandLectureVideos failed:', metaRes.status, err);
      }
    } catch (e) {
      console.warn('[CourseraHelper-Main] onDemandLectureVideos error:', e);
    }

    // Nếu không lấy được trackingId từ API, cố gắng tìm trong React Fiber của video
    if (!trackingId) {
      const videoEl = document.querySelector('video');
      if (videoEl) {
        try {
          const fk = Object.keys(videoEl).find(k => k.startsWith('__reactFiber'));
          let cur = fk ? videoEl[fk] : null;
          let d = 0;
          while (cur && d < 40) {
            if (cur.memoizedProps?.trackingId) { trackingId = cur.memoizedProps.trackingId; break; }
            if (cur.memoizedProps?.videoId) { trackingId = cur.memoizedProps.videoId; break; }
            cur = cur.return;
            d++;
          }
        } catch (e) {}
      }
    }

    if (!trackingId) {
      console.warn('[CourseraHelper-Main] Could not resolve video trackingId, using fallback');
      trackingId = itemId;
    }

    document.documentElement.dataset.chTrackingId = trackingId;

    const videoEl = document.querySelector('video');
    if (videoEl && videoEl.duration && !isNaN(videoEl.duration) && isFinite(videoEl.duration) && videoEl.duration > 2) {
      durationMs = Math.ceil(videoEl.duration * 1000);
    }
    const viewedUpToMs = durationMs + 2000;

    const apiHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'x-coursera-application': 'ondemand',
      'x-requested-with': 'XMLHttpRequest'
    };
    if (csrf) {
      apiHeaders['x-csrf3-token'] = csrf;
      apiHeaders['x-csrf2-token'] = csrf;
    }

    console.log('[CourseraHelper-Main] Sending 3-step completion calls:', JSON.stringify({
      canSkip,
      userId,
      courseId,
      trackingId,
      viewedUpToMs
    }));

    // BƯỚC 1: Gửi sự kiện play (bắt buộc cho Coursera backend ghi nhận phiên xem)
    try {
      const playRes = await fetch(`/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/play?autoEnroll=false`, {
        method: 'POST',
        headers: apiHeaders,
        credentials: 'include',
        body: JSON.stringify({ contentRequestBody: {} })
      });
      console.log('[CourseraHelper-Main] videoEvents/play status:', playRes.status);
    } catch (e) {}

    // BƯỚC 2: Cập nhật viewedUpTo lên 100% thời lượng video qua onDemandVideoProgresses.v1
    try {
      const progUrl = `/api/onDemandVideoProgresses.v1/${userId}~${courseId}~${trackingId}`;
      const progRes = await fetch(progUrl, {
        method: 'PUT',
        headers: apiHeaders,
        credentials: 'include',
        body: JSON.stringify({
          videoProgressId: `${userId}~${courseId}~${trackingId}`,
          viewedUpTo: viewedUpToMs
        })
      });
      console.log('[CourseraHelper-Main] onDemandVideoProgresses status:', progRes.status);
      if (progRes.status !== 204 && progRes.status !== 200) {
        const txt = await progRes.text();
        console.warn('[CourseraHelper-Main] onDemandVideoProgresses error response:', progRes.status, txt);
      }
    } catch (e) {
      console.warn('[CourseraHelper-Main] onDemandVideoProgresses error:', e);
    }

    // BƯỚC 3: Gửi sự kiện ended để Coursera chốt hoàn thành bài giảng video
    try {
      const endUrl = `/api/opencourse.v1/user/${userId}/course/${slug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`;
      const endRes = await fetch(endUrl, {
        method: 'POST',
        headers: apiHeaders,
        credentials: 'include',
        body: JSON.stringify({ contentRequestBody: {} })
      });
      console.log('[CourseraHelper-Main] videoEvents/ended status:', endRes.status);
      if (endRes.status !== 200 && endRes.status !== 204) {
        const txt = await endRes.text();
        console.warn('[CourseraHelper-Main] videoEvents/ended error response:', endRes.status, txt);
      }
    } catch (e) {
      console.warn('[CourseraHelper-Main] videoEvents/ended error:', e);
    }

    // BƯỚC 4: Đồng thời gửi tín hiệu hoàn thành item qua onDemandSupplementCompletions.v1
    try {
      await fetch('/api/onDemandSupplementCompletions.v1', {
        method: 'POST',
        headers: apiHeaders,
        credentials: 'include',
        body: JSON.stringify({
          courseId: courseId,
          itemId: itemId,
          userId: parseInt(userId, 10)
        })
      }).catch(() => {});
    } catch (e) {}

    // BƯỚC 5: Kích hoạt React Fiber handlers trên phần tử video
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

    // BƯỚC 6: Kiểm tra xác nhận trạng thái hoàn thành trực tiếp từ server Coursera
    let isConfirmed = false;
    for (let check = 0; check < 5; check++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        const pRes = await fetch(`/api/onDemandCoursesProgress.v1/${userId}~${courseId}?fields=gradedAssignmentGroupProgress`, {
          headers: {
            'Accept': 'application/json',
            'x-csrf3-token': csrf,
            'x-requested-with': 'XMLHttpRequest'
          },
          credentials: 'include'
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          const items = pData?.elements?.[0]?.items || {};
          const itemProg = items[itemId];
          if (itemProg && (itemProg.progressState === 'Completed' || itemProg.completed === true)) {
            console.log('[CourseraHelper-Main] Server CONFIRMED Completed for:', itemId);
            isConfirmed = true;
            try {
              const link = document.querySelector(`a[href*="/${itemId}/"], a[href$="/${itemId}"]`);
              if (link) {
                const aria = link.getAttribute('aria-label') || '';
                if (aria) link.setAttribute('aria-label', aria.replace(/Not submitted|In progress|chưa nộp|đang làm/gi, 'Completed'));
                const svg = link.querySelector('svg');
                if (svg) {
                  svg.setAttribute('data-testid', 'learn-item-success-icon');
                  svg.innerHTML = `
                    <rect fill="var(--cds-color-green-700, #00823c)" height="20" rx="10" width="20"></rect>
                    <path d="M8.333 13.542l-3.542-3.542 1.18-1.18 2.362 2.354 5.9-5.9 1.18 1.18-7.08 7.088z" fill="#ffffff"></path>
                  `;
                }
              }
            } catch (e) {}
            break;
          }
        }
      } catch (e) {}
    }

    return isConfirmed;
  }

  // === LẮNG NGHE SỰ KIỆN TỪ CONTENT SCRIPT ĐỂ TUA VIDEO ===
  window.addEventListener('COURSERA_HELPER_SKIP_VIDEO', async () => {
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
