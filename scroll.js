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
    section.style.height = firstHeight * 7 + "px";
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
    for (let i = 0; i < 6; i++) {
      const triggerTop = sectionTop + i * firstHeight;
      if (scrollY >= triggerTop - _myOffsetTop) active = i;
    }

    if (active === null) {
      for (let n = 1; n <= 6; n++) first.classList.remove("s" + n);
      lastActive = null;
      return;
    }

    if (active === lastActive) return;
    for (let n = 1; n <= 6; n++) first.classList.remove("s" + n);
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

  handleScroll();
})();
