// evScatter.js: EVR-05 vegetation + rock scatter for three r186 (WebGL2). Terrain & Vegetation Realism.
// Instanced LOD0/LOD1 meshes near, octahedral (hemi-oct 8x8) impostors far. One InstancedMesh per species per LOD per primitive,
// one per species impostor atlas. CPU LOD + frustum selection at most every 250 ms (recipe §5), never per frame.
// Look (V37_GPU_BUDGETS): vertex-only wind (1 sin per term, branch weight/phase from COLOR_0, layout EVR05-VC1, see VERTEX_LAYOUT.md),
// back-light translucency = view-to-sun dot x (1 - thickness) injected via onBeforeCompile (no transmission, no extra pass),
// alpha-tested leaves only. New programs: 1 shared vegetation program (MeshStandard + onBeforeCompile, all species) + 1 impostor program.
// Kill switch: ?fx=0 (or opts.fx=false) => no wind, no translucency (plain alpha-tested MeshStandard), impostors unlit-albedo-only lighting.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
const _frus = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();

export const TIERS = {
  //           lod0   lod1   impostor-out  wind-radius  translucency  shadows  density   (distances in m, LOD bias per recipe)
  desktop: { d0: 30,  d1: 90,  dImp: 150, far: 1600, wind: 40, trans: true,  shadow: true,  density: 1.0 },
  mobile:  { d0: 18,  d1: 54,  dImp: 90,  far: 900,  wind: 20, trans: true,  shadow: false, density: 0.55 },
  low:     { d0: 12,  d1: 36,  dImp: 60,  far: 500,  wind: 0,  trans: false, shadow: false, density: 0.3, heroOnly: true, impFill: true, farTree: 1200 },
  // low: hero species get meshes; other trees (fir, quiver) are impostor-only far fill so ridges read forested (Oct 17 fix)
};

/** Shared uniforms (one time/wind set; Animation may drive evTime/evWindStr/evWindDir directly). */
export const evVegUniforms = {
  evTime: { value: 0 }, evWindStr: { value: 1 }, evWindDir: { value: new THREE.Vector3(0.8, 0, 0.6).normalize() },
  evWindFar: { value: 40 }, evSunDirView: { value: new THREE.Vector3(0, 1, 0) }, evSunColor: { value: new THREE.Color(1, 1, 1) },
  evTransStrength: { value: 0.9 }, evTransTint: { value: new THREE.Color(0.95, 1.0, 0.35) }, evSunDirWorld: { value: new THREE.Vector3(0, 1, 0) },
  evAmbient: { value: new THREE.Color(0.35, 0.4, 0.45) },
  // R1-R3 (ADAPTER.md, Oct 17): same program, uniforms only. Defaults reproduce the timed Oct 15 shader exactly.
  evWindParams: { value: new THREE.Vector4(0.35, 0.6, 0.03, 7.0) },   // R1: swayAmp, swayFreq, flutterAmp, flutterFreq
  evFlutter: { value: 1 },                                              // R2: 0 = flutter off (reduced motion)
  evGustFront: { value: 0 },                                            // R3: 0 = off; ~0.035 rolls gusts across the forest along evWindDir
};

export function fxEnabled(opts = {}) {
  if (opts.fx === false) return false;
  try { return new URLSearchParams(location.search).get('fx') !== '0'; } catch { return true; }
}

// ------------------------------------------------------------------ vegetation materials: ONE leaf + ONE bark material for every wind species
// (Lead rule: +1 program per tree material family). Textures come from KTX2 array textures (layer per species, see VERTEX_LAYOUT.md):
// geometry attribute TEXCOORD_1.x = layer (renamed evLayer), TEXCOORD_0 = uv (renamed evUv).
const VEG_KEY = 'evVeg3';
export function makeVegMaterial(kind, arrTex, tier, fx) {
  const leaf = kind === 'leaves', T = TIERS[tier];
  const m = new THREE.MeshStandardMaterial({ roughness: leaf ? 0.75 : 0.9, metalness: 0, alphaTest: leaf ? 0.5 : 0, side: leaf ? THREE.DoubleSide : THREE.FrontSide });
  m.name = 'ev_veg_' + kind;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, evVegUniforms, { evMapArr: { value: arrTex } });
    sh.defines = sh.defines || {};
    if (fx && leaf && T.trans) sh.defines.EV_TRANS = 1;
    if (fx && T.wind > 0) sh.defines.EV_WIND = 1;
    sh.vertexShader = 'attribute vec4 evWind; attribute vec2 evUv; attribute vec2 evLayer;\nuniform float evTime, evWindStr, evWindFar, evFlutter, evGustFront; uniform vec3 evWindDir; uniform vec4 evWindParams;\nvarying vec2 vEv; varying vec3 vEvUvl;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vEv = evWind.ba; vEvUvl = vec3(evUv, evLayer.x + 0.5);
#ifdef EV_WIND
  #ifdef USE_INSTANCING
  vec3 evIp = instanceMatrix[3].xyz;
  #else
  vec3 evIp = vec3(0.0);
  #endif
  vec4 evWp = modelMatrix * vec4(evIp, 1.0);
  float evFade = 1.0 - smoothstep(evWindFar * 0.75, evWindFar, distance(evWp.xyz, cameraPosition));
  if (evFade > 0.0) {
    float ip = fract(sin(dot(evIp.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
    float r = evWind.r, s = evWindStr * evFade;
    float gust = dot(evWp.xz, evWindDir.xz) * evGustFront;                                                                   // R3 gust front (0 = off)
    transformed.xz += evWindDir.xz * (sin(evTime * evWindParams.y + ip - gust) * evWindParams.x * r * r * position.y * 0.08 * s);   // slow outer-branch sway (R1)
    transformed += normal * (step(0.75, r) * sin(evTime * evWindParams.w + evWind.g * 6.2831 + ip) * evWindParams.z * evFlutter * s);   // fast leaf flutter (R1, R2)
  }
#endif`);
    sh.fragmentShader = 'uniform vec3 evSunDirView, evSunColor, evTransTint; uniform float evTransStrength; uniform mediump sampler2DArray evMapArr;\nvarying vec2 vEv; varying vec3 vEvUvl;\n' +
      sh.fragmentShader.replace('#include <map_fragment>', `diffuseColor *= texture(evMapArr, vec3(vEvUvl.xy, floor(vEvUvl.z)));`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse *= vEv.y;                           // baked crown AO (A): shadowed interior leaves stay deep green
#ifdef EV_TRANS
  float evBack = pow(saturate(dot(normalize(-vViewPosition), evSunDirView)), 5.0);   // camera looks towards the sun
  reflectedLight.directDiffuse += diffuseColor.rgb * evTransTint * evSunColor * (evBack * (1.0 - vEv.x) * evTransStrength);
#endif`);
  };
  m.customProgramCacheKey = () => VEG_KEY + kind + tier + (fx ? 1 : 0);
  return m;
}

// ------------------------------------------------------------------ impostor material (hemi-octahedral 8x8, one program)
const IMP_VS = `
uniform float evRadius; uniform vec3 evPivot; varying vec2 vUv; varying vec3 vNw; varying float vFog;
#include <fog_pars_vertex>
vec2 hemiOctEncode(vec3 d){ d /= (abs(d.x)+abs(d.y)+abs(d.z)); return vec2(d.x+d.y, d.x-d.y); }
vec3 hemiOctDecode(vec2 e){ vec2 p = vec2(e.x+e.y, e.x-e.y)*0.5; return normalize(vec3(p, 1.0-abs(p.x)-abs(p.y))); }
void main(){
  mat4 im = modelMatrix * instanceMatrix;
  vec3 cen = (im * vec4(evPivot, 1.0)).xyz;
  vec3 dW = normalize(cameraPosition - cen);
  mat3 R = mat3(im); float sc = length(R[0]); mat3 Rn = R / sc;
  vec3 dL = transpose(Rn) * dW;                 // three local (Y up)
  vec3 dB = vec3(dL.x, -dL.z, max(dL.y, 0.0)); // Blender model frame (Z up), hemisphere
  vec2 e = hemiOctEncode(dB);
  vec2 cell = clamp(floor((e * 0.5 + 0.5) * 8.0), 0.0, 7.0);
  vec3 dS = hemiOctDecode((cell + 0.5) / 8.0 * 2.0 - 1.0);           // snapped view dir (Blender frame)
  vec3 f = -dS; vec3 r = cross(f, vec3(0,0,1)); r = length(r) < 1e-4 ? vec3(1,0,0) : normalize(r); vec3 u = cross(r, f);
  vec3 rL = vec3(r.x, r.z, -r.y), uL = vec3(u.x, u.z, -u.y);         // back to three local
  vec3 pL = evPivot + (rL * position.x + uL * position.y) * evRadius;
  vec4 mv = viewMatrix * im * vec4(pL, 1.0);
  gl_Position = projectionMatrix * mv;
  vUv = vec2((cell.x + position.x * 0.5 + 0.5) / 8.0, (cell.y + 0.5 - position.y * 0.5) / 8.0);   // row 0 = top (ktx2, flipY=false)
  vNw = vec3(Rn[0].x, Rn[0].z, 0.0);           // cos/sin of instance yaw for normal rotation
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;
// T1 fix (Oct 17): #include <common> provides saturate(); without it the shader only compiled when three injected
// tonemapping_pars_fragment (canvas + tone mapping), and failed in render-target / NoToneMapping pipelines.
const IMP_FS = `
#include <common>
uniform sampler2D evAlbedo, evNd; uniform vec3 evSunDirWorld, evSunColor, evAmbient, evTransTint; uniform float evTransStrength; uniform float evFx;
varying vec2 vUv; varying vec3 vNw;
#include <fog_pars_fragment>
void main(){
  vec4 a = texture2D(evAlbedo, vUv);
  if (a.a < 0.5) discard;
  float thick = saturate(a.a * 2.0 - 1.0);
  vec3 nB = texture2D(evNd, vUv).rgb * 2.0 - 1.0;
  vec3 nL = vec3(nB.x, nB.z, -nB.y);
  vec3 n = normalize(vec3(vNw.x * nL.x + vNw.y * nL.z, nL.y, -vNw.y * nL.x + vNw.x * nL.z));
  float ndl = max(dot(n, evSunDirWorld), 0.0);
  // ambient: half-desaturated sky (avoids blue crown cores) and darker toward the occluded core (thick)
  vec3 amb = mix(vec3(dot(evAmbient, vec3(0.2126, 0.7152, 0.0722))), evAmbient, 0.5) * (1.0 - 0.45 * thick);
  vec3 col = a.rgb * (amb + evSunColor * ndl * evFx + evSunColor * (1.0 - evFx) * 0.6);
  // impostors are static (budget); back-light uses the camera->fragment direction approximated by the view axis
  vec3 vd = normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
  col += a.rgb * evTransTint * evSunColor * pow(saturate(dot(-vd, evSunDirWorld)), 5.0) * (1.0 - thick) * evTransStrength * evFx;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
export function makeImpostorMaterial(albedo, nd, meta, fx) {
  return new THREE.ShaderMaterial({ name: 'evImpostor', vertexShader: IMP_VS, fragmentShader: IMP_FS, fog: true, side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), evAlbedo: { value: albedo }, evNd: { value: nd },
      evRadius: { value: meta.radius }, evPivot: { value: new THREE.Vector3(0, meta.pivot_offset_z, 0) }, evFx: { value: fx ? 1 : 0 },
      evSunDirWorld: evVegUniforms.evSunDirWorld, evSunColor: evVegUniforms.evSunColor, evAmbient: evVegUniforms.evAmbient,
      evTransTint: evVegUniforms.evTransTint, evTransStrength: evVegUniforms.evTransStrength } });
}

// ------------------------------------------------------------------ EVSI instance files (decoder lives here; loaders only call createScatter)
// v1: 16 B header + 16 B/instance (f32 x,y,z, u16 yaw, u16 scale/4096).
// v2: 40 B header (magic 'EVSI', u16 ver=2, u16 stride=8, u32 count, u32 flags, f32 min[3], f32 extent[3])
//     + 8 B/instance: u16 qx,qy,qz (p = min + q/65535*extent), u8 yaw (q/256*2pi), u8 scale (0.5 + q/255).
export function parseEvsi(buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'EVSI') throw new Error('not EVSI');
  const ver = dv.getUint16(4, true), stride = dv.getUint16(6, true), n = dv.getUint32(8, true), pos = new Float32Array(n * 3), yaw = new Float32Array(n), scl = new Float32Array(n);
  if (ver === 1) {
    for (let i = 0, o = 16; i < n; i++, o += stride) {
      pos[i * 3] = dv.getFloat32(o, true); pos[i * 3 + 1] = dv.getFloat32(o + 4, true); pos[i * 3 + 2] = dv.getFloat32(o + 8, true);
      yaw[i] = dv.getUint16(o + 12, true) / 65536 * Math.PI * 2; scl[i] = dv.getUint16(o + 14, true) / 4096;
    }
  } else if (ver === 2) {
    const mn = [0, 1, 2].map((k) => dv.getFloat32(16 + k * 4, true)), ex = [0, 1, 2].map((k) => dv.getFloat32(28 + k * 4, true) / 65535);
    for (let i = 0, o = 40; i < n; i++, o += stride) {
      for (let k = 0; k < 3; k++) pos[i * 3 + k] = mn[k] + dv.getUint16(o + k * 2, true) * ex[k];
      yaw[i] = dv.getUint8(o + 6) / 256 * Math.PI * 2; scl[i] = 0.5 + dv.getUint8(o + 7) / 255;
    }
  } else throw new Error('EVSI version ' + ver);
  return { n, pos, yaw, scl };
}

function prepGeometry(g) {
  const c = g.getAttribute('color');
  if (c) { g.setAttribute('evWind', c); g.deleteAttribute('color'); }
  else { const n = g.getAttribute('position').count, a = new Float32Array(n * 4); for (let i = 0; i < n; i++) a.set([0, 0, 1, 1], i * 4); g.setAttribute('evWind', new THREE.BufferAttribute(a, 4)); }
  g.setAttribute('evUv', g.getAttribute('uv')); const l = g.getAttribute('uv1');
  g.setAttribute('evLayer', l || new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2)); g.deleteAttribute('uv1');
  return g;
}

/**
 * Build the scatter. opts: { scene, camera, gltf (GLTFLoader with KTX2 + Meshopt), ktx2 (KTX2Loader), base (URL of scatter/ folder),
 *   tier: 'desktop'|'mobile'|'low', fx?: bool, sun?: DirectionalLight, onProgress? }
 * Returns { group, update(dtSeconds), stats(), dispose(), setTier() }.
 */
export async function createScatter(opts) {
  let { camera } = opts; const { gltf, ktx2, base } = opts; const tier = opts.tier || 'desktop'; const T = TIERS[tier]; const fx = fxEnabled(opts);
  const man = await (await fetch(opts.manifest || `${base}/scatter.json`)).json();
  const group = new THREE.Group(); group.name = 'evScatter'; opts.scene.add(group);
  evVegUniforms.evWindFar.value = T.wind;
  const VA = man.vegArrays, pick = (o) => o[tier] || o.desktop;
  const [leafArr, barkArr] = await Promise.all([ktx2.loadAsync(`${base}/${pick(VA.leaves)}`), ktx2.loadAsync(`${base}/${pick(VA.bark)}`)]);
  for (const t of [leafArr, barkArr]) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = tier === 'desktop' ? 4 : 2; t.needsUpdate = true; }
  const MAT = { leaves: makeVegMaterial('leaves', leafArr, tier, fx), bark: makeVegMaterial('bark', barkArr, tier, fx) };
  // shared 512 rock texture set (rocks/boulders): one texture set, per-species tint from the GLB baseColorFactor; same program for all
  let rockTex = null;
  if (man.rockTex && !T.heroOnly) {
    const [b, nrm, orm] = await Promise.all(['base', 'normal', 'orm'].map((k) => ktx2.loadAsync(`${base}/${man.rockTex[k]}`)));
    b.colorSpace = THREE.SRGBColorSpace; for (const t of [b, nrm, orm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = tier === 'desktop' ? 4 : 2; t.needsUpdate = true; }
    rockTex = { b, nrm, orm };
  }
  const rockMats = new Map();
  const rockMat = (m) => { const k = m.color.getHexString(); if (!rockMats.has(k)) rockMats.set(k, new THREE.MeshStandardMaterial({ color: m.color.clone(), map: rockTex.b, normalMap: rockTex.nrm, roughnessMap: rockTex.orm, metalnessMap: rockTex.orm, roughness: 1, metalness: 0, name: 'ev_rock' })); return rockMats.get(k); };
  const species = [];
  for (const [name, sp] of Object.entries(man.species)) {
    // This legacy set ships only a whole-plant atlas, with no GLB on disk.
    // Keep the remaining real-mesh scatter available until its geometry is authored.
    if (sp.impostorOnly && sp.cls !== 'tree') continue;
    const fill = !!(T.heroOnly && !sp.hero && T.impFill && sp.impostor && sp.cls === 'tree');   // low tier: impostor-only far fill
    if (T.heroOnly && !sp.hero && !fill) continue;
    const inst = parseEvsi(await (await fetch(`${base}/${sp.instances[tier] || sp.instances.desktop}`)).arrayBuffer());
    // fix-scatter-ground: snap Y once to the SHIPPING terrain (opts.groundY) and drop instances in water (opts.isWet)
    const _drop = new Uint8Array(inst.n);
    if (opts.groundY) for (let i = 0; i < inst.n; i++) { const x = inst.pos[i * 3], z = inst.pos[i * 3 + 2]; const h = opts.groundY(x, z);
      inst.pos[i * 3 + 1] = h; if (opts.isWet && opts.isWet(x, z, h)) _drop[i] = 1; }
    const g = await gltf.loadAsync(`${base}/${sp.glb[tier] || sp.glb.desktop}`);
    const lods = [];
    for (const L of [0, 1]) {
      const node = g.scene.getObjectByName(`${name}_LOD${L}`); if (!node) continue; node.updateMatrixWorld(true);
      const parts = [];
      node.traverse((o) => { if (o.isMesh) parts.push(o); });
      lods.push(parts.map((o) => {
        let geo = o.geometry.clone().applyMatrix4(o.matrixWorld), mat;
        if (sp.wind) { geo = prepGeometry(geo); mat = MAT[/leaves/.test(o.material.name) ? 'leaves' : 'bark']; }
        else if (sp.sharedRockTex && rockTex) mat = rockMat(o.material);
        else { mat = o.material; mat.vertexColors = false; }                                   // rocks / quiver: their own standard material, no wind
        const im = new THREE.InstancedMesh(geo, mat, inst.n);
        im.count = 0; im.frustumCulled = false; im.castShadow = T.shadow && L === 0 && sp.cls === 'tree'; im.receiveShadow = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.name = `${name}_LOD${L}_${mat.name}`; group.add(im); return im;
      }));
    }
    let imp = null;
    if (sp.impostor && sp.cls === 'tree') {
      const [alb, nd] = await Promise.all([ktx2.loadAsync(`${base}/${sp.impostor.albedo[tier] || sp.impostor.albedo.desktop}`), ktx2.loadAsync(`${base}/${sp.impostor.nd[tier] || sp.impostor.nd.desktop}`)]);
      alb.colorSpace = THREE.SRGBColorSpace; nd.colorSpace = THREE.NoColorSpace;
      for (const t of [alb, nd]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false; }
      imp = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), makeImpostorMaterial(alb, nd, sp.impostor.meta, fx), inst.n);
      imp.count = 0; imp.frustumCulled = false; imp.instanceMatrix.setUsage(THREE.DynamicDrawUsage); imp.name = `${name}_impostor`; group.add(imp);
    }
    const mats = new Float32Array(inst.n * 16);
    for (let i = 0; i < inst.n; i++) {
      _p.fromArray(inst.pos, i * 3); _q.setFromAxisAngle(_Y, inst.yaw[i]); _s.setScalar(inst.scl[i]); _m.compose(_p, _q, _s).toArray(mats, i * 16);
    }
    // density thinning per tier: deterministic per instance
    const keep = new Uint8Array(inst.n); for (let i = 0; i < inst.n; i++) keep[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 < T.density * (sp.densityScale?.[tier] ?? 1) && !_drop[i] ? 1 : 0;
    const cull = sp.cls === 'tree' ? (T.farTree || T.far) : sp.cls === 'rock' ? T.far * 0.25 : T.far * 0.08;
    species.push({ name, sp, inst, lods, imp, mats, keep, rad: (sp.height_m || 10) * 0.6, cull, fill });
  }
  let acc = 1e9, lastStats = {}, externalTrees = false;
  const tmpPos = new THREE.Vector3();
  function select() {
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pm);
    const cp = camera.getWorldPosition(tmpPos), st = { instances: 0, drawn: [0, 0, 0], draws: 0 };
    const lb = 1; // distances are tier-scaled in TIERS
    for (const S of species) {
      if (externalTrees && S.sp.cls === 'tree') {
        [...S.lods.flat(), S.imp].filter(Boolean).forEach(m => {m.count=0;m.visible=false;});
        continue;
      }
      const c = [0, 0, 0], arrs = [S.lods[0]?.map((m) => m.instanceMatrix.array), S.lods[1]?.map((m) => m.instanceMatrix.array), S.imp ? [S.imp.instanceMatrix.array] : null];
      for (let i = 0; i < S.inst.n; i++) {
        if (!S.keep[i]) continue;
        _sph.center.fromArray(S.inst.pos, i * 3); _sph.center.y += S.rad; _sph.radius = S.rad * S.inst.scl[i] * 1.2;
        const d = _sph.center.distanceTo(cp); if (d > S.cull) continue;
        if (!_frus.intersectsSphere(_sph)) continue;
        const L = !S.imp ? (d<T.d0 && S.lods[0] ? 0 : S.lods[1] ? 1 : 0)
          : S.fill ? 2 : d<T.d0*lb ? 0 : d<T.dImp*lb ? 1 : 2;
        const tgt = arrs[L]; if (!tgt) continue;   // L = -1: fill species inside the mesh range (not drawn on low)
        for (const a of tgt) a.set(S.mats.subarray(i * 16, i * 16 + 16), c[L] * 16);
        c[L]++;
      }
      [S.lods[0], S.lods[1], S.imp ? [S.imp] : null].forEach((ms, L) => ms && ms.forEach((m) => { m.count = c[L]; m.instanceMatrix.needsUpdate = c[L] > 0; m.visible = c[L] > 0; if (c[L]) st.draws++; }));
      st.instances += c[0] + c[1] + c[2]; st.drawn[0] += c[0]; st.drawn[1] += c[1]; st.drawn[2] += c[2];
    }
    lastStats = st;
  }
  const sunV = new THREE.Vector3();
  function update(dt) {
    evVegUniforms.evTime.value += dt;
    if (opts.sun) {
      sunV.copy(opts.sun.position).sub(opts.sun.target.position).normalize(); evVegUniforms.evSunDirWorld.value.copy(sunV);
      evVegUniforms.evSunDirView.value.copy(sunV).transformDirection(camera.matrixWorldInverse);
      evVegUniforms.evSunColor.value.copy(opts.sun.color).multiplyScalar(opts.sun.intensity / Math.PI);
    }
    acc += dt * 1000; if (acc >= 250) { acc = 0; select(); }
  }
  if (camera) select();
  return {
    group, update, setCamera(c) { camera = c; select(); }, stats: () => ({ ...lastStats, species: species.length, fx, tier }),
    claimTreePlacements() {
      externalTrees=true; select();
      return species.filter(s=>s.sp.cls==='tree').map(s=>({name:s.name,height:s.sp.height_m,matrices:s.mats,keep:s.keep,count:s.inst.n,group}));
    },
    restoreTreePlacements() {externalTrees=false;select();},
    dispose() { group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); leafArr.dispose(); barkArr.dispose(); group.removeFromParent(); },
  };
}
