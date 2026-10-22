// ============================================================
// EVR-06 hotfix v36.1 (4/6): WebGL context loss / restore.
//
// 1st loss : preventDefault (allows restore), pause the render loop, show "Restoring the 3D view…".
//            On 'webglcontextrestored' three.js re-creates its GL state; render targets, shadow maps
//            and textures with a CPU source re-upload on first use. Resources that only lived on the
//            GPU are rebuilt here: the PMREM environment (HDR is re-loaded) and the terrain texture
//            arrays (their CPU copy is freed after upload, patch 2/6).
// 2nd loss (this session, counted in sessionStorage 'ev_ctx_lost'), or no restore within 5 s:
//            switch to the lite tier at runtime: free the world, show the 2D map; the drone video,
//            plots, legend, nav and every modal keep working.
// ============================================================
import { forceLite } from './deviceTier.js?v=73';

function pill(text) {
  let el = document.getElementById('evCtxPill');
  if (!el) {
    el = document.createElement('div'); el.id = 'evCtxPill';
    el.style.cssText = 'position:absolute;left:50%;bottom:84px;transform:translateX(-50%);z-index:30;padding:8px 14px;border-radius:999px;background:rgba(10,14,22,.78);color:#f6f1e4;font:500 13px/1.2 system-ui,sans-serif;pointer-events:none';
    (document.getElementById('view3d') || document.body).appendChild(el);
  }
  el.textContent = text; el.hidden = !text;
}

export function installContextRecovery(world, { onLite } = {}) {
  const canvas = world?.renderer?.domElement || world?.canvas;
  if (!canvas || canvas.__evCtxRecovery) return;
  canvas.__evCtxRecovery = true;
  let restoreTimer = null;

  const goLite = (why) => {
    clearTimeout(restoreTimer);
    pill('');
    forceLite(why);
    try { world.disposeGPU?.(); } catch (_) {}
    try { onLite?.(why); } catch (e) { console.log('[EVR-06] lite switch', e); }
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // required for 'webglcontextrestored' to fire
    if (world._disposed) return; // our own disposeGPU() (unload / lite switch) is not a device loss
    let n = 1;
    try { n = +(sessionStorage.getItem('ev_ctx_lost') || 0) + 1; sessionStorage.setItem('ev_ctx_lost', String(n)); } catch (_) {}
    console.warn('[EVR-06] WebGL context lost (#' + n + ')');
    world.setRenderPaused?.('context-lost', true);
    if (n >= 2) { goLite('repeat-context-loss'); return; }
    pill('Restoring the 3D view…');
    restoreTimer = setTimeout(() => goLite('no-context-restore'), 5000);
  }, false);

  canvas.addEventListener('webglcontextrestored', async () => {
    clearTimeout(restoreTimer);
    console.log('[EVR-06] WebGL context restored; rebuilding GPU-only resources');
    try {
      const L = world.lighting, A = world.assetLoader;
      // PMREM env lived only on the GPU: new generator + re-load the HDR (1.6 MB, usually from cache).
      if (L?.pmrem && world.renderer) {
        const PMREM = L.pmrem.constructor; try { L.pmrem.dispose(); } catch (_) {}
        L.pmrem = new PMREM(world.renderer);
      }
      // v37 fix (Safari f4a: rock behind the gate after a restore): keep the Cycles backdrop as the background and
      // force its re-upload (its CPU image is retained), instead of falling back to the HDR stand-in.
      const bgTex = (A && A._backdropActive) ? A._hdriBgTex : null;
      if (bgTex) { bgTex.needsUpdate = true; A._restoreBg = bgTex; }
      if (A) { A._hdriEnvMap = null; A._hdriLoading = false; A._loadHDRI?.(); }
      try { L?._applySkyBackground?.(); } catch (_) {}
      // Terrain arrays: CPU copy was freed after upload; reload them into the same uniforms.
      try { const m = await import('../realism/terrainSplat.js?v=73'); await m.reloadTerrainLayers?.(world); } catch (e) { console.log('[EVR-06] terrain reload', e); }
      if (world.renderer?.shadowMap) world.renderer.shadowMap.needsUpdate = true;
      world._resize?.();
    } catch (e) { console.log('[EVR-06] restore', e); }
    pill('');
    world.setRenderPaused?.('context-lost', false);
  }, false);
}
