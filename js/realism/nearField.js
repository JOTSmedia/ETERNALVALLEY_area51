// ============================================================
// ETERNAL VALLEY v36 (EVR-04): photoreal near-field
//  - Tree impostors baked in Blender 5.2 Cycles from CC0 Poly Haven scans
//    (8 azimuth views, 4x2 atlas, KTX2/ETC1S with WebP fallback), instanced,
//    cylindrical billboards that pick + blend the two nearest baked views.
//  - Scanned rock meshes (Poly Haven, decimated LOD0/LOD1, meshopt GLB).
//  - Volumetric cloud sprites rendered in Blender (replace the white cards).
//  - World-space (triplanar) scanned cobble / granite surfaces so big stone
//    boxes no longer stretch one texture over 100+ m.
// Tiers: desktop (full atlases) / mobile (half-res atlases, LOD1 rocks).
// ============================================================
import * as THREE from 'three';
import { scannedPBR, initScannedMaterials } from './scannedMaterials.js?v=73';
import { config } from './rendererConfig.js?v=73'; // [v36 polish] sun direction
import { terrainHeight } from '../terrain.js?v=73'; // [v36 polish] contact-AO blobs follow the ground
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js?v=36';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js?v=36';

export const NF_IS_MOBILE = (window.__EV_DEVICE?.tier || 'desktop') !== 'desktop';
const TIER = NF_IS_MOBILE ? 'mobile' : 'desktop';
const BASE = 'images/nearfield/';
const V = '?v=36';

let _ktx2 = null, _renderer = null, _ktxOK = false;
export function initNearField(renderer) {
  if (_renderer) return;
  _renderer = renderer;
  const q = typeof location !== 'undefined' ? location.search : '';
  if (/[?&]nfwebp=1/.test(q)) { _ktxOK = false; return; } // debug: force WebP fallback
  try {
    _ktx2 = initScannedMaterials(renderer);
    _ktxOK = true;
  } catch (e) { console.warn('[nearField] KTX2 unavailable, WebP fallback', e); _ktxOK = false; }
}

function _ensureInit() {
  if (!_renderer && typeof window !== 'undefined' && window.__rbvWorld?.renderer) initNearField(window.__rbvWorld.renderer);
}
const _texCache = new Map();
const _imgLoader = new THREE.TextureLoader();
// Loads <name>_<tier>.ktx2, falls back to <name>_<tier>.webp. Returns a texture immediately
// (placeholder image swapped in when the real one arrives) so synchronous builders can use it.
export function nfTexture(name, { srgb = true, repeat = false, tiered = true, gltf = false } = {}) {
  _ensureInit();
  const key = name + (tiered ? '_' + TIER : '');
  if (_texCache.has(key)) return _texCache.get(key);
  const holder = new THREE.Texture();
  holder.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) holder.wrapS = holder.wrapT = THREE.RepeatWrapping;
  holder.userData.nfPending = true;
  _texCache.set(key, holder);
  const adopt = (tex) => {
    // copy the loaded source/format into the holder so every material keeps its reference
    holder.image = tex.image; holder.mipmaps = tex.mipmaps; holder.format = tex.format; holder.type = tex.type;
    holder.generateMipmaps = tex.generateMipmaps; holder.minFilter = THREE.LinearMipmapLinearFilter; holder.magFilter = THREE.LinearFilter;
    holder.flipY = tex.isCompressedTexture ? false : !gltf; holder.anisotropy = NF_IS_MOBILE ? 2 : 8;
    if (tex.isCompressedTexture) { holder.isCompressedTexture = true; holder.generateMipmaps = false; }
    holder.userData.nfPending = false; holder.needsUpdate = true;
  };
  const webp = () => _imgLoader.load(`${BASE}${key}.webp${V}`, adopt, undefined,
    () => console.warn('[nearField] missing texture', key));
  if (_ktxOK && _ktx2) _ktx2.load(`${BASE}${key}.ktx2${V}`, adopt, undefined, webp); else webp();
  return holder;
}

// ---------------------------------------------------------------- tree impostors
// From blender_src/bakes/bake_meta.json (ev_nearfield.py). height_m = tree height, quad_* = baked frame size.
export const IMPOSTORS = {
  fir:       { atlas: 'tree_fir',       height_m: 18.939, quad_h_m: 19.696, quad_w_m: 7.694 },   // Poly Haven fir_tree_01 (v36b single-tree crop)
  broadleaf: { atlas: 'tree_broadleaf', height_m: 5.027,  quad_h_m: 5.229,  quad_w_m: 5.024 },   // Poly Haven island_tree_01
  smallleaf: { atlas: 'tree_smallleaf', height_m: 4.557,  quad_h_m: 4.739,  quad_w_m: 4.48 },    // Poly Haven tree_small_02
  blossom:   { atlas: 'tree_blossom',   height_m: 19.469, quad_h_m: 25.394, quad_w_m: 25.394 },  // Poly Haven jacaranda_tree
};

const _camPos = { value: new THREE.Vector3() };
const _sunV = { value: new THREE.Vector3(0, 1, 0) };   // [v36 polish] sun direction in view space (for leaf translucency)
const _sunW = new THREE.Vector3();
// v36b wind: shared clock; amplitude 0 when the user asks for reduced motion
const _wind = { value: 0 };
const _windAmp = { value: 0 }; // [EVR-05 anim] impostors static per V37_GPU_BUDGETS (was: 1, 0 under reduced motion)
if (typeof matchMedia === 'function') { try { /* [EVR-05 anim] listener removed: impostors static */ } catch (e) { /* old Safari */ } }
// v36b: impostor quads were sized from the legacy canopy bbox and read ~20% small next to v35 trees
export const NF_TREE_SCALE = 1.22;
const _vp = `
  uniform vec3 uNfCam; uniform float uNfViews; uniform float uNfTime; uniform float uNfWind;
  varying vec2 vNfUv0; varying vec2 vNfUv1; varying float vNfBlend; varying vec3 vNfN;
`;
// NOTE atlas layout: views 0-3 top row, 4-7 bottom row (flipY texture => v=1 is top).
const _vMain = `
  vec3 nfO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float nfS = length((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 nfTo = uNfCam - nfO; nfTo.y = 0.0; nfTo = normalize(nfTo + vec3(1e-5, 0.0, 0.0));
  vec3 nfR = normalize(cross(vec3(0.0, 1.0, 0.0), nfTo));
  vec3 nfZ = normalize((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  float nfYaw = atan(nfZ.x, nfZ.z);
  float nfRel = atan(nfTo.x, nfTo.z) - nfYaw;
  float nfF = mod(nfRel / 6.2831853 * uNfViews + uNfViews * 8.0, uNfViews);
  float nfF0 = floor(nfF); float nfF1 = mod(nfF0 + 1.0, uNfViews); vNfBlend = nfF - nfF0;
  vec2 nfQ = uv;
  vNfUv0 = vec2((mod(nfF0, 4.0) + nfQ.x) * 0.25, (nfF0 < 3.5 ? 0.5 : 0.0) + nfQ.y * 0.5);
  vNfUv1 = vec2((mod(nfF1, 4.0) + nfQ.x) * 0.25, (nfF1 < 3.5 ? 0.5 : 0.0) + nfQ.y * 0.5);
  vec3 nfW = nfO + nfR * position.x * nfS + vec3(0.0, 1.0, 0.0) * position.y * nfS;
  { // gentle wind: sway grows with height^2 (trunk base fixed), per-tree phase from position, plus small leaf flutter
    float nfH = clamp(uv.y, 0.0, 1.0); float nfPh = dot(nfO.xz, vec2(0.071, 0.113));
    float nfSw = (sin(uNfTime * 0.9 + nfPh) * 0.7 + sin(uNfTime * 2.3 + nfPh * 1.7) * 0.3) * nfH * nfH;
    float nfFl = sin(uNfTime * 5.1 + nfPh * 9.0 + position.x * 3.0) * 0.12 * nfH;
    nfW += (nfR * 0.8 + nfTo * 0.35) * (nfSw + nfFl) * 0.018 * position.y * nfS * uNfWind;
  }
  vec3 nfN = normalize(nfTo * 0.62 + nfR * (uv.x - 0.5) * 1.1 + vec3(0.0, 1.0, 0.0) * (0.25 + (uv.y - 0.5) * 0.7));
  vNfN = normalize((viewMatrix * vec4(nfN, 0.0)).xyz);
  vec4 mvPosition = viewMatrix * vec4(nfW, 1.0);
  gl_Position = projectionMatrix * mvPosition;
`;
function patchImpostor(shader, isDepth) {
  shader.uniforms.uNfCam = _camPos;
  shader.uniforms.uNfViews = { value: 8 };
  shader.uniforms.uNfTime = _wind; shader.uniforms.uNfWind = _windAmp; shader.uniforms.uNfSunV = _sunV;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + _vp)
    .replace('#include <project_vertex>', _vMain);
  // the instanced world position is used by shadow / fog / CSM chunks
  shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>',
    'vec4 worldPosition = vec4(nfW, 1.0);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vNfUv0; varying vec2 vNfUv1; varying float vNfBlend; varying vec3 vNfN;')
    .replace('#include <map_fragment>', `
      vec4 nfA = texture2D(map, vNfUv0); vec4 nfB = texture2D(map, vNfUv1);
      // smooth, alpha-weighted crossfade between the two nearest of the 8 views (no dark fringe, no hard pop)
      float nfT = smoothstep(0.0, 1.0, vNfBlend);
      float nfWa = nfA.a * (1.0 - nfT), nfWb = nfB.a * nfT;
      vec4 sampledDiffuseColor = vec4((nfA.rgb * nfWa + nfB.rgb * nfWb) / max(nfWa + nfWb, 1e-4), max(nfA.a * (1.0 - nfT) + nfB.a * nfT, max(nfA.a, nfB.a) * 0.85));
      ${isDepth ? '' : `
        #ifdef NF_BLOSSOM
          float nfLeaf = smoothstep(0.0, 0.06, sampledDiffuseColor.g - max(sampledDiffuseColor.r, sampledDiffuseColor.b) * 0.92);
          float nfL = dot(sampledDiffuseColor.rgb, vec3(0.3, 0.55, 0.15));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(nfL * 2.1, nfL * 1.25, nfL * 1.5), nfLeaf * NF_BLOSSOM);
        #endif
        { // v36b grade: deeper, more saturated natural green (white-world bake reads pale under the ACES grade)
          vec3 c = pow(max(sampledDiffuseColor.rgb, 0.0), vec3(1.18));
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, 1.32) * vec3(0.80, 0.90, 0.72);
          sampledDiffuseColor.rgb = max(c, 0.0); }
        diffuseColor *= sampledDiffuseColor;`}
      ${isDepth ? 'diffuseColor.a *= sampledDiffuseColor.a;' : ''}
    `);
  if (!isDepth) shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uNfSunV;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { // [v36 polish] sun/sky tint: leaf translucency when backlit (low sun behind the trees) + soft sky fill, so impostors never go black
        vec3 nfV = normalize(-vViewPosition);                 // camera -> fragment
        float nfBack = pow(max(dot(nfV, normalize(uNfSunV)), 0.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * (vec3(1.0, 0.80, 0.42) * 1.9 * nfBack + vec3(0.42, 0.50, 0.58) * 0.30);
      }`)
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNfN); nonPerturbedNormal = normal;')
    .replace('#include <normal_fragment_maps>', '');
}

function impostorMaterial(kind, tint, blossom = 0) {
  const map = nfTexture(IMPOSTORS[kind].atlas);
  const m = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1.0, metalness: 0,
    color: new THREE.Color(tint ?? 0xffffff).multiplyScalar(0.9), envMapIntensity: 0.32,
  });
  // alpha-to-coverage stays OFF: the post-processing render target has no MSAA, so A2C discarded every texel (QC 11:05)
  m.alphaToCoverage = false;
  if (blossom > 0) m.defines = { NF_BLOSSOM: blossom.toFixed(2) };
  m.onBeforeCompile = (s) => patchImpostor(s, false);
  m.customProgramCacheKey = () => 'evImpostor' + blossom;
  m.userData.evImpostor = true;
  const d = new THREE.MeshDepthMaterial({ map, alphaTest: 0.42, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  d.onBeforeCompile = (s) => patchImpostor(s, true);
  d.customProgramCacheKey = () => 'evImpostorDepth';
  return { m, d };
}

/**
 * Instanced impostor forest. refHeight = height (m, at instance scale 1) of the legacy tree it replaces,
 * so v34/v35 placement + scale logic is kept exactly.
 */
export function impostorForest(scene, kind, matrices, colors, refHeight, { tint, castShadow = true, widthMul = 1, blossom = 0, blobs = true } = {}) {
  if (!matrices || !matrices.length) return null;
  const meta = IMPOSTORS[kind];
  const quadH = refHeight * NF_TREE_SCALE * meta.quad_h_m / meta.height_m;
  const quadW = quadH * meta.quad_w_m / meta.quad_h_m * widthMul;
  const geo = new THREE.PlaneGeometry(quadW, quadH);
  geo.translate(0, quadH / 2, 0);
  const { m, d } = impostorMaterial(kind, tint, blossom);
  const mesh = new THREE.InstancedMesh(geo, m, matrices.length);
  const c = new THREE.Color();
  matrices.forEach((mx, i) => {
    mesh.setMatrixAt(i, mx);
    if (colors && colors[i]) { // legacy per-tree brightness jitter 0.75..1.2 -> gentler 0.88..1.08
      const l = 0.88 + (colors[i].r - 0.75) / 0.45 * 0.2; mesh.setColorAt(i, c.setRGB(l, l, l * 0.98));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // billboards extend sideways: pad the bounding sphere so frustum culling never pops trees
  mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += quadH;
  mesh.customDepthMaterial = d;
  mesh.castShadow = castShadow && !NF_IS_MOBILE; mesh.receiveShadow = true;
  mesh.name = 'EV_Impostor_' + kind;
  mesh.onBeforeRender = (r, s, cam) => { _camPos.value.setFromMatrixPosition(cam.matrixWorld); _wind.value = performance.now() * 0.001; _sunV.value.copy(config.sun.direction).transformDirection(cam.matrixWorldInverse); };
  scene.add(mesh);
  if (blobs) contactBlobs(scene, matrices, quadW * 0.30, { opacity: 0.42, name: 'EV_ContactAO_' + kind }); // [v36 polish]
  mesh.userData.blobRadius = quadW * 0.30; // EVR-06: densePlanting builds its blobs time-sliced
  return mesh;
}

// ---------------------------------------------------------------- [v36 polish] contact AO
// Soft dark ground blobs under trees and rocks (one instanced draw per forest / rock set, no downloads).
// When the parent is the world scene the blob is laid on the terrain plane at the instance root.
let _blobTex = null;
function blobTexture() {
  if (_blobTex) return _blobTex;
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot(i + 0.5 - n / 2, j + 0.5 - n / 2) / (n / 2);
    let a = Math.max(0, 1 - r); a = a * a * (3 - 2 * a);
    d[(j * n + i) * 4 + 3] = Math.round(255 * Math.pow(a, 0.8));
  }
  _blobTex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); _blobTex.needsUpdate = true;
  return _blobTex;
}
const _bP = new THREE.Vector3(), _bQ = new THREE.Quaternion(), _bS = new THREE.Vector3(), _bN = new THREE.Vector3(), _bUp = new THREE.Vector3(0, 1, 0), _bM = new THREE.Matrix4();
export function contactBlobs(parent, matrices, radius1, opts = {}) {
  if (opts.slice) return contactBlobsSliced(parent, matrices, radius1, opts);
  const { opacity = 0.45, name = 'EV_ContactAO' } = opts;
  if (!matrices || !matrices.length) return null;
  if (NF_IS_MOBILE) return null; // EVR-06: [v36 polish] contact-AO blobs are a desktop-tier extra
  const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0xffffff, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, toneMapped: false });
  // no fog tint (a fogged black blob turns into a pale disc far away); fade the blobs out with distance instead
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n gl_FragColor.a *= 1.0 - smoothstep(140.0, 420.0, vFogDepth);\n#endif'); };
  mat.customProgramCacheKey = () => 'evContactAO';
  const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
  const world = opts.world ?? !!parent.isScene; // EVR-06: sliced builds pass world:true
  matrices.forEach((mx, i) => {
    mx.decompose(_bP, _bQ, _bS);
    const r = Math.min(7, radius1 * Math.max(_bS.x, _bS.y, _bS.z));
    if (world) {
      // EVR-06: 3 height lookups (forward differences) instead of 5; same normal to ~1 deg on these slopes
      const e = Math.max(0.6, r * 0.5), x = _bP.x, z = _bP.z, h0 = terrainHeight(x, z);
      const hx = 2 * (terrainHeight(x + e, z) - h0), hz = 2 * (terrainHeight(x, z + e) - h0);
      _bN.set(-hx, 2 * e, -hz).normalize();
      _bP.y = h0 + 0.08;
      _bQ.setFromUnitVectors(_bUp, _bN);
      if (_bN.y < 0.7 || !(r > 0.05)) { mesh.setMatrixAt(i, _bM.makeScale(0, 0, 0)); return; }   // cliffs / hidden instances: no blob
    } else { _bP.y += 0.08; _bQ.identity(); }
    _bS.set(r, 1, r);
    mesh.setMatrixAt(i, _bM.compose(_bP, _bQ, _bS));
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 1; mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** EVR-06: same blobs, built in <= 8 ms slices (opts.slice = async yielder). Desktop tier only. */
async function contactBlobsSliced(parent, matrices, radius1, { opacity = 0.45, name = 'EV_ContactAO', slice } = {}) {
  if (!matrices || !matrices.length || NF_IS_MOBILE) return null;
  const tmp = new THREE.Group();
  const chunk = 1500, out = [];
  for (let i = 0; i < matrices.length; i += chunk) {   // build sub-meshes per chunk, then merge into one InstancedMesh
    const m = contactBlobs(tmp, matrices.slice(i, i + chunk), radius1, { opacity, name, world: !!parent.isScene });
    if (m) out.push(m);
    await slice();
  }
  if (!out.length) return null;
  const total = out.reduce((a, m) => a + m.count, 0);
  const mesh = new THREE.InstancedMesh(out[0].geometry, out[0].material, total);
  let k = 0; for (const m of out) { for (let j = 0; j < m.count; j++) { m.getMatrixAt(j, _bM); mesh.setMatrixAt(k++, _bM); } if (m !== out[0]) { m.geometry.dispose(); m.material.dispose(); } }
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 1; mesh.name = name;
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- scanned rocks
const ROCKS = {
  boulder: { glb: 'rock_namaqualand_boulder_02', tex: 'rock_namaqualand' },
  stone:   { glb: 'rock_rock_07', tex: 'rock_07' },
};
let _gltf = null;
function gltfLoader() {
  _ensureInit();
  if (!_gltf) { _gltf = new GLTFLoader(); _gltf.setMeshoptDecoder(MeshoptDecoder); if (_ktx2) _gltf.setKTX2Loader(_ktx2); }
  return _gltf;
}
const _rockMats = {};
function rockMaterial(kind, tint) {
  const k = kind + (tint ?? '');
  if (_rockMats[k]) return _rockMats[k];
  const t = ROCKS[kind].tex;
  const m = new THREE.MeshStandardMaterial({
    map: nfTexture(t + '_diff', { gltf: true }), normalMap: nfTexture(t + '_nor', { srgb: false, gltf: true }),
    roughnessMap: nfTexture(t + '_arm', { srgb: false, gltf: true }), aoMap: nfTexture(t + '_arm', { srgb: false, gltf: true }),
    roughness: 1, metalness: 0, color: tint ?? 0xffffff, envMapIntensity: 0.8,
  });
  m.normalScale.set(1, 1);
  return (_rockMats[k] = m);
}
/**
 * Scanned rock instances that replace a legacy rock geometry. legacySize = horizontal diameter (m)
 * of the legacy rock at instance scale 1 (kept so the placement/scale logic stays identical).
 * Returns an Object3D (Group) immediately; the GLB is attached when it streams in.
 */
export function scannedRocks(scene, kind, matrices, legacySize, { castShadow = true, tint } = {}) {
  const g = new THREE.Group(); g.name = 'EV_ScanRocks_' + kind;
  if (!matrices || !matrices.length) return g;
  scene.add(g);
  const _rt = (typeof window !== 'undefined' && window.EV_PERF && window.EV_PERF.tier) || 'desktop'; // EVR-06 (Oct 15): per-tier cap + LOD
  const lod = (NF_IS_MOBILE || _rt !== 'desktop') ? 'lod1' : 'lod0';
  const _rf = ({ desktop: 1, mobile: 0.5 })[_rt] ?? 0.35;
  if (_rf < 1 && matrices.length > 8) { const keep = Math.max(8, Math.round(matrices.length * _rf)), st = matrices.length / keep; matrices = Array.from({ length: keep }, (_, k) => matrices[Math.floor(k * st)]); }
  if (_rt !== 'desktop') castShadow = false;
  contactBlobs(scene, matrices, legacySize * 0.62, { opacity: 0.5, name: 'EV_ContactAO_' + kind }); // [v36 polish]
  gltfLoader().load(`${BASE}${ROCKS[kind].glb}_${lod}.glb${V}`, (gltf) => {
    let geo = null;
    gltf.scene.traverse(o => { if (!geo && o.isMesh) geo = o.geometry; });
    if (!geo) return;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, sz = new THREE.Vector3(); bb.getSize(sz);
    const k = legacySize / Math.max(sz.x, sz.z, 1e-3);
    const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(0, -bb.min.y - sz.y * 0.12, 0));
    if (!geo.attributes.uv1 && geo.attributes.uv) geo.setAttribute('uv1', geo.attributes.uv);
    const mesh = new THREE.InstancedMesh(geo, rockMaterial(kind, tint), matrices.length);
    const t = new THREE.Matrix4();
    matrices.forEach((mx, i) => mesh.setMatrixAt(i, t.copy(mx).multiply(fix)));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = castShadow && !NF_IS_MOBILE; mesh.receiveShadow = true;
    g.add(mesh);
  }, undefined, (e) => console.warn('[nearField] rock GLB failed', kind, e?.message || e));
  return g;
}

// ---------------------------------------------------------------- volumetric cloud sprites
export function cloudSpriteMaterial(i) {
  return new THREE.SpriteMaterial({
    map: nfTexture('cloud_' + (i % 4), { tiered: false }), transparent: true, depthWrite: false,
    opacity: 0.5, color: 0xffffff, fog: true,
  });
}

// ---------------------------------------------------------------- world-space scanned surfaces
// tileMeters: metres per texture repeat. Triplanar on world position, so a 240 m terrace box shows
// real-size cobbles instead of one stretched 512 px tile. Chains any existing onBeforeCompile.
export function worldSpaceSurface(mat, tileMeters, top = null, antiTile = false) {
  if (!mat || mat.userData.nfWorldUV) return mat;
  mat.userData.nfWorldUV = true;
  const prev = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') ? mat.onBeforeCompile : null;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (shader, r) {
    if (prev) prev.call(this, shader, r);
    if (shader.vertexShader.includes('vNfWP')) return;
    shader.uniforms.uNfTile = { value: 1 / tileMeters };
    if (top) { shader.uniforms.uNfTop = { value: top.map }; shader.uniforms.uNfTopTile = { value: 1 / top.tileMeters }; }
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vNfWP; varying vec3 vNfWN;\nvoid main() {')
      .replace(/}\s*$/, `
        #ifdef USE_INSTANCING
          vNfWP = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
          vNfWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vNfWP = (modelMatrix * vec4(position, 1.0)).xyz;
          vNfWN = normalize(mat3(modelMatrix) * normal);
        #endif
      }`);
    const tri = (s) => `nfTri(${s})`;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `varying vec3 vNfWP; varying vec3 vNfWN; uniform float uNfTile;
        float nfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nfVN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(nfHash(i), nfHash(i + vec2(1.0, 0.0)), f.x), mix(nfHash(i + vec2(0.0, 1.0)), nfHash(i + 1.0), f.x), f.y); }
        // v36b anti-tiling: blend the tile with a rotated / rescaled / offset copy of itself through value noise
        vec4 nfAT(sampler2D t, vec2 uv) {
          ${antiTile ? `vec2 uv2 = mat2(0.809, -0.588, 0.588, 0.809) * uv * 0.87 + vec2(0.31, 0.57);
          float n = nfVN(uv * 0.27) * 0.65 + nfVN(uv * 0.71 + 3.1) * 0.35;
          return mix(texture2D(t, uv), texture2D(t, uv2), smoothstep(0.36, 0.64, n));` : 'return texture2D(t, uv);'}
        }
        vec4 nfTri(sampler2D t) {
          vec3 w = pow(abs(normalize(vNfWN)), vec3(4.0)); w /= (w.x + w.y + w.z);
          return texture2D(t, vNfWP.zy * uNfTile) * w.x + nfAT(t, vNfWP.xz * uNfTile) * w.y + texture2D(t, vNfWP.xy * uNfTile) * w.z;
        }
        ${top ? 'uniform sampler2D uNfTop; uniform float uNfTopTile;' : ''}
        void main() {`)
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment
        .replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', `vec4 sampledDiffuseColor = ${tri('map')};
          { // macro variation (same scan at 1/23 and 1/61 scale): dirt, wear and tonal patches visible from the orbit camera
            float nfM = texture2D(map, vNfWP.xz * uNfTile * 0.043).g * 0.6 + texture2D(map, vNfWP.zx * uNfTile * 0.016 + 0.37).g * 0.4;
            sampledDiffuseColor.rgb *= mix(0.72, 1.18, smoothstep(0.15, 0.75, nfM)); }
          ${top ? `{ // grass / soil on up-facing ground: hills read as vegetated rock, not grey card
            float nfUp = smoothstep(0.55, 0.82, normalize(vNfWN).y);
            float nfN = texture2D(uNfTop, vNfWP.xz * 0.013).g; // low-freq breakup from the same scan
            nfUp = clamp(nfUp + (nfN - 0.5) * 0.6, 0.0, 1.0);
            sampledDiffuseColor = mix(sampledDiffuseColor, texture2D(uNfTop, vNfWP.xz * uNfTopTile), nfUp); }` : ''}`))
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment
        .replace('vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );', `vec4 texelRoughness = ${tri('roughnessMap')};`))
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = ${tri('normalMap')}.xyz * 2.0 - 1.0;`));
  };
  mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|nfWS' + tileMeters + (top ? 'T' : '') + (antiTile ? 'A' : ''); };
  mat.needsUpdate = true;
  return mat;
}

// Scanned CC0 cobble (Poly Haven cobblestone_floor_01), world-space so stones stay ~real size (tile 2.4 m).
let _cobble = null;
export function cobbleMaterial() {
  if (_cobble) return _cobble;
  _ensureInit();
  _cobble = new THREE.MeshStandardMaterial({
    // v37 PBR: library cobble (Poly Haven cobblestone_square, CC0; pbr-EVR-07/08), KTX2 bottom-left origin, so no V-mirror / green flip
    ...scannedPBR('paving'), roughness: 1, metalness: 0,
    color: new THREE.Color(1.22, 1.14, 1.02), envMapIntensity: 0.7,
  });
  _cobble.normalScale.set(1.2, 1.2);
  return worldSpaceSurface(_cobble, 1.0 * 2.4, null, true);
}

// Scanned CC0 lichen/moss rock (Poly Haven mossy_rock), world-space 7 m tiles, grass blended onto up-facing
// faces (existing scanned grass texture), for the near hills / cliffs that read as grey card in v35.
let _cliff = null;
export function scanCliffMaterial() {
  if (_cliff) return _cliff;
  _ensureInit();
  const grass = scannedPBR('grass').map;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.colorSpace = THREE.SRGBColorSpace;
  _cliff = new THREE.MeshStandardMaterial({
    ...scannedPBR('rock'), roughness: 1, metalness: 0,
    color: 0xe8e2d6, envMapIntensity: 0.8, side: THREE.DoubleSide,
  });
  _cliff.normalScale.set(1.1, 1.1); // OpenGL normal maps, bottom-left KTX2 orientation
  return worldSpaceSurface(_cliff, 7.0, { map: grass, tileMeters: 3.0 });
}
