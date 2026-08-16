(function () {
  const pointsEl = document.getElementById("pointsNum");
  if (!pointsEl) return;

  // Prefer the value the tracker screen just recorded (sessionStorage).
  // Fall back to a ?points= query param so this screen can be opened
  // and tested on its own, e.g. confirmation.html?points=12
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("points");
  const fromSession = sessionStorage.getItem("habitPoints");
  const raw = Number(fromQuery ?? fromSession ?? 0);
  const target = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;

  countUpTo(pointsEl, target);

  function countUpTo(el, target, duration = 900) {
    if (target === 0) {
      el.textContent = "0";
      return;
    }
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic — fast start, gentle landing
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target; // guarantee it lands exactly on target, no rounding drift
      }
    }
    requestAnimationFrame(tick);
  }
})();
