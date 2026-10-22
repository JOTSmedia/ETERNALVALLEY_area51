// ============================================================
// SOMEWHERE OVER THE RAINBOW BRIDGE — 3D world engine (Three.js)
// A living paradise: the Rainbow Bridge at the valley's heart,
// glowing pawprints, seasonal blooms, real time-of-day skies
// and live weather moods — always gentle, always paradise.
// ============================================================
import * as THREE from 'three';
import { cloudSpriteMaterial } from './realism/nearField.js?v=73'; // EVR-04
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'; // [lighting-pass1]
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { mergeGeometries as _rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { CSMShader } from 'three/addons/csm/CSMShader.js';

// [EVR-05 r186] Upstream r186 CSMShader.lights_fragment_begin is a stale (~r17x) copy of the core
// chunk, and CSM swaps it into THREE.ShaderChunk globally. Against the r186 core it
//  - writes material.iridescenceF0 (gone in r186: iridescenceF0Dielectric/Metallic) -> every
//    iridescent MeshPhysicalMaterial fails to compile (Shader Error, VALIDATE_STATUS false);
//  - skips the r181 STANDARD block that fills material.dfg / multiScatteringCompensation
//    (uninitialised energy compensation on every PBR material);
//  - lacks the r186 sun-light, light-probe-grid and point-shadow-type sections.
// Re-base it: r186 core chunk with only the directional-light section replaced by CSM's cascade
// version (exactly what the addon intends). Runs at module load, before any CSM is constructed.
(function evRebaseCSMShader() {
  const core = THREE.ShaderChunk.lights_fragment_begin;
  const csm = CSMShader.lights_fragment_begin;
  const cS = core.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
  const cE = core.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )');
  const mS = csm.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && defined( USE_CSM )');
  const mE = csm.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )');
  if (core === csm || core.includes('USE_CSM')) return; // already injected / already re-based
  if (cS < 0 || cE < cS || mS < 0 || mE < mS) { console.log('[EVR-05] CSMShader re-base anchors not found; using addon chunk as-is'); return; }
  CSMShader.lights_fragment_begin = core.slice(0, cS) + csm.slice(mS, mE) + core.slice(cE);
})();

// [EVR-05 r186] UnrealBloomPass composite changed in r18x: r170 blended (rgb = s*sum, a = 3*s) with SRC_ALPHA,ONE, so the
// added bloom was 3*s^2*sum; r186 writes premultiplied 3*s*sum with ONE,ONE. Squaring the strength in the composite keeps
// every tuned LOOK.bloom value (0.05..0.38) giving the r170 result (globe.js inlines the same 2-line patch).
function evKeepR170BloomResponse(bloom) {
  const m = bloom && bloom.compositeMaterial;
  if (!m || !m.fragmentShader.includes('3.0 * bloomStrength')) return false;
  m.fragmentShader = m.fragmentShader.replace('3.0 * bloomStrength', '3.0 * bloomStrength * bloomStrength');
  m.needsUpdate = true;
  return true;
}

const originalSetupMaterial = CSM.prototype.setupMaterial;
CSM.prototype.setupMaterial = function(material) {
    if (material.userData.csmSetupDone) return;
    material.userData.csmSetupDone = true;
    const origObc = material.onBeforeCompile;
    originalSetupMaterial.call(this, material);
    const csmObc = material.onBeforeCompile;
    if (origObc && origObc !== csmObc) {
        material.onBeforeCompile = function(shader, renderer) {
            origObc.call(this, shader, renderer);
            csmObc.call(this, shader, renderer);
        };
    }
};

// Fully Robust Safe Merge Wrapper (Universal Index & Attribute Normalization)
const mergeGeometries = (geos, useGroups = false) => {
    if (!geos || !Array.isArray(geos) || geos.length === 0) return null;
    const validGeos = geos.filter(g => g && g.attributes && g.attributes.position);
    if (validGeos.length === 0) return null;
    if (validGeos.length === 1) return validGeos[0];
    
    let anyIndexed = false;
    let anyNonIndexed = false;
    let anyColor = false;
    let anyUv = false;
    let anyNormal = false;
    
    for (const g of validGeos) {
        if (g.index) anyIndexed = true;
        else anyNonIndexed = true;
        if (g.attributes.color) anyColor = true;
        if (g.attributes.uv) anyUv = true;
        if (g.attributes.normal) anyNormal = true;
    }
    
    const normalized = validGeos.map(g => {
        let out = g;
        // Normalize indexing: if mixed, convert all to non-indexed
        if (anyIndexed && anyNonIndexed && g.index) {
            out = g.toNonIndexed();
        }
        
        // Normalize normals
        if (anyNormal && !out.attributes.normal) {
            out.computeVertexNormals();
        }
        
        // Normalize UVs
        if (anyUv && !out.attributes.uv) {
            const count = out.attributes.position.count;
            const uvs = new Float32Array(count * 2);
            out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
        
        // Normalize Color
        if (anyColor && !out.attributes.color) {
            const count = out.attributes.position.count;
            const colors = new Float32Array(count * 3).fill(1);
            out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        } else if (!anyColor && out.attributes.color) {
            out.deleteAttribute('color');
        }
        return out;
    });
    
    try {
        const merged = _rawMergeGeometries(normalized, useGroups);
        normalized.forEach(g => { if (g) g.dispose(); });
        return merged;
    } catch (err) {
        console.warn('[world3d] mergeGeometries fallback:', err);
        return null;
    }
};
const safeMerge = mergeGeometries;

import { WORLD, DISTRICTS, ROADS, RIVER, RIVER_INLET, RIVER_OUTLET, terrainHeight, backgroundMountainElevation, distToRoads, distToRiver, getRiverInfo, riverWaterElevation, fbm, ridgeNoise, mulberry32, SIZE_DIMS } from './terrain.js?v=73';
import { getSeason, SEASON_STYLE, getDayPhase, PHASES, MOODS, fetchWeather } from './ambience.js?v=73';
import { Surfaces, waterNormalTexture, textures, material, createBotanicalFoliageMaterial, clearCache } from './materials.js?v=73';
import { icon, speciesIcon, speciesKey } from './icons.js?v=73';
import { charityName } from './catalog.js?v=73';
import { DRONE_TOUR_LANDMARKS } from './tour.js?v=73';
import { buildGrandBoulevard, buildSecondaryRoad } from './roads.js?v=73';
import { config as rendererConfig, getSunDirection } from './realism/rendererConfig.js?v=73'; // patch01: single sun source
import { heightFog } from './realism/heightFog.js?v=73';
import { EV_PERF } from './perf/qualityTier.js?v=73'; // EVR-04

// [lighting-pass2] ONE world sun + sky from ONE real HDRI: Poly Haven "Table Mountain 2" (CC0, see LICENSES.md).
// Every consumer (HDRI background + PMREM env rotation, CSM, fog tint, bg-mountain in-scatter, god rays/sun glow,
// water, terrain, foliage SSS via globalThis.__EV_SUN_DIR) reads the single _sunDir derived here.
// Units: renderer units = photometric units (cd/m2, lux) x EV_SCALE, EV_SCALE = 1/(1.2*2^EV100) at EV100 = ev100,
// so toneMappingExposure stays 1.0 and the pass-1 emissives/hero lights keep their meaning.
export const EV_SKY = {
  envUrl: EV_PERF.envUrl || 'images/textures/table_mountain_2_2k_env.hdr', // EVR-04: 1k env (PMREM is 256/face; 2k = same IBL, 4.7 MB more). ?env=2k restores.
  envUrl2k: 'images/textures/table_mountain_2_2k_env.hdr', // IBL copy: sun disc + aureole clamped to 8 within 5 deg (no sun in the env)
  bgUrl: 'images/textures/table_mountain_2_4k_bg.hdr',   // [EVR-03] no longer downloaded (replaced by backdrop)
  backdrop: { // Poly Haven photographic panorama, aligned with the lighting HDRI.
    urls: { ultra: 'images/backdrop/table_mountain_2_photographic.jpg', desktop: 'images/backdrop/table_mountain_2_4k.jpg', mobile: 'images/backdrop/table_mountain_2_2k.jpg' },
    scale: 1.0, yawDeg: -25 },
  hdriSunDir: [0.64042, 0.12658, 0.75752], // measured radiance centroid of the sun, unrotated three.js equirect (elevation 7.27 deg)
  hdriSunRemoved: 3.3375,                  // sun energy removed from the env copy (HDRI units, normal illuminance, luminance)
  hdriSunRGB: [1.0, 0.8461, 0.4218],       // linear chroma of the removed sun energy (~low-sun warm)
  hdriFogRGB: [1.1078, 1.0615, 0.6959],    // horizon chroma near the sun (+-25 deg az, 1-5 deg el) at the sun-side horizon luminance (HDRI units)
  yawDeg: -25,          // Shared panorama/environment/sun rotation; lights the southern facades.
  sunLux: 25000,        // direct normal illuminance for a hazy 7 deg sun; sets the absolute scale of the HDRI
  ev100: 12.0,          // [v36 golden hour] was 11.5: -0.5 EV
  golden: { sunGain: 1.12, skyGain: 0.90, sunTint: [1.0, 0.97, 0.92], bloom: 0.14, bloomThreshold: 0.95 }, // [v36 golden hour] stronger warm key vs dimmer sky fill
  fogDensity: 4.0e-5,  // [v36 polish] was 7.5e-5 (QA: washed out)  // [v36b 60%] FogExp2 (was 2.5e-4): 6% at 2 km, 22% at 4 km
};
export function evSkyUnits() {
  const s = 1 / (1.2 * Math.pow(2, EV_SKY.ev100));
  const sky = EV_SKY.sunLux / EV_SKY.hdriSunRemoved * s;               // HDRI -> renderer radiance (env + background intensity)
  const c = EV_SKY.hdriSunRGB, lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const G = EV_SKY.golden || { sunGain: 1, skyGain: 1 };
  return { s, sky: sky * G.skyGain, sun: EV_SKY.sunLux * s / lum * G.sunGain };                     // sun: DirectionalLight intensity for colour hdriSunRGB
}
export function evSunDir(target = new THREE.Vector3()) {
  // three r170 samples env/background with R(-yaw)*dir, so a feature at d0 appears at R(+yaw)*d0
  return target.fromArray(EV_SKY.hdriSunDir).applyEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(EV_SKY.yawDeg), 0)).normalize();
}


// Soft Radial Contact Ambient Occlusion Shadow Decal Texture
let _sharedShadowMat = null;
function createContactShadow(radius, yPos = 0.04) {
  if (!_sharedShadowMat) {
    const shadowCnv = document.createElement('canvas');
    shadowCnv.width = shadowCnv.height = 128;
    const sCtx = shadowCnv.getContext('2d');
    const sGrad = sCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
    sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    sGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.38)');
    sGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.10)');
    sGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCnv);
    _sharedShadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), _sharedShadowMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = yPos;
  return mesh;
}

// ---- GPU OPTIMIZATION: Foliage Overdraw Elimination ----
// Force canopy materials to use binary alpha cutouts and write to depth buffer instantly
const _origLeafCard = Surfaces.leafCard;
Surfaces.leafCard = function(...args) {
  const m = _origLeafCard.apply(this, args);
  m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true;
  return m;
};
const _origPineNeedles = Surfaces.pineNeedles;
Surfaces.pineNeedles = function(...args) {
  const m = _origPineNeedles.apply(this, args);
  m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true;
  return m;
};
const _origCypressFoliage = Surfaces.cypressFoliage;
Surfaces.cypressFoliage = function(...args) {
  const m = _origCypressFoliage.apply(this, args);
  m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true;
  return m;
};
const _origSakuraBlossom = Surfaces.sakuraBlossom;
Surfaces.sakuraBlossom = function(...args) {
  const m = _origSakuraBlossom.apply(this, args);
  m.transparent = false; m.alphaTest = 0.45; m.depthWrite = true;
  return m;
};

const V3 = THREE.Vector3;
// Pre-allocated colour constants — avoids per-vertex GC pressure during terrain build
const _roadTint = new THREE.Color(0xbfb39a);

// Pre-allocated scratch variables for 120 FPS render loop & sub-frame integration (zero GC allocations)
const _v3Temp1 = new THREE.Vector3();
const _v3Temp2 = new THREE.Vector3();
const _v3Temp3 = new THREE.Vector3();
const _v3Temp4 = new THREE.Vector3();
const _colTemp = new THREE.Color();
const _colTemp2 = new THREE.Color();
const _quatTemp = new THREE.Quaternion();
const _mat4Temp = new THREE.Matrix4();

function _hermiteSmooth(x) {
  const c = Math.max(0.0, Math.min(1.0, x));
  return c * c * (3.0 - 2.0 * c);
}

// ---------------- Procedural Geometry Math Utilities ----------------
// De-sterilizes procedural meshes with organic artisanal weathering & vertex crevice occlusion
export function applyOrganicWeathering(geometry, noiseScale = 0.08, noiseAmp = 0.28, seed = 17) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return geometry;
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (isNaN(x) || !isFinite(x)) x = 0;
    if (isNaN(y) || !isFinite(y)) y = 0;
    if (isNaN(z) || !isFinite(z)) z = 0;
    const n = (fbm(x * noiseScale + seed, z * noiseScale + seed, 2) - 0.5) * noiseAmp;
    const ny = (fbm(y * noiseScale * 1.5 + seed * 2, x * noiseScale + seed, 2) - 0.5) * (noiseAmp * 0.6);
    const fx = isNaN(n) ? x : x + n;
    const fy = isNaN(ny) ? y : y + ny;
    const fz = isNaN(n) ? z : z + n;
    pos.setXYZ(i, fx, fy, fz);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  if (geometry.computeBoundingSphere) geometry.computeBoundingSphere();
  if (geometry.computeBoundingBox) geometry.computeBoundingBox();
  return geometry;
}

export function bakeVertexCreviceOcclusion(geometry, groundY = 0, creviceStrength = 0.45) {
  if (!geometry || !geometry.attributes.position) return geometry;
  const pos = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const ny = normals ? normals.getY(i) : 0;
    const groundFactor = Math.max(0, Math.min(1, (y - groundY) / 4.0));
    const normalFactor = Math.max(0, ny * 0.5 + 0.5);
    const ao = Math.max(0.35, Math.min(1.0, 0.45 + 0.35 * groundFactor + 0.20 * normalFactor));
    colors[i * 3]     = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export class WorldLighting {
  static EV_SKY = EV_SKY; // [lighting-pass2] read by WorldAssetLoader._loadHDRI
  constructor(world) {
    this.world = world;
  }

  _lights() {
    // 1. Hemisphere light: sky radiance top bounce + natural meadow ground bounce
    this.hemi = new THREE.HemisphereLight(0x5078a0, 0x384828, 0.45);
    this.world.scene.add(this.hemi);

    // [lighting-pass1] empty LightProbe removed (zero SH, only cost)

    // 3. Directional Sun/Moon with calibrated CSM cascaded shadows
    // [lighting-pass1] the zero-intensity DirectionalLight is gone; a plain anchor keeps the lens flare
    // [EVR-02] keep Object3D anchor; sunDir from HDRI (evSunDir) and synced to rendererConfig below
    const sun = new THREE.Object3D();
    const _sd0 = evSunDir(); // [lighting-pass2] anchor on the HDRI sun from frame 0 (was (-800,950,600))
    sun.position.copy(_sd0).multiplyScalar(3000);
    try { rendererConfig.sun.direction.copy(_sd0); } catch (_) {}

    const isMobileDevice = EV_PERF.tier !== 'desktop';
    this.csm = new CSM({
        shadowBias: -0.0001,
        maxFar: 350, // [lighting-pass1] was 3500: cascades spend texels where the eye is (20/80/350 m)
        cascades: EV_PERF.cascades || (isMobileDevice ? 2 : 3), // EVR-06 per-tier; [lighting-pass1] was 4 (EVR-04: shadows are off on mobile/low tiers, so this is desktop's 3)
        mode: 'custom', // [lighting-pass1] was 'practical', which silently ignored customSplitsCallback
        parent: this.world.scene,
        shadowMapSize: EV_PERF.shadowMapSize || (isMobileDevice ? 1024 : 2048), // EVR-06 per-tier / device-memory cap; [lighting-pass1] was 4096; keep for perf
        lightDirection: _sd0.clone().negate(), // [lighting-pass2]/EVR-02] HDRI sun; mirrored into config.sun.direction
        camera: this.world.camera,
        lightIntensity: 3.3, // [lighting-pass1] overwritten per phase by LOOK.sun
        lightNear: 1,
        lightFar: 6000,
        lightMargin: 200,
        // [lighting-pass1] three r170 CSM calls (cascades, near, far, target) and expects NORMALISED breaks pushed into target.
        // The old callback took (cascades, far, near), returned absolute metres and was never called (mode 'practical').
        customSplitsCallback: function (cascades, near, far, target) {
            const metres = cascades <= 1 ? [350] : cascades === 2 ? [40, 350] : [20, 80, 350]; // EVR-06: must match the cascade count (1 cascade crashed CSM)
            for (const m of metres) target.push(Math.min(1, m / far));
        }
    });

    this.csm.fade = true; // [lighting-pass1] was false; fade blends cascade seams

    // Apply shadow biases per cascade
    this.csm.lights.forEach((light, i) => {
        // Bias decreases for distant cascades to prevent acne, tighter near biases for dramatic cliff edge shadows
        light.shadow.bias = isMobileDevice ? -0.001 : -0.0005 - (i * 0.0002);
        light.shadow.normalBias = 0.015 + (i * 0.01);
        light.shadow.radius = 3.0; // [v36] softer golden-hour CSM penumbra (was 2.5) // [lighting-pass1] honoured now that shadowMap.type = PCFShadowMap
    });

    

    this.world.scene.add(sun);
    this.sun = sun;
  }

  _sky() {
    // 1. True Rayleigh/Mie scattering physical Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.sky.frustumCulled = false;
    this.world.scene.add(this.sky);

    const skyUniforms = this.sky.material.uniforms;
    // [EVR-05 r186] parity with the r170 Sky: r183 dropped its legacy gamma, r186 added procedural clouds (coverage 0.4 by
    // default) and a new sun disc. The valley has its own cloudScape, so clouds stay off and the r170 tone curve is restored.
    if (skyUniforms.cloudCoverage) skyUniforms.cloudCoverage.value = 0.0;
    {
      const m = this.sky.material;
      const fs = m.fragmentShader
        .replace('varying vec3 vSunDirection;', 'varying vec3 vSunDirection;\n\t\tvarying float vSunfade;')
        .replace(/float sundisc = [^;]+;\s*vec3 sundiscColor = [^;]+;\s*vec3 texColor = \( Lin \+ L0 \) \* 0\.04 \+ sundiscColor \+ vec3\( 0\.0, 0\.0003, 0\.00075 \);/,
          'float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );\n\t\t\tL0 += ( vSunE * 19000.0 * Fex ) * sundisk;\n\t\t\tvec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );')
        .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) ), 1.0 );');
      if (fs.includes('float sundisk') && fs.includes('vSunfade ) ) ) )')) { m.fragmentShader = fs; m.needsUpdate = true; }
      else console.log('[EVR-05] Sky r170-look patch anchors not found; using the r186 Sky as is');
    }
    skyUniforms['turbidity'].value = 4.0;
    skyUniforms['rayleigh'].value = 1.35;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // 2. Load 2K HDR Environment Map for physically accurate PBR reflections across all materials
    try {
      this.pmrem = new THREE.PMREMGenerator(this.world.renderer);
      this.pmrem.compileEquirectangularShader();
      // [lighting-pass1] duplicate meadow_2k.hdr load removed: WorldAssetLoader._loadHDRI() is the single loader
    } catch (err) {
      console.warn('[WorldLighting] HDRI environment load error:', err);
    }

    // [lighting-pass2] three's Lensflare removed: the sun glow is drawn in the god-rays pass, occluded by the scene depth
    // and hidden when the sun is off-screen or behind the camera (see _composer).
  }

  _updateLighting(phase, mood) {
    const p = phase || this._forcedPhase || getDayPhase();
    const rawKey = typeof p === 'string' ? p : (p?.key || 'sunlit');
    const phaseKey = (rawKey === 'day') ? 'sunlit' : rawKey;
    const m = mood || MOODS[this.mood] || (phaseKey === 'blessing' ? MOODS.blessing : MOODS.clear);

    // Dynamic Time-of-Day Spherical Solar Coordinates
    // [EVR-02] lighting HDRI day sun + phase tables; sync to config.sun.direction for terrain/foliage
    const ELEV = { dawn: 8.0, sunlit: 36.5, day: 36.5, dusk: 6.0, night: 40.0, blessing: 35.0 };
    const AZI = { dawn: 85.0, sunlit: 298.0, day: 298.0, dusk: 275.0, night: 45.0, blessing: 290.0 };
    const elevation = ELEV[phaseKey] ?? 43.5;
    const azimuth = AZI[phaseKey] ?? 307.0;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    const hdriDay = phaseKey === 'sunlit'; // [lighting-pass2] day = the HDRI's sun; other UI phases keep their table
    this._hdriDay = hdriDay;
    const sunDir = hdriDay ? evSunDir() : new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    try { rendererConfig.sun.direction.copy(sunDir); } catch (_) {}
    this._sunDir = sunDir;
    // [oneworld] single shared sun vector (foliage SSS shaders reference it directly)
    (globalThis.__EV_SUN_DIR ||= new THREE.Vector3(0.4, 0.8, 0.5).normalize()).copy(sunDir);

    // Atmospheric Sky Palette
    const SKY_PALETTE = {
      dawn: {
        zenith: 0x182a52,   // Mediterranean morning deep sapphire
        horizon: 0xf2a884,  // Radiant apricot-rose & champagne gold horizon
        ground: 0x283424,   // Soft morning loam & foliage ground bounce
        sunCol: 0xffe0ba,   // Radiant morning champagne sunlight (~3200K)
        sunInt: 2.8,
      },
      sunlit: {
        zenith: 0x093b7b,   // Rich celestial azure / cerulean sapphire zenith (5600K daylight)
        horizon: 0x8ac4f6,  // Radiant golden-tinted azure horizon
        ground: 0x384828,   // Deep rich meadow ground bounce
        sunCol: 0xfff5dd,   // Warm natural 5600K champagne gold sunlight
        sunInt: 3.6,
      },
      day: {
        zenith: 0x093b7b,
        horizon: 0x8ac4f6,
        ground: 0x384828,
        sunCol: 0xfff5dd,
        sunInt: 3.6,
      },
      dusk: {
        zenith: 0x121c3e,   // Deep twilight sapphire-violet
        horizon: 0xea7236,  // Radiant molten coral & amber sunset horizon (~2200K)
        ground: 0x2e1e16,   // Warm terracotta shadow ground bounce
        sunCol: 0xff883c,   // Molten gold-orange sunset
        sunInt: 2.8,
      },
      night: {
        zenith: 0x040c1e,   // Lapis-lazuli deep midnight space zenith
        horizon: 0x122444,  // Luminous celestial starlight horizon (~8500K)
        ground: 0x0a1412,   // Moonlit pasture ground bounce
        sunCol: 0xd4ecff,   // Pristine silver-cyan moonlight
        sunInt: 1.4,
      },
      blessing: {
        zenith: 0x18345c,   // Ethereal celestial sapphire zenith
        horizon: 0xd8c8f0,  // Iridescent pearl-lavender horizon (~6200K)
        ground: 0x344c2c,   // Lush emerald-dew ground bounce
        sunCol: 0xfffae8,   // Iridescent prismatic radiance sunlight
        sunInt: 3.4,
      },
    };
    const skyPal = SKY_PALETTE[phaseKey] || SKY_PALETTE.sunlit;

    if (this.sky?.material?.uniforms) {
      const u = this.sky.material.uniforms;
      if (u.sunPosition) u.sunPosition.value.copy(sunDir);
      if (u.uSunPosition) u.uSunPosition.value.copy(sunDir);
      if (u.uZenithColor) u.uZenithColor.value.setHex(skyPal.zenith);
      if (u.uHorizonColor) u.uHorizonColor.value.setHex(skyPal.horizon);
      if (u.uGroundColor) u.uGroundColor.value.setHex(skyPal.ground);
      if (u.uSunColor) u.uSunColor.value.setHex(skyPal.sunCol);
      if (u.uSunIntensity) u.uSunIntensity.value = skyPal.sunInt;
    }

    // Directional Sun, Hemisphere Fill, Aerial Perspective Fog & Exposure Matrix
    const LOOK = {
      dawn:     { exposure: 1.00, sun: 1.85, env: 0.70, hemi: 1.15, sunCol: 0xffe0ba, hemiSky: 0x6a5870, hemiGnd: 0x302820, fogCol: 0xb89084, fogDensity: 0.000075, fogNear: 1000, fogFar: 15000, stars: 0.00, clouds: 0xf4dfd4, water: 0x1c4456, bloom: 0.18, rainbow: 0.50, lanternGlow: 0.8 },
      sunlit:   { exposure: 1.00, sun: 3.30, env: 0.70, hemi: 0.30, sunCol: 0xfff5dd, hemiSky: 0x5078a0, hemiGnd: 0x384828, fogCol: 0xb7d2e7, fogDensity: 0.000250, fogNear: 1200, fogFar: 18000, stars: 0.00, clouds: 0xffffff, water: 0x185874, bloom: 0.05, rainbow: 0.45, lanternGlow: 0.5 },
      day:      { exposure: 1.00, sun: 3.30, env: 0.70, hemi: 0.30, sunCol: 0xfff5dd, hemiSky: 0x5078a0, hemiGnd: 0x384828, fogCol: 0xb7d2e7, fogDensity: 0.000250, fogNear: 1200, fogFar: 18000, stars: 0.00, clouds: 0xffffff, water: 0x185874, bloom: 0.05, rainbow: 0.45, lanternGlow: 0.5 },
      dusk:     { exposure: 1.00, sun: 1.85, env: 0.60, hemi: 1.15, sunCol: 0xff883c, hemiSky: 0x684848, hemiGnd: 0x2e201a, fogCol: 0xa86854, fogDensity: 0.000075, fogNear: 900,  fogFar: 14000, stars: 0.25, clouds: 0xfba680, water: 0x203848, bloom: 0.22, rainbow: 0.65, lanternGlow: 1.4 },
      night:    { exposure: 1.18, sun: 0.65, env: 0.15, hemi: 0.70, sunCol: 0xd4ecff, hemiSky: 0x1c2c3e, hemiGnd: 0x101814, fogCol: 0x142236, fogDensity: 0.000055, fogNear: 800,  fogFar: 12000, stars: 1.00, clouds: 0x42587c, water: 0x142e48, bloom: 0.38, rainbow: 0.75, lanternGlow: 2.4 },
      blessing: { exposure: 1.08, sun: 2.00, env: 0.85, hemi: 1.35, sunCol: 0xfffae8, hemiSky: 0x6c7ea8, hemiGnd: 0x344c2c, fogCol: 0xaec2dc, fogDensity: 0.000100, fogNear: 600,  fogFar: 9000,  stars: 0.15, clouds: 0xf8e8f4, water: 0x1a6078, bloom: 0.28, rainbow: 1.00, lanternGlow: 1.2 },
    };
    let look = LOOK[phaseKey] || LOOK.sunlit;
    if (hdriDay) {
      // [lighting-pass2] key, fill and fog come from the HDRI (pass 1: sun 3.30 0xfff5dd, env 0.70 meadow_2k, hemi 0.30, fog 0xb7d2e7 @ 2.5e-4)
      const u = evSkyUnits(), sc = EV_SKY.hdriSunRGB, fc = EV_SKY.hdriFogRGB;
      look = { ...look, exposure: 1.0, sun: u.sun, env: u.sky, hemi: 0.0,
        sunCol: new THREE.Color().setRGB(sc[0], sc[1], sc[2]).getHex(),
        fogRGB: [fc[0] * u.sky, fc[1] * u.sky, fc[2] * u.sky],
        fogCol: new THREE.Color().setRGB(fc[0] / fc[0], fc[1] / fc[0], fc[2] / fc[0]).getHex(),
        fogDensity: EV_SKY.fogDensity, bloom: EV_SKY.golden ? EV_SKY.golden.bloom : look.bloom };
      LOOK.sunlit = LOOK.day = look;
    }

    if (this.bloomPass) {
      this.bloomPass.strength = look.bloom;
    }

    // [lighting-pass2] HDRI backplate for the day phase (was: background = null over the Rayleigh Sky)
    this._applySkyBackground();

    if (this.csm) {
      this.csm.lightDirection.copy(sunDir).negate();
      this.csm.lights.forEach(light => {
          if (hdriDay) { const T = EV_SKY.golden?.sunTint || [1, 1, 1]; light.color.setRGB(EV_SKY.hdriSunRGB[0] * T[0], EV_SKY.hdriSunRGB[1] * T[1], EV_SKY.hdriSunRGB[2] * T[2]); }
          else light.color.setHex(look.sunCol);
          light.intensity = look.sun * (hdriDay ? 1.0 : (m.light || 1.0)); // [lighting-pass2] HDRI sun: no mood factor
      });
    }

    if (this.sun) {
      // [oneworld/EVR-02] flare anchor on the lit sun direction; CSM lights carry colour/intensity
      this.sun.position.copy(sunDir).multiplyScalar(3000);
    }

    if (this.hemi) {
      this.hemi.color.setHex(look.hemiSky);
      this.hemi.groundColor.setHex(look.hemiGnd);
      this.hemi.intensity = look.hemi;
    }

    if (this.world.terrain._terrainShaders) this.world.terrain._terrainShaders.forEach(s => { if (s.uniforms?.uSunDir) s.uniforms.uSunDir.value.copy(sunDir); });
    // [lighting-pass2] every ShaderMaterial sun uniform (fish/turtle/manta/waterfalls/cascades had stale (0.4,0.8,0.5) defaults)
    this.world.scene.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (mats) for (const mt of mats) { const un = mt && mt.uniforms; if (!un) continue;
        for (const k of ['uSunDir', 'sunDirection', 'uLightDir', 'uSunDirection']) if (un[k]?.value?.isVector3) un[k].value.copy(sunDir); }
    });
    if (this.world._bgMountainShader?.uniforms?.uSunDir) {
      this.world._bgMountainShader.uniforms.uSunDir.value.copy(sunDir);
    }
    if (this.world._windMaterials) {
      for (let i = 0, len = this.world._windMaterials.length; i < len; i++) {
        const mat = this.world._windMaterials[i];
        if (mat.userData?.botanicalShader?.uniforms?.uLightDir) {
          mat.userData.botanicalShader.uniforms.uLightDir.value.copy(sunDir);
        }
        if (mat.userData?.windShader?.uniforms?.uLightDir) {
          mat.userData.windShader.uniforms.uLightDir.value.copy(sunDir);
        }
      }
    }

    // Dynamic aerial perspective exponential fog calibration
    if (this.world.scene.fog) {
      this._applyFogColor(look); // [lighting-pass2] HDR fog tint from the HDRI horizon near the sun
      if (this.world.scene.fog.isFogExp2) {
        const moodDensityMult = 1.0; // [oneworld] mood no longer changes fog density
        this.world.scene.fog.density = look.fogDensity * moodDensityMult;
      } else if (this.world.scene.fog.isFog) {
        this.world.scene.fog.near = look.fogNear;
        this.world.scene.fog.far = look.fogFar;
      }
    }
    // patch01: height fog overrides LOOK fog colour/density (colour from Sky horizon for sunDir)
    heightFog.update(sunDir, { scene: this.world.scene, sky: this.sky });

    this.world.renderer.toneMappingExposure = 1.0; // [oneworld] single exposure (was look.exposure x mood.light factor)
    this._envIntensity = look.env;
    this._updateEnvironment();
    this.world.renderer.shadowMap.needsUpdate = true;
    return { sunDir, LOOK: look, LOOKS: LOOK, SKY_PALETTE: skyPal, SKY_PALETTES: SKY_PALETTE, phaseKey };
  }

  /** EVR-06: free all composer render targets (used when post is switched off, on unload and on context loss). */
  disposeComposer() {
    const c = this.composer; if (!c) return;
    try {
      for (const p of c.passes || []) p.dispose?.();
      c.renderTarget1?.depthTexture?.dispose?.();
      c.renderTarget2?.depthTexture?.dispose?.();
      c.dispose?.();
    } catch (e) { console.log('[EVR-06] disposeComposer', e); }
    this.composer = null; this.useComposer = false; this.bloomPass = null;
    if (this.world) this.world.depthTexture = null;
  }

  _composer() {
    if (this.composer) return;
    const w = this.world.canvas.clientWidth || window.innerWidth || 1;
    const h = this.world.canvas.clientHeight || window.innerHeight || 1;
    const isMobile = EV_PERF.tier !== 'desktop';
    
    // Create custom render target to retain hardware MSAA (anti-aliasing) during post-processing
    const renderTarget = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: EV_PERF.composerSamples ?? 4, // [lighting-pass1] MSAA 4 (was 0): geometry AA + foliage alphaToCoverage. EVR-06: 0 on <8 GB devices (SMAA still on)
    });
    renderTarget.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.world.depthTexture = renderTarget.depthTexture;
    
    const composer = new EffectComposer(this.world.renderer, renderTarget);
    // EVR-06: EffectComposer clones the MSAA target (samples + depth texture) for its 2nd ping-pong buffer.
    // Only RenderPass/GTAO/bloom touch the MSAA buffer (in place); the 2nd buffer receives SMAA/fullscreen
    // passes only (4 swaps/frame: godRays, Output, lens, SMAA), so it needs neither MSAA nor a depth texture (saves ~270 MB at 1440x900 @2x).
    try {
      const rt2 = composer.renderTarget2;
      if (rt2) { rt2.samples = 0; if (rt2.depthTexture) { rt2.depthTexture.dispose(); rt2.depthTexture = null; } } // depthBuffer kept (plain renderbuffer) in case a pass toggle makes the swap count odd
    } catch (e) { console.log('[EVR-06] composer rt2 trim', e); }
    // EVR-06 (Oct 15) BLACK-FRAME ROOT CAUSE: the chain swaps 5x per frame (godRays, Output, lens, grade, SMAA), an ODD
    // count, so every other frame RenderPass drew into rt2 (no depth texture) and godRays wrote into rt1 while sampling
    // rt1's depth texture as tDepth (fallback world.depthTexture) -> feedback loop -> draws dropped -> black canvas on
    // alternate frames (looked view-dependent/intermittent). Fix: always start the frame on rt1, whatever the parity.
    { const r0 = composer.render.bind(composer);
      composer.render = (dt) => { if (composer.readBuffer !== composer.renderTarget1) composer.swapBuffers(); return r0(dt); }; }
    composer.setPixelRatio(this.world.renderer.getPixelRatio());
    composer.addPass(new RenderPass(this.world.scene, this.world.camera));

    // [lighting-pass2] GTAO ON for the desktop composer tiers (high/ultra; the composer is never built on mobile or low/medium),
    // right after RenderPass. Adapted to this renderer: log depth -> NDC depth, opaque casters only, in-place multiply blend.
    // EVR-06 (Mac repro): GTAO re-renders the whole opaque scene into a normal/depth G-buffer every frame
    // (~doubles desktop draw calls). Off by default; ?gtao=1 opts back in for QA / high-end look checks.
    const _gtaoOn = EV_PERF.gtao && !/[?&]gtao=0\b/.test(location.search);
    if (!isMobile && _gtaoOn) {
      const scene = this.world.scene, camera = this.world.camera;
      // [EVR-04] GTAO at HALF resolution (was full): ~4x fewer AO fragments; the blend upsamples bilinearly.
      const _aoS = EV_PERF.gtaoScale || 1;
      const gtaoPass = new GTAOPass(scene, camera, Math.ceil(w * _aoS), Math.ceil(h * _aoS));
      { const _ss = gtaoPass.setSize.bind(gtaoPass); gtaoPass.setSize = (sw, sh) => _ss(Math.ceil(sw * _aoS), Math.ceil(sh * _aoS)); }
      gtaoPass.output = GTAOPass.OUTPUT.Denoise; // AO is multiplied onto readBuffer below (keeps the composer swap count even)
      const aoParameters = {
        radius: 4.0,            // metres (was 0.35, i.e. invisible at landscape scale)
        distanceExponent: 2.0,
        thickness: 4.0,
        scale: 1.0,
        samples: 16,
        distanceFallOff: 1.0,
        screenSpaceRadius: false,
      };
      gtaoPass.updateGtaoMaterial(aoParameters);
      gtaoPass.blendIntensity = 1.0;
      // (a) logarithmicDepthBuffer: the G-buffer depth is log2(1+w)/log2(far+1); GTAO/denoise expect hardware perspective depth
      const LOG2NDC = `
        uniform float evNear; uniform float evFar;
        float evLogToNdc(float d) { if (d >= 1.0) return 1.0; float w = exp2(d * log2(evFar + 1.0)) - 1.0; return ((w - evNear) * evFar) / ((evFar - evNear) * max(w, 1e-4)); }
      `;
      for (const mt of [gtaoPass.gtaoMaterial, gtaoPass.pdMaterial]) {
        mt.uniforms.evNear = { value: camera.near };
        mt.uniforms.evFar = { value: camera.far };
        mt.fragmentShader = mt.fragmentShader
          .replace(/(uniform (?:highp )?sampler2D tDepth;)/, `$1\n${LOG2NDC}`)
          .replace(/((?:textureLod|texelFetch)\(tDepth, uv\.xy, 0(?:\.0)?\)\.(?:DEPTH_SWIZZLING|a|r))/g, 'evLogToNdc($1)');
        mt.needsUpdate = true;
      }
      // (a2) fade AO out with distance: GTAO runs after fog/in-scatter, so at km range it painted black noisy creases
      // on the hazy background massif. AO is a contact cue: full to 120 m, gone by 400 m.
      gtaoPass.gtaoMaterial.fragmentShader = gtaoPass.gtaoMaterial.fragmentShader
        .replace('gl_FragColor = FRAGMENT_OUTPUT;', 'ao = mix(ao, 1.0, smoothstep(120.0, 400.0, -viewPos.z));\n\t\t\tgl_FragColor = FRAGMENT_OUTPUT;');
      // (b) only opaque, non-cutout geometry writes the AO G-buffer (alpha cards/transparent planes would AO as solid quads)
      // [EVR-05 r186] the pass's helpers are private now (_overrideVisibility/_restoreVisibility/_renderOverride/_renderPass)
      // and _visibilityCache became an Array; keep our own Map so the restore puts every object back exactly.
      const _aoVis = new Map();
      gtaoPass._restoreVisibility = function () { for (const [o, v] of _aoVis) o.visible = v; _aoVis.clear(); };
      gtaoPass._overrideVisibility = function () {
        const cache = _aoVis;
        this.scene.traverse(o => {
          cache.set(o, o.visible);
          if (o.isPoints || o.isLine || o.isSprite) { o.visible = false; return; }
          if (o.isMesh) { const mt = Array.isArray(o.material) ? o.material[0] : o.material;
            if (!mt || mt.transparent || mt.alphaTest > 0 || mt.depthWrite === false) o.visible = false; }
        });
      };
      // (c) no HDRI backplate in the normal pass
      const baseOverride = gtaoPass._renderOverride.bind(gtaoPass);
      gtaoPass._renderOverride = (r, m, rt, c, a) => { const bg = scene.background; scene.background = null; try { baseOverride(r, m, rt, c, a); } finally { scene.background = bg; } };
      // (d) in-place multiply onto readBuffer, needsSwap=false
      const baseRender = gtaoPass.render.bind(gtaoPass);
      gtaoPass.needsSwap = false;
      gtaoPass.render = (renderer, writeBuffer, readBuffer, dt, mask) => {
        gtaoPass.gtaoMaterial.uniforms.evNear.value = gtaoPass.pdMaterial.uniforms.evNear.value = camera.near;
        gtaoPass.gtaoMaterial.uniforms.evFar.value = gtaoPass.pdMaterial.uniforms.evFar.value = camera.far;
        baseRender(renderer, writeBuffer, readBuffer, dt, mask);
        gtaoPass.blendMaterial.uniforms.intensity.value = gtaoPass.blendIntensity;
        gtaoPass.blendMaterial.uniforms.tDiffuse.value = gtaoPass.pdRenderTarget.texture;
        gtaoPass._renderPass(renderer, gtaoPass.blendMaterial, readBuffer); // [EVR-05 r186] renderPass -> _renderPass
      };
      this.gtaoPass = gtaoPass;
      composer.addPass(gtaoPass);

      // SSRPass removed (Tech Artist recipe): it was being added every frame despite the "DISABLED" note.
    }


    // EVR-06 (Mac repro: 25-26 renderer.render() calls per frame on desktop): UnrealBloom is ~13 full-screen passes
    // for strength 0.05 / threshold 1.1 (barely visible). Off by default; ?bloom=1 opts back in for look checks.
    const _bloomOn = EV_PERF.bloom && /[?&]bloom=1\b/.test(location.search);
    if (!isMobile && _bloomOn) {
      // 1. High-Fidelity Optical Bloom Pass (Peak specular solar glints, water crests, glowing rainbow, and lanterns)
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)),
        0.05,   // strength [lighting-pass1] was 0.28
        0.40,   // radius   [lighting-pass1] was 0.85
        1.10,   // threshold [lighting-pass1] was 0.85 (HDR: only real light sources bloom)
      );
      this.bloomPass = bloom;
      // [lighting-pass2] firefly guard = the pass-1 "white square sprite" fix. UnrealBloom's separable blur is nearly a box
      // (sigma = kernelRadius, truncated at 1 sigma), so ONE NaN/Inf/huge HDR pixel blooms into a visible soft SQUARE.
      // Pass 1 exposed it by dropping the god-rays clamp(0,1) that used to hide it. Clamp the bloom input (sun backplate peak ~86).
      bloom.highPassUniforms.uFireflyMax = { value: 100.0 };
      bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader
        .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\nuniform float uFireflyMax;')
        .replace('vec4 texel = texture2D( tDiffuse, vUv );',
          'vec4 texel = texture2D( tDiffuse, vUv );\n if (any(isnan(texel)) || any(isinf(texel))) texel = vec4(0.0);\n texel = min(texel, vec4(uFireflyMax));');
      bloom.materialHighPassFilter.needsUpdate = true;
      evKeepR170BloomResponse(bloom); // [EVR-05 r186]
      composer.addPass(bloom);
    }
    if (!isMobile && EV_PERF.godRays) { // EVR-06: god rays stay on (visible look + keeps the composer swap count even); only bloom is gated

      // 1.5 God Rays Volumetric Light Scattering (Optimized)
      const GodRaysShader = {
        uniforms: {
          tDiffuse: { value: null },
          uLightPosition: { value: new THREE.Vector2(0.5, 0.5) },
          uExposure: { value: 0.11 }, // [v36 polish] was 0.18: backlit views washed out on the sun side
          uDecay: { value: 0.93 },
          uDensity: { value: 0.96 },
          uWeight: { value: 0.4 },
          uClampMax: { value: 1.0 },
          // [lighting-pass2] soft sun glow replaces three's Lensflare (white 16x16 occlusion quad); occluded by scene depth
          tDepth: { value: null },
          tRays: { value: null },
          uAspect: { value: w / h },
          uSunGlow: { value: new THREE.Vector3(0, 0, 0) },
          uRayLo: { value: 8.0 },   // HDR: only the sun/aureole (renderer units) cast rays, not the whole bright sky
          uRayHi: { value: 30.0 },
          uFireflyMax: { value: 100.0 }, // [lighting-pass2] one huge pixel must not streak
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform vec2 uLightPosition;
          uniform float uExposure;
          uniform float uDecay;
          uniform float uDensity;
          uniform float uWeight;
          uniform float uClampMax;
          uniform sampler2D tDepth;
          uniform sampler2D tRays;
          uniform float uAspect;
          uniform vec3 uSunGlow;
          uniform float uRayLo;
          uniform float uRayHi;
          uniform float uFireflyMax;
          varying vec2 vUv;

          float skyAt(vec2 uv) { return step(0.99999, texture2D(tDepth, clamp(uv, 0.0, 1.0)).x); } // cleared depth = sky

          void main() {
            vec4 originalColor = texture2D(tDiffuse, vUv);
            if (any(isnan(originalColor)) || any(isinf(originalColor))) originalColor = vec4(0.0, 0.0, 0.0, 1.0); // EVR-06: NaN guard
            vec3 rayColorTotal = texture2D(tRays, vUv).rgb; // EVR-06: rays traced at half/quarter res (rayMat), bilinear upsample
            vec3 finalColor = originalColor.rgb + rayColorTotal * uExposure;
            // [lighting-pass2] sun glow: 9 depth taps around the sun -> visible fraction; zero off-screen / behind camera
            vec2 L = uLightPosition;
            float onScreen = step(0.0, L.x) * step(L.x, 1.0) * step(0.0, L.y) * step(L.y, 1.0);
            if (onScreen > 0.0) {
              float e = 0.004;
              float vis = (skyAt(L) + skyAt(L + vec2(e, 0.0)) + skyAt(L - vec2(e, 0.0)) + skyAt(L + vec2(0.0, e)) + skyAt(L - vec2(0.0, e))
                + skyAt(L + vec2(e, e)) + skyAt(L - vec2(e, e)) + skyAt(L + vec2(e, -e)) + skyAt(L + vec2(-e, e))) / 9.0;
              float r = length((vUv - L) * vec2(uAspect, 1.0));
              finalColor += uSunGlow * vis * (exp(-r * 70.0) + 0.04 * exp(-r * 9.0));
            }
            gl_FragColor = vec4(max(finalColor, vec3(0.0)), originalColor.a); // [lighting-pass1] no clamp to uClampMax: stay HDR until OutputPass
          }
        `
      };
  
      const godRaysPass = new ShaderPass(GodRaysShader);
      godRaysPass.needsSwap = true;
      // EVR-06 (Oct 15 late): the 25-tap radial ray march runs into a half-res target (quarter on mobile tiers) and the
      // composite reads it bilinearly. Before the ping-pong fix every other god-rays draw was dropped, so its full-res
      // cost only became visible on the Mac after it (desktop 60 -> 36-41 fps). Saves 3/4 of the ray taps.
      const _rayDiv = (EV_PERF.tier === 'desktop') ? 2 : 4;
      const _rayRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
      const _rayMat = new THREE.ShaderMaterial({ uniforms: godRaysPass.uniforms, vertexShader: GodRaysShader.vertexShader, fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uLightPosition; uniform float uDecay, uDensity, uWeight, uRayLo, uRayHi, uFireflyMax; varying vec2 vUv;
void main() {
            vec2 texCoord = vUv;
            vec2 deltaTextCoord = texCoord - uLightPosition;
            deltaTextCoord *= 1.0 / 25.0 * uDensity;
            
            vec3 rayColorTotal = vec3(0.0);
            float illuminationDecay = 1.0;
            
            // 25 iterations to maintain 60 FPS performance
            for(int i = 0; i < 25; i++) {
              texCoord -= deltaTextCoord;
              vec3 sampleColor = texture2D(tDiffuse, texCoord).rgb;
              sampleColor = (any(isnan(sampleColor)) || any(isinf(sampleColor))) ? vec3(0.0) : min(sampleColor, vec3(uFireflyMax));
              float brightness = dot(sampleColor, vec3(0.299, 0.587, 0.114));
              vec3 rayColor = sampleColor * smoothstep(uRayLo, uRayHi, brightness); // [lighting-pass2] was 0.85-1.0 (LDR)
              rayColorTotal += rayColor * illuminationDecay * uWeight;
              illuminationDecay *= uDecay;
            }
            
            gl_FragColor = vec4(rayColorTotal, 1.0);
}
`, depthTest: false, depthWrite: false });
      const _rayQuad = new FullScreenQuad(_rayMat);
      godRaysPass.uniforms.tRays.value = _rayRT.texture;
      this._godRaysRT = _rayRT;
      const _setSize0 = godRaysPass.setSize?.bind(godRaysPass);
      godRaysPass.setSize = (w2, h2) => { _setSize0?.(w2, h2); _rayRT.setSize(Math.max(1, Math.ceil(w2 / _rayDiv)), Math.max(1, Math.ceil(h2 / _rayDiv))); };
      godRaysPass.dispose = ((d0) => () => { d0?.(); _rayRT.dispose(); _rayMat.dispose(); _rayQuad.dispose(); })(godRaysPass.dispose?.bind(godRaysPass));
      
      const origRender = godRaysPass.render.bind(godRaysPass);
      godRaysPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
        if (this.world && this.world.camera && this._sunDir) {
          const sunPos = this._sunDir.clone().multiplyScalar(1e6).add(this.world.camera.position);
          sunPos.project(this.world.camera);
          const x = (sunPos.x + 1) / 2;
          const y = (sunPos.y + 1) / 2;
          if (sunPos.z > 1.0) {
             godRaysPass.uniforms.uLightPosition.value.set(-10, -10);
          } else {
             godRaysPass.uniforms.uLightPosition.value.set(x, y);
          }
          // [lighting-pass2] glow colour = HDRI sun chroma; only for the HDRI day sun
          const gu = godRaysPass.uniforms, c = EV_SKY.hdriSunRGB, k = this._hdriDay ? 6.0 : 0.0;
          gu.uSunGlow.value.set(c[0] * k, c[1] * k, c[2] * k);
          gu.tDepth.value = readBuffer.depthTexture || null; // EVR-06: never fall back to a texture attached to writeBuffer (feedback loop)
          if (!gu.tDepth.value) gu.uSunGlow.value.set(0, 0, 0);
          gu.uAspect.value = readBuffer.width / Math.max(1, readBuffer.height);
        }
        godRaysPass.uniforms.tDiffuse.value = readBuffer.texture;
        if (_rayRT.width === 1) _rayRT.setSize(Math.max(1, Math.ceil(readBuffer.width / _rayDiv)), Math.max(1, Math.ceil(readBuffer.height / _rayDiv)));
        const _prevRT = renderer.getRenderTarget(); renderer.setRenderTarget(_rayRT); _rayQuad.render(renderer); renderer.setRenderTarget(_prevRT);
        origRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      };
  
      this.godRaysPass = godRaysPass;
      composer.addPass(godRaysPass);
    }

    // 2. 35mm Lens Optical Clarity Shader Pass
    const CinematicLensShader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uChromaticDispersion: { value: 0.0004 },
        uVignetteRoundness: { value: 0.85 },
        uVignetteDarkness: { value: 0.12 },
        uGrainIntensity: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uChromaticDispersion;
        uniform float uVignetteRoundness;
        uniform float uVignetteDarkness;
        uniform float uGrainIntensity;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 uv = vUv;
          vec2 distFromCenter = uv - 0.5;
          float distSq = dot(distFromCenter, distFromCenter);

          // Radial Chromatic Dispersion (35mm Prime Lens)
          vec2 rOffset = distFromCenter * (uChromaticDispersion * 1.6 * distSq);
          vec2 bOffset = -distFromCenter * (uChromaticDispersion * 1.2 * distSq);
          float r = texture2D(tDiffuse, uv + rOffset).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv + bOffset).b;
          vec3 col = vec3(r, g, b);

          // Optical Lens Vignette
          float vignette = 1.0 - smoothstep(0.4, 0.85, length(distFromCenter) * uVignetteRoundness) * uVignetteDarkness;
          col *= vignette;

          // Organic 35mm Film Grain
          float grain = (hash21(uv * uResolution + fract(uTime * 43.12)) - 0.5) * uGrainIntensity;
          col += vec3(grain);

          // [lighting-pass1] removed pow(col, 0.96) 'grounding' (a gamma lift; was applied to linear HDR)

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    };

    const lensPass = new ShaderPass(CinematicLensShader);
    // [lighting-pass1] lens pass (CA/vignette/grain) MOVED after OutputPass (display-referred); added below
    this._cinematicPass = lensPass;

    if (!isMobile) {
      // Depth of Field (Bokeh)
      const bokehPass = new BokehPass(this.world.scene, this.world.camera, {
        focus: 600.0,
        aperture: 0.00005,
        maxblur: 0.015,
        width: w,
        height: h
      });
      // composer.addPass(bokehPass);
      this.bokehPass = bokehPass;
    }

    // 3. Hollywood ACES Filmic Tone Mapping & Accurate sRGB Output
    
    // Super-fast Anti-Aliasing (FXAA) to smooth 1.0 DPR edges without massive GPU lag
    // [lighting-pass1] FXAA (ran on linear HDR) replaced by SMAA after AgX/OutputPass.
    // Locked chain: Render(MSAA4) -> Bloom -> GodRays -> OutputPass(AgX+sRGB) -> Lens -> SMAA
    composer.addPass(new OutputPass());
    composer.addPass(lensPass);
    // [v36 polish] display-space grade: black point, gentle S-curve, warmth, saturation (greens a little more). QA: "washed out".
    const gradePass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uBlack: { value: 0.008 }, uCurve: { value: 0.10 }, uSat: { value: 0.98 }, uGreen: { value: 0.0 }, uWarm: { value: new THREE.Vector3(1.0, 1.0, 1.0) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uBlack, uCurve, uSat, uGreen; uniform vec3 uWarm; varying vec2 vUv;
        void main(){
          vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;
          c = max(c - uBlack, 0.0) / (1.0 - uBlack);
          c = mix(c, c * c * (3.0 - 2.0 * c), uCurve);
          c *= uWarm;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float green = smoothstep(0.0, 0.12, c.g - max(c.r, c.b) * 0.92);
          c = mix(vec3(l), c, uSat + uGreen * green);
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
        }` });
    composer.addPass(gradePass);
    this.gradePass = gradePass;
    const pixelRatio = this.world.renderer.getPixelRatio();
    const smaaPass = new SMAAPass(); // [EVR-05 r186] ctor takes no size since r175; the composer sizes it in addPass/setSize
    composer.addPass(smaaPass);
    this._smaaPass = smaaPass;

    this.composer = composer;
  }

  _stars() {
    const N = 1800;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const siz = new Float32Array(N);
    const rng = mulberry32(42);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = rng() * Math.PI * 2, e = Math.acos(rng() * 0.95); // upper dome
      const r = 8000;                                            // outside the terrain, inside the sky
      pos[i * 3] = Math.cos(a) * Math.sin(e) * r;
      pos[i * 3 + 1] = Math.cos(e) * r + 100;
      pos[i * 3 + 2] = Math.sin(a) * Math.sin(e) * r;
      // Real starfields are not uniformly white: most are faint and
      // slightly warm or blue, with only a handful bright.
      const k = rng();
      c.setHSL(0.08 + rng() * 0.55, 0.35 * rng(), 0.72 + k * 0.28);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      siz[i] = (0.35 + Math.pow(rng(), 5) * 1.9) * 46;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(siz, 1));
    g.computeBoundingSphere();

    // Soft round sprites with per-star size — the default PointsMaterial
    // draws hard squares, which is the one thing a night sky must not do.
    this.starMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTex: { value: this._starSprite() }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        #include <fog_pars_vertex>
        attribute float size;
        varying vec3 vColor; varying float vTw;
        uniform float uTime;
        void main(){
          vColor = color;
          vTw = 0.75 + 0.25 * sin(uTime * 1.4 + position.x * 0.01 + position.z * 0.013);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
                  #include <logdepthbuf_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <logdepthbuf_pars_fragment>
        #include <fog_pars_fragment>
        uniform sampler2D uTex; uniform float uOpacity;
        varying vec3 vColor; varying float vTw;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor, t.a * uOpacity * vTw);
                  #include <logdepthbuf_fragment>
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      vertexColors: true,
    });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.visible = false;
    this.stars.frustumCulled = false;
    this.world.scene.add(this.stars);
  }

  _starSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  _horizon() {
    // Continuous distant landscape horizon ring beyond the background mountain range (R = 5100m to 24000m)
    const ringGeo = new THREE.RingGeometry(5100, 24000, 96, 24);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0, 500);
    const rPos = ringGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i), rz = rPos.getZ(i);
      const rDist = Math.hypot(rx, rz - 500);
      if (rz > 800) {
        // Southern ocean horizon
        rPos.setY(i, 0.2);
      } else {
        // Distant atmospheric horizon haze
        const tEdge = Math.max(0, Math.min(1, (rDist - 5100) / 9000));
        const edgeH = (fbm(rx * 0.00035 + 15, rz * 0.00035 + 15, 3) - 0.4) * 160;
        rPos.setY(i, Math.max(0, edgeH * (1.0 - tEdge)));
      }
    }
    ringGeo.computeVertexNormals();
    const horizonMat = new THREE.MeshStandardMaterial({
      color: 0xa0c4de,
      roughness: 0.95,
      metalness: 0.05,
      fog: true,
    });
    this.horizonMat = horizonMat;
    const horizonMesh = new THREE.Mesh(ringGeo, horizonMat);
    horizonMesh.receiveShadow = false;
    this.world.scene.add(horizonMesh);
  }

  // v37 S2 (realism-bar-EVR-07): additive god-ray cones removed; screen-space god rays + height fog stay

  _updateEnvironment() {
    if (this.world.assetLoader._hdriLoading) return;
    if (this.world.assetLoader._hdriEnvMap) {
      this.world.scene.environment = this.world.assetLoader._hdriEnvMap;
      this.world.scene.environmentIntensity = this._envIntensity ?? 0.7; // [lighting-pass1]
      return;
    }
    // [lighting-pass1] never swap to a procedural pmrem.fromScene env in daytime: wait for the single HDR load
    {
      const k = this._forcedPhase?.key || (getDayPhase ? getDayPhase().key : 'sunlit');
      if (k === 'day' || k === 'sunlit' || k === 'blessing') { this.world.assetLoader._loadHDRI?.(); return; }
    }
    // [oneworld] env frozen to the single HDR for every phase/mood: no pmrem.fromScene swap
    { this.world.assetLoader._loadHDRI?.(); return; }
    if (!this.pmrem || !this._envScene || !this._envSky || !this.sky?.material?.uniforms) return;
    const src = this.sky.material.uniforms;
    const dst = this._envSky.material.uniforms;
    for (const k of ['uSunPosition', 'uZenithColor', 'uHorizonColor', 'uGroundColor', 'uSunColor', 'uSunIntensity']) {
      if (dst[k] && src[k]) {
        if (dst[k].value && typeof dst[k].value.copy === 'function' && src[k].value) {
          dst[k].value.copy(src[k].value);
        } else {
          dst[k].value = src[k].value;
        }
      }
    }

    if (this._envGroundPlane?.material?.color) {
      const rawKey = this._forcedPhase?.key || (getDayPhase ? getDayPhase().key : 'sunlit');
      const phaseKey = (rawKey === 'day') ? 'sunlit' : rawKey;
      if (phaseKey === 'dusk') this._envGroundPlane.material.color.setHex(0x3a2c20);
      else if (phaseKey === 'dawn') this._envGroundPlane.material.color.setHex(0x283024);
      else if (phaseKey === 'night') this._envGroundPlane.material.color.setHex(0x06080a);
      else if (phaseKey === 'blessing') this._envGroundPlane.material.color.setHex(0x344c2c);
      else this._envGroundPlane.material.color.setHex(0x384828);
    }

    this._envRT?.dispose();
    console.log('[world3d] CALLING pmrem.fromScene!', performance.now()); this._envRT = this.pmrem.fromScene(this._envScene); console.log('[world3d] FINISHED pmrem.fromScene!', performance.now());
    this.world.scene.environment = this._envRT.texture;
    this.world.scene.environmentIntensity = this._envIntensity ?? 0.7; // [lighting-pass1]
  }

  applyAmbience() {
    if (this.world._disposed) return;
    const phase = this._forcedPhase || getDayPhase();
    const rawKey = typeof phase === 'string' ? phase : (phase?.key || 'sunlit');
    const phaseKey = (rawKey === 'day') ? 'sunlit' : rawKey;
    const P = PHASES[phaseKey] || PHASES[rawKey] || PHASES.sunlit || PHASES.day;
    const M = MOODS[this.mood] || (phaseKey === 'blessing' ? MOODS.blessing : MOODS.clear);

    // Delegate lighting, sun direction, hemisphere fill, and PMREM environment refresh to _updateLighting
    const { sunDir, LOOK } = this._updateLighting(phase, M);

    // --- True Photographic Aerial Perspective Fog (Atmospheric Rayleigh depth cueing) ---
    if (this.world.scene.fog) {
      this._applyFogColor(LOOK); // [lighting-pass2]
      if (this.world.scene.fog.isFogExp2) {
        const moodDensityMult = 1.0; // [oneworld] mood no longer changes fog density
        this.world.scene.fog.density = LOOK.fogDensity * moodDensityMult;
      } else if (this.world.scene.fog.isFog) {
        this.world.scene.fog.near = LOOK.fogNear;
        this.world.scene.fog.far = LOOK.fogFar;
      }
    }
    heightFog.update(sunDir, { scene: this.world.scene, sky: this.sky }); // patch01
    if (this.sky?.material) this.sky.material.fog = false;

    // --- Dynamic Stars & Twinkle ---
    this.stars.visible = LOOK.stars > 0.01;
    this.starMat.uniforms.uOpacity.value = LOOK.stars;

    // Distant horizon haze skirt matching atmospheric aerial perspective
    if (this.horizonMat) {
      this.horizonMat.visible = true;
      this.horizonMat.color.setHex(LOOK.fogCol);
    }

    if (this.world.renderer && this.world.renderer.shadowMap) {
      this.world.renderer.shadowMap.needsUpdate = true;
    }

    // --- Dynamic Volumetric Cloud Deck Color ---
    if (this._clouds) {
      this._clouds.forEach(c => {
        if (c?.material?.color && typeof c.material.color.setHex === 'function') {
          c.material.color.setHex(LOOK.clouds);
        }
      });
    }

    // --- Floating River Lanterns Glow & Emissive Radiance ---
    if (this.world.terrain._lanternMat) {
      this.world.terrain._lanternMat.emissiveIntensity = LOOK.lanternGlow * 0.4; // v37: dimmed lanterns
    }

    // --- Ocean & Lake PBR Water Colors ---
    if (this.world.terrain.oceanMesh?.material?.color) {
      this.world.terrain.oceanMesh.material.color.setHex(LOOK.water);
    }
    if (this.world.waterObjects) {
      for (const w of this.world.waterObjects) {
        if (w.material?.uniforms) {
          const wu = w.material.uniforms;
          if (wu.sunDirection) wu.sunDirection.value.copy(sunDir);
          if (wu.sunColor) wu.sunColor.value.setHex(LOOK.sunCol);
          if (wu.waterColor) wu.waterColor.value.setHex(LOOK.water);
          if (wu.distortionScale) wu.distortionScale.value = (M.rainbow > 0.7 || phaseKey === 'blessing') ? 4.2 : 3.8;
        } else if (w.material?.color) {
          w.material.color.setHex(LOOK.water);
        }
      }
    }
    const allCustomWaterMats = [
      this.world.terrain._lakeShader,
      this.world.terrain._oceanShader,
      this.world.terrain._surfShader,
      this.world.terrain._oceanWaterfallShader,
      this.world.terrain._mountainWaterfallShader,
      this.world._impactRingShader,
      this.world._mistShader,
      this.world._splashShader,
      this.world.terrain.riverMat,
      this.world._waterPoolMat,
      this.world.terrain._fountainBasinMat,
      this.world.terrain._fountainCascadeMat,
      this.world.terrain._shorelineFoamMaterial,
      ...(this.world.terrain._riverMaterials || []),
    ];
    for (const mat of allCustomWaterMats) {
      if (mat?.uniforms) {
        if (mat.uniforms.waterColor) mat.uniforms.waterColor.value.setHex(LOOK.water);
        if (mat.uniforms.uDeepColor) mat.uniforms.uDeepColor.value.setHex(LOOK.water);
        if (mat.uniforms.uDeepWater) mat.uniforms.uDeepWater.value.setHex(LOOK.water);
        if (mat.uniforms.sunColor) mat.uniforms.sunColor.value.setHex(LOOK.sunCol);
        if (mat.uniforms.uSunColor) mat.uniforms.uSunColor.value.setHex(LOOK.sunCol);
        if (mat.uniforms.sunDirection) mat.uniforms.sunDirection.value.copy(sunDir);
        if (mat.uniforms.uSunDir) mat.uniforms.uSunDir.value.copy(sunDir);
        
        // Feed depth texture and camera params to support caustics and intersection foam
        if (mat.uniforms.uDepthTexture && this.world.depthTexture) mat.uniforms.uDepthTexture.value = this.world.depthTexture;
        if (mat.uniforms.cameraNear && this.world.camera) mat.uniforms.cameraNear.value = this.world.camera.near;
        if (mat.uniforms.cameraFar && this.world.camera) mat.uniforms.cameraFar.value = this.world.camera.far;
      }
    }

    // --- Bloom: calibrated optical response ---
    if (this.bloomPass) {
      this.bloomPass.strength = LOOK.bloom;
      this.bloomPass.radius = 0.50 + P.night * 0.20;
      this.bloomPass.threshold = phaseKey === 'night' ? 0.74 : (EV_SKY.golden ? EV_SKY.golden.bloomThreshold : 1.10); // [lighting-pass1] day was 0.94
    }

    // The rainbow: delicate atmospheric dispersion arc
    this._rainbowBase = (0.08 + 0.10 * (phaseKey === 'blessing' ? 1.0 : M.rainbow)) * (1 + P.night * 0.25);
    this._pawBase = 0.28;
  }

  // [lighting-pass1] Dynamic-light budget (<=4 incl. CSM): remove every Point/Spot light not tagged userData.hero
  _pruneLights() {
    const drop = [];
    this.world.scene.traverse(o => { if ((o.isPointLight || o.isSpotLight) && !o.userData?.hero) drop.push(o); });
    drop.forEach(l => { l.parent?.remove(l); if (l.target?.parent) l.target.parent.remove(l.target); l.dispose?.(); });
    this._prunedLights = drop.length;
    console.log('[lighting-pass1] pruned punctual lights:', drop.length);
  }

  forcePhase(key) {
    this._forcedPhase = key ? { key, t: 0.5 } : null;
    if (key === 'blessing') this.mood = 'blessing';
    this.applyAmbience();
  }

  // [lighting-pass2] _buildLensflare() removed (see _sky / _composer sun glow)

  // [lighting-pass2] apply the HDRI backplate (day) or fall back to the Rayleigh Sky (other UI phases)
  _applySkyBackground() {
    const scene = this.world.scene, al = this.world.assetLoader;
    const yaw = THREE.MathUtils.degToRad(EV_SKY.yawDeg);
    scene.environmentRotation.set(0, yaw, 0);
    scene.backgroundRotation.set(0, yaw, 0);
    const phaseKey = (this._forcedPhase || getDayPhase())?.key;
    const isNight = phaseKey === 'night';
    const bg = isNight ? (this._nightBackground ||= new THREE.Color(0x050c18))
      : this._hdriDay ? (al._hdriBgTex || null) : null;
    if (this.world._isUnderwaterState) return; // underwater blend owns scene.background until it surfaces
    scene.background = bg;
    // [EVR-03] the Cycles backdrop is LDR (linear radiance x backdrop.scale, sRGB-encoded): undo the scale, own yaw
    const isBackdrop = !!(al && al._backdropActive && bg && al._hdriBgTex === bg);
    if (isBackdrop) scene.backgroundRotation.set(0, THREE.MathUtils.degToRad(EV_SKY.backdrop.yawDeg), 0);
    scene.backgroundIntensity = evSkyUnits().sky / (isBackdrop ? EV_SKY.backdrop.scale : 1);
    if (this.world.bgMountainsMesh) this.world.bgMountainsMesh.visible = true;
    this._hdriSkyActive = !!bg && !isNight;
    if (this.sky) this.sky.visible = !bg;
  }

  _applyFogColor(look) {
    const fog = this.world.scene.fog;
    if (!fog) return;
    if (look.fogRGB) fog.color.setRGB(look.fogRGB[0], look.fogRGB[1], look.fogRGB[2]); // linear HDR (renderer units)
    else fog.color.setHex(look.fogCol);
  }

  // dev hook: rotate the ONE sun + env + background together (deg)
  setSkyYaw(deg) { EV_SKY.yawDeg = deg; this.applyAmbience(); }

  _cloudScape() {
    this._clouds = [];
    const rng = mulberry32(7024);
    // EVR-04 (v36): soft volumetric cloud sprites rendered in Blender Cycles (Principled Volume + noise),
    // replacing the 14 additive white mist cards that read as blocks. Same count, area and drift.
    // v36b: 8 softer, more transparent sprites, lifted above the mountain crests so ridges stay crisp
    for (let m = 0; m < 8; m++) {
      const mw = 560 + rng() * 420;
      const mh = 160 + rng() * 120;
      const sp = new THREE.Sprite(cloudSpriteMaterial(m));
      sp.scale.set(mw, mw * 0.39, 1);
      sp.position.set((rng() - 0.5) * 2800, 760 + rng() * 360, -1300 + rng() * 800);
      sp.material.opacity = 0.2 + rng() * 0.14;
      sp.material.rotation = (rng() - 0.5) * 0.08;
      sp.userData = { speedX: (rng() - 0.5) * 0.4 + 0.6, origY: sp.position.y, phase: rng() * Math.PI * 2 };
      sp.renderOrder = -1;
      sp.name = 'EV_CloudSprite';
      this.world.scene.add(sp);
      this._clouds.push(sp);
    }
  }


}
