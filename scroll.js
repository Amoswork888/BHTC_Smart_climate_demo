(function () {
  // 添加點一下播放功能，避免自動播放被瀏覽器阻擋
  let videoUnlocked = false;

  function unlockVideo(video) {
    if (videoUnlocked || !video) return;
    videoUnlocked = true;

    const p = video.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch(() => {
        // 若還是不行，代表該 WebView/影片設定更嚴格
        videoUnlocked = false;
      });
    }
  }

  // 任何一次手勢都算：pointerdown 最泛用
  window.addEventListener(
    "pointerdown",
    () => {
      const v = first.querySelector(".sys-progress .percentang video");
      unlockVideo(v);
    },
    { once: true }
  );

  const section = document.querySelector(".section-part1");
  if (!section) return;

  const containers = Array.from(section.querySelectorAll(".container"));
  const first = containers[0];
  if (!first) return;

  let firstHeight = first.offsetHeight || first.getBoundingClientRect().height;

  // 設定 section 高度
  function setSectionHeight() {
    firstHeight = first.offsetHeight || first.getBoundingClientRect().height;
    section.style.height = firstHeight * 6 + "px";
  }
  setSectionHeight();

  let ticking = false;
  let lastActive = null;
  let _myOffsetTop = 400;

  function handleScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    let active = null;
    // Use section top + multiples of first container height as virtual triggers
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

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  // 卷動時觸發
  window.addEventListener("scroll", onScroll, { passive: true });

  // resize 時重新計算
  window.addEventListener("resize", () => {
    setSectionHeight();
    handleScroll();
  });
  window.addEventListener("load", () => {
    setSectionHeight();
    handleScroll();
  });

  const media = first.querySelectorAll("img, video");
  media.forEach((m) => {
    if (m.tagName && m.tagName.toLowerCase() === "video") {
      m.addEventListener("loadedmetadata", () => {
        setSectionHeight();
        handleScroll();
      });
    } else {
      m.addEventListener("load", () => {
        setSectionHeight();
        handleScroll();
      });
    }
  });

  // 監聽 .s3 class 加入/移除事件
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        if (first.classList.contains("s3")) {
          handleS3();
        } else {
          // .s3 被移除時，清除 li 的 style
          clearLiStyles();
        }
      }
    });
  });

  observer.observe(first, { attributes: true, attributeFilter: ["class"] });

  // 處理 .s3 右側區塊動畫觸發的邏輯
  let s3Running = false;

  function handleS3() {
    const video = first.querySelector(".sys-progress .percentang video");
    const percentang = first.querySelector(".sys-progress .percentang");
    if (!video || !percentang) return;

    // 避免在 s3 狀態下重複觸發一堆次
    if (s3Running) return;
    s3Running = true;

    // 建議加上（若你 HTML 沒寫）
    video.playsInline = true;

    // 播放（要接住 Promise）
    const p = video.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        // 播放被擋：直接解除 running，等待使用者點一下解鎖後再進 s3
        s3Running = false;
      });
    }

    // 用 onended 取代 addEventListener，避免累積
    video.onended = () => {
      const liElements = first.querySelectorAll(
        ".sys-progress .function-list li:not(.percentang)"
      );

      let completedCount = 0;

      liElements.forEach((li) => {
        li.style.transition = "opacity 0.5s ease-out";
        li.style.opacity = "0";

        li.addEventListener(
          "transitionend",
          () => {
            li.style.visibility = "hidden";
            completedCount++;
            if (completedCount === liElements.length) {
              percentang.classList.add("done");
              s3Running = false; // 完成後解鎖下一次
            }
          },
          { once: true }
        );
      });
    };
  }

  // 清除 .percentang 以外的 li 的 style
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
      video.currentTime = 0; // 你要「每次進 s3 都從頭播」就留著
      video.onended = null; // 清掉 handler，避免殘留狀態
    }
    s3Running = false;
  }

  handleScroll();
})();
