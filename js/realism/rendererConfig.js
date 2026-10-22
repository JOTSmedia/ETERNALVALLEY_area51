// ============================================================
// ETERNAL VALLEY: renderer config (STUB for patch01 + patch02)
//
// Eternal Valley Dev owns the real central renderer config. This stub
// only defines the two sections patch01 reads, so the patch runs on
// its own:
//   config.sun         one sun for everything (lights, sky, fog, foliage)
//   config.atmosphere  exponential height fog + sun in-scatter
// When Dev's file lands, re-export `config` from there and delete this
// stub. heightFog.js and the WorldLighting hunk import only { config,
// getSunDirection } from this path.
// ============================================================
import * as THREE from 'three';

export const config = {
  sun: {
    // Matches the Table Mountain 2 lighting in WorldLighting.js.
    elevationDeg: 7.27, // [EVR-02] Table Mountain 2 HDRI sun elev
    // Same convention the scene has always used:
    // THREE.Spherical theta, measured from +Z toward +X.
    azimuthDeg: 15,
    // Derived, unit vector pointing TOWARD the sun. Read it, don't write
    // it. Call refreshSun() after changing the angles.
    direction: new THREE.Vector3(),
  },

  atmosphere: {
    enabled: true,
    preset: 'day',
    // Extinction per metre at y = baseY. At camera height near baseY:
    // 1 km ~30%, 3 km ~65%, 6 km ~88% (camera.far stays 6000).
    density: 4.0e-5, // [v36 polish, was 7.5e-5] [EVR-04 v36b] 60% of EVR-02 1.25e-4 (far ridges read crisp, not milky) lighting pass2 FogExp2 (was terrain stub 0.00035)
    heightFalloff: 0.0025,   // 1/m. Density halves every ~277 m of altitude
    baseY: 10,               // m. Reference height (valley floor ~10-20 m)
    sunInscatter: 0.13,      // [v36 polish was 0.26; v36b was 0.35] Strength of the forward (toward-sun) lobe
    inscatterG: 0.76,        // Henyey-Greenstein anisotropy of that lobe
    maxOpacity: 1.0,         // Clamp on the height-fog factor
    colorSource: 'skyHorizon', // 'skyHorizon' = derived from the Sky shader for config.sun.direction
    colorScale: 1.0,         // Multiplier on the derived horizon color
    horizonSampleElevDeg: 3, // Elevation of the horizon ring averaged for fog color
    presets: {
      day:        { density: 4.0e-5, heightFalloff: 0.0025, baseY: 10, sunInscatter: 0.13, inscatterG: 0.76 },
      goldenHour: { density: 0.000075, heightFalloff: 0.0020, baseY: 10, sunInscatter: 0.28, inscatterG: 0.80 },
    },
  },

  // ---------------- patch02: ONE continuous ground ----------------
  // Every weight is a smooth function of slope, height, distance to water,
  // tree density, aridity and noise. No zone tests anywhere. The same numbers
  // drive the terrain shader (terrainSplat.js) and the CPU scatter
  // (terrainField.js groundWeights), so the ground and the plants agree.
  terrain: {
    enabled: true,
    tier: 'auto',                // 'high' | 'mid' | 'auto' (auto: mid when innerWidth <= 768 or deviceMemory < 6)
    texturePath: 'images/terrain/scan/',  // patch02/assets/terrain -> project images/terrain/scan/
    layerRes:  { high: 1024, mid: 512 },  // per-layer texture size inside the texture arrays
    fieldRes:  { high: 1024, mid: 512 },  // world mask texture (7071 m square): 6.9 m / 13.8 m per texel
    macroRes:  { high: 512,  mid: 256 },
    // Layer order is fixed (shader indices). tileMeters comes from the scan set NOTES.md.
    layers: ['granite', 'sandstone', 'wetPebbles', 'beachSand', 'desertSand', 'meadow', 'forestFloor', 'snow'],
    tileMeters: { granite: 1.80, sandstone: 1.83, wetPebbles: 2.16, beachSand: 1.80, desertSand: 3.00, meadow: 2.00, forestFloor: 1.50, snow: 2.00 },
    layerTint: { meadow: [0.86, 1.0, 0.80], snow: [1.9, 1.9, 1.9], granite: [0.66, 0.61, 0.53] },  // EVR-04: warmer, darker granite (read as grey card in v35)  // optional per-layer linear RGB multipliers (scan meadow is olive-yellow)
    // Detail UV: real scan scale near the camera, larger tiles far away (drone views), crossfaded by distance.
    detail: { farScale: 0.25, fadeStart: 18.0, fadeEnd: 70.0, normalStrength: 1.0 },
    creviceAO: 0.6,              // baked vertex crevice AO, applied to INDIRECT light only (was multiplied into albedo)
    spray: { x: 0, z: -560, r: 70, f: 90, wet: 0.85 },  // waterfall spray wetness (soft disc)
    // patch02b: same layers + slope/height rules on the distant mountain ring (_backgroundMountains, R 2.2-5.3 km).
    // Cheap path: albedo fetches only (1 top-down / up to 3 triplanar), procedural macro, no anti-tiling, no field.
    // Distant mountain ring (patch02b). Ring-only snow/tree lines = the legacy ring shader's bands
    // (snow 980 -> 1420 m; conifer belt full below 240 m, gone to rock by 840 m). Valley keeps snow.minY.
    ring: { enabled: true, tileScaleMul: 0.1, forestDensityBelowTreeline: 0.6,
            snowLineY: 1800.0, snowFeather: 360.0, treeLineY: 1250.0, treeLineFeather: 420.0 },
    rock:   { nyMax: 0.56, feather: 0.10, triplanarSharpness: 4.0 },  // EVR-04: granite only where Ny < 0.56 (was 0.80): vegetated hills, rock on real cliffs
    wet:    { distance: 8.0, feather: 3.0, darken: 0.62, roughness: 0.35 }, // wet river rock within 8 m of water
    sand:   { beachWidth: 45.0, beachMaxH: 6.0, feather: 18.0 },
    arid:   { centers: [ { x: -620, z: 520, r: 420 }, { x: -1000, z: -560, r: 470 }, { x: -930, z: -620, r: 220 } ], feather: 260.0 }, // [v36] + NW desert canyon   // "Desert Bloom" SW of the bridge (matches _vegetation inDesert box)
    forest: { threshold: 0.68, feather: 0.24 },   // forest floor where tree density > 0.4
    snow:   { minY: 1800.0, feather: 360.0, nyMin: 0.55 },
    noise:  { amplitude: 0.08, heightAmp: 14.0, distAmp: 2.5 },    // perturbs every threshold: no straight lines
    heightBlend: 0.28,           // height-map blend depth (0 = linear, larger = crisper interlock)
    antiTiling: { enabled: true, rotationRad: 0.66, scale2: 0.71, noiseCells: 0.07, macroStrength: 0.24, macroHue: 0.06, macroScaleM: 180.0 },
    waterBodies: {               // analytic shorelines used by the distance-to-water mask
      riverHalfWidth: 23.0,      // _river() ribbon baseWidth 46
      lake: { x: 885, z: 263, r: 295 },   // [v36] map layout
      plunge: { x: 300, z: -250, r: 50 },
      coastCurve: 0.00025,       // [v36] coastZ(x) = 980 - 0.00025 x^2
      riverBox: [-330, 380, -330],
      oceanLineZ: 980.0,         // WORLD.beachLineZ
      islands: [ { x: 860, z: 1190, r: 340 } ],
    },
  },

  scatter: {
    enabled: true,
    // Tree density field (also the forest-floor mask). fbm in [0,1], then soft exclusions.
    treeDensity: { freq: 0.0042, octaves: 3, bias: -0.12, gain: 1.35,
                   maxY: 1150.0, maxYFeather: 250.0, minNy: 0.66, nyFeather: 0.12,
                   waterClear: 10.0, waterFeather: 8.0, roadClear: 14.0, roadFeather: 10.0 },
    // Soft clearings around landmarks (radius, feather in m). Replaces hard "return null" boxes.
    // s = strength (1 = no trees inside r, 0.75 = thinned to 25%).
    clearings: [
      { x: 0, z: 200, r: 260, f: 140, s: 0.80 },  // open central valley floor (pastures), soft
      { x: 0, z: 20, r: 92, f: 30 },   { x: 0, z: 880, r: 130, f: 40 },  { x: 0, z: 440, r: 130, f: 40 },
      { x: 560, z: -540, r: 120, f: 35 }, { x: -480, z: -200, r: 110, f: 35 },
    ],
    corridors: [  // soft view corridors (axis-aligned boxes with feathered edges)
      { x0: -36, x1: 36, z0: -700, z1: -240, f: 20 },  { x0: -180, x1: 180, z0: -900, z1: -450, f: 30 },
      { x0: -22, x1: 22, z0: -240, z1: 320, f: 12 },   { x0: -52, x1: 52, z0: 760, z1: 1120, f: 20 },
    ],
    trees: { meadowShare: 0.12 },     // probability scale for lone trees on open meadow
    grass: {
      ring: true,                     // camera-centred dense grass ring
      radius: { high: 60, mid: 45 },  // m; fades out over the last fadeFrac of the radius
      fadeFrac: 0.35,
      spacing: { high: 0.55, mid: 0.80 },  // m between tuft slots (toroidal grid)
      updateBudgetMs: 2.0,            // CPU time per frame for re-seating slots
      teleportBudgetMs: 8.0,          // used while > 1/3 of the ring is stale (tour cuts); nearest slots are seated first
      meadowWeight: 1.0, forestWeight: 0.30, wetWeight: 0.15,    // density from ground weights
      tintFromTerrain: 0.85,          // 1 = blades exactly the terrain colour beneath
      tintLift: 1.10,                 // blades a little brighter than the soil-average albedo
      minScale: 0.7, maxScale: 1.35,
      hardSurfaces: [ { x: 0, z: 20, r: 68 }, { x: 0, z: 440, r: 30 } ],  // plaza, bridge abutments (m)
    },
    flowers: { patchFreq: 0.018, patchThreshold: 0.55, count: { high: 10000, mid: 3000 } },
  },
};

/** Recompute config.sun.direction from the angles (same math as WorldLighting). */
export function refreshSun() {
  const phi = THREE.MathUtils.degToRad(90 - config.sun.elevationDeg);
  const theta = THREE.MathUtils.degToRad(config.sun.azimuthDeg);
  config.sun.direction.setFromSphericalCoords(1, phi, theta).normalize();
  return config.sun.direction;
}

/** Copy of the current sun direction (toward the sun, unit length). */
export function getSunDirection(out = new THREE.Vector3()) {
  return out.copy(config.sun.direction);
}

refreshSun();
