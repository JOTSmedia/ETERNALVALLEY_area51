// ============================================================
// ETERNAL VALLEY: exponential height fog with sun in-scatter (patch01)
//
// What it does
//   * Replaces three.js's global fog chunks (ShaderChunk.fog_*), so every
//     built-in material, and every onBeforeCompile material built on
//     one, gets height fog with no per-material edits.
//   * The FogExp2 density curve becomes the analytic integral of
//     density * exp(-heightFalloff * (y - baseY)) along the view ray, plus
//     a Henyey-Greenstein forward lobe toward config.sun.direction.
//   * The fog color is derived from the Preetham Sky (three/addons Sky.js
//     math, ported below) at the horizon for the current sun direction.
//
// Exclusions and fallbacks
//   * Sky.js is a ShaderMaterial with fog:false, so USE_FOG is never
//     defined and it is untouched. So are the stars and anything else
//     with fog:false.
//   * A material can opt out with material.defines.HF_DISABLE = ''.
//   * Custom ShaderMaterials with fog:true that don't carry our uniforms
//     get hfParams.w == 0 and render exactly like stock FogExp2.
//   * Linear THREE.Fog (near/far) is left stock.
//
// Must be installed BEFORE the first material compiles. WorldCore.js
// imports this module at the top, and install() runs on import.
// ============================================================
import * as THREE from 'three';
import { config, getSunDirection } from './rendererConfig.js?v=73';

// Shared plain {x,y,z,w} objects. UniformsUtils.clone() copies Vector/Color
// instances but passes plain objects through by reference, and the WebGL
// vec3/vec4 setters accept {x,y,z(,w)}. So one object here drives every
// program with no per-material bookkeeping.
const U = {
  hfParams:     { value: { x: 0, y: 0, z: 0, w: 0 } }, // falloff, baseY, sunInscatter, mix (0 = stock fog)
  hfSun:        { value: { x: 0, y: 1, z: 0, w: 0.76 } }, // xyz toward-sun dir, w = HG g
  hfSunColor:   { value: { x: 0, y: 0, z: 0, w: 1 } },   // rgb linear in-scatter tint, w = max fog opacity
};
// NB: every value is a plain object on purpose. A bare number (e.g. a float
// uniform) would be copied by UniformsUtils.clone() and stop updating.

const FOG_PARS_VERTEX = /* glsl */`
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vHFRay;
#endif
`;

const FOG_VERTEX = /* glsl */`
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	// World-space camera->vertex offset. mat3(viewMatrix) is the inverse
	// camera rotation; its transpose rotates view space back to world.
	vHFRay = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif
`;

const FOG_PARS_FRAGMENT = /* glsl */`
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vHFRay;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
	uniform vec4 hfParams;
	uniform vec4 hfSun;
	uniform vec4 hfSunColor;
#endif
`;

const FOG_FRAGMENT = /* glsl */`
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 hfFogColor = fogColor;
	#if defined( FOG_EXP2 ) && ! defined( HF_DISABLE )
	if ( hfParams.w > 0.0 ) {
		float hfDist = length( vHFRay );
		vec3  hfDir  = vHFRay / max( hfDist, 1e-4 );
		float hfK    = max( hfParams.x, 1e-6 );
		// Optical depth of d(y) = fogDensity * exp(-k (y - baseY)) along the ray
		float hfKdy  = hfK * vHFRay.y;
		float hfLine = abs( hfKdy ) > 1e-4 ? ( 1.0 - exp( - hfKdy ) ) / hfKdy : 1.0;
		float hfTau  = fogDensity * hfDist * exp( - hfK * ( cameraPosition.y - hfParams.y ) ) * hfLine;
		float hfFactor = min( 1.0 - exp( - hfTau ), hfSunColor.w );
		// Henyey-Greenstein forward lobe toward the sun
		float hfG   = hfSun.w;
		float hfG2  = hfG * hfG;
		float hfCos = dot( hfDir, normalize( hfSun.xyz ) );
		float hfPh  = ( 1.0 - hfG2 ) / ( 4.0 * PI * pow( max( 1.0 + hfG2 - 2.0 * hfG * hfCos, 1e-4 ), 1.5 ) );
		vec3  hfCol = fogColor + hfSunColor.rgb * ( hfParams.z * hfPh );
		fogFactor  = mix( fogFactor, hfFactor, hfParams.w );
		hfFogColor = mix( fogColor, hfCol, hfParams.w );
	}
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, hfFogColor, fogFactor );
#endif
`;

// ---------- Preetham sky (JS port of three r170 examples/jsm/objects/Sky.js) ----------
const TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const CUTOFF = 1.6110731556870734, STEEP = 1.5, EE = 1000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function skyParams(sky) {
  const u = sky?.material?.uniforms || {};
  return {
    turbidity: u.turbidity?.value ?? 4.0,
    rayleigh: u.rayleigh?.value ?? 1.35,
    mieCoefficient: u.mieCoefficient?.value ?? 0.005,
    g: u.mieDirectionalG?.value ?? 0.8,
  };
}

/** Linear RGB the Sky shader outputs (before tone mapping) for view direction `dir`. Returns { color, fex }. */
export function skyRadiance(dir, sunDir, p) {
  const zc = clamp(sunDir.y, -1, 1);
  const sunE = EE * Math.max(0, 1 - Math.exp(-((CUTOFF - Math.acos(zc)) / STEEP)));
  // WorldLighting feeds a unit vector as sunPosition, so this matches it exactly.
  const sunfade = 1 - clamp(1 - Math.exp(sunDir.y / 450000), 0, 1);
  const rC = p.rayleigh - (1 - sunfade);
  const mieC = 0.434 * (0.2 * p.turbidity * 10e-18);
  const betaR = TOTAL_RAYLEIGH.map(v => v * rC);
  const betaM = MIE_CONST.map(v => v * mieC * p.mieCoefficient);
  const zen = Math.acos(Math.max(0, dir.y));
  const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
  const sR = 8.4e3 * inv, sM = 1.25e3 * inv;
  const cosT = dir.x * sunDir.x + dir.y * sunDir.y + dir.z * sunDir.z;
  const rPh = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
  const g2 = p.g * p.g;
  const mPh = 0.07957747154594767 * (1 - g2) / Math.pow(1 - 2 * p.g * cosT + g2, 1.5);
  const k = clamp(Math.pow(1 - sunDir.y, 5), 0, 1);
  const exp = 1 / (1.2 + 1.2 * sunfade);
  const bias = [0, 0.0003, 0.00075];
  const color = [0, 0, 0], fex = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const Fex = Math.exp(-(betaR[i] * sR + betaM[i] * sM));
    const ratio = (betaR[i] * rPh + betaM[i] * mPh) / (betaR[i] + betaM[i]);
    let Lin = Math.pow(sunE * ratio * (1 - Fex), 1.5);
    Lin *= 1 + (Math.pow(sunE * ratio * Fex, 0.5) - 1) * k;
    const L0 = 0.1 * Fex;
    color[i] = Math.pow((Lin + L0) * 0.04 + bias[i], exp);
    fex[i] = Fex;
  }
  return { color, fex };
}

const _dir = new THREE.Vector3();
/** Mean horizon color around the full azimuth ring, plus the sun's extinction tint. */
export function horizonColors(sunDir, sky, elevDeg = 3, samples = 16) {
  const p = skyParams(sky);
  const e = THREE.MathUtils.degToRad(elevDeg);
  const avg = [0, 0, 0];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    _dir.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
    const { color } = skyRadiance(_dir, sunDir, p);
    for (let c = 0; c < 3; c++) avg[c] += color[c] / samples;
  }
  // Extinction along the sun direction: white at noon, warm at golden hour
  _dir.copy(sunDir).setY(Math.max(sunDir.y, Math.sin(e))).normalize();
  const { fex } = skyRadiance(_dir, sunDir, p);
  const m = Math.max(fex[0], fex[1], fex[2], 1e-6);
  return { horizon: avg, sunTint: fex.map(v => v / m) };
}

let _installed = false;
let _underwater = 0;

export const heightFog = {
  uniforms: U,

  /** Patch the global fog chunks and inject the shared uniforms. Idempotent. */
  install() {
    if (_installed) return;
    THREE.ShaderChunk.fog_pars_vertex = FOG_PARS_VERTEX;
    THREE.ShaderChunk.fog_vertex = FOG_VERTEX;
    THREE.ShaderChunk.fog_pars_fragment = FOG_PARS_FRAGMENT;
    THREE.ShaderChunk.fog_fragment = FOG_FRAGMENT;
    // Built-in materials take uniforms from ShaderLib at program-creation
    // time. UniformsLib.fog covers ShaderMaterials that merge it later.
    const targets = [THREE.UniformsLib.fog, ...Object.values(THREE.ShaderLib).map(s => s.uniforms)];
    for (const t of targets) {
      if (!t || !('fogColor' in t)) continue;
      for (const k of Object.keys(U)) t[k] = U[k];
    }
    _installed = true;
  },

  /** Apply a named preset from config.atmosphere.presets onto config.atmosphere. */
  applyPreset(name) {
    const pr = config.atmosphere.presets?.[name];
    if (!pr) return false;
    Object.assign(config.atmosphere, pr, { preset: name });
    return true;
  },

  /** 0 = above water (height fog on), 1 = fully underwater (stock FogExp2 underwater look). */
  setUnderwaterBlend(b) {
    _underwater = clamp(b || 0, 0, 1);
    U.hfParams.value.w = config.atmosphere.enabled ? 1 - _underwater : 0;
  },

  /**
   * Push config.atmosphere + sun into the uniforms and scene.fog.
   * @param {THREE.Vector3} [sunDir] Defaults to config.sun.direction.
   * @param {{scene?: THREE.Scene, sky?: THREE.Mesh}} [ctx]
   */
  update(sunDir = getSunDirection(), ctx = {}) {
    const a = config.atmosphere;
    const s = sunDir.clone().normalize();
    U.hfParams.value.x = a.heightFalloff;
    U.hfParams.value.y = a.baseY;
    U.hfParams.value.z = a.sunInscatter;
    U.hfParams.value.w = a.enabled ? 1 - _underwater : 0;
    U.hfSun.value.x = s.x; U.hfSun.value.y = s.y; U.hfSun.value.z = s.z; U.hfSun.value.w = a.inscatterG;
    U.hfSunColor.value.w = a.maxOpacity;

    const { horizon, sunTint } = horizonColors(s, ctx.sky, a.horizonSampleElevDeg);
    const fogRGB = horizon.map(v => v * a.colorScale);
    const lum = 0.2126 * fogRGB[0] + 0.7152 * fogRGB[1] + 0.0722 * fogRGB[2];
    U.hfSunColor.value.x = sunTint[0] * lum;
    U.hfSunColor.value.y = sunTint[1] * lum;
    U.hfSunColor.value.z = sunTint[2] * lum;

    const fog = ctx.scene?.fog;
    if (fog && a.enabled) {
      if (a.colorSource === 'skyHorizon') fog.color.setRGB(fogRGB[0], fogRGB[1], fogRGB[2], THREE.LinearSRGBColorSpace);
      if (fog.isFogExp2 && _underwater < 0.001) fog.density = a.density;
    }
    return { fogColorLinear: fogRGB, sunTint };
  },
};

heightFog.install();
export default heightFog;
