// [v36 polish] QA: "sparse". Mass-scatter the existing v36 scanned-tree impostors on slopes and along the
// river and lake shores (map layout, after plots), plus flower beds around the plaza and along the gate approach.
// No new downloads: impostor atlases + the meadow flower materials are already loaded.
import * as THREE from 'three';
import { terrainHeight, distToRoads, getRiverInfo, fbm, mulberry32, WORLD, coastZ, isUnderWater } from '../terrain.js?v=73';
import { impostorForest, contactBlobs } from './nearField.js?v=73';

const KEEP = () => [
  [WORLD.plaza.x, WORLD.plaza.z, 95], [0, 880, 95], [0, 440, 60],
  [WORLD.cathedral.x, WORLD.cathedral.z, 120], [WORLD.mosque.x, WORLD.mosque.z, 135], [WORLD.buddhistTemple.x, WORLD.buddhistTemple.z, 130],
  [-930, -620, 80], [WORLD.waterfall.x, WORLD.waterfall.z, 70],
];
const ARID = [[-620, 520, 430], [-1000, -560, 480], [-930, -620, 230]];

// EVR-06: desktop tier only, time-sliced (<= 8 ms per task), built after world-ready (WorldCore lazy queue).
// `slice` is an async yielder (WorldCore evSlicer). Same seed and placement as v36 polish, so the look is unchanged.
export async function buildDensePlanting(world, { mobile = false, slice = async () => {} } = {}) {
  const T = world.terrain, scene = world.scene, plots = world.plots || [];
  const rng = mulberry32(36036);
  const keep = KEEP();
  const L = WORLD.lake;
  const out = { fir: [], broadleaf: [], smallleaf: [], blossom: [] };
  const m4 = (x, y, z, s, r) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(s, s, s));
  // plot lookup grid (40 m cells)
  const grid = new Map(), key = (x, z) => ((x / 40) | 0) * 100003 + ((z / 40) | 0);
  for (const p of plots) { const k = key(p.x, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  const nearPlot = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const a = grid.get(key(x + dx * 40, z + dz * 40)); if (a) for (const p of a) if (Math.hypot(x - p.x, z - p.z) < 16) return true; } return false; };
  const ok = (x, z, roadClear) => {
    if (z >= coastZ(x) - 30) return false;
    for (const [kx, kz, r] of keep) if (Math.hypot(x - kx, z - kz) < r) return false;
    for (const [ax, az, r] of ARID) if (Math.hypot(x - ax, z - az) < r) return false;
    if (Math.hypot(x - L.x, z - L.z) < L.r + 6) return false;
    if (distToRoads(x, z) < roadClear) return false;
    if (isUnderWater(x, z)) return false;
    return !nearPlot(x, z);
  };
  const slopeAt = (x, z) => { const e = 2, hx = terrainHeight(x + e, z) - terrainHeight(x - e, z), hz = terrainHeight(x, z + e) - terrainHeight(x, z - e); return 1 - (2 * e) / Math.hypot(hx, hz, 2 * e); };

  // 1. shores: river corridor and the lake ring
  const nShore = mobile ? 2600 : 7000;
  for (let i = 0; i < nShore; i++) {
    let x, z;
    if (rng() < 0.45) { const a = rng() * Math.PI * 2, r = L.r + 10 + Math.pow(rng(), 1.6) * 80; x = L.x + Math.cos(a) * r; z = L.z + Math.sin(a) * r; }
    else { x = -320 + rng() * 700; z = -320 + rng() * 1250; const ri = getRiverInfo(x, z); if (ri.dist < 27 || ri.dist > 75) continue; }
    if (!ok(x, z, 9)) continue;
    const y = terrainHeight(x, z) - 0.2, s = 0.75 + rng() * 0.55, r = rng() * 6.283;
    (rng() < 0.6 ? out.smallleaf : out.broadleaf).push(m4(x, y, z, s, r));
    if ((i & 63) === 0) await slice();
  }
  // 2. slopes: clumped forest masses on the valley sides
  const nSlope = mobile ? 9000 : 26000;
  for (let i = 0; i < nSlope; i++) {
    const x = -1500 + rng() * 3100, z = -1300 + rng() * 2200;
    const clump = fbm(x * 0.0045 + 7.1, z * 0.0045 - 3.3, 3);
    if (clump < 0.42 + rng() * 0.12) continue;
    const h = terrainHeight(x, z);
    if (h < 22 || h > 1150) continue;
    const sl = slopeAt(x, z);
    if (sl < 0.04 || sl > 0.45) continue;
    if (!ok(x, z, 10)) continue;
    const y = h - 0.25, s = 0.7 + rng() * 0.6, r = rng() * 6.283;
    const pick = rng();
    if (h > 150 || pick < 0.35) out.fir.push(m4(x, y, z, s, r));
    else if (pick < 0.85) out.broadleaf.push(m4(x, y, z, s * 1.1, r));
    else out.blossom.push(m4(x, y, z, s * 0.8, r));
    if ((i & 63) === 0) await slice();
  }
  // A mountain forest surrounds the fortress terraces; the old 200m exclusion
  // left the building isolated on a bare artificial mound.
  const fortressTrees=mobile?700:2200;
  for(let i=0;i<fortressTrees;i++) {
    const a=rng()*Math.PI*2,r=Math.sqrt(120*120+rng()*(470*470-120*120));
    const x=WORLD.cathedral.x+Math.cos(a)*r,z=WORLD.cathedral.z+Math.sin(a)*r;
    if(!ok(x,z,12))continue;
    const h=terrainHeight(x,z),sl=slopeAt(x,z);
    if(h<25||h>1050||sl>.40)continue;
    out.fir.push(m4(x,h-.25,z,.9+rng()*.65,rng()*Math.PI*2));
    if((i&63)===0)await slice();
  }
  const sets = [['fir', out.fir, 15.0, {}], ['broadleaf', out.broadleaf, 8.5, {}], ['smallleaf', out.smallleaf, 7.0, { tint: 0xf4fff0 }], ['blossom', out.blossom, 7.0, {}]];
  const meshes = [];
  for (const [kind, mats, h, o] of sets) {
    const m = impostorForest(scene, kind, mats, null, h, { ...o, blobs: false });
    if (!m) continue;
    m.name += '_dense'; meshes.push(m);
    await slice();
    await contactBlobs(scene, mats, m.userData.blobRadius, { opacity: 0.42, name: 'EV_ContactAO_' + kind + '_dense', slice });
  }

  // 3. flower beds: plaza ring outer edge + both sides of the boulevard on the gate approach
  const K = T && T._flowerKit;
  let nFlowers = 0;
  if (K) {
    const mats = [K.poppyMat, K.lavenderMat, K.edelweissMat, K.forgetMeNotMat];
    const bins = mats.map(() => []);
    const P = WORLD.plaza;
    const add = (x, z, bias) => {
      if (distToRoads(x, z) < 7.5) return;
      const y = terrainHeight(x, z) - 0.05, s = 0.38 + rng() * 0.3;
      const k = Math.min(3, Math.floor((fbm(x * 0.08, z * 0.08, 2) * 0.5 + rng() * 0.5 + bias) * 4) % 4);
      bins[k].push(m4(x, y, z, s, rng() * 6.283));
    };
    await slice();
    for (let i = 0; i < (mobile ? 900 : 3200); i++) { const a = rng() * Math.PI * 2, r = P.r + 8 + rng() * 9; add(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 0); }
    for (let i = 0; i < (mobile ? 600 : 2400); i++) { const sd = rng() < 0.5 ? -1 : 1, x = sd * (14.5 + rng() * 6.5), z = 600 + rng() * 255; add(x, z, 0.25); }
    bins.forEach((arr, i) => {
      if (!arr.length) return;
      const geo = K.flowerGeos?.[i] || (i === 1 ? K.lavenderGeo : K.flowerGeo);
      const im = new THREE.InstancedMesh(geo, mats[i], arr.length);
      arr.forEach((mx, j) => im.setMatrixAt(j, mx));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere?.(); im.receiveShadow = true; im.castShadow = false;
      im.name = 'EV_FlowerBeds_' + i; scene.add(im); nFlowers += arr.length;
    });
  }
  console.log('[world3d] densePlanting', JSON.stringify({ fir: out.fir.length, broadleaf: out.broadleaf.length, smallleaf: out.smallleaf.length, blossom: out.blossom.length, flowers: nFlowers }));
  return meshes;
}
