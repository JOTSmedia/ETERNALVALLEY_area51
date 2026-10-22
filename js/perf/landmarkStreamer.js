// EVR-04 perf: distance-based streaming of landmarks and zone-gated fish/coral.
// - Each registered object gets a world bounding sphere ONCE (at register time).
// - Every 250 ms (not every frame) it is shown only while the camera is within
//   radius + sphere radius, with 10 % hysteresis so it never flickers on the edge.
// - Hidden objects cost nothing: no draw calls, no shadow casting, and the fish
//   CPU swim update is skipped (WorldCore checks mesh.visible).
import * as THREE from 'three';
import { EV_PERF } from './qualityTier.js?v=73';

const _box = new THREE.Box3(), _sph = new THREE.Sphere();

export class LandmarkStreamer {
  constructor(world) { this.world = world; this.items = []; this._next = 0; this.stats = { shown: 0, hidden: 0 }; }

  /** @param kind 'landmark' | 'underwater' | 'fish' — picks the tier radius. `waterY` gates underwater sets. */
  register(obj, kind = 'landmark', opts = {}) {
    if (!obj || this.items.some(i => i.obj === obj)) return;
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj, false);
    if (_box.isEmpty()) return;
    _box.getBoundingSphere(_sph);
    const base = kind === 'fish' ? EV_PERF.fishRadius : kind === 'underwater' ? EV_PERF.underwaterRadius : EV_PERF.landmarkRadius;
    // Huge spread-out sets (a school over a whole lake) use the sphere as the zone.
    this.items.push({ obj, kind, center: _sph.center.clone(), r: _sph.radius, show: opts.radius ?? base,
                      waterY: opts.waterY, name: opts.name || obj.name, on: obj.visible });
  }

  update(camera, now = performance.now()) {
    if (now < this._next || !this.items.length) return;
    this._next = now + 250;
    const p = camera.position; let shown = 0;
    for (const it of this.items) {
      let d = p.distanceTo(it.center) - it.r;
      // Underwater sets: from above water, treat as farther (they're barely visible through the surface).
      if (it.waterY !== undefined && p.y > it.waterY + 2) d += 0.5 * it.show;
      const lim = it.on ? it.show * 1.1 : it.show;
      const want = d < lim;
      if (want !== it.on) { it.on = want; it.obj.visible = want; if (this.world.renderer?.shadowMap) this.world.renderer.shadowMap.needsUpdate = true; }
      if (want) shown++;
    }
    this.stats.shown = shown; this.stats.hidden = this.items.length - shown;
  }
}
