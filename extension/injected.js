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
    if (!videos.length) {
      window.dispatchEvent(new CustomEvent('COURSERA_HELPER_VIDEO_SKIPPED', { detail: { success: false } }));
      return;
    }

    for (const v of videos) {
      // 1. Add bypass listeners (capture, main world) BEFORE doing anything
      addSeekBypassListeners(v);
      patchReactFiber(v);

      // 2. Allow seeking flag ON
      v._ch_allow_seek = true;
      v.muted = true;

      const dur = (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 2)
        ? v.duration : 1200;

      // 3. Seek to 85% of video
      const seekTarget = dur * 0.85;
      try {
        v.currentTime = seekTarget;
      } catch (e) {}

      // 4. Set 16x speed
      try { v.playbackRate = 16; } catch (e) {}

      // 5. Start playing (main world, no isolation issues)
      try { await v.play(); } catch (e) {}

      console.log('[CourseraHelper] Seeking to 85% =', seekTarget, '/ duration =', dur, '| playbackRate =', v.playbackRate);

      // 6. Wait for natural 'ended' event (up to 90 seconds)
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          v.removeEventListener('ended', onEnd);
          resolve();
        }, 90000);

        function onEnd() {
          clearTimeout(timeout);
          console.log('[CourseraHelper] Video ended naturally at:', v.currentTime);

          // Trigger React Fiber completion handlers
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

          resolve();
        }

        v.addEventListener('ended', onEnd, { once: true });
      });

      // 7. Disable bypass flag
      v._ch_allow_seek = false;
    }

    window.dispatchEvent(new CustomEvent('COURSERA_HELPER_VIDEO_SKIPPED', { detail: { success: true } }));
  });

})();
