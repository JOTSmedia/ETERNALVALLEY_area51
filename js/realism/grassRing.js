// ============================================================
// ETERNAL VALLEY: camera-centred dense grass ring (patch02)
//
// A toroidal grid of tuft slots (spacing S) covering a 2R x 2R square around
// the camera. Each world cell always maps to the same slot, so moving the
// camera only re-seats the row/column of slots that crossed over. Per slot:
//   density = grassDensity() from the SAME ground weights as the terrain shader
//   colour  = terrain albedo beneath it (terrainAlbedoAt), so blades melt into the ground
//   fade    = vertex shader shrinks tufts to nothing between R*(1-fadeFrac) and R
// Re-seating runs under a per-frame time budget (config.scatter.grass.updateBudgetMs).
// ============================================================
import * as THREE from 'three';
import { config } from './rendererConfig.js?v=73';
import { grassDensity, terrainAlbedoAt, sampleField, hash01, resolveTier } from './terrainField.js?v=73';
import { terrainHeight, ROADS, WORLD } from '../terrain.js?v=73';

const _c = new THREE.Color(), _base = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _f = [0, 0, 0, 0];

function roadClear(x, z) {   // metres outside the nearest road edge (ROADS[].w is full width)
  let best = Infinity;
  for (const r of ROADS) {
    if (r.ring) { best = Math.min(best, Math.abs(Math.hypot(x - r.cx, z - r.cz) - r.r) - r.w * 0.5); continue; }
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i], [x2, z2] = r.pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1, l = dx * dx + dz * dz;
      const t = l > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l)) : 0;
      best = Math.min(best, Math.hypot(x - x1 - dx * t, z - z1 - dz * t) - r.w * 0.5);
    }
  }
  return best;
}

export class GrassRing {
  /**
   * @param {{scene: THREE.Scene, camera: THREE.Camera, geometry: THREE.BufferGeometry, material: THREE.Material, tier?: string}} o
   *   material: a botanical grass material (createBotanicalFoliageMaterial). Its onBeforeCompile is chained, not replaced.
   */
  constructor({ scene, camera, geometry, material, tier = resolveTier(), radius, spacing, name, tintMul = 1, densityMul = 1, salt = 0 }) {
    const G = config.scatter.grass;
    this.camera = camera;
    this.R = radius ?? G.radius[tier];
    this.S = spacing ?? G.spacing[tier];
    this.tintMul = tintMul; this.densityMul = densityMul; this.salt = salt;   // [v36] reused for the scanned grass-card ring
    this.N = Math.ceil((2 * this.R) / this.S);
    const count = this.N * this.N;
    this.cells = new Int32Array(count * 2).fill(0x7fffffff);
    this.queue = new Int32Array(count); this.qHead = 0; this.qLen = 0;
    this.camCell = [NaN, NaN];

    this.uniforms = { uGrassRing: { value: new THREE.Vector2(this.R * (1 - G.fadeFrac), this.R) } };
    const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
    const U = this.uniforms;
    material.onBeforeCompile = function (shader, renderer) {
      if (prev) prev.call(this, shader, renderer);
      shader.uniforms.uGrassRing = U.uGrassRing;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec2 uGrassRing;')
        .replace('#include <project_vertex>', `
          #ifdef USE_INSTANCING
            vec3 grRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float grFade = 1.0 - smoothstep(uGrassRing.x, uGrassRing.y, length(grRoot.xz - cameraPosition.xz));
            transformed *= grFade;   // shrink toward the root, after wind: blades sink into the terrain colour
          #endif
          #include <project_vertex>`);
    };
    material.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|grassRing'; };

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name || 'EV_GrassRing';
    mesh.frustumCulled = false;          // the whole ring follows the camera
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.grassRing = true;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, _m); mesh.setColorAt(i, _c.setRGB(0.2, 0.3, 0.1)); }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    this.mesh = mesh;
    _base.setRGB(0.10, 0.16, 0.05, THREE.LinearSRGBColorSpace);   // fallback blade colour
  }

  /** Call once per frame. */
  update() {
    const cam = this.camera.position, S = this.S, N = this.N;
    const cx = Math.floor(cam.x / S), cz = Math.floor(cam.z / S);
    if (cx !== this.camCell[0] || cz !== this.camCell[1]) {
      this.camCell[0] = cx; this.camCell[1] = cz;
      const x0 = cx - (N >> 1), z0 = cz - (N >> 1);
      // Every slot: which world cell should it hold now? Queue the ones that changed.
      this.qLen = 0; this.qHead = 0;
      for (let j = 0; j < N; j++) {
        const Z = z0 + (((j - z0) % N) + N) % N;
        for (let i = 0; i < N; i++) {
          const X = x0 + (((i - x0) % N) + N) % N;
          const k = j * N + i;
          if (this.cells[k * 2] !== X || this.cells[k * 2 + 1] !== Z) {
            this.cells[k * 2] = X; this.cells[k * 2 + 1] = Z;
            this.queue[this.qLen++] = k;
          }
        }
      }
      // Seat the nearest slots first (teleports: grass grows outward from the camera).
      if (this.qLen > 4096) {
        const q = Array.from(this.queue.subarray(0, this.qLen));
        q.sort((a, b) => {
          const ax = this.cells[a * 2] - cx, az = this.cells[a * 2 + 1] - cz, bx = this.cells[b * 2] - cx, bz = this.cells[b * 2 + 1] - cz;
          return (ax * ax + az * az) - (bx * bx + bz * bz);
        });
        this.queue.set(q);
      }
    }
    if (this.qHead >= this.qLen) return;
    const G = config.scatter.grass, pending = this.qLen - this.qHead;
    // After a teleport / tour cut most slots are stale: spend more per frame until the ring is seated.
    const budget = pending > (this.N * this.N) / 3 ? (G.teleportBudgetMs ?? G.updateBudgetMs) : G.updateBudgetMs;
    const t0 = performance.now();
    let n = 0;
    while (this.qHead < this.qLen) {
      this._seat(this.queue[this.qHead++]);
      if ((++n & 63) === 0 && performance.now() - t0 > budget) break;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _seat(k) {
    const G = config.scatter.grass, S = this.S;
    const X = this.cells[k * 2], Z = this.cells[k * 2 + 1];
    const x = (X + hash01(X, Z, 11 + this.salt)) * S, z = (Z + hash01(X, Z, 23 + this.salt)) * S;
    let visible = false;
    sampleField(x, z, _f);
    const pagoda = WORLD.buddhistTemple;
    const insidePagoda = Math.abs(x - pagoda.x) < 31 && Math.abs(z - pagoda.z) < 40;
    if (_f[0] * 32 > 0.5 && !insidePagoda) {                    // outside water and the pagoda foundation
      const h = terrainHeight(x, z), e = 0.75;
      const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z), hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
      const ny = (2 * e) / Math.hypot(hx, hz, 2 * e);
      let dens = grassDensity(x, z, h, ny) * this.densityMul;
      if (dens > 0.01) {
        const rc = roadClear(x, z);
        dens *= Math.min(1, Math.max(0, (rc - 0.3) / 1.2));    // soft edge along road shoulders
        for (const hs of G.hardSurfaces || []) dens *= Math.min(1, Math.max(0, (Math.hypot(x - hs.x, z - hs.z) - hs.r) / 3));
      }
      if (hash01(X, Z, 7 + this.salt) < dens) {
        visible = true;
        const sc = G.minScale + (G.maxScale - G.minScale) * hash01(X, Z, 31);
        _q.setFromAxisAngle(_up, hash01(X, Z, 43) * Math.PI * 2);
        _p.set(x, h - 0.04, z); _s.set(sc, sc * (0.85 + 0.3 * hash01(X, Z, 59)), sc);
        _m.compose(_p, _q, _s);
        terrainAlbedoAt(x, z, h, ny, _c);
        _c.lerp(_base, 1 - G.tintFromTerrain).multiplyScalar(G.tintLift * this.tintMul);
        this.mesh.setColorAt(k, _c);
      }
    }
    if (!visible) _m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(k, _m);
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); }
}
