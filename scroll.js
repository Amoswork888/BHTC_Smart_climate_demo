(function () {
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
  function handleS3() {
    const video = first.querySelector(".sys-progress .percentang video");
    if (!video) return;

    // 播放影片
    video.play();

    // 監聽影片播放完成
    video.addEventListener(
      "ended",
      () => {
        // 獲取 .percentang 以外的所有 li
        const liElements = first.querySelectorAll(
          ".sys-progress .function-list li:not(.percentang)"
        );

        // 對每個 li 做 fadeout
        liElements.forEach((li) => {
          li.style.transition = "opacity 0.5s ease-out";
          li.style.opacity = "0";

          // fadeout 完成後設定 display: none
          li.addEventListener(
            "transitionend",
            () => {
              li.style.display = "none";
            },
            { once: true }
          );
        });
      },
      { once: true }
    );
  }

  // 清除 .percentang 以外的 li 的 style
  function clearLiStyles() {
    const liElements = first.querySelectorAll(
      ".sys-progress .function-list li:not(.percentang)"
    );

    liElements.forEach((li) => {
      li.style.transition = "";
      li.style.opacity = "";
      li.style.display = "";
    });
  }

  handleScroll();
})();
