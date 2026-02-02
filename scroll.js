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
    { passive: true }
  );

  let firstHeight = first.offsetHeight || first.getBoundingClientRect().height;

  // ✅ 依你的需求：維持 firstHeight * 6 不改
  function setSectionHeight() {
    firstHeight = first.offsetHeight || first.getBoundingClientRect().height;
    section.style.height = firstHeight * 6 + "px";
  }
  setSectionHeight();

  let ticking = false;
  let lastActive = null;
  let _myOffsetTop = 400;

  // 用來記錄上一次的捲軸位置，以判斷是往上還是往下捲動
  let previousScrollY = window.scrollY || window.pageYOffset;

  // 找出頁面中所有 .container-p2kv，並準備對應的影片控制 flag
  const p2kvContainers = Array.from(document.querySelectorAll(".container-p2kv"));
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
        { once: true }
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
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollingDown = scrollY > previousScrollY;
    const viewportHeight = window.innerHeight;

    p2kvContainers.forEach((c) => {
      const v = c.querySelector("video");
      if (!v) return;

      const rect = c.getBoundingClientRect();
      const elemTop = rect.top + scrollY; // 元素相對文件上方的位置

      // 向下捲動：當卷軸往下捲到 .container-p2kv 頂端 - 300px 時，播放影片（只播放一次，避免重複觸發）
      if (scrollingDown && scrollY >= elemTop - 300) {
        if (!v._p2kvPlayed) {
          try {
            const p = v.play();
            if (p && typeof p.then === "function") {
              p.catch(() => {});
            }
          } catch (e) {}
          v._p2kvPlayed = true;
        }
      }

      // 向上捲動：當元素頂端到達視窗底部（>= 100vh）時，重置影片時間到 0s 並暫停
      if (!scrollingDown && rect.top >= viewportHeight) {
        try {
          v.pause();
          v.currentTime = 0;
        } catch (e) {}
        v._p2kvPlayed = false;
      }
    });

    previousScrollY = scrollY;
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
    ".sys-progress .percentang video"
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
    const video = first.querySelector(".sys-progress .percentang video");
    const percentang = first.querySelector(".sys-progress .percentang");
    if (!video || !percentang) return;

    if (s3Running) return;
    s3Running = true;

    try {
      video.currentTime = 0.05;
    } catch (e) {}

    const p = video.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        s3Running = false;
      });
    }

    video.onended = () => {
      const liElements = first.querySelectorAll(
        ".sys-progress .function-list li:not(.percentang)"
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
          { once: true }
        );
      });
    };
  }

  function clearLiStyles() {
    const liElements = first.querySelectorAll(
      ".sys-progress .function-list li:not(.percentang)"
    );
    const percentang = first.querySelector(".sys-progress .percentang");

    liElements.forEach((li) => {
      li.style.transition = "";
      li.style.opacity = "";
      li.style.visibility = "visible";
    });
    percentang.classList.remove("done");

    const video = first.querySelector(".sys-progress .percentang video");
    if (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (e) {}
      video.onended = null;
    }
    s3Running = false;
  }

  handleScroll();
  // 初始化時一併檢查並觸發 .container-p2kv 的影片控制
  handleP2KVScroll();
})();
