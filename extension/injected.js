// Coursera Helper - Main World Injection Script
// Runs in the MAIN world to directly access Coursera's player, DOM, and React Fiber
// Bypasses locked video restrictions (seek-lock, fast-forward lock) and ensures legitimate completion

(function() {
  if (window.__COURSERA_HELPER_INJECTED__) return;
  window.__COURSERA_HELPER_INJECTED__ = true;

  console.log('[CourseraHelper] Main-world video bypass engine initialized.');

  // 1. Intercept HTMLMediaElement addEventListener to disable Coursera's seek-lock reset
  const origAddEventListener = HTMLMediaElement.prototype.addEventListener;
  HTMLMediaElement.prototype.addEventListener = function(type, listener, options) {
    if (type === 'seeking' || type === 'seeked') {
      const wrapped = function(event) {
        if (this._ch_bypass_lock) {
          event.stopImmediatePropagation();
          return;
        }
        return listener.apply(this, arguments);
      };
      this._ch_wrapped = this._ch_wrapped || [];
      this._ch_wrapped.push({ original: listener, wrapped: wrapped, type: type });
      return origAddEventListener.call(this, type, wrapped, options);
    }
    return origAddEventListener.apply(this, arguments);
  };

  // 2. Unlock Coursera React Fiber state and player restrictions
  function unlockMedia(video) {
    if (!video) return;
    video._ch_bypass_lock = true;

    try {
      const fiberKey = Object.keys(video).find(k => k.startsWith('__reactFiber'));
      let cur = fiberKey ? video[fiberKey] : null;
      let depth = 0;
      while (cur && depth < 30) {
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

  // Auto unlock all videos periodically
  setInterval(() => {
    const videos = document.querySelectorAll('video');
    videos.forEach(unlockMedia);
  }, 1000);

  // Helper to extract CSRF token in main world
  function getCSRFToken() {
    try {
      const m = document.cookie.match(/CSRF3-Token=([^;]+)/) || document.cookie.match(/csrf-token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) {
      return '';
    }
  }

  // 3. Skip Video Handler with progressive stepping & React Fiber onEnded trigger
  window.addEventListener('COURSERA_HELPER_SKIP_VIDEO', async (evt) => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) {
      window.dispatchEvent(new CustomEvent('COURSERA_HELPER_VIDEO_SKIPPED', { detail: { success: false, reason: 'no_video' } }));
      return;
    }

    for (const v of videos) {
      unlockMedia(v);
      v._ch_bypass_lock = true;
      v.muted = true;
      try { v.playbackRate = 16; } catch (e) {}

      const dur = (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 2) ? v.duration : 1200;
      let curTime = v.currentTime || 0;
      v.play().catch(() => {});

      // Step forward progressively across 8 frames so Coursera's player logs natural progress
      const steps = 8;
      const stepSize = Math.max(1, (dur - curTime) / steps);

      for (let i = 1; i <= steps; i++) {
        await new Promise(r => setTimeout(r, 60));
        curTime = Math.min(dur, curTime + stepSize);
        v.currentTime = (i === steps) ? Math.max(0, dur - 0.2) : curTime;
        v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
      }

      // Finish at exact duration
      await new Promise(r => setTimeout(r, 80));
      v.currentTime = dur;
      v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
      v.dispatchEvent(new Event('ended', { bubbles: true }));

      // Call React Fiber completion handlers directly
      try {
        const fiberKey = Object.keys(v).find(k => k.startsWith('__reactFiber'));
        let cur = fiberKey ? v[fiberKey] : null;
        let depth = 0;
        while (cur && depth < 30) {
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
          depth++;
        }
      } catch (e) {}

      // Keep playing state settled
      v._ch_bypass_lock = false;
    }

    // Call onDemandVideoProgresses API directly with COMPLETED state
    try {
      const path = window.location.pathname;
      const m = path.match(/\/learn\/([^/]+)\/lecture\/([^/?#]+)/);
      if (m) {
        const slug = m[1];
        const itemId = m[2];
        const csrf = getCSRFToken();
        const headers = {
          'Content-Type': 'application/json',
          'x-coursera-application': 'video-player'
        };
        if (csrf) {
          headers['CSRF3-Token'] = csrf;
          headers['X-CSRF3-Token'] = csrf;
          headers['x-csrf-token'] = csrf;
        }

        // Get CourseId from window or preloaded state
        let courseId = '';
        if (window.__PRELOADED_STATE__) {
          const s = JSON.stringify(window.__PRELOADED_STATE__);
          const cidMatch = s.match(/"courseId"\s*:\s*"([^"]+)"/);
          if (cidMatch) courseId = cidMatch[1];
        }

        if (courseId && itemId) {
          const payload = JSON.stringify({
            courseId: courseId,
            itemId: itemId,
            videoProgress: {
              timestamp: 999999,
              playbackRate: 1,
              state: 'COMPLETED',
              duration: 999999
            }
          });

          fetch('/api/onDemandVideoProgresses.v1', {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: payload
          }).catch(() => {});

          fetch(`/api/onDemandVideoProgresses.v1/${courseId}~${itemId}`, {
            method: 'PUT',
            headers: headers,
            credentials: 'include',
            body: payload
          }).catch(() => {});
        }
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('COURSERA_HELPER_VIDEO_SKIPPED', { detail: { success: true } }));
  });

})();
