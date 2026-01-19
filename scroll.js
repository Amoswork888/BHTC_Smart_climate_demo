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

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        handleBackToTop();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

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
})();
