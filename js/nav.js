// [nav-EVR-04] Drone tour optional (OFF by default, persisted toggle) + Drone Tour active-tab fix.
// Explicit drone buttons and ?tour=true links still start the tour.
const KEY = 'ev_drone_tour_enabled';
let explicitUntil = new URLSearchParams(location.search).has('tour') ? performance.now() + 60000 : 0;
const EVNav = {
  get droneEnabled() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
  set droneEnabled(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch {} const t = document.getElementById('evDroneToggle'); if (t) t.checked = !!v; },
  droneAllowed() { return this.droneEnabled || performance.now() < explicitUntil; },
  markExplicit() { explicitUntil = performance.now() + 120000; }, // survives slow world loads
  clearExplicit() { explicitUntil = 0; },
  postUpdate() {},
};
window.EVNav = EVNav;

['btnDroneTour', 'navDroneTourBtn', 'droneTourToolbarBtn', 'globeDroneTourBtn', 'droneTourEntryBtn'].forEach(id =>
  document.addEventListener('click', e => { if (e.target.closest?.('#' + id)) EVNav.markExplicit(); }, true));

// Choosing any other view cancels a pending explicit tour request.
['btn3d', 'btnGlobe', 'btnEarth', 'btn2d'].forEach(id =>
  document.addEventListener('click', e => { if (e.target.closest?.('#' + id)) EVNav.clearExplicit(); }, true));

// Drone Tour tab is highlighted only while a tour is actually running.
function syncTabs() {
  const w = window.world;
  const v3d = document.getElementById('view3d');
  if (!v3d || v3d.classList.contains('hidden')) return;
  const touring = !!(w?.tourController?.tourMode || window.VeoTour?.isPlaying);
  const d = document.getElementById('btnDroneTour'), s = document.getElementById('btn3d');
  d?.classList.toggle('active', touring); s?.classList.toggle('active', !touring);
  d?.setAttribute('aria-pressed', String(touring)); s?.setAttribute('aria-pressed', String(!touring));
}

function addToggle() {
  const host = document.getElementById('btnDroneTour')?.parentElement;
  if (!host || document.getElementById('evDroneToggle')) return;
  const l = document.createElement('label');
  l.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:0 8px;cursor:pointer;white-space:nowrap';
  l.title = 'Start the cinematic drone tour automatically when entering the valley';
  l.innerHTML = '<input type="checkbox" id="evDroneToggle"> Auto tour';
  host.appendChild(l);
  const t = l.querySelector('input'); t.checked = EVNav.droneEnabled;
  t.onchange = () => { EVNav.droneEnabled = t.checked; };
}
setInterval(syncTabs, 400);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addToggle); else addToggle();
