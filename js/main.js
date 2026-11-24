(function () {
  const progress = document.getElementById("progress");
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("navMenu");
  const themeButton = document.getElementById("themeToggle");
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;

  if (themeButton) {
    const light = root.getAttribute("data-theme") === "light";
    themeButton.setAttribute("aria-pressed", light ? "true" : "false");
    themeButton.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toggle.addEventListener("click", function () {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  const stars = Array.from({ length: 70 }, function () {
    return { x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, a: Math.random() };
  });

  function resize() {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
  }
  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(function (star) {
      star.a += 0.008;
      ctx.beginPath();
      const light = root.getAttribute("data-theme") === "light";
      const ink = light ? "109,40,217" : "224,196,138";
      ctx.fillStyle = "rgba(" + ink + "," + (0.25 + Math.sin(star.a) * 0.25) + ")";
      ctx.arc(star.x * canvas.width, star.y * canvas.height, star.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      requestAnimationFrame(drawStars);
    }
  }
  window.addEventListener("resize", resize);
  resize();
  drawStars();
})();
