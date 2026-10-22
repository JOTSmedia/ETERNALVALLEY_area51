import { initPhotographicView } from './photographic.js?v=73';
// ============================================================
// SOMEWHERE OVER THE RAINBOW BRIDGE — boot
// ============================================================
// EVR-06: device tier first (deviceMemory, GPU string, quick probe) — before any heavy allocation.
import { EV_DEVICE, IS_LITE } from './perf/deviceTier.js?v=73';
import { generatePlots, DISTRICTS, PET_NAMES } from './terrain.js?v=73';
// [EVR-05 shell-first] world3d.js (-> WorldCore -> three) is NOT imported statically any more;
// startWorld() loads it with a dynamic import after first paint + idle (see loadWorldModule).
import { Map2D } from './map2d.js?v=73';
import { Auth } from './auth.js?v=73';
import { State } from './state.js?v=73';
import { UI } from './ui.js?v=73';
import { SEASON_STYLE, MOODS } from './ambience.js?v=73';
import { EarthView } from './earth.js?v=73';
import { Theme } from './theme.js?v=73';
import { Atmosphere } from './atmosphere.js?v=73';
import { Motion } from './motion.js?v=73';
import { hydrate as hydrateIcons } from './icons.js?v=73';
import { warmThumbs, photosReady } from './thumbs.js?v=73';
import { CharityUI } from './charityui.js?v=73';
// [EVR-05 shell-first] materials.js pulls in three; warmAllTextures is loaded lazily with the world.
import { installRenderGate } from './perf/renderGate.js?v=73';
import { WorldProgress } from './perf/worldProgress.js?v=73';
import { installContextRecovery } from './perf/contextRecovery.js?v=73'; // EVR-06 (4/6)

// ---------------- [EVR-05 shell-first] lazy 3D ----------------
// Zero 3D bytes on the critical path: the shell (HTML/CSS/UI modules) paints and becomes
// interactive first; three.js, the world modules, textures, HDR and GLB are fetched only
// after the first paint and an idle slot (or immediately when the visitor asks for 3D).
function afterFirstPaintAndIdle(timeout = 1200) {
  return new Promise((resolve) => {
    const idle = () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout });
      else setTimeout(resolve, 60);
    };
    // two rAFs = the shell frame has been committed
    requestAnimationFrame(() => requestAnimationFrame(idle));
  });
}
let _worldModulePromise = null;
function loadWorldModule() {
  if (!_worldModulePromise) {
    _worldModulePromise = import('./world3d.js?v=73').catch((e) => { _worldModulePromise = null; throw e; });
  }
  return _worldModulePromise;
}
let _texturesWarming = null;
function warmWorldTexturesLazily() {
  if (_texturesWarming) return _texturesWarming;
  _texturesWarming = import('./materials.js?v=73')
    .then((m) => m.warmAllTextures())
    .catch((e) => console.log('[boot background] Texture warming error:', e))
    .then(() => {
      // EVR-06 (Mac repro: a 2nd WebGL context, ~30 MB / 29 programs, was created 2.5-9.5 s into EVERY load, mid world build):
      // thumbnails are no longer pre-warmed at boot. They render on demand when a shop/gift panel shows them
      // (thumbImg -> placeholder -> warm), are cached in sessionStorage, and the studio context is released
      // a few seconds after the last render (thumbs.js releaseStudio).
      void warmThumbs;
    });
  return _texturesWarming;
}

window.UI = UI;

const plots = generatePlots();

// Re-apply saved ownership + customizations onto the generated world
import { SLOTS, ITEM_DECOR, GIFT_DECOR, GIFTS, CHARITIES } from './catalog.js?v=73';
function applySavedState() {
  const owned = State.data?.ownedPlots || {};
  for (const [plotId, rec] of Object.entries(owned)) {
    const p = plots.find(x => x.id === plotId);
    if (!p) continue;
    p.status = 'occupied';
    const gifts = State.data?.gifts?.[plotId] || [];
    p.memorial = { ...rec.memorial, owner: 'You', gifts: gifts.length };
    // chosen headstone
    p.decor = [{ type: 'headstone', style: rec.memorial?.headstone || 'classic' }];
    // purchased items at their chosen slots
    for (const entry of rec.decor || []) {
      const d = ITEM_DECOR[entry.itemId];
      const slot = SLOTS.find(s => s.id === entry.slot) || SLOTS[0];
      if (d) p.decor.push({ ...d, dx: slot.dx, dz: slot.dz });
    }
    // gifts laid at the base
    gifts.forEach((g, i) => {
      const gd = GIFT_DECOR[g.giftId];
      if (gd) p.decor.push({ ...gd, dx: ((i % 3) - 1) * 2.8, dz: 4.5 + Math.floor(i / 3) * 2.2 });
    });
  }
  // gifts left on pre-occupied (seeded) plots
  for (const [plotId, gifts] of Object.entries(State.data?.gifts || {})) {
    if (owned[plotId]) continue;
    const p = plots.find(x => x.id === plotId);
    if (!p) continue;
    gifts.forEach((g, i) => {
      const gd = GIFT_DECOR[g.giftId];
      if (gd) p.decor.push({ ...gd, dx: ((i % 3) - 1) * 2.8, dz: 4.5 + Math.floor(i / 3) * 2.2 });
    });
  }
}

// ---------------- Preloader ----------------
// Responsive boot time that smoothly draws full rainbow arc.
const preloader = {
  el: document.getElementById('preloader'),
  bar: document.getElementById('preloaderBarFill'),
  step(pct) {
    if (window.__setRainbowProgress) window.__setRainbowProgress(pct);
  },
  done() {
    window.__rbvBooted = true;
    window.__appBootReady = true;
    if (typeof window.__finishPreloader === 'function') {
      window.__finishPreloader();
    }
  },
  /** Boot failed. Say so on the loading screen and dismiss gracefully. */
  fail(err) {
    window.__rbvBooted = true;
    window.__appBootReady = true;
    console.log('[boot]', err);
    const note = document.getElementById('preloaderNote');
    const word = document.getElementById('preloaderWord');
    if (word) word.textContent = 'Opening Sanctuary...';
    if (note) {
      note.textContent = (err && err.message) ? err.message : String(err);
      note.classList.remove('hidden');
    }
    if (this.el) {
      this.el.classList.add('is-done');
      this.el.style.display = 'none';
      if (this.el.parentNode) this.el.remove();
    }
    if (typeof window.enter === 'function') {
      window.enter('film');
    }
  },
};

// A live line on the welcome screen: what the valley looks like right now.
function describeNow(snap) {
  const el = document.getElementById('welcomeNow');
  if (!el) return;
  const season = SEASON_STYLE[snap.season].name.split(' — ')[0];
  el.textContent = `${snap.label} in the valley · ${season}`;
}

/**
 * Build the 3D valley and the 2D map. Runs after the entrance is on
 * screen, so a slow CDN delays only the Sanctuary, never the door.
 * Returns the same promise on repeat calls.
 */
let worldPromise = null;
let _worldFailures = 0; // EVR-06: a failed build used to be retried by every caller, each time with a NEW WebGL context
function startWorld(plots) {
  // EVR-06 lite tier: never build the 3D world (no three.js, no GPU allocations).
  // Callers get the independent 2D map; the drone tour is a video and needs no world.
  if (IS_LITE || _worldFailures >= 1) {
    return UI.ensureMap().then((map) => ({ world: null, map: map || null }));
  }
  if (window.world || UI.world) {
    const w = window.world || UI.world;
    if (!UI.world) UI.world = w;
    if (!window.world) window.world = w;
    return Promise.resolve({ world: w, map: UI.map });
  }
  if (!worldPromise) {
    const _failedWorld = { w: null };
    worldPromise = (async () => {
      try {
        // [EVR-05 shell-first] never compete with the shell's first paint
        WorldProgress.show();
        await afterFirstPaintAndIdle();
        WorldProgress.set(2, 'Loading the 3D engine…');
        try { performance.mark('ev:world-import-start'); } catch (_) {}
        const { World3D } = await loadWorldModule();
        try { performance.mark('ev:world-import-done'); } catch (_) {}
        WorldProgress.set(8, 'Building the valley…');
        warmWorldTexturesLazily();

        let canvas = document.getElementById('canvas3d');
        if (!canvas) {
          
          canvas = document.querySelector('canvas#canvas3d');
        }
        
        // EVR-06 (4/6): the old one-shot handler jumped to the Google map on any context loss.
        // contextRecovery.js restores in place on the 1st loss and switches to lite on a repeat loss.
        try { sessionStorage.setItem('ev_build_inflight', '1'); } catch (_) {}
        const world = _failedWorld.w = new World3D(canvas, plots, (p) => UI.openPlot(p));
        installRenderGate(world); // [EVR-05 shell-first] pause while hidden / a modal covers the canvas
        installContextRecovery(world, { onLite: () => {
          window.world = null; UI.world = null; worldPromise = null; window.__startWorldPromise = null;
          UI.toast('3D was paused to keep your device stable. Showing the map instead.', 6000, 'sparkle');
          if (UI._currentView === 'view3d' && !document.getElementById('veoDroneTourVideo')?.offsetParent) UI.show2D();
        } });
        
        // Start building the asynchronous features (water, plots, gate, bridge, islands, etc.)
        await world.initAsync().catch(e => console.warn('[world] async initialization error:', e));
        try { world.setRenderPaused?.('build', false); } catch (_) {} // EVR-06: never leave the build pause on after an init error

        window.world = world;
        window.UI = window.UI || UI;
        window.UI.world = world;
        console.log('[boot] window.world assigned, creating Map2D...');
        world.onAmbience = (w, season) => {
          Theme.setMood(w.mood);
          UI.toast(`${SEASON_STYLE[season].name} · ${MOODS[w.mood].label}${w.live ? ' (live weather)' : ''}`, 5000);
        };
        let map = UI.map || await UI.ensureMap(); // EVR-06: one Map2D, built independently of the world
        if (!map) {
          map = new Map2D(document.getElementById('canvas2d'), plots,
            (p) => { UI.openPlot(p); world.selectPlot(p); });
        }
        
        UI.attachWorld(world, map);
        WorldProgress.done();
        try { sessionStorage.removeItem('ev_build_inflight'); sessionStorage.removeItem('ev_build_died'); } catch (_) {} // EVR-06 crash-loop breaker: build finished
        try { performance.mark('ev:world-ready'); } catch (_) {}
        
        return { world, map };
      } catch (e) {
        console.log('[world] failed to initialize 3D world:', e.stack || e);
        WorldProgress.fail();
        // EVR-06: free the half-built world's context and stay on the 2D map (no retry storm, no extra
        // Google-globe WebGL context). Every UI function keeps working on the map.
        _worldFailures++;
        try { _failedWorld.w?.disposeGPU?.(); } catch (_) {}
        try { sessionStorage.removeItem('ev_build_inflight'); } catch (_) {}
        const map = await UI.ensureMap().catch(() => null);
        try { if (UI._currentView === 'view3d') await UI.show2D(); } catch (_) {}
        try { UI.toast('3D could not start on this device. Showing the map instead.', 6000, 'sparkle'); } catch (_) {}
        return { world: null, map };
      }
    })();
    window.__startWorldPromise = worldPromise;
  }
  return worldPromise;
}

let tickerInterval = null;
function startTicker() {
  const tickerEl = document.getElementById('welcomeTicker');
  if (!tickerEl) return;
  
  const dk = Object.values(DISTRICTS);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  function getSafeMessage() {
    const type = Math.random();
    const pet = rand(PET_NAMES);
    
    const wrap = document.createElement('span');
    if (type < 0.4) {
      const gift = rand(GIFTS);
      wrap.innerHTML = `<span class="ticker-gold-mark">✦</span> <b>${pet}</b> received <b>${gift.name}</b> tribute`;
    } else if (type < 0.8) {
      const dist = rand(dk);
      wrap.innerHTML = `<span class="ticker-gold-mark">✦</span> Memorial placed for <b>${pet}</b> in <b>${dist.name}</b>`;
    } else {
      const charity = rand(CHARITIES);
      const amount = Math.floor(Math.random() * 80) + 10;
      wrap.innerHTML = `<span class="ticker-gold-mark">✦</span> <b>${pet}</b>’s family raised <b>$${amount}</b> for <b>${charity.name}</b>`;
    }
    return wrap.innerHTML;
  }

  let activeEl = null;

  function tick() {
    if (!document.getElementById('welcomeTicker')) {
      if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
      return;
    }
    if (activeEl) {
      activeEl.classList.remove('is-active');
      activeEl.classList.add('is-exit');
      const old = activeEl;
      setTimeout(() => { if (old.parentNode) old.remove(); }, 1000);
    }
    
    const newEl = document.createElement('div');
    newEl.className = 'welcome-ticker-content';
    newEl.innerHTML = getSafeMessage();
    tickerEl.appendChild(newEl);
    
    // trigger reflow
    void newEl.offsetWidth;
    
    newEl.classList.add('is-active');
    activeEl = newEl;
  }
  
  tick();
  tickerInterval = setInterval(tick, 4000);

  // Pause ticker when tab is hidden to prevent battery drain & reference leaks
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
    } else if (!tickerInterval && document.getElementById('welcomeTicker')) {
      tickerInterval = setInterval(tick, 4000);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (tickerInterval) clearInterval(tickerInterval);
  });
}

let hasEntered = false;
let enterPromise = null;
/**
 * Cross into the site. Runs automatically once loading finishes —
 * the loading screen should not hand off to another door.
 */
export async function enter(mode = 'film') {
  if (mode === 'tour' && (window.EVNav && !window.EVNav.droneAllowed())) mode = '3d'; // [nav-EVR-04] drone tour off by default
  console.log('[enter] entering sanctuary in mode:', mode);
  if (hasEntered && enterPromise) return enterPromise;
  hasEntered = true;
  enter._done = true;

  enterPromise = (async () => {
    try {
      const preloaderEl = document.getElementById('preloader');
      if (preloaderEl) {
        preloaderEl.classList.add('is-done');
        preloaderEl.style.pointerEvents = 'none';
        setTimeout(() => {
          if (preloaderEl.parentNode) preloaderEl.remove();
        }, 900);
      }
      if (tickerInterval) {
        clearInterval(tickerInterval);
        tickerInterval = null;
      }
      try {
        if (window.__evAtmosphere?.stop) window.__evAtmosphere.stop();
      } catch (e) {
        console.log('[enter] atmosphere stop error:', e);
      }
      const welcome = document.getElementById('welcome');
      if (welcome && welcome.parentNode) {
        welcome.remove();
      }
      document.body.classList.add('has-entered');
      const topbar = document.getElementById('topbar');
      if (topbar) topbar.classList.remove('hidden');
      const stage = document.getElementById('stage');
      if (stage) {
        stage.classList.remove('hidden');
        stage.style.display = 'block';
      }

      setTimeout(() => {
        document.getElementById('earthToolbar')?.classList.remove('is-waiting');
        document.getElementById('globeCta')?.classList.remove('is-waiting');
      }, 100);

      if (mode === 'photographic' || mode === 'film' || mode === 'tour') {
        if (mode === 'photographic') await UI.showPhotographic();
        else await UI.startFilmTour(0);
      } else if (mode === '3d' || mode === 'tour') {
        try {
          if (mode === 'tour') {
            console.log('[enter] tour mode requested: launching Veo Drone Tour immediately');
            if (window.VeoTour) window.VeoTour.start(0);
            else if (window.veoTour) window.veoTour.start(0);
            UI.show3D('tour', false).catch(e => console.log('[enter] initial show3D tour call:', e));
          }

          if (IS_LITE) {
            // EVR-06 lite: tour = drone video (already started above); '3d' = the 2D map. No world, no throw.
            if (mode !== 'tour') await UI.show2D();
            UI.ensureMap();
            throw { evLite: true };
          }
          console.log('[enter] starting/awaiting startWorld...');
          const res = await startWorld(plots);
          
          if (window.world) {
            if (window.world.start) window.world.start();
            if (window.world._resize) window.world._resize();
          }
          
          if (!res || !res.world) {
            if (_worldFailures) { await UI.show2D(); throw { evLite: true }; } // EVR-06: failed build -> 2D map, not the Google globe
            throw new Error('3D World failed to initialize');
          }
          
          console.log('[enter] startWorld resolved, world ready:', !!UI.world);
          if (mode === 'tour') {
            if (window.VeoTour) window.VeoTour.start(0);
            else if (window.veoTour) window.veoTour.start(0);
            if (UI.world?.setMode) UI.world.setMode('tour');
          } else {
            if (UI._currentView !== 'viewPhotographic') await UI.show3D(mode === '3d' ? 'orbit' : mode, false);
            else UI.world?.stop();
          }
        } catch (e) {
          if (e && e.evLite) { /* EVR-06 lite path handled above */ } else {
          console.log('[enter] 3D world failed, falling back to Earth:', e);
          if (window.UI && window.UI.showEarth) {
            window.UI.showEarth();
          } else {
            try { await UI.showGlobe(); } catch (e2) {
              console.log('[enter] Globe fallback failed, falling back to 2D:', e2);
              try { await UI.show2D(); } catch {}
            }
          }
          }
        }
      } else if (mode === 'globe') {
        try {
          await UI.showGlobe();
          console.log('[enter] showGlobe resolved');
        } catch (e) {
          console.log('[enter] Globe failed, falling back to 3D:', e);
          try {
            await startWorld(plots);
            await UI.show3D('tour');
          } catch (e2) {
            try { await UI.show2D(); } catch {}
          }
        }
      } else if (mode === 'earth') {
        try {
          await UI.showEarth();
        } catch (e) {
          try { await UI.showGlobe(); } catch {}
        }
      } else if (mode === '2d') {
        try {
          await UI.show2D();
        } catch (e) {
          try {
            await startWorld(plots);
            await UI.show3D('tour');
          } catch {}
        }
      }

      // Multi-stage canvas and camera resize dispatch
      const triggerCanvasResize = () => {
        window.dispatchEvent(new Event('resize'));
        if (UI.world?._resize) UI.world._resize();
        if (UI.world?.start) UI.world.start();
        if (UI.globe?.resize) UI.globe.resize();
        if (UI.map?._resize) UI.map._resize();
      };
      requestAnimationFrame(triggerCanvasResize);
      setTimeout(triggerCanvasResize, 50);
      setTimeout(triggerCanvasResize, 200);
      setTimeout(triggerCanvasResize, 500);

      // Shared memorial deep links: ?m=<earth id>, ?p=<sanctuary plot id>, ?campaign=<id>, ?charity=<id>
      try {
        const params = new URLSearchParams(location.search);
        
        if (params.get('paid') === '1') {
          UI.toast('Your memorial contribution was received. It will appear shortly.', 8000, 'crest');
          params.delete('paid');
          window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
        }
        
        if (params.get('tour') === 'true' || params.has('tour')) {
          setTimeout(() => {
            if (typeof window.enter === 'function') window.enter('film');
          }, 100);
        }
        
        const memId = params.get('m');
        if (memId) {
          const { allMemorials } = await import('./social.js?v=73');
          const m = allMemorials(State.data).find(x => x.id === memId);
          if (m) setTimeout(() => { UI.showEarth(); UI.openEarthMemorial(m); }, 1200);
          else UI.toast('That memorial link could not be found on this device.');
        }
        const plotId = params.get('p');
        if (plotId) {
          const pl = plots.find(x => x.id === plotId);
          if (pl) await UI.visitPhotographicPlot(pl);
        }
        const cmpId = params.get('campaign');
        if (cmpId) {
          const { Campaigns } = await import('./charity.js?v=73');
          const c = Campaigns.get(cmpId);
          if (c) setTimeout(() => CharityUI.campaignModal(UI, c), 1200);
        }
        const chId = params.get('charity');
        if (chId) {
          const { charityById } = await import('./charity.js?v=73');
          const ch = charityById(chId);
          if (ch) setTimeout(() => UI.shelterModal(ch), 1200);
        }
        // Partner referrals: ?ref=<partner-code> (vets, cremators, shelters)
        const ref = params.get('ref');
        if (ref) {
          try { localStorage.setItem('ev_ref', ref.slice(0, 40)); } catch {}
          const cfg = await import('./config.js?v=73');
          if (cfg.HAS_API) {
            let consent = false;
            try { consent = localStorage.getItem('ev_privacy_consent') === 'true'; } catch {}
            if (consent) {
              fetch(cfg.API_BASE + '/track', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: 'referral', name: 'Partner referral: ' + ref.slice(0, 40), amount: 0, user: 'visitor' }),
              }).catch(() => {});
            }
          }
          UI.toast('Welcome — you were referred by a caring partner.', 'heart');
        }
      } catch (err) {
        console.log('[enter] URL param handling failed:', err);
      }
    } catch (err) {
      console.log('[enter] enter error, resetting entry flag:', err);
      hasEntered = false;
      enter._done = false;
      enterPromise = null;
      throw err;
    }
  })();

  return enterPromise;
}
window.enter = enter;

// Immediately expose checkAndEnterApp so preloader or button clicks can trigger it

window.__checkAndEnterApp = () => {
  if (window.__appBootReady || window.__rainbowAnimationReady) {
    enter('film');
  }
};
// Auto-trigger it once boot finishes!
const originalBoot = boot;


async function boot() { 
  console.log('[boot] 1: Theme.init, Icons & Early UI.init');
  try {
    Theme.init();
    hydrateIcons(document);
    window.UI = UI;
    UI.init({ earth: null, plots, ensureWorld: () => startWorld(plots) });
    initPhotographicView(UI);
  } catch (e) {
    console.log('[boot] Theme/icons/UI init error:', e);
  }
  // [EVR-05 shell-first] The shell is ready now: dismiss the preloader instead of waiting
  // for the 3D world. The opening film starts as soon as the shell is ready;
  // the optional 3D world is loaded only when the visitor requests it.
  try { performance.mark('ev:shell-ui-ready'); } catch (_) {}
  preloader.step(100);
  preloader.done();
  if (IS_LITE) {
    // EVR-06 lite: the 2D map is built right away (it never waited for the world in lite); no 3D build at all.
    try { document.body.classList.add('ev-lite'); } catch (_) {}
    UI.ensureMap();
  }
  // The optional 3D preview is loaded only when explicitly requested.

  // Background non-blocking warmups & async tasks
  (async () => {
    console.log('[boot background] Atmosphere, Ticker, Auth & State...');
    try {
      startTicker();
      const atmosphereEl = document.getElementById('atmosphere');
      if (atmosphereEl) {
        const atmosphere = new Atmosphere(atmosphereEl);
        Theme.onChange(snap => { atmosphere.setTheme(snap); describeNow(snap); });
        atmosphere.start();
        window.__evAtmosphere = atmosphere;
      }
      Motion.enhance(document);
      Motion.cursorGlow();
    } catch (e) {
      console.log('[boot background] Atmosphere/Motion error:', e);
    }

    try {
      await Promise.all([
        photosReady.catch(e => console.log('[boot background] photosReady error:', e)),
        Auth.init().then(() => State.init(Auth.user)).catch(e => console.log('[boot background] Auth/State error:', e)),
      ]);
      applySavedState();
    } catch (e) {
      console.log('[boot background] Auth/State step error:', e);
    }

    // [EVR-05 shell-first] PBR texture + thumbnail warming moved to warmWorldTexturesLazily(),
    // started by startWorld() once the world module is loading (keeps three off the critical path).
  })();

  // Dev handle: lets the valley be inspected and its clock overridden
  const isProd = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
  
  if (!isProd) {
    // Dev-only globals for console debugging — never exposed in production
    window.UI = UI;
    window.world = window.world || UI.world;
    window.RBV = {
      UI, Theme, get atmosphere() { return window.__evAtmosphere; }, plots, get earth() { return UI.earth; },
      /** Forget the visitor has seen the tour, so it auto-plays again. */
      resetTour() { try { localStorage.removeItem('ev_tour_seen_v1'); } catch {} return 'tour will play on next load'; },
      get world() { return UI.world; },
      get map() { return UI.map; },
      ready: () => startWorld(plots),
      setPhase(key) { UI.world?.forcePhase(key); Theme.forcePhase?.(key); return key; },
      setMood(mood) { if (UI.world) { UI.world.mood = mood; UI.world.applyAmbience(); } Theme.setMood(mood); return mood; },
    };
  }
  
  // Ensure IS_ADMIN chip cannot be trivially spoofed on client-side in production
  if (isProd) {
    try {
      localStorage.removeItem('ev_admin_mode');
      const params = new URLSearchParams(window.location.search);
      if (params.has('admin') || params.has('dev')) {
        params.delete('admin');
        params.delete('dev');
        params.delete('mode');
        const clean = params.toString();
        window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname);
        // No reload — replaceState already cleaned the URL and IS_ADMIN was
        // evaluated at module parse time so stripping params is cosmetic only.
      }
    } catch {}
  }

  // Primary enter buttons
  document.getElementById('enterBtn')?.addEventListener('click', () => enter('film'));
  document.getElementById('sanctuaryEntryBtn')?.addEventListener('click', () => enter('film'));
  document.getElementById('enterValleyBtn')?.addEventListener('click', () => UI.startFilmTour(0));
  document.getElementById('btn3d')?.addEventListener('click', () => UI.show3D('orbit'));
  document.getElementById('btnGlobe')?.addEventListener('click', () => UI.showGlobe());

  // "Create a Memorial — Guided Journey" enters, then opens the wizard
  document.getElementById('wizardEntryBtn')?.addEventListener('click', async () => {
    await enter('photographic');
    setTimeout(() => UI.griefWizardModal(), 800);
  });

  // The ledger opens over the entrance without crossing the bridge
  // first — the point of publishing it is that it can be checked
  // before anyone is asked for anything.
  for (const id of ['welcomeLedger', 'welcomeLedger2']) {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      CharityUI.ledgerModal(UI);
    });
  }
  document.getElementById('ctaCampaigns')?.addEventListener('click', (e) => {
    e.preventDefault();
    CharityUI.togglePanel(UI);
  });

  // Entry is now handled by __finishPreloader -> completeAndDismiss -> enter('film')
  // No need for a redundant trigger here.
}

boot().catch(err => preloader.fail(err));

// EVR-06 (4/6): a normal unload/reload during the build is not a crash.
window.addEventListener('pagehide', () => { try { sessionStorage.removeItem('ev_build_inflight'); } catch (_) {} });

// -------- Global error boundary --------
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason || '');
  if (/ResizeObserver|AbortError|cancelled|canceled/i.test(msg)) return;
  console.log('[unhandledrejection]', e.reason);
  try { UI?.toast('Something went wrong — please reload if the page looks broken.', 6000, 'warning'); } catch {}
});
window.addEventListener('error', (e) => {
  if (/WebGL|context lost/i.test(e.message || '')) return;
  console.log('[error]', e.message, e.filename, e.lineno);
});

// -------- Mobile menu --------
function initMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const topbar = document.getElementById('topbar');
  if (menuToggle && topbar && !menuToggle._bound) {
    menuToggle._bound = true;
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      topbar.classList.toggle('nav-open');
    });
    document.addEventListener('click', (e) => {
      if (topbar.classList.contains('nav-open') && !topbar.contains(e.target)) {
        topbar.classList.remove('nav-open');
      }
    });
    topbar.querySelectorAll('a, button').forEach(el => {
      if (el.id === 'navDropdownToggle' || el.id === 'menuToggle') return; // [v36 polish] phone: the menu button and Explore must not collapse the menu they just opened
      el.addEventListener('click', () => {
        setTimeout(() => topbar.classList.remove('nav-open'), 120);
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileMenu);
} else {
  initMobileMenu();
}
