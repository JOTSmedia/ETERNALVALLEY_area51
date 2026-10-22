// EVR-05 (Eternal Valley Animation): adapter that DRIVES Terrain's existing evScatter wind.
// Lead decision (Oct 17): v37 uses Terrain's evScatter.js wind chunk + its evVegUniforms; Animation adds NO shader hook,
// NO material and NO program. This file only writes Terrain's uniforms once per frame.
//
// Terrain uniforms driven (exact names, runtime/evScatter.js `evVegUniforms`):
//   evTime    (float)  shader clock. sway = sin(evTime*0.6 + ip), flutter = sin(evTime*7.0 + G*2pi + ip)
//   evWindStr (float)  scales BOTH sway (0.35*R^2*y*0.08) and flutter (0.03, leaves R>=0.75) -> our eased gust x strength
//   evWindDir (vec3)   sway direction (xz)
//   evWindFar (float)  fade radius; evScatter sets it from TIERS[tier].wind at createScatter (40 / 20 / low). Left alone.
// Terrain's sway/flutter amplitudes and frequencies are compile-time constants (they equal our EVR-05 tuning:
// 0.6 / 0.35 / 7.0 / 0.03), so per-term tuning maps to: global amplitude -> evWindStr, global frequency -> evTime rate.
// If Terrain adds `evWindParams` (vec4 swayAmp, swayFreq, flutterAmp, flutterFreq) the driver fills it automatically
// (see ADAPTER.md request R1). Uses NO module import of evScatter, so the Lead passes evVegUniforms / TIERS in and
// there can never be a second copy of the uniform object.
const q = (k) => { try { return new URLSearchParams(location.search).get(k); } catch (_) { return null; } };

// Tunable params (live; edit at runtime via window.__evWind.params in QC).
export const SCATTER_WIND_PARAMS = {
  strength: 1.6,          // evWindStr = eased gust (0.4..~1.1, x0.5 mobile/low from MotionAmbient.scale()) * strength
  timeScale: 1.0,         // evTime rate (1 = Terrain's 0.6 rad/s sway, 7 rad/s flutter)
  dir: [0.8, 0.0, 0.6],   // wind direction (normalized on write)
  dirWander: 0.12,        // rad, slow +-wander of the direction (0 = fixed); 1 cos+sin per FRAME on CPU, nothing per vertex
  reducedStrength: 0.15,  // prefers-reduced-motion: near-still (flutter also scales by this; no separate flutter uniform yet, R2)
  reducedTimeScale: 0.25, // prefers-reduced-motion: quarter speed
  lowHeroRadius: 0,       // v37 Lead R5: low tier stays static (was 12) // low tier: wind radius for hero LOD0 trees (= TIERS.low.d0); 0 keeps Terrain's static low tier
  // only used if Terrain exposes evWindParams (request R1); values = ref_A tuning, same as the current constants
  swayAmp: 0.35, swayFreq: 0.6, flutterAmp: 0.03, flutterFreq: 7.0,
};
export const SCATTER_FX_OFF = q('fx') === '0';
const RM = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/** Call BEFORE createScatter(): lets low-tier hero LOD0 trees sway (same shared program; compiles EV_WIND in). */
export function prepareScatterTiers(TIERS, params = SCATTER_WIND_PARAMS) {
  if (TIERS && TIERS.low && !(TIERS.low.wind > 0) && params.lowHeroRadius > 0) TIERS.low.wind = params.lowHeroRadius;
  return TIERS;
}

export class ScatterWindDriver {
  /** motion: MotionAmbient (eased gust, tier, reduced motion); U: evScatter's evVegUniforms. */
  constructor(motion, U, params = SCATTER_WIND_PARAMS) {
    this.motion = motion; this.U = U; this.params = params; this._t = 0; this._last = null;
    if (SCATTER_FX_OFF && U) { U.evWindStr.value = 0; }
    if (typeof window !== 'undefined') window.__evWind = this;
  }
  /** Once per frame, AFTER scatter.update(dt) (evScatter also advances evTime; we overwrite it with our clock). */
  update(dt, t) {
    const U = this.U, P = this.params; if (!U) return;
    if (SCATTER_FX_OFF) { U.evWindStr.value = 0; if (this._last !== null) U.evTime.value = this._last; else this._last = U.evTime.value; return; }  // frozen + zero
    const rm = RM.matches;
    this._t += Math.min(dt, 0.1) * P.timeScale * (rm ? P.reducedTimeScale : 1);
    U.evTime.value = this._t; this._last = this._t;
    const g = this.motion ? this.motion.stepGust(dt, t) : 0.6;
    U.evWindStr.value = rm ? P.reducedStrength : g * P.strength;
    const d = U.evWindDir.value, a = P.dirWander ? Math.sin(t * 0.021) * P.dirWander : 0, c = Math.cos(a), s = Math.sin(a);
    d.set(P.dir[0] * c - P.dir[2] * s, P.dir[1], P.dir[0] * s + P.dir[2] * c).normalize();
    if (U.evWindParams) U.evWindParams.value.set(P.swayAmp, P.swayFreq, P.flutterAmp, P.flutterFreq);
  }
}
