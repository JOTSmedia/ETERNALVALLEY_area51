// [EVR-05 shell-first] Small "valley loading" pill shown while the lazily-imported 3D
// world downloads and builds. The site shell is fully usable meanwhile.
// It listens to the same progress hook the world stages already report into
// (window.__setRainbowProgress) — after the preloader has gone that hook is free.

let el = null, bar = null, label = null, shown = false, finished = false;

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'evWorldProgress';
  el.className = 'ev-world-progress';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<span class="ev-wp-label">Preparing the valley…</span>' +
    '<span class="ev-wp-track"><span class="ev-wp-fill"></span></span>';
  label = el.querySelector('.ev-wp-label');
  bar = el.querySelector('.ev-wp-fill');
  (document.getElementById('view3d') || document.body).appendChild(el);
  return el;
}

export const WorldProgress = {
  pct: 0,
  show() {
    if (shown || finished) return;
    shown = true;
    ensure();
    // Chain the world's stage progress into the pill (the preloader's own handler, if any,
    // still runs; it is a no-op once the preloader is gone).
    const prev = window.__setRainbowProgress;
    window.__setRainbowProgress = (pct) => {
      try { if (typeof prev === 'function') prev(pct); } catch (_) {}
      // WorldCore.initAsync stages report 55..95 (calibrated for the old preloader);
      // map that onto 12..98 of the pill
      if (!finished) WorldProgress.set(12 + (Math.max(55, Math.min(95, pct)) - 55) * (86 / 40));
    };
    requestAnimationFrame(() => el && el.classList.add('is-on'));
  },
  set(pct, text) {
    if (!el || finished) return;
    this.pct = Math.max(this.pct, Math.min(100, pct));
    bar.style.width = this.pct.toFixed(1) + '%';
    if (text) label.textContent = text;
    else label.textContent = 'Building the valley… ' + Math.round(this.pct) + '%';
  },
  done() {
    if (finished) return;
    finished = true;
    if (!el) return;
    bar.style.width = '100%';
    label.textContent = 'Valley ready';
    el.classList.add('is-done');
    setTimeout(() => { el && el.remove(); el = null; }, 900);
  },
  fail() {
    if (!el) return;
    label.textContent = '3D valley unavailable — 2D map and globe still work';
    el.classList.add('is-failed');
    setTimeout(() => { el && el.remove(); el = null; }, 6000);
  },
};
