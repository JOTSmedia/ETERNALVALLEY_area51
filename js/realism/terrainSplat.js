// ============================================================
// ETERNAL VALLEY: ONE continuous splat ground material (patch02)
//
// Replaces the zone colouring and the slope-only three-layer shader with
// eight scanned layers (JOTS 3D Environment / Poly Haven CC0 sets) whose
// weights are smooth functions of:
//   slope (Ny), height, distance to the true shoreline, tree density,
//   aridity, and noise.
// The formulas mirror groundWeights() in terrainMasksCore.js, so the CPU
// scatter places grass and trees on the same ground the GPU draws.
//
// Layers (texture-array index), in LAYER order:
//   0 granite      Ny < 0.8                          (triplanar)
//   1 sandstone    Ny < 0.8 in arid ground          (triplanar)
//   2 wetPebbles   within 8 m of water
//   3 beachSand    sea beaches below 6 m
//   4 desertSand   arid flats
//   5 meadow       flats
//   6 forestFloor  tree density > 0.4
//   7 snow         above 280 m
//
// Anti-tiling:
//   - stochastic second tap (rotated, rescaled, noise-blended)
//   - near/far detail UV crossfade
//   - world macro brightness/hue map
//   - height-map blending at the borders
//
// Every texture fetch uses textureGrad with derivatives taken in uniform
// control flow, so the dynamic per-layer branches are safe.
// ============================================================
import * as THREE from 'three';
import { terrainHorizon } from './terrainHorizon.js?v=73';
import { scannedPBR } from './scannedMaterials.js?v=73';
import { config } from './rendererConfig.js?v=73';
import { bakeTerrainField, setLayerMeans, loadLayerManifest, WORLD_HALF, NUM_LAYERS } from './terrainField.js?v=73';

// ---------- texture arrays ----------
async function loadRGB(url, res) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`terrain texture ${url}: HTTP ${r.status}`);
  const bmp = await createImageBitmap(await r.blob(), { resizeWidth: res, resizeHeight: res, resizeQuality: 'high', colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(res, res) : Object.assign(document.createElement('canvas'), { width: res, height: res });
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, res, res);
  bmp.close?.();
  return ctx.getImageData(0, 0, res, res).data;   // opaque JPEGs, so there's no premultiply loss
}

/**
 * Build the 2 RGBA8 texture arrays.
 *   albedo: rgb = sRGB albedo, a = height
 *   surface: r,g = normal xy (OpenGL +Y), b = roughness, a = AO
 */
const _layerCache = new Map();
/** Memoised: the valley terrain and the mountain ring share ONE pair of texture arrays. */
export function loadTerrainLayers(opts = {}) {
  const key = `${opts.basePath || config.terrain.texturePath}|${opts.res}`;
  if (!_layerCache.has(key)) _layerCache.set(key, _loadTerrainLayers(opts).catch((e) => { _layerCache.delete(key); throw e; }));
  return _layerCache.get(key);
}
async function _loadTerrainLayers({ basePath = config.terrain.texturePath, res, renderer, onProgress } = {}) {
  const manifest = await loadLayerManifest(basePath);
  const keys = config.terrain.layers;
  const n = keys.length, px = res * res;
  const dir = res <= 512 ? `${basePath}512/` : basePath; // EVR-04: mid/mobile tier downloads 512 JPGs (2.9 MB) instead of 1024 (12.8 MB)
  const alb = new Uint8Array(px * 4 * n), srf = new Uint8Array(px * 4 * n);
  for (let L = 0; L < n; L++) {
    const k = keys[L];
    const [a, nrh, orm] = await Promise.all([
      loadRGB(`${dir}${k}_albedo.jpg`, res), loadRGB(`${dir}${k}_nrh.jpg`, res), loadRGB(`${dir}${k}_orm.jpg`, res)]);
    const o = px * 4 * L;
    for (let i = 0; i < px; i++) {
      const q = i * 4, d = o + q;
      alb[d] = a[q]; alb[d + 1] = a[q + 1]; alb[d + 2] = a[q + 2]; alb[d + 3] = nrh[q + 2];
      srf[d] = nrh[q]; srf[d + 1] = nrh[q + 1]; srf[d + 2] = orm[q + 1]; srf[d + 3] = orm[q];
    }
    onProgress?.((L + 1) / n);
    await new Promise((r) => setTimeout(r, 0));
  }
  const mk = (data, cs) => {
    const t = new THREE.DataArrayTexture(data, res, res, n);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = cs;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    t.needsUpdate = true;
    // EVR-06: drop the CPU copy (2 x 33.5 MB at 1024, 2 x 8.4 MB at 512) once the GPU has it.
    // On a WebGL context restore the arrays are rebuilt by reloadTerrainLayers() (perf/contextRecovery.js).
    if (typeof window !== 'undefined' && window.EV_PERF?.freeCpuTextures) {
      t.onUpdate = () => { t.image = { data: null, width: res, height: res, depth: n }; t.userData.evCpuFreed = true; t.onUpdate = null; };
    }
    return t;
  };
  return { albedo: mk(alb, THREE.SRGBColorSpace), surface: mk(srf, THREE.NoColorSpace), manifest };
}

/**
 * EVR-06 (4/6): after a WebGL context restore, rebuild the texture arrays whose CPU copy was freed
 * after upload, and point every one-ground material (valley + ring) at the new arrays.
 */
export async function reloadTerrainLayers(world) {
  const mats = [];
  world?.scene?.traverse((o) => { const m = o.material; if (m && m.userData && m.userData.terrainSplat) mats.push(m); });
  if (!mats.length) return;
  const old = new Set();
  for (const [k, p] of _layerCache) { try { const v = await p; old.add(v.albedo); old.add(v.surface); } catch (_) {} _layerCache.delete(k); }
  const t = mats[0].userData.terrainSplat.tier;
  const horizon = await terrainHorizon();
    const layers = await loadTerrainLayers({ res: config.terrain.layerRes[t], renderer: world.renderer });
  for (const m of mats) { const u = m.userData.terrainSplat.uniforms; u.uTsAlbedo.value = layers.albedo; u.uTsSurface.value = layers.surface; }
  for (const tex of old) { try { tex.dispose(); } catch (_) {} }
}

// ---------- GLSL ----------
const TS_PARS = /* glsl */`
uniform sampler2D uPhotoGrass;
uniform sampler2D uPhotoRock;
uniform sampler2D uPhotoSoil;
uniform sampler2D uPhotoSand;
uniform highp sampler2DArray uTsAlbedo;
uniform highp sampler2DArray uTsSurface;
uniform sampler2D uTsField;
uniform sampler2D uTerrainHorizon;
uniform float uHorizonHalf;
uniform float uHorizonEnabled;
uniform sampler2D uTsMacro;
uniform vec4 uTsRock;    // nyMax, feather, triplanarSharpness, -
uniform vec4 uTsSnow;    // minY, feather, nyMin, -
uniform vec4 uTsWet;     // distance, feather, darken, roughness
uniform vec4 uTsSand;    // -, beachMaxH, -, -
uniform vec4 uTsForest;  // threshold, feather, -, -
uniform vec4 uTsNoise;   // amplitude, heightAmp, distAmp, -
uniform vec4 uTsAnti;    // enabled, rotationRad, scale2, noiseCells
uniform vec4 uTsMacroP;  // macroStrength, macroHue, heightBlend, creviceAO
uniform vec4 uTsDetail;  // farScale, fadeStart, fadeEnd, normalStrength
uniform vec4 uTsSpray;   // x, z, r, f
uniform float uTsSprayWet;
uniform float uTsLayerScale[${NUM_LAYERS}];   // 1 / tileMeters
uniform vec3 uTsLayerTint[${NUM_LAYERS}];
uniform float uTsLayerRough[${NUM_LAYERS}]; // manifest mean roughness (ring path: no surface fetch)
uniform vec4 uTsRing;    // tileScaleMul, treeline maxY, maxYFeather, forest density below treeline
uniform vec4 uTsRingSnow; // ring-only snow line: start Y, blend width, -, -
varying vec3 vTsWorldPos;
varying vec3 vTsWorldNormal;
varying float vTsCrevice;

float tsH21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tsVNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tsH21(i), tsH21(i + vec2(1.0, 0.0)), f.x), mix(tsH21(i + vec2(0.0, 1.0)), tsH21(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Crossfade independent offset samples across irregular cells. The broad rock
// strata must not read as a repeated five-metre square on tall cliff faces.
vec3 tsPhotoRock(vec2 p) {
  vec2 warp = vec2(tsVNoise(p * 0.021), tsVNoise(p * 0.021 + 37.0)) * 2.4;
  vec2 uv = (p + warp) * 0.12;
  float cell = tsVNoise(p * 0.033) * 8.0;
  float a = floor(cell), b = a + 1.0;
  vec2 offsetA = vec2(tsH21(vec2(a, 3.0)), tsH21(vec2(a, 7.0))) * 11.0;
  vec2 offsetB = vec2(tsH21(vec2(b, 3.0)), tsH21(vec2(b, 7.0))) * 11.0;
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec3 colA = textureGrad(uPhotoRock, uv + offsetA, dx, dy).rgb;
  vec3 colB = textureGrad(uPhotoRock, uv + offsetB, dx, dy).rgb;
  return mix(colA, colB, smoothstep(0.2, 0.8, fract(cell)))
    * vec3(0.46,0.52,0.58) * mix(0.58, 1.0, tsVNoise(p * 0.009));
}
// Top-down sample of one layer: near (real scale, stochastic 2-tap) <-> far (scaled up), crossfaded.
vec4 tsTop(highp sampler2DArray tex, float L, vec2 p, vec2 gx, vec2 gy, float s, float tFar, float tSto, mat2 R, bool isNormal) {
  vec4 near = vec4(0.0), far = vec4(0.0);
  if (tFar < 0.98) {
    if (tSto < 0.98) near += textureGrad(tex, vec3(p * s, L), gx * s, gy * s) * (1.0 - tSto);
    if (tSto > 0.02) {
      float s2 = s * uTsAnti.z;
      vec4 b = textureGrad(tex, vec3(R * (p * s2) + vec2(0.37, 0.19), L), R * (gx * s2), R * (gy * s2));
      if (isNormal) b.xy = (transpose(R) * (b.xy * 2.0 - 1.0)) * 0.5 + 0.5;   // rotate the tangent normal back
      near += b * tSto;
    }
  }
  if (tFar > 0.02) { float sf = s * uTsDetail.x; far = textureGrad(tex, vec3(p * sf, L), gx * sf, gy * sf); }
  return mix(near, far, tFar);
}
// Triplanar (rock). b = axis blend. Golus-style UDN with per-axis sign flips.
vec4 tsTri1(highp sampler2DArray tex, float L, vec3 P, vec3 dPx, vec3 dPy, vec3 b, vec3 sg, float sc, bool isNormal, inout vec3 nPert, float k) {
  vec4 acc = vec4(0.0);
  if (b.x > 0.02) {
    vec2 uv = vec2(P.z * sg.x, P.y), gx = vec2(dPx.z * sg.x, dPx.y), gy = vec2(dPy.z * sg.x, dPy.y);
    vec4 t = textureGrad(tex, vec3(uv * sc, L), gx * sc, gy * sc); acc += t * b.x;
    if (isNormal) { vec2 tn = t.xy * 2.0 - 1.0; nPert += vec3(0.0, tn.y, tn.x * sg.x) * (b.x * k); }
  }
  if (b.y > 0.02) {
    vec2 uv = vec2(P.x * sg.y, P.z), gx = vec2(dPx.x * sg.y, dPx.z), gy = vec2(dPy.x * sg.y, dPy.z);
    vec4 t = textureGrad(tex, vec3(uv * sc, L), gx * sc, gy * sc); acc += t * b.y;
    if (isNormal) { vec2 tn = t.xy * 2.0 - 1.0; nPert += vec3(tn.x * sg.y, 0.0, tn.y) * (b.y * k); }
  }
  if (b.z > 0.02) {
    vec2 uv = vec2(-P.x * sg.z, P.y), gx = vec2(-dPx.x * sg.z, dPx.y), gy = vec2(-dPy.x * sg.z, dPy.y);
    vec4 t = textureGrad(tex, vec3(uv * sc, L), gx * sc, gy * sc); acc += t * b.z;
    if (isNormal) { vec2 tn = t.xy * 2.0 - 1.0; nPert += vec3(-tn.x * sg.z, tn.y, 0.0) * (b.z * k); }
  }
  return acc;
}
// Near/far crossfade; both scales are only sampled inside the fade band.
vec4 tsTri(highp sampler2DArray tex, float L, vec3 P, vec3 dPx, vec3 dPy, vec3 b, vec3 sg, float s, float tFar, bool isNormal, out vec3 nPert) {
  nPert = vec3(0.0);
  vec4 acc = vec4(0.0);
  if (tFar < 0.98) acc += tsTri1(tex, L, P, dPx, dPy, b, sg, s, isNormal, nPert, 1.0 - tFar) * (1.0 - tFar);
  if (tFar > 0.02) acc += tsTri1(tex, L, P, dPx, dPy, b, sg, s * uTsDetail.x, isNormal, nPert, tFar) * tFar;
  return acc;
}
`;

// Weights: keep in sync with groundWeights() in terrainMasksCore.js
const TS_MAIN = /* glsl */`
  vec3 tsP = vTsWorldPos;
  vec3 tsNg = normalize(vTsWorldNormal);
  vec3 tsdPx = dFdx(tsP), tsdPy = dFdy(tsP);           // uniform control flow
  vec2 tsUv = (tsP.xz + ${WORLD_HALF.toFixed(3)}) / ${(WORLD_HALF * 2).toFixed(3)};
  float tsNy = tsNg.y, tsY = tsP.y;
#ifdef TS_RING
  // Distant mountain ring (outside the baked 7 km field): no water, beach or desert there.
  // Forest only below the same tree line as the scatter. Procedural low-res macro, zero fetches.
  float tsRingTree = uTsRing.w * (1.0 - smoothstep(uTsRing.y - uTsRing.z, uTsRing.y, tsY));
  vec4 tsF = vec4(1.0, tsRingTree, 0.0, 0.0);
  vec4 tsM = vec4(tsVNoise(tsP.xz / 600.0), tsVNoise(tsP.xz / 900.0 + 17.0), tsVNoise(tsP.xz / 150.0 + 5.0), 1.0);
  float tsN = (tsM.b - 0.5) * 2.0;
#else
  vec4 tsF = texture2D(uTsField, tsUv);
  vec4 tsM = texture2D(uTsMacro, tsUv);
  float tsN = (tsM.b - 0.5) * 2.0 + (tsVNoise(tsP.xz * 0.31) - 0.5) * 0.5;   // + fine GPU-only wiggle
#endif
  float tsDW = tsF.r * 32.0, tsTree = tsF.g, tsBeach = tsF.b, tsArid = tsF.a;
  float alpineRock = mix(uTsRock.x,0.80,smoothstep(500.0,1350.0,tsY));
  float tsRockW = 1.0 - smoothstep(alpineRock - uTsRock.y, alpineRock + uTsRock.y, tsNy + tsN * uTsNoise.x * 0.5);
#ifdef TS_RING
  // ring-only override: legacy ring snow line (snow starts at snowLineY, full by +snowFeather)
  float tsSnowW = smoothstep(uTsRingSnow.x, uTsRingSnow.x + uTsRingSnow.y, tsY + tsN * uTsNoise.y)
                * smoothstep(uTsSnow.z - 0.1, uTsSnow.z + 0.1, tsNy);
#else
  float tsSnowW = smoothstep(uTsSnow.x - uTsSnow.y * 0.5, uTsSnow.x + uTsSnow.y * 0.5, tsY + tsN * uTsNoise.y)
                * smoothstep(uTsSnow.z - 0.1, uTsSnow.z + 0.1, tsNy);
#endif
  float tsWet = 1.0 - smoothstep(uTsWet.x - uTsWet.y, uTsWet.x, tsDW + tsN * uTsNoise.z);
  float tsBeachH = tsBeach * (1.0 - smoothstep(uTsSand.y - 2.0, uTsSand.y + 2.0, tsY));
  float tsSandW = smoothstep(0.35, 0.65, max(tsBeachH, tsArid * 0.9) + tsN * uTsNoise.x);
  float tsForestW = smoothstep(uTsForest.x - uTsForest.y * 0.5, uTsForest.x + uTsForest.y * 0.5, tsTree + tsN * uTsNoise.x);
  float tsFlat = 1.0 - tsRockW, tsNs = 1.0 - tsSnowW;
  float tsRem = tsFlat * tsNs * (1.0 - tsSandW) * (1.0 - tsWet);
  float tsW[${NUM_LAYERS}];
  tsW[0] = tsRockW * (1.0 - tsArid) * (1.0 - tsSnowW * 0.6);
  tsW[1] = tsRockW * tsArid;
  tsW[2] = tsWet * tsFlat * (1.0 - tsSandW) * tsNs;
  tsW[3] = tsSandW * (1.0 - tsArid) * tsFlat * tsNs;
  tsW[4] = tsSandW * tsArid * tsFlat * tsNs;
  tsW[5] = tsRem * (1.0 - tsForestW);
  tsW[6] = tsRem * tsForestW;
  tsW[7] = tsSnowW * (tsFlat + tsRockW * 0.4);
  float tsSum = 0.0;
  for (int i = 0; i < ${NUM_LAYERS}; i++) tsSum += tsW[i];
  tsSum = 1.0 / max(tsSum, 1e-5);
  // waterfall spray: wetness only (darker, glossier), no layer change
  float tsSpray = (1.0 - smoothstep(uTsSpray.z, uTsSpray.z + uTsSpray.w, length(tsP.xz - uTsSpray.xy))) * uTsSprayWet;
  float tsWetness = max(tsWet, tsSpray);

  // shared sampling params
  float tsDist = length(cameraPosition - tsP);
#ifdef TS_RING
  float tsFar = 1.0, tsSto = 0.0;        // ring: far scale only, no stochastic second tap
  float tsScaleMul = uTsRing.x;          // and much larger tiles (2+ km away)
#else
  float tsFar = smoothstep(uTsDetail.y, uTsDetail.z, tsDist);
  float tsSto = uTsAnti.x > 0.5 ? smoothstep(0.30, 0.70, tsVNoise(tsP.xz * uTsAnti.w)) : 0.0;
  float tsScaleMul = 1.0;
#endif
  mat2 tsR = mat2(cos(uTsAnti.y), sin(uTsAnti.y), -sin(uTsAnti.y), cos(uTsAnti.y));
  vec3 tsB = pow(abs(tsNg), vec3(uTsRock.z)); tsB /= (tsB.x + tsB.y + tsB.z + 1e-5);
  vec3 tsSg = vec3(tsNg.x >= 0.0 ? 1.0 : -1.0, tsNg.y >= 0.0 ? 1.0 : -1.0, tsNg.z >= 0.0 ? 1.0 : -1.0);

  // pass 1: albedo + height for active layers
  vec4 tsAlb[${NUM_LAYERS}];
  float tsHB[${NUM_LAYERS}];
  float tsMax = -1.0;
  vec3 tsDummy;
  for (int i = 0; i < ${NUM_LAYERS}; i++) {
    tsW[i] *= tsSum;
    tsAlb[i] = vec4(0.0); tsHB[i] = 0.0;
    if (tsW[i] > 0.004) {
      float s = uTsLayerScale[i] * tsScaleMul;
      tsAlb[i] = (i <= 1)
        ? tsTri(uTsAlbedo, float(i), tsP, tsdPx, tsdPy, tsB, tsSg, s, tsFar, false, tsDummy)
        : tsTop(uTsAlbedo, float(i), tsP.xz, tsdPx.xz, tsdPy.xz, s, tsFar, tsSto, tsR, false);
      tsHB[i] = tsW[i] + tsAlb[i].a * uTsMacroP.z;
      tsMax = max(tsMax, tsHB[i]);
    }
  }
  // height blend
  tsMax -= uTsMacroP.z;
  float tsSum2 = 0.0;
  for (int i = 0; i < ${NUM_LAYERS}; i++) { tsW[i] = tsW[i] > 0.004 ? max(tsHB[i] - tsMax, 0.0) : 0.0; tsSum2 += tsW[i]; }
  tsSum2 = 1.0 / max(tsSum2, 1e-5);

  // pass 2: compose albedo; sample the surface (normal/rough/AO) only for surviving layers
  vec3 tsAlbedo = vec3(0.0); vec3 tsNPert = vec3(0.0); float tsRough = 0.0; float tsAO = 0.0;
  for (int i = 0; i < ${NUM_LAYERS}; i++) {
    float w = tsW[i] * tsSum2;
    if (w > 0.004) {
      tsAlbedo += tsAlb[i].rgb * uTsLayerTint[i] * w;
      float s = uTsLayerScale[i] * tsScaleMul;
      vec4 srf; vec3 np;
#ifdef TS_RING
      srf = vec4(0.5, 0.5, uTsLayerRough[i], 1.0); np = vec3(0.0);   // ring: no surface fetch (sub-pixel detail)
#else
      if (i <= 1) {
        srf = tsTri(uTsSurface, float(i), tsP, tsdPx, tsdPy, tsB, tsSg, s, tsFar, true, np);
      } else {
        srf = tsTop(uTsSurface, float(i), tsP.xz, tsdPx.xz, tsdPy.xz, s, tsFar, tsSto, tsR, true);
        vec2 tn = srf.xy * 2.0 - 1.0; np = vec3(tn.x, 0.0, tn.y);
      }
#endif
      tsNPert += np * w; tsRough += srf.b * w; tsAO += srf.a * w;
    }
  }
  // Native 4K photographed surfaces retain detail at walking distance. The existing
  // eight-layer arrays still carry the continuous biome masks, normals and wetness.
  vec2 photoUv = tsP.xz * 0.24;
  vec2 photoUv2 = tsR * photoUv * 0.71 + vec2(0.37, 0.19);
  float photoBlend = smoothstep(0.25, 0.75, tsVNoise(tsP.xz * 0.065));
  vec3 photoGrass = mix(texture2D(uPhotoGrass, photoUv).rgb, texture2D(uPhotoGrass, photoUv2).rgb, photoBlend);
  vec3 photoSoil = mix(texture2D(uPhotoSoil, photoUv).rgb, texture2D(uPhotoSoil, photoUv2).rgb, photoBlend);
  // Damp understory remains vegetated; litter dominates only beneath dense canopy.
  photoGrass *= vec3(0.16, 0.37, 0.14);
  photoGrass *= mix(1.0,0.48,smoothstep(0.12,0.72,tsTree));
  photoSoil = mix(photoGrass, photoSoil * 0.68, smoothstep(0.62, 0.92, tsTree));
  vec3 photoSand = mix(texture2D(uPhotoSand, photoUv).rgb, texture2D(uPhotoSand, photoUv2).rgb, photoBlend);
  vec3 photoRock = tsPhotoRock(tsP.zy) * tsB.x
                 + tsPhotoRock(tsP.xz) * tsB.y
                 + tsPhotoRock(tsP.xy) * tsB.z;
  float photoWeight = (tsW[0] + tsW[1] + tsW[3] + tsW[4] + tsW[5] + tsW[6]) * tsSum2;
  vec3 photoAlbedo = (photoRock * (tsW[0] + tsW[1]) + photoSand * (tsW[3] + tsW[4])
                    + photoGrass * tsW[5] + photoSoil * tsW[6]) * tsSum2;
  tsAlbedo = tsAlbedo * (1.0 - photoWeight * 0.90) + photoAlbedo * 0.90;
  // macro variation (brightness + slight hue) to kill repetition at distance
  tsAlbedo *= 1.0 + (tsM.r - 0.5) * 2.0 * uTsMacroP.x;
  tsAlbedo *= mix(vec3(1.0 - uTsMacroP.y, 1.0, 1.0 + uTsMacroP.y), vec3(1.0 + uTsMacroP.y, 1.0, 1.0 - uTsMacroP.y), tsM.g);
  tsAlbedo *= mix(1.0, uTsWet.z, tsWetness);
  tsAlbedo = min(tsAlbedo, vec3(0.92));
  tsRough = mix(tsRough, uTsWet.w, tsWetness);
  tsAO *= mix(1.0, vTsCrevice, uTsMacroP.w);
  vec3 tsNWorld = normalize(tsNg + tsNPert * uTsDetail.w);
  diffuseColor.rgb = tsAlbedo;
`;

function makeUniforms(albedo, surface, fieldTex, macroTex, manifest) {
  const T = config.terrain;
  return {
    uTsAlbedo: { value: albedo }, uTsSurface: { value: surface },
    uTsField: { value: fieldTex }, uTsMacro: { value: macroTex },
    uTsRock: { value: new THREE.Vector4(T.rock.nyMax, T.rock.feather, T.rock.triplanarSharpness, 0) },
    uTsSnow: { value: new THREE.Vector4(T.snow.minY, T.snow.feather, T.snow.nyMin, 0) },
    uTsWet: { value: new THREE.Vector4(T.wet.distance, T.wet.feather, T.wet.darken, T.wet.roughness) },
    uTsSand: { value: new THREE.Vector4(0, T.sand.beachMaxH, 0, 0) },
    uTsForest: { value: new THREE.Vector4(T.forest.threshold, T.forest.feather, 0, 0) },
    uTsNoise: { value: new THREE.Vector4(T.noise.amplitude, T.noise.heightAmp, T.noise.distAmp, 0) },
    uTsAnti: { value: new THREE.Vector4(T.antiTiling.enabled ? 1 : 0, T.antiTiling.rotationRad, T.antiTiling.scale2, T.antiTiling.noiseCells) },
    uPhotoGrass: { value: scannedPBR('grass').map },
    uPhotoRock: { value: scannedPBR('rock').map },
    uPhotoSoil: { value: scannedPBR('mud').map },
    uPhotoSand: { value: scannedPBR('sand').map },
    uTsMacroP: { value: new THREE.Vector4(T.antiTiling.macroStrength, T.antiTiling.macroHue, T.heightBlend, T.creviceAO) },
    uTsDetail: { value: new THREE.Vector4(T.detail.farScale, T.detail.fadeStart, T.detail.fadeEnd, T.detail.normalStrength) },
    uTsSpray: { value: new THREE.Vector4(T.spray.x, T.spray.z, T.spray.r, T.spray.f) },
    uTsSprayWet: { value: T.spray.wet },
    uTsLayerScale: { value: T.layers.map((k) => 1 / T.tileMeters[k]) },
    uTsLayerTint: { value: T.layers.map((k) => new THREE.Vector3(...(T.layerTint?.[k] || [1, 1, 1]))) },
    uTsLayerRough: { value: T.layers.map((k) => manifest?.layers?.find((l) => l.key === k)?.meanRoughness ?? 0.8) },
    uTsRing: { value: new THREE.Vector4(T.ring?.tileScaleMul ?? 0.1, T.ring?.treeLineY ?? config.scatter.treeDensity.maxY, T.ring?.treeLineFeather ?? config.scatter.treeDensity.maxYFeather, T.ring?.forestDensityBelowTreeline ?? 0.6) },
    uTsRingSnow: { value: new THREE.Vector4(T.ring?.snowLineY ?? T.snow.minY, T.ring?.snowFeather ?? T.snow.feather, 0, 0) },
  };
}

/**
 * Create the one-ground material. Resolves to null (so the caller keeps the legacy material) if anything fails.
 * Geometry needs: position, normal, and optionally aCreviceAO (float).
 */
export async function createTerrainSplatMaterial({ renderer, tier, fieldPromise, onProgress, variant = 'valley' } = {}) {
  const ring = variant === 'ring';   // patch02b: distant mountain ring, cheap path
  try {
    const field = await (fieldPromise || bakeTerrainField({ tier }));
    const t = field.tier;
    const horizon = await terrainHorizon();
    const layers = await loadTerrainLayers({ res: config.terrain.layerRes[t], renderer, onProgress });
    setLayerMeans(layers.manifest);
    const uniforms = makeUniforms(layers.albedo, layers.surface, field.fieldTex, field.macroTex, layers.manifest);

    uniforms.uTerrainHorizon={value:horizon.texture};
    uniforms.uHorizonHalf={value:horizon.half};
    // Other lighting presets have another sun direction and use their cascades.
    uniforms.uHorizonEnabled={get value(){return config.sun.direction.dot(horizon.direction)>.999 ? 1 : 0;}};
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, metalness: 0.0, envMapIntensity: 1.0 });
    mat.name = ring ? 'EV_OneGround_Ring' : 'EV_OneGround';
    mat.userData.terrainSplat = { uniforms, tier: t, variant };
    if (ring) mat.defines = { TS_RING: '' };
    mat.customProgramCacheKey = () => `ev_oneground_${ring ? 'ring_' : ''}${t}`;
    mat.onBeforeCompile = (shader) => {
      if (new URLSearchParams(location.search).has('qa')) console.info('[realism QA] compiling terrain', variant);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aCreviceAO;
          varying vec3 vTsWorldPos;
          varying vec3 vTsWorldNormal;
          varying float vTsCrevice;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vTsWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vTsWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTsCrevice = aCreviceAO > 0.0 ? aCreviceAO : 1.0;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${TS_PARS}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${TS_MAIN}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(tsRough, 0.04, 1.0);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize((viewMatrix * vec4(tsNWorld, 0.0)).xyz);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          float terrainSun = texture2D(uTerrainHorizon, (vTsWorldPos.xz + uHorizonHalf) / (uHorizonHalf * 2.0)).r;
          terrainSun = mix(1.0, terrainSun, uHorizonEnabled);
          reflectedLight.directDiffuse *= terrainSun;
          reflectedLight.directSpecular *= terrainSun;`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          reflectedLight.indirectDiffuse *= tsAO;
          reflectedLight.indirectSpecular *= mix(1.0, tsAO, 0.6);`);
    };
    return mat;
  } catch (e) {
    console.warn('[terrainSplat] one-ground material unavailable, keeping legacy terrain:', e?.message || e);
    return null;
  }
}
