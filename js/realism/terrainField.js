// ============================================================
// ETERNAL VALLEY: one-ground terrain field, main-thread side (patch02)
//
// Bakes two world-space mask textures that describe the WHOLE ground with
// no zone tests (formulas in terrainMasksCore.js):
//   uField  RGBA8: R = distance to the TRUE shoreline (0..32 m), G = tree density,
//                  B = sea-beach proximity, A = aridity
//   uMacro  RGBA8: R = macro brightness, G = macro hue, B = threshold noise
// The terrain shader (terrainSplat.js) and the CPU scatter (groundWeights)
// read the same data and formulas, so ground and plants always agree.
// The bake runs in a module Worker when possible; otherwise it runs chunked
// on the main thread.
// ============================================================
import * as THREE from 'three';
import { config } from './rendererConfig.js?v=73';
import { setMaskConfig, bakeFieldArrays, setFieldData, groundWeights, NUM_LAYERS } from './terrainMasksCore.js?v=73';
export * from './terrainMasksCore.js?v=73';

const plainCfg = () => JSON.parse(JSON.stringify({ terrain: config.terrain, scatter: config.scatter }));
setMaskConfig(plainCfg());

export function resolveTier() {
  const t = config.terrain.tier;
  if (t === 'high' || t === 'mid') return t;
  if (typeof window === 'undefined') return 'high';
  if (window.EV_PERF && window.EV_PERF.terrainLayerRes) return window.EV_PERF.terrainLayerRes <= 512 ? 'mid' : 'high'; // EVR-06: tier caps (Safari has no deviceMemory)
  const lowMem = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 6;
  return (window.innerWidth <= 768 || lowMem) ? 'mid' : 'high';
}

function bakeInWorker(tier, cfg) {
  return new Promise((resolve, reject) => {
    let w;
    try { w = new Worker(new URL('./terrainFieldWorker.js?v=73', import.meta.url), { type: 'module' }); }
    catch (e) { reject(e); return; }
    const to = setTimeout(() => { w.terminate(); reject(new Error('terrain field worker timeout')); }, 30000);
    w.onmessage = (ev) => { clearTimeout(to); w.terminate(); ev.data?.error ? reject(new Error(ev.data.error)) : resolve(ev.data); };
    w.onerror = (ev) => { clearTimeout(to); w.terminate(); reject(ev.error || new Error(ev.message || 'worker error')); };
    w.postMessage({ cfg, tier });
  });
}

let _tex = null;
/** Bake (once) and return { fieldTex, macroTex, tier }. Safe to call repeatedly. */
export async function bakeTerrainField({ tier = resolveTier(), onProgress, useWorker = true } = {}) {
  if (_tex) return _tex;
  const cfg = plainCfg(); setMaskConfig(cfg);
  let d = null;
  if (useWorker && typeof Worker !== 'undefined') {
    try { d = await bakeInWorker(tier, cfg); } catch (e) { console.warn('[terrainField] worker bake failed, baking on main thread:', e?.message || e); }
  }
  if (!d) d = await bakeFieldArrays(tier, { onProgress, yieldEveryMs: 16 });
  setFieldData(d);
  const mk = (data, res) => {
    const t = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.flipY = false; t.needsUpdate = true;
    return t;
  };
  _tex = { fieldTex: mk(d.field, d.fieldRes), macroTex: mk(d.macro, d.macroRes), tier };
  return _tex;
}

let _layerMeans = null;
/** Mean linear albedo per layer (from assets manifest.json), times config.terrain.layerTint. */
export function setLayerMeans(manifest) {
  _layerMeans = config.terrain.layers.map((k) => {
    const L = manifest.layers.find((l) => l.key === k);
    const c = L ? L.meanLinearAlbedo : [0.2, 0.2, 0.2];
    const t = config.terrain.layerTint?.[k] || [1, 1, 1];
    return [c[0] * t[0], c[1] * t[1], c[2] * t[2]];
  });
}
const _w = new Float32Array(NUM_LAYERS);
/** Approximate terrain albedo (linear RGB) beneath a point, for tinting grass blades. */
export function terrainAlbedoAt(x, z, h, ny, out = new THREE.Color()) {
  const g = groundWeights(x, z, h, ny, _w);
  let r = 0, gg = 0, b = 0;
  const means = _layerMeans || [];
  for (let i = 0; i < NUM_LAYERS; i++) { const c = means[i] || [0.2, 0.2, 0.2]; r += c[0] * _w[i]; gg += c[1] * _w[i]; b += c[2] * _w[i]; }
  const at = config.terrain.antiTiling;
  const mb = 1 + (g.macro[0] - 0.5) * 2 * at.macroStrength;
  const wetK = 1 - g.wet * (1 - config.terrain.wet.darken);
  return out.setRGB(r * mb * wetK, gg * mb * wetK, b * mb * wetK, THREE.LinearSRGBColorSpace);
}


let _manifestP = null;
/** Fetch the layer manifest once (small JSON) and install the layer means for terrainAlbedoAt(). */
export function loadLayerManifest(basePath = config.terrain.texturePath) {
  if (!_manifestP) {
    _manifestP = fetch(basePath + 'manifest.json').then((r) => { if (!r.ok) throw new Error('manifest HTTP ' + r.status); return r.json(); })
      .then((m) => { setLayerMeans(m); return m; });
  }
  return _manifestP;
}
