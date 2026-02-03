(function () {
  // 先取得 DOM（避免 first 未初始化就被用到）
  const section = document.querySelector(".section-part1");
  if (!section) return;

  const containers = Array.from(section.querySelectorAll(".container"));
  const first = containers[0];
  if (!first) return;

  // =========
  // Media utils
  // =========

  // 全域解鎖旗標：只要任何一支影片成功透過手勢完成一次 play→pause，即視為已解鎖
  let videoUnlocked = false;

  // 等待手勢的 Promise（讓 safePlay 在被 autoplay policy 擋住時可掛起等手勢再重試）
  let _gestureWaitPromise = null;
  let _resolveGestureWait = null;

  function waitForGestureOnce() {
    if (_gestureWaitPromise) return _gestureWaitPromise;

    _gestureWaitPromise = new Promise((resolve) => {
      _resolveGestureWait = resolve;
    });

    const onGesture = () => {
      try {
        if (_resolveGestureWait) _resolveGestureWait();
      } finally {
        _gestureWaitPromise = null;
        _resolveGestureWait = null;
        window.removeEventListener("pointerdown", onGesture, true);
        window.removeEventListener("touchstart", onGesture, true);
        window.removeEventListener("click", onGesture, true);
      }
    };

    // capture: true 讓它更早拿到手勢（某些 WebView 比較挑）
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("touchstart", onGesture, true);
    window.addEventListener("click", onGesture, true);

    return _gestureWaitPromise;
  }

  function once(el, eventName) {
    return new Promise((resolve) => {
      const handler = () => resolve();
      el.addEventListener(eventName, handler, { once: true });
    });
  }

  function isMetadataReady(v) {
    // HAVE_METADATA = 1
    return !!v && v.readyState >= 1 && isFinite(v.duration) && v.duration > 0;
  }

  // 核心：集中播放控制
  // - requireGesture: 若被 policy 擋，會等待一次手勢後再重試
  // - ensureMetadata: 若 metadata 未就緒，會等待 loadedmetadata
  // - unlockMode: 解鎖用（play 一下立刻 pause），成功後 videoUnlocked=true
  async function safePlay(video, options = {}) {
    const {
      requireGesture = true,
      ensureMetadata = true,
      unlockMode = false,
      // 預設用靜音解鎖最保險；正式播放你要不要取消靜音可自行在外面控制
      forceMutedForUnlock = true,
      playsInline = true,
    } = options;

    if (!video) return false;

    try {
      if (playsInline) video.playsInline = true;
      if (unlockMode && forceMutedForUnlock) video.muted = true;

      if (ensureMetadata && !isMetadataReady(video)) {
        await once(video, "loadedmetadata");
      }

      // 解鎖模式：播放一下就 pause（用來取得播放權限）
      // 注意：部分環境 pause/seek 可能 throw，所以包 try
      const p = video.play();
      if (p && typeof p.then === "function") {
        await p;
      }

      if (unlockMode) {
        try {
          video.pause();
          // 解鎖時回到 0，避免影響之後播放
          video.currentTime = 0;
        } catch (e) {}
        videoUnlocked = true;
      }

      return true;
    } catch (e) {
      // 可能是 autoplay policy 或其他原因導致 play() 被拒絕
      if (requireGesture) {
        // 等一次手勢後重試一次
        await waitForGestureOnce();

        // 手勢發生後，再試一次（第二次就不要無限重試，避免卡死）
        try {
          if (playsInline) video.playsInline = true;
          if (unlockMode && forceMutedForUnlock) video.muted = true;
          if (ensureMetadata && !isMetadataReady(video)) {
            await once(video, "loadedmetadata");
          }
          const p2 = video.play();
          if (p2 && typeof p2.then === "function") {
            await p2;
          }

          if (unlockMode) {
            try {
              video.pause();
              video.currentTime = 0;
            } catch (e2) {}
            videoUnlocked = true;
          }

          return true;
        } catch (e2) {
          return false;
        }
      }

      return false;
    }
  }

  // =========
  // 解鎖：任意一次手勢嘗試解鎖一次（失敗不鎖死，下一次手勢還能再試）
  // =========
  function tryUnlockFromGesture() {
    if (videoUnlocked) return;

    // 你原本是挑 percentang video 來解鎖：保留
    const v = first.querySelector(".sys-progress .percentang video");
    // 重要：解鎖要走 safePlay 的 unlockMode
    safePlay(v, {
      unlockMode: true,
      ensureMetadata: false, // 解鎖不一定要等 duration
      requireGesture: false, // 已在手勢事件中
      forceMutedForUnlock: true,
      playsInline: true,
    }).then((ok) => {
      // ok=true 代表解鎖成功，之後不必再做事
      // 失敗則保持可重試（不做任何事）
      if (ok) {
        // 成功後可選擇移除 listener（若你希望仍可重試某些影片，可不移除）
        // 這裡採保守：成功後移除，避免多餘觸發
        window.removeEventListener("pointerdown", tryUnlockFromGesture, true);
      }
    });
  }

  // capture: true 讓這次 pointerdown 更像「有效手勢」
  window.addEventListener("pointerdown", tryUnlockFromGesture, true);

  // =========
  // Layout / scroll logic（保留原本）
  // =========

  let firstHeight = first.offsetHeight || first.getBoundingClientRect().height;

  function setSectionHeight() {
    firstHeight = first.offsetHeight || first.getBoundingClientRect().height;
    section.style.height = firstHeight * 6 + "px";
  }
  setSectionHeight();

  let ticking = false;
  let lastActive = null;
  let _myOffsetTop = 400;

  // 判斷影片剩餘幾秒時視為「倒數」
  const mvCountdownSeconds = 2;

  // 用來記錄上一次的捲軸位置，以判斷方向
  let previousScrollY = window.scrollY || window.pageYOffset;

  function getScrollY() {
    return window.scrollY || window.pageYOffset;
  }

  function getScrollDirection() {
    const scrollY = getScrollY();
    let dir = 0;
    if (scrollY > previousScrollY) dir = 1;
    else if (scrollY < previousScrollY) dir = -1;
    previousScrollY = scrollY;
    return dir;
  }

  // 找出頁面中所有 .container-p2kv，並準備對應的影片控制 flag
  const p2kvContainers = Array.from(
    document.querySelectorAll(".container-p2kv"),
  );
  p2kvContainers.forEach((c) => {
    const v = c.querySelector("video");
    if (v) {
      v._p2kvPlayed = false;
      v.addEventListener("loadedmetadata", () => {}, { once: true });
    }
  });

  function handleScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    let active = null;
    const sectionTop = section.getBoundingClientRect().top + scrollY;

    for (let i = 0; i < 5; i++) {
      const triggerTop = sectionTop + i * firstHeight;
      if (scrollY >= triggerTop - _myOffsetTop) active = i;
    }

    if (active === null) {
      for (let n = 1; n <= 5; n++) first.classList.remove("s" + n);
      lastActive = null;
      return;
    }

    if (active === lastActive) return;
    for (let n = 1; n <= 5; n++) first.classList.remove("s" + n);
    first.classList.add("s" + (active + 1));
    lastActive = active;
  }

  function handleBackToTop() {
    const scrollY = window.scrollY || window.pageYOffset;
    const documentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;

    const triggerPoint = documentHeight - viewportHeight - 300;

    const backToTopButton = document.querySelector(".back-to-top");
    if (!backToTopButton) return;

    if (scrollY >= triggerPoint) backToTopButton.classList.add("show");
    else backToTopButton.classList.remove("show");
  }

  /**
   * 處理 .container-p2kv 的捲軸與影片邏輯：
   * - 往下捲動且到達門檻 → 播放（safePlay）
   * - 往上捲動且元素頂端到視窗底部 → pause + reset
   */
  function handleP2KVScroll() {
    const scrollY = getScrollY();
    const direction = getScrollDirection(); // 1: down, -1: up
    const scrollingDown = direction === 1;
    const scrollingUp = direction === -1;
    const viewportHeight = window.innerHeight;

    p2kvContainers.forEach((c) => {
      const v = c.querySelector("video");
      if (!v) return;

      const rect = c.getBoundingClientRect();
      const elemTop = rect.top + scrollY;

      if (scrollingDown && scrollY >= elemTop - 300) {
        if (!v._p2kvPlayed) {
          // 用 safePlay：若被擋會等手勢後重試；成功才設 _p2kvPlayed=true
          safePlay(v, {
            requireGesture: true,
            ensureMetadata: true,
            unlockMode: false,
            playsInline: true,
          }).then((ok) => {
            v._p2kvPlayed = !!ok;
          });

          // 監聽播放進度：倒數時加 mv-on
          const onTimeUpdate = () => {
            try {
              const dur = v.duration;
              if (!isFinite(dur) || dur <= 0) return;
              const remaining = dur - v.currentTime;
              if (remaining <= mvCountdownSeconds) {
                try {
                  c.classList.add("mv-on");
                } catch (e) {}
                v.removeEventListener("timeupdate", onTimeUpdate);
              }
            } catch (e) {}
          };

          v.addEventListener("timeupdate", onTimeUpdate);

          // 保險：若本來就已接近尾端
          try {
            if (
              isFinite(v.duration) &&
              v.duration - v.currentTime <= mvCountdownSeconds
            ) {
              c.classList.add("mv-on");
              v.removeEventListener("timeupdate", onTimeUpdate);
            }
          } catch (e) {}
        }
      }

      if (scrollingUp && rect.top >= viewportHeight) {
        try {
          v.pause();
          v.currentTime = 0;
        } catch (e) {}
        v._p2kvPlayed = false;
        try {
          c.classList.remove("mv-on");
        } catch (e) {}
      }
    });
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        handleBackToTop();
        handleP2KVScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  window.addEventListener("resize", () => {
    setSectionHeight();
    handleScroll();
    handleP2KVScroll();
  });

  window.addEventListener("load", () => {
    setSectionHeight();
    handleScroll();
    handleP2KVScroll();
  });

  const media = first.querySelectorAll("img, video");
  media.forEach((m) => {
    if (m.tagName && m.tagName.toLowerCase() === "video") {
      m.addEventListener("loadedmetadata", () => {
        setSectionHeight();
        handleScroll();
        handleP2KVScroll();
      });
    } else {
      m.addEventListener("load", () => {
        setSectionHeight();
        handleScroll();
        handleP2KVScroll();
      });
    }
  });

  // percentangVideo：保留你的初始化（pause + currentTime 0.05）
  // 但一樣避免在 metadata 前動它
  const percentangVideo = first.querySelector(
    ".sys-progress .percentang video",
  );
  if (percentangVideo) {
    percentangVideo.playsInline = true;
    percentangVideo.addEventListener("loadedmetadata", () => {
      try {
        percentangVideo.pause();
        percentangVideo.currentTime = 0.05;
      } catch (e) {}
    });
  }

  // =========
  // S3 logic（把 play 改用 safePlay）
  // =========

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        if (first.classList.contains("s3")) handleS3();
        else clearLiStyles();
      }
    });
  });
  observer.observe(first, { attributes: true, attributeFilter: ["class"] });

  let s3Running = false;

  function handleS3() {
    // 主車星芒影片 car-star
    const video = first.querySelector(".main-car .car video.car-star");
    const percentang = first.querySelector(".sys-progress .percentang");
    if (!video || !percentang) return;

    try {
      video.currentTime = 0.05;
    } catch (e) {}

    // 當 .s3 發生後，監聽 .percentang 的 class 變化（關注 .done）
    if (!percentang._doneObserverAttached) {
      const playStar = () => {
        const video_carStar = first.querySelector(
          ".main-car .car video.car-star",
        );
        if (!video_carStar) return;

        // 用 safePlay 統一處理
        safePlay(video_carStar, {
          requireGesture: true,
          ensureMetadata: true,
          unlockMode: false,
          playsInline: true,
        }).then((ok) => {
          // 若播放被擋也不做事，等待下一次條件或使用者手勢
        });
      };

      const onPercentangClassChange = (mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "class") {
            if (percentang.classList.contains("done")) {
              playStar();
              // 清理 observer 與 fallback
              try {
                if (percentang._doneObserver) {
                  percentang._doneObserver.disconnect();
                  percentang._doneObserver = null;
                }
                percentang._doneObserverAttached = false;
                if (percentang._doneFallbackTimer) {
                  clearTimeout(percentang._doneFallbackTimer);
                  percentang._doneFallbackTimer = null;
                }
              } catch (e) {}
              break;
            }
          }
        }
      };

      const doneObserver = new MutationObserver(onPercentangClassChange);
      doneObserver.observe(percentang, {
        attributes: true,
        attributeFilter: ["class"],
      });
      percentang._doneObserver = doneObserver;
      percentang._doneObserverAttached = true;

      // fallback：超時後強制播（仍走 safePlay）
      percentang._doneFallbackTimer = setTimeout(() => {
        try {
          if (s3Running) return;
          s3Running = true;
          playStar();
        } catch (e) {}
        try {
          if (percentang._doneObserver) {
            percentang._doneObserver.disconnect();
            percentang._doneObserver = null;
          }
          percentang._doneObserverAttached = false;
          percentang._doneFallbackTimer = null;
        } catch (e) {}
      }, 5000);
    }

    // 這裡你是用 car-star 的 ended 去觸發右側 fadeout + done
    video.onended = () => {
      const liElements = first.querySelectorAll(
        ".sys-progress .function-list li:not(.percentang)",
      );

      let completedCount = 0;
      const done = () => {
        percentang.classList.add("done");
        s3Running = false;
      };

      // 保險：避免 transitionend 沒觸發造成卡死
      const safetyTimer = setTimeout(done, 800);

      liElements.forEach((li) => {
        li.style.transition = "opacity 0.5s ease-out";
        li.style.opacity = "0";

        li.addEventListener(
          "transitionend",
          () => {
            li.style.visibility = "hidden";
            completedCount++;
            if (completedCount === liElements.length) {
              clearTimeout(safetyTimer);
              done();
            }
          },
          { once: true },
        );
      });
    };

    // 你原本 handleS3 沒有在進 s3 時立即播放 car-star（而是等待 done），
    // 這裡維持原設計，不額外自動播放。
  }

  function clearLiStyles() {
    const liElements = first.querySelectorAll(
      ".sys-progress .function-list li:not(.percentang)",
    );
    const percentang = first.querySelector(".sys-progress .percentang");

    liElements.forEach((li) => {
      li.style.transition = "";
      li.style.opacity = "";
      li.style.visibility = "visible";
    });
    percentang.classList.remove("done");

    const video_carStar = first.querySelector(".main-car .car video.car-star");
    if (video_carStar) {
      video_carStar.pause();
      try {
        video_carStar.currentTime = 0;
      } catch (e) {}
      video_carStar.onended = null;
    }
    s3Running = false;
  }

  handleScroll();
  handleP2KVScroll();
})();
