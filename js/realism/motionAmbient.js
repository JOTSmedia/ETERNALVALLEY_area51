// EVR-02 (Eternal Valley Animation): ambient motion governor.
// One place that decides how much ambient motion the world gets:
//  - prefers-reduced-motion: wind and cloud drift almost still (live-updated)
//  - low quality tier / mobile: wind amplitude halved
//  - wind gusts eased with frame-rate-independent smoothing (no snapping)
// Cost: a few scalar ops per frame plus the existing uniform writes (<0.05 ms).
import { ScatterWindDriver } from './motionScatterWind.js?v=73'; // EVR-05 evScatter wind adapter
const RM = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

export class MotionAmbient {
  constructor(world) {
    this.world = world;
    this._gust = 0.4;
    const mob = typeof window !== 'undefined' && (/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 768);
    this._mobile = mob;
  }
  scale() {
    if (RM.matches) return 0.15;
    const tier = this.world._qualityTier;
    const dev = typeof window !== 'undefined' && window.__EV_DEVICE ? window.__EV_DEVICE.tier : ''; // EVR-05: v37 device tier too
    return (tier === 'low' || this._mobile || dev === 'mobile' || dev === 'low') ? 0.5 : 1.0;
  }
  // Replaces the old inline gust block: same character, eased, scaled.
  // EVR-05: eased gust, stepped at most once per frame (shared by legacy wind mats and the evScatter driver).
  stepGust(dt, t) {
    if (this._gustT === t) return this._gust;
    this._gustT = t;
    const macro = Math.sin(t * 0.15) * 0.3 + Math.sin(t * 0.05 + 2.0) * 0.3;
    const micro = Math.sin(t * 1.2) * 0.15 * Math.max(0, macro);
    const target = (0.4 + Math.max(0, macro) + micro) * this.scale();
    this._gust += (target - this._gust) * (1 - Math.exp(-dt * 1.5));
    return this._gust;
  }
  // EVR-05: Lead calls this once after createScatter(): this._motion.attachScatter(evVegUniforms)
  // (and prepareScatterTiers(TIERS) before createScatter). No shader hook; drives Terrain's uniforms only.
  attachScatter(U, params) { this._scatterWind = new ScatterWindDriver(this, U, params); return this._scatterWind; }
  updateScatterWind(dt, t) { if (this._scatterWind) this._scatterWind.update(dt, t); }
  updateWind(dt, t, mats) {
    this.stepGust(dt, t); // EVR-05: gust keeps easing even when there are no legacy wind materials
    if (!mats || !mats.length) return;
    const time = RM.matches ? t * 0.25 : t;
    for (let i = 0, len = mats.length; i < len; i++) {
      const u = mats[i].userData?.windShader?.uniforms;
      if (!u) continue;
      if (u.uTime) u.uTime.value = time;
      if (u.uWindIntensity) u.uWindIntensity.value = this._gust;
    }
  }
  // EVR-04: water/mist shader clock; reduced-motion slows falls, pools and mist to 25%.
  ambientTime(t) { return RM.matches ? t * 0.25 : t; }
  // Replaces the old inline cloud drift: same speed at full motion, symmetric wrap.
  updateClouds(dt, clouds) {
    if (!clouds) return;
    const s = RM.matches ? 0.1 : 1.0;
    for (let i = 0, len = clouds.length; i < len; i++) {
      const c = clouds[i];
      c.position.x += (c.userData.speedX || 2.4) * dt * 14.0 * s;
      if (c.position.x > 4200) c.position.x -= 8400;
    }
  }
}
