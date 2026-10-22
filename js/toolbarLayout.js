// [v36.2] Toolbar layout helper (classic script, no dependencies).
// 1. Publishes the real bottom edge of the top bar, the district chip row and the cathedral pill as
//    CSS variables (--ev-topbar-bottom, --ev-chips-bottom, --ev-cath-bottom, --ev-topbar-bottom-et), so the pills below them
//    stack instead of overlapping, whatever the bar's height (two rows on phones, touch sizes, fonts).
// 2. Gives the district chip row a visible scroll affordance: arrow buttons plus a fade at the edge
//    that still has chips, wheel-to-horizontal scrolling, and the active chip kept in view.
// 3. Keeps aria-expanded on the menu button in sync. Layout only: no app logic is touched.
(function () {
  var D = document, root = D.documentElement;
  function bottomOf(el) {
    if (!el) return 0;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    var r = el.getBoundingClientRect();
    return r.height > 0 ? Math.round(r.bottom) : 0;
  }
  // Offsets are published relative to the box the consumers are positioned in (#view3d for the
  // chips, cathedral pill and FPS readout; the search bar's own offset parent), not the viewport.
  function topOf(el) {
    if (!el) return 0;
    var r = el.getBoundingClientRect();
    return r.height > 0 ? r.top : 0;
  }
  var raf = 0;
  function update() {
    raf = 0;
    var tb = D.getElementById('topbar'), dn = D.getElementById('districtNav'), cp = D.getElementById('cathedralNavPill');
    var v3 = D.getElementById('view3d'), et = D.getElementById('earthToolbar');
    var mt = D.getElementById('menuToggle');
    var open = !!(tb && tb.classList.contains('nav-open'));
    if (mt) mt.setAttribute('aria-expanded', open ? 'true' : 'false');
    // An opened phone menu makes the bar taller: it overlays the page, so nothing below moves.
    if (open) { if (dn) syncArrows(dn); return; }
    var tbB = bottomOf(tb) || 64;
    var base = topOf(v3);
    root.style.setProperty('--ev-topbar-bottom', Math.round(tbB - base) + 'px');
    var dnB = bottomOf(dn);
    var dnRel = dnB ? Math.round(dnB - base) : Math.round(tbB - base);
    root.style.setProperty('--ev-chips-bottom', dnRel + 'px');
    var cpB = bottomOf(cp);
    root.style.setProperty('--ev-cath-bottom', (cpB ? Math.round(cpB - base) : dnRel) + 'px');
    var etBase = et && et.offsetParent ? topOf(et.offsetParent) : 0;
    root.style.setProperty('--ev-topbar-bottom-et', Math.round(tbB - etBase) + 'px');
    if (dn) syncArrows(dn);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }

  function syncArrows(dn) {
    var l = dn.querySelector('.dn-arrow-left'), r = dn.querySelector('.dn-arrow-right');
    if (!l || !r) return;
    var max = dn.scrollWidth - dn.clientWidth;
    var canL = dn.scrollLeft > 2, canR = dn.scrollLeft < max - 2;
    if (l.hidden === canL) l.hidden = !canL;
    if (r.hidden === canR) r.hidden = !canR;
    dn.classList.toggle('can-scroll-left', canL);
    dn.classList.toggle('can-scroll-right', canR);
  }
  function makeArrow(dir) {
    var b = D.createElement('button');
    b.type = 'button';
    b.className = 'dn-arrow dn-arrow-' + dir;
    b.setAttribute('aria-label', dir === 'left' ? 'Show earlier districts' : 'Show more districts');
    b.title = dir === 'left' ? 'Earlier districts' : 'More districts';
    b.innerHTML = '<span aria-hidden="true">' + (dir === 'left' ? '&#8249;' : '&#8250;') + '</span>';
    b.hidden = true;
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var dn = b.parentElement;
      dn.scrollBy({ left: (dir === 'left' ? -1 : 1) * Math.max(160, dn.clientWidth * 0.7), behavior: 'smooth' });
    });
    return b;
  }
  function initChips() {
    var dn = D.getElementById('districtNav');
    if (!dn || dn.querySelector('.dn-arrow')) return;
    dn.insertBefore(makeArrow('left'), dn.firstChild);
    dn.appendChild(makeArrow('right'));
    dn.addEventListener('scroll', schedule, { passive: true });
    // A mouse wheel scrolls the row sideways (trackpads already do).
    dn.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && dn.scrollWidth > dn.clientWidth) {
        dn.scrollLeft += e.deltaY; e.preventDefault();
      }
    }, { passive: false });
    // Keep the chosen chip fully visible (it can be picked from elsewhere, e.g. the cathedral pill).
    dn.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('.district-btn');
      if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }
  function init() {
    initChips();
    update();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(schedule, function () {});
    var obsTargets = ['topbar', 'districtNav', 'cathedralNavPill', 'view3d', 'stage'];
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(schedule);
      obsTargets.forEach(function (id) { var el = D.getElementById(id); if (el) ro.observe(el); });
    }
    if (window.MutationObserver) {
      var mo = new MutationObserver(schedule);
      obsTargets.forEach(function (id) { var el = D.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }); });
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
