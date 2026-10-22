// ============================================================
// ETERNAL VALLEY: one-ground terrain masks, pure JS core (patch02)
// No three.js and no rendererConfig import, so it also runs inside a Web
// Worker (import maps don't apply to workers). The main thread passes the
// config sections in with setMaskConfig().
//
// Bakes two world-space mask textures that describe the WHOLE ground with
// no zone tests:
//   uField  RGBA8: R = distance to water (0..32 m), G = tree density 0..1,
//                  B = beach proximity 0..1,       A = aridity 0..1
//   uMacro  RGBA8: R = macro brightness, G = macro hue, B = threshold noise
// The terrain shader (terrainSplat.js) and the CPU scatter (groundWeights()
// below) read the SAME textures and the SAME formulas, so trees, grass and
// ground colour always agree and never stop at a line.
// ============================================================
import { fbm, getRiverInfo, distToRoads, isUnderWater } from '../terrain.js?v=73';

export const WORLD_HALF = 3535.535;            // terrain plane is 7071.07 m square, centred at 0
export const LAYER = { granite: 0, sandstone: 1, wetPebbles: 2, beachSand: 3, desertSand: 4, meadow: 5, forestFloor: 6, snow: 7 };
export const NUM_LAYERS = 8;
const WATER_RANGE = 32.0;                       // metres encoded in field.R

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
let config = null;
/** Must be called (main thread and worker) before anything else. cfg = { terrain, scatter } plain objects. */
export function setMaskConfig(cfg) { config = cfg; }

export const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }; // == GLSL smoothstep

// ---------- analytic masks (cheap: no terrainHeight calls) ----------
/** Horizontal distance (m) from (x,z) to the nearest water edge; 0 on/in water. */
export function distToWater(x, z) {
  const wb = config.terrain.waterBodies;
  let d = Infinity;
  const oz = wb.oceanLineZ - (wb.coastCurve || 0) * x * x;   // [v36] coast arc (terrain.js coastZ)
  const rb = wb.riverBox || [-90, 320, -620];
  if (z > rb[2] && z < oz + 60 && x > rb[0] && x < rb[1]) {   // river polyline bbox (+70 m)
    const ri = getRiverInfo(x, z);
    d = Math.min(d, ri.dist - wb.riverHalfWidth);
  }
  d = Math.min(d, Math.hypot(x - wb.lake.x, z - wb.lake.z) - wb.lake.r);
  d = Math.min(d, Math.hypot(x - wb.plunge.x, z - wb.plunge.z) - wb.plunge.r);
  if (z >= oz) {
    // Open ocean except on islands: distance from inside an island to its shore
    let inIsland = Infinity;
    for (const is of wb.islands) {
      const di = Math.hypot(x - is.x, z - is.z);
      if (di < is.r) inIsland = Math.min(inIsland, is.r - di);
    }
    d = Math.min(d, inIsland === Infinity ? 0 : inIsland);
  } else {
    d = Math.min(d, oz - z);
  }
  return Math.max(0, d);
}

/** Distance to the sea shore only (beaches); lakes/rivers get wet pebbles, not sand. */
function distToSea(x, z) {
  const wb = config.terrain.waterBodies;
  const oz = wb.oceanLineZ - (wb.coastCurve || 0) * x * x;
  if (z < oz) return oz - z;
  let inIsland = Infinity;
  for (const is of wb.islands) {
    const di = Math.hypot(x - is.x, z - is.z);
    if (di < is.r) inIsland = Math.min(inIsland, is.r - di);
  }
  return inIsland === Infinity ? 0 : inIsland;
}

function aridity(x, z) {
  const a = config.terrain.arid;
  let v = 0;
  // Noise-perturbed radius so the desert edge is ragged, never a circle.
  const wob = (fbm(x * 0.004 + 31.7, z * 0.004 - 12.3, 3) / 0.875 - 0.5) * a.feather * 1.2;
  for (const c of a.centers) {
    const d = Math.hypot(x - c.x, z - c.z) + wob;
    v = Math.max(v, 1 - smooth(c.r - a.feather * 0.5, c.r + a.feather * 0.5, d));
  }
  return v;
}

function softClearings(x, z) {
  const sc = config.scatter;
  let keep = 1;
  for (const c of sc.clearings) {
    const d = Math.hypot(x - c.x, z - c.z);
    keep *= 1 - (c.s ?? 1) * (1 - smooth(c.r, c.r + c.f, d));
  }
  for (const b of sc.corridors) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    keep *= smooth(0, b.f, Math.hypot(dx, dz));
  }
  return keep;
}

/** Tree-density intent (0..1) before slope/height limits. Also the forest-floor mask. */
export function treeDensityRaw(x, z, dWater = distToWater(x, z)) {
  const t = config.scatter.treeDensity;
  let v = clamp01((fbm(x * t.freq, z * t.freq, t.octaves) / 0.875 - 0.5) * t.gain + 0.5 + t.bias);
  if (v <= 0) return 0;
  v *= smooth(t.waterClear, t.waterClear + t.waterFeather, dWater);
  if (v <= 0) return 0;
  v *= softClearings(x, z);
  if (v <= 0) return 0;
  v *= smooth(t.roadClear, t.roadClear + t.roadFeather, distToRoads(x, z));
  return v;
}

// ---------- bake ----------
const _state = { field: null, macro: null, fieldRes: 0, macroRes: 0, ready: false };

/**
 * Bake the uField + uMacro byte arrays. With yieldEveryMs (main-thread fallback)
 * it yields like _terrain(); in the worker it runs flat out.
 * @returns {Promise<{field: Uint8Array, macro: Uint8Array, fieldRes: number, macroRes: number}>}
 */
export async function bakeFieldArrays(tier, { onProgress, yieldEveryMs = 0 } = {}) {
  const fr = config.terrain.fieldRes[tier], mr = config.terrain.macroRes[tier];
  const field = new Uint8Array(fr * fr * 4), macro = new Uint8Array(mr * mr * 4);
  const sand = config.terrain.sand;
  let last = performance.now();
  const yieldMain = async () => { if (yieldEveryMs > 0 && performance.now() - last > yieldEveryMs) { await new Promise(r => setTimeout(r, 0)); last = performance.now(); } };

  // Pass A: analytic shore distance everywhere; within SHORE_BAND of an analytic
  // shore, test the real water surface (isUnderWater uses terrainHeight), then
  // a two-pass chamfer transform gives metres to the TRUE shoreline (the lake
  // basin's waterline sits ~20 m outside lake.r, for example).
  const SHORE_BAND = 70, cell = WORLD_HALF * 2 / fr;
  const dist = new Float32Array(fr * fr);
  const BIG = 1e6;
  for (let j = 0; j < fr; j++) {
    const z = -WORLD_HALF + (j + 0.5) / fr * WORLD_HALF * 2;
    for (let i = 0; i < fr; i++) {
      const x = -WORLD_HALF + (i + 0.5) / fr * WORLD_HALF * 2;
      const dA = distToWater(x, z);
      const k = j * fr + i;
      if (dA < SHORE_BAND) dist[k] = isUnderWater(x, z) ? 0 : BIG;
      else dist[k] = dA;                       // far from water: analytic is fine (and capped at 32 m anyway)
    }
    if ((j & 7) === 0) { onProgress?.(j / fr * 0.35); await yieldMain(); }
  }
  const D1 = cell, D2 = cell * Math.SQRT2;
  for (let j = 0; j < fr; j++) for (let i = 0; i < fr; i++) {      // forward pass
    const k = j * fr + i; let d = dist[k];
    if (i > 0) d = Math.min(d, dist[k - 1] + D1);
    if (j > 0) { d = Math.min(d, dist[k - fr] + D1); if (i > 0) d = Math.min(d, dist[k - fr - 1] + D2); if (i < fr - 1) d = Math.min(d, dist[k - fr + 1] + D2); }
    dist[k] = d;
  }
  for (let j = fr - 1; j >= 0; j--) for (let i = fr - 1; i >= 0; i--) { // backward pass
    const k = j * fr + i; let d = dist[k];
    if (i < fr - 1) d = Math.min(d, dist[k + 1] + D1);
    if (j < fr - 1) { d = Math.min(d, dist[k + fr] + D1); if (i < fr - 1) d = Math.min(d, dist[k + fr + 1] + D2); if (i > 0) d = Math.min(d, dist[k + fr - 1] + D2); }
    dist[k] = d;
  }
  // Water texels are 0; shift by half a cell so the band is centred on the shore texel edge.
  for (let k = 0; k < dist.length; k++) if (dist[k] > 0 && dist[k] < BIG) dist[k] = Math.max(0, dist[k] - cell * 0.5);

  for (let j = 0; j < fr; j++) {
    const z = -WORLD_HALF + (j + 0.5) / fr * WORLD_HALF * 2;
    for (let i = 0; i < fr; i++) {
      const x = -WORLD_HALF + (i + 0.5) / fr * WORLD_HALF * 2;
      const dW = dist[j * fr + i];
      const k = (j * fr + i) * 4;
      field[k]     = Math.round(clamp01(dW / WATER_RANGE) * 255);
      field[k + 1] = Math.round(treeDensityRaw(x, z, dW) * 255);
      field[k + 2] = Math.round((1 - smooth(sand.beachWidth - sand.feather, sand.beachWidth + sand.feather, distToSea(x, z))) * 255);
      field[k + 3] = Math.round(aridity(x, z) * 255);
    }
    if ((j & 7) === 0) { onProgress?.(0.35 + j / fr * 0.5); await yieldMain(); }
  }
  for (let j = 0; j < mr; j++) {
    const z = -WORLD_HALF + (j + 0.5) / mr * WORLD_HALF * 2;
    for (let i = 0; i < mr; i++) {
      const x = -WORLD_HALF + (i + 0.5) / mr * WORLD_HALF * 2;
      const s = 1 / config.terrain.antiTiling.macroScaleM;
      const k = (j * mr + i) * 4;
      macro[k]     = Math.round(clamp01(fbm(x * s, z * s, 4) / 0.9375) * 255);
      macro[k + 1] = Math.round(clamp01(fbm(x * s * 0.6 + 71.3, z * s * 0.6 - 19.1, 3) / 0.875) * 255);
      macro[k + 2] = Math.round(clamp01(fbm(x * 0.022 + 5.1, z * 0.022 + 9.7, 3) / 0.875) * 255); // ~45 m wiggle
      macro[k + 3] = 255;
    }
    if ((j & 15) === 0) { onProgress?.(0.85 + j / mr * 0.15); await yieldMain(); }
  }
  return { field, macro, fieldRes: fr, macroRes: mr };
}

/** Install baked arrays for CPU sampling (scatter). */
export function setFieldData(d) { Object.assign(_state, d, { ready: true }); }
export function fieldState() { return _state; }

// Bilinear sample matching GPU LinearFilter (texel centres at (i+0.5)/res).
function bilinear(data, res, x, z, out) {
  const u = (x + WORLD_HALF) / (WORLD_HALF * 2) * res - 0.5, v = (z + WORLD_HALF) / (WORLD_HALF * 2) * res - 0.5;
  const i0 = Math.max(0, Math.min(res - 1, Math.floor(u))), j0 = Math.max(0, Math.min(res - 1, Math.floor(v)));
  const i1 = Math.min(res - 1, i0 + 1), j1 = Math.min(res - 1, j0 + 1);
  const fu = clamp01(u - i0), fv = clamp01(v - j0);
  for (let c = 0; c < 4; c++) {
    const a = data[(j0 * res + i0) * 4 + c], b = data[(j0 * res + i1) * 4 + c];
    const d = data[(j1 * res + i0) * 4 + c], e = data[(j1 * res + i1) * 4 + c];
    out[c] = ((a + (b - a) * fu) * (1 - fv) + (d + (e - d) * fu) * fv) / 255;
  }
  return out;
}
const _f = [0, 0, 0, 0], _m = [0, 0, 0, 0];
export function sampleField(x, z, out = [0, 0, 0, 0]) { return _state.ready ? bilinear(_state.field, _state.fieldRes, x, z, out) : out.fill(0); }
export function sampleMacro(x, z, out = [0, 0, 0, 0]) { return _state.ready ? bilinear(_state.macro, _state.macroRes, x, z, out) : out.fill(0.5); }

/**
 * Ground layer weights at a point. MUST stay in sync with TS_WEIGHTS_GLSL in terrainSplat.js.
 * @param {number} h  terrain height (m)   @param {number} ny world normal Y
 * @param {Float32Array|number[]} out length 8 (LAYER order), normalised. Returns { wet, out }.
 */
export function groundWeights(x, z, h, ny, out = new Float32Array(NUM_LAYERS)) {
  const T = config.terrain, N = T.noise;
  sampleField(x, z, _f); sampleMacro(x, z, _m);
  const n = (_m[2] - 0.5) * 2;
  const dW = _f[0] * WATER_RANGE, tree = _f[1], beach = _f[2], arid = _f[3];
  const rock = 1 - smooth(T.rock.nyMax - T.rock.feather, T.rock.nyMax + T.rock.feather, ny + n * N.amplitude * 0.5);
  const snow = smooth(T.snow.minY - T.snow.feather * 0.5, T.snow.minY + T.snow.feather * 0.5, h + n * N.heightAmp)
             * smooth(T.snow.nyMin - 0.1, T.snow.nyMin + 0.1, ny);
  const wet = 1 - smooth(T.wet.distance - T.wet.feather, T.wet.distance, dW + n * N.distAmp);
  const beachH = beach * (1 - smooth(T.sand.beachMaxH - 2, T.sand.beachMaxH + 2, h));
  const sandW = smooth(0.35, 0.65, Math.max(beachH, arid * 0.9) + n * N.amplitude);
  const forest = smooth(T.forest.threshold - T.forest.feather * 0.5, T.forest.threshold + T.forest.feather * 0.5, tree + n * N.amplitude);
  const flat = 1 - rock, ns = 1 - snow;
  const rem = flat * ns * (1 - sandW) * (1 - wet);
  out[0] = rock * (1 - arid) * (1 - snow * 0.6);
  out[1] = rock * arid;
  out[2] = wet * flat * (1 - sandW) * ns;
  out[3] = sandW * (1 - arid) * flat * ns;
  out[4] = sandW * arid * flat * ns;
  out[5] = rem * (1 - forest);
  out[6] = rem * forest;
  out[7] = snow * (flat + rock * 0.4);
  let s = 0; for (let i = 0; i < NUM_LAYERS; i++) s += out[i];
  s = s > 1e-5 ? 1 / s : 0; for (let i = 0; i < NUM_LAYERS; i++) out[i] *= s;
  return { wet, tree, arid, dWater: dW, beach: beachH, macro: _m, out };
}

const _w = new Float32Array(NUM_LAYERS);
/** Smooth tree probability (0..1) for a candidate at (x,z) with height h and normal Y ny. */
export function treeProbability(x, z, h, ny) {
  const t = config.scatter.treeDensity;
  const g = groundWeights(x, z, h, ny, _w);
  const base = g.tree + config.scatter.trees.meadowShare * (1 - g.tree);   // lone meadow trees
  return base
    * smooth(t.minNy - t.nyFeather, t.minNy + t.nyFeather, ny)
    * (1 - smooth(t.maxY - t.maxYFeather, t.maxY, h))
    * (1 - _w[LAYER.snow]) * (1 - 0.85 * _w[LAYER.beachSand]) * (1 - 0.75 * g.arid)   // desert: sparse (cacti chosen by species pick)
    * smooth(t.waterClear * 0.5, t.waterClear, g.dWater);
}

/** Grass tuft density (0..1) from the same ground weights. */
export function grassDensity(x, z, h, ny) {
  const G = config.scatter.grass;
  groundWeights(x, z, h, ny, _w);
  return clamp01(_w[LAYER.meadow] * G.meadowWeight + _w[LAYER.forestFloor] * G.forestWeight + _w[LAYER.wetPebbles] * G.wetWeight);
}

/** Integer hash -> [0,1) (stable per cell). */
export function hash01(ix, iz, seed = 0) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
