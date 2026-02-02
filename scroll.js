(function () {
  // 先取得 DOM（避免 first 未初始化就被用到）
  const section = document.querySelector(".section-part1");
  if (!section) return;

  const containers = Array.from(section.querySelectorAll(".container"));
  const first = containers[0];
  if (!first) return;

  // 添加點一下播放功能，避免自動播放被瀏覽器阻擋
  let videoUnlocked = false;

  function unlockVideo(video) {
    if (!video || videoUnlocked) return;

    const p = video.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        video.pause();
        try {
          video.currentTime = 0;
        } catch (e) {}
        videoUnlocked = true; // 成功才鎖定
      }).catch(() => {
        // 失敗就保持可重試
        videoUnlocked = false;
      });
    }
  }

  // 任何一次手勢都算：pointerdown（改成可重試，成功後自動不再做事）
  window.addEventListener(
    "pointerdown",
    () => {
      if (videoUnlocked) return;
      const v = first.querySelector(".sys-progress .percentang video");
      unlockVideo(v);
    },
    { passive: true },
  );

  let firstHeight = first.offsetHeight || first.getBoundingClientRect().height;

  // firstHeight * 6
  function setSectionHeight() {
    firstHeight = first.offsetHeight || first.getBoundingClientRect().height;
    section.style.height = firstHeight * 6 + "px";
  }
  setSectionHeight();

  let ticking = false;
  let lastActive = null;
  let _myOffsetTop = 400;

  // 判斷影片剩餘幾秒時視為「倒數」，可於此修改（單位：秒）
  const mvCountdownSeconds = 2;

  // 用來記錄上一次的捲軸位置，以判斷是往上或往下捲動（初始化）
  let previousScrollY = window.scrollY || window.pageYOffset;

  /**
   * 取得目前的垂直捲軸位置（cross-browser）
   * @returns {number} 當前 scrollY
   */
  function getScrollY() {
    return window.scrollY || window.pageYOffset;
  }

  /**
   * 取得捲動方向並更新 previousScrollY
   * 回傳： 1 表示往下捲動、-1 表示往上捲動、0 表示未改變
   *
   * 注意：此函式會更新 `previousScrollY`，每個 rAF 週期請只呼叫一次以避免競態
   */
  function getScrollDirection() {
    const scrollY = getScrollY();
    let dir = 0;
    if (scrollY > previousScrollY) dir = 1;
    else if (scrollY < previousScrollY) dir = -1;
    previousScrollY = scrollY;
    return dir;
  }

  /**
   * 便利函式：是否正在往下捲動（會呼叫 getScrollDirection() 並回傳 bool）
   * 若需避免更新 previousScrollY，請直接呼叫 getScrollDirection() 並自行處理回傳值
   */
  function isScrollingDown() {
    return getScrollDirection() === 1;
  }

  /**
   * 便利函式：是否正在往上捲動（會呼叫 getScrollDirection() 並回傳 bool）
   */
  function isScrollingUp() {
    return getScrollDirection() === -1;
  }

  // 找出頁面中所有 .container-p2kv，並準備對應的影片控制 flag
  const p2kvContainers = Array.from(
    document.querySelectorAll(".container-p2kv"),
  );
  p2kvContainers.forEach((c) => {
    const v = c.querySelector("video");
    if (v) {
      // 自訂屬性用來記錄是否已依規則播放過
      v._p2kvPlayed = false;
      // 確保 metadata 載入時可以做必要的初始化（若需要）
      v.addEventListener(
        "loadedmetadata",
        () => {
          // 目前不需額外處理，但保留以防未來擴充
        },
        { once: true },
      );
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
   * - 當往下捲動 且 捲軸位置到達（元素頂端 - 300px）時，該元素內的 video 播放
   * - 當往上捲動 且 元素頂端到達視窗底部（>= 100vh）時，該元素內的 video 時間軸回到 0s 並暫停
   */
  function handleP2KVScroll() {
    const scrollY = getScrollY();
    const direction = getScrollDirection(); // 1: down, -1: up, 0: no change
    const scrollingDown = direction === 1;
    const scrollingUp = direction === -1;
    const viewportHeight = window.innerHeight;

    p2kvContainers.forEach((c) => {
      const v = c.querySelector("video");
      if (!v) return;

      const rect = c.getBoundingClientRect();
      const elemTop = rect.top + scrollY; // 元素相對文件上方的位置

      // 向下捲動：當卷軸往下捲到 .container-p2kv 頂端 - 300px 時，播放影片（只播放一次，避免重複觸發）
      // 同時為容器加上 .mv-on 樣式（代表影片正在透過捲軸被觸發播放）
      if (scrollingDown && scrollY >= elemTop - 300) {
        if (!v._p2kvPlayed) {
          try {
            const p = v.play();
            if (p && typeof p.then === "function") {
              p.catch(() => {});
            }
          } catch (e) {}

          // 標記已觸發播放（避免重複嘗試播放）
          v._p2kvPlayed = true;

          // 監聽播放進度，動態偵測何時只剩下 mvCountdownSeconds 秒或更少
          const onTimeUpdate = () => {
            try {
              const dur = v.duration;
              if (!isFinite(dur) || dur <= 0) return;
              const remaining = dur - v.currentTime;
              if (remaining <= mvCountdownSeconds) {
                // 當剩餘時間 <= mvCountdownSeconds 時加入 .mv-on，並移除監聽以避免重複觸發
                try {
                  c.classList.add("mv-on");
                } catch (e) {}
                v.removeEventListener("timeupdate", onTimeUpdate);
              }
            } catch (e) {}
          };

          v.addEventListener("timeupdate", onTimeUpdate);

          // 保險：若目前已在倒數 mvCountdownSeconds 範圍（例如短片或已播放到末段），立即加上並移除監聽
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

      // 向上捲動：當元素頂端到達視窗底部（>= 100vh）時，重置影片時間到 0s 並暫停
      // 同時移除 .mv-on，代表影片不再處於捲軸觸發播放狀態
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
        // 新增：同一個 rAF 內處理 .container-p2kv 的影片控制，保持效能
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
    // 調整視窗大小時也要檢查 .container-p2kv 的狀態
    handleP2KVScroll();
  });
  window.addEventListener("load", () => {
    setSectionHeight();
    handleScroll();
    // 頁面載入完成後也執行一次 P2KV 檢查
    handleP2KVScroll();
  });

  const media = first.querySelectorAll("img, video");
  media.forEach((m) => {
    if (m.tagName && m.tagName.toLowerCase() === "video") {
      m.addEventListener("loadedmetadata", () => {
        setSectionHeight();
        handleScroll();
        // 影片 metadata 載入後也需判斷 .container-p2kv 的播放條件
        handleP2KVScroll();
      });
    } else {
      m.addEventListener("load", () => {
        setSectionHeight();
        handleScroll();
        // 圖片載入後亦需檢查（避免視高變動導致判斷錯誤）
        handleP2KVScroll();
      });
    }
  });

  const percentangVideo = first.querySelector(
    ".sys-progress .percentang video",
  );
  if (percentangVideo) {
    percentangVideo.addEventListener("loadedmetadata", () => {
      percentangVideo.pause();
      try {
        percentangVideo.currentTime = 0.05;
      } catch (e) {}
    });
  }

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
    // 改為使用主車的星芒影片作為觸發控制（class: .car-star）
    const video = first.querySelector(".main-car .car video.car-star");
    const percentang = first.querySelector(".sys-progress .percentang");
    if (!video || !percentang) return;

    try {
      video.currentTime = 0.05;
    } catch (e) {}

    // 當 .s3 發生後，監聽 .percentang 的 class 變化（關注 .done 是否被加入），
    // 當偵測到 .done 時，啟動主車的星芒影片（.car-star）播放
    if (!percentang._doneObserverAttached) {
      const playStar = () => {
        try {
          const video_carStar = first.querySelector(
            ".main-car .car video.car-star",
          );
          if (!video_carStar) return;
          const pr = video_carStar.play();
          if (pr && typeof pr.then === "function") pr.catch(() => {});
        } catch (e) {}
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

      // 建立 observer
      const doneObserver = new MutationObserver(onPercentangClassChange);
      doneObserver.observe(percentang, {
        attributes: true,
        attributeFilter: ["class"],
      });
      percentang._doneObserver = doneObserver;
      percentang._doneObserverAttached = true;

      // 保險 fallback：若 class 沒被加入，則在超時後強制播放（避免卡死）
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

    video.onended = () => {
      const liElements = first.querySelectorAll(
        ".sys-progress .function-list li:not(.percentang)",
      );

      let completedCount = 0;
      const done = () => {
        percentang.classList.add("done");
        s3Running = false;
      };

      // ✅ 保險：避免 transitionend 沒觸發造成卡死
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

    // 清除主車星芒影片的播放狀態（若存在）
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
  // 初始化時一併檢查並觸發 .container-p2kv 的影片控制
  handleP2KVScroll();
})();
