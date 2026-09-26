// Coursera Helper - Main World Injection Script
// Runs in the MAIN world to directly access Coursera's player, DOM, and React Fiber
// Key fix: capture listeners + 16x natural playback to satisfy backend heartbeat validation

(function() {
  if (window.__COURSERA_HELPER_INJECTED__) return;
  window.__COURSERA_HELPER_INJECTED__ = true;

  console.log('[CourseraHelper] Main-world bypass engine v3 initialized.');

  // Track which videos have been properly unlocked
  const unlockedSet = new WeakSet();

  // === CORE: Add capturing seek-lock bypass listeners to a video element ===
  // Must run in MAIN WORLD so we intercept Coursera's listeners (not just content script ones)
  function addSeekBypassListeners(v) {
    if (unlockedSet.has(v)) return;
    unlockedSet.add(v);

    // Block all non-capture seeking/seeked listeners BEFORE they can reset currentTime
    v.addEventListener('seeking', function(e) {
      if (v._ch_allow_seek) e.stopImmediatePropagation();
    }, { capture: true, passive: false });

    v.addEventListener('seeked', function(e) {
      if (v._ch_allow_seek) e.stopImmediatePropagation();
    }, { capture: true, passive: false });

    // Also patch memoizedProps to allow seeking
    patchReactFiber(v);
  }

  // Unlock React Fiber props on the video element
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

  // Auto-unlock all videos periodically
  setInterval(() => {
    document.querySelectorAll('video').forEach(v => {
      addSeekBypassListeners(v);
    });
  }, 800);

  // === MAIN SKIP HANDLER ===
  window.addEventListener('COURSERA_HELPER_SKIP_VIDEO', async () => {
    const videos = Array.from(document.querySelectorAll('video'));
    for (const v of videos) {
      addSeekBypassListeners(v);
      patchReactFiber(v);

      // Trigger React Fiber completion handlers directly
      try {
        const fk = Object.keys(v).find(k => k.startsWith('__reactFiber'));
        let cur = fk ? v[fk] : null;
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

    window.dispatchEvent(new CustomEvent('COURSERA_HELPER_VIDEO_SKIPPED', { detail: { success: true } }));
  });

})();
