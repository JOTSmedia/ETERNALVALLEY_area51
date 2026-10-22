import { blendAlpineTerrain, hasAlpineElevation } from './realism/alpineElevation.js?v=73';
// ============================================================
// SOMEWHERE OVER THE RAINBOW BRIDGE — World geometry & plots
// Single source of truth shared by the 3D engine, 2D map & UI.
// Coordinates: x = east(+), z = south(+). Gate sits at south (z≈900).
// The Rainbow River flows from Mirror Lake through the valley
// heart, crossed by the Rainbow Bridge on the Grand Boulevard.
// ============================================================

// ---------- Seeded RNG (deterministic world) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const WORLD_SEED = 20260707;

// ---------- Value noise ----------
function hash2(x, y) {
  // Fast bitwise hash to replace slow Math.sin
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296.0;
}
// C2 continuous quintic Hermite polynomial: zero 1st & 2nd derivative at grid borders (eliminates boxy creases)
function smooth(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 3) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); amp *= 0.5; f *= 2.1; }
  return v;
}
export function ridgeNoise(x, y, oct = 4) {
  let sum = 0, amp = 1.0, freq = 1.0, maxAmp = 0;
  for (let i = 0; i < oct; i++) {
    const n = Math.abs(noise2(x * freq, y * freq) - 0.5) * 2.0; // V-shaped sharp arêtes
    sum += (1.0 - n) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return sum / maxAmp;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function sstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return smooth(t); // C2 continuous quintic Hermite interpolation: 6t^5 - 15t^4 + 10t^3
}
function dist(x1, z1, x2, z2) { return Math.hypot(x1 - x2, z1 - z2); }

// ---------- Key world constants (50 km² Continuous Sanctuary Grid) ----------
export const WORLD_50SQKM = {
  size: 7071.07,                      // Exactly 50 km² (7071.07m x 7071.07m continuous grid)
  halfSize: 3535.53,
  oceanLevel: 0.35,
  beachLineZ: 980.0,                  // Mainland shoreline
  waterLevel: 12.5,                   // Mirror Lake & river level
  plungeLevel: 18.0,                  // Waterfall plunge pool level
  
  // Landmarks
  gate: { x: 0, z: 880, y: 8.5 },                         // On solid dry ground
  rainbowBridge: { x: 0, z: 440, y: 11.0, span: 48 },         // Pointed Gothic arch with spire
  treeOfLife: { x: 0, z: 80, y: 24.0, h: 35, r: 20 },         // Central Meadow
  plazaFountains: { x: 0, z: 20, r: 62 },
  
  // Western Navajo Realm
  alhambra: { x: -480, z: -200, y: 96.0 },
  phantasmTree: { x: -720, z: -340, y: 115.0, h: 14.0, r: 8.0 }, // 12-15m realistic scale
  
  // Eastern Zen Alpine Realm
  mirrorLake: { x: 430, z: -260, r: 295, y: 12.5 },
  pagoda: { x: 560, z: -540, y: 35.0, h: 35.0 },
  floatingTorii: { x: 380, z: -210, y: 12.5 },
  
  // Northern Alpine Crest
  waterfallPlunge: { x: 0, z: -550, y: 18.0, h: 182.0 },
  cathedral: { x: 0, z: -687, y: 182.0 },
  
  // Southern Offshore Archipelago (2.0 km Offshore)
  offshoreDistance: 2000.0,
  kayaIsland: { x: 20, z: 2980, y: 22.0, r: 340.0 },     // 980m (beach) + 2000m = 2980m
  huskyStatue: { x: 25, z: 2920, y: 24.0 },
  starlightTemple: { x: 20, z: 2980, y: 22.0, r: 22.0 }
};

export const WORLD = {
  ...WORLD_50SQKM,
  bridge: WORLD_50SQKM.rainbowBridge,
  lake: WORLD_50SQKM.mirrorLake,
  plaza: WORLD_50SQKM.plazaFountains,
  waterfall: { x: 0, z: -550 },
  panorama: { x: -600, z: -600 },
  pagoda: WORLD_50SQKM.pagoda,
  kaya: WORLD_50SQKM.kayaIsland,
  summit: { x: -520, z: -470 },
  island: WORLD_50SQKM.kayaIsland,
  buddhistTemple: WORLD_50SQKM.pagoda,
  mosque: WORLD_50SQKM.alhambra,
  templeOfBaal: { x: -110, z: 3040, y: 22.0 },
  jewishTemple: { x: -110, z: 3040, y: 22.0 },
};

// The Rainbow River System:
// 1. Inlet River: Mountain Waterfall Plunge Pool (x=0, z=-550, y=14.5) → Mirror Lake Shoreline (x=145, z=-326, y=12.5)
export const RIVER_INLET = [
  [0, -550, 14.5], [0, -450, 14.0], [0, -360, 13.5], [45, -350, 13.2], [95, -338, 12.8], [145, -326, 12.5]
];

// 2. Outlet River: Mirror Lake Shoreline (x=236, z=-38, y=12.5) → under Rainbow Bridge (x=0, z=440, y=11.0) → Eastern Coastal Gorge (x=165, z=918, y=7.8)
export const RIVER_OUTLET = [
  [236, -38, 12.5], [180, 160, 11.9], [90, 310, 11.5], [0, 440, 11.0],
  [65, 560, 10.4], [115, 680, 9.6], [145, 800, 8.8], [160, 875, 8.3], [165, 918, 7.8]
];

export const RIVER = RIVER_OUTLET; // for backward compatibility

export function distToRiver(x, z) {
  return getRiverInfo(x, z).dist;
}

export function riverWaterElevation(x, z) {
  return getRiverInfo(x, z).y;
}

// ---------- Majestic Glacial Cirque & Alpine Mountain Morphology ----------
export function _legacyHeight(x, z, bg) {
  const L = LEGACY_ANCHORS;
  const r = Math.hypot(x, z);

  // 1. Majestic Alpine Glacial Massif (Smooth Swiss Alpine morphology - zero Minecraft spikes)
  const massifMacro = fbm(x * 0.0012 + 15.0, z * 0.0012 + 15.0, 4);
  const alpineRidge = (1.0 - Math.abs(fbm(x * 0.0028 + 4.2, z * 0.0028 + 4.2, 4) - 0.5) * 2.0);
  const couloirErosion = Math.pow(Math.abs(fbm(x * 0.0050 + 3.1, z * 0.0050 + 3.1, 3) - 0.5) * 2.0, 1.5);
  
  // Natural rounded alpine massif domes surrounding the valley
  const domeWest = Math.exp(-Math.pow(dist(x, z, -720, -340) / 240, 2)) * 130;
  const domeEast = Math.exp(-Math.pow(dist(x, z, 680, -390) / 240, 2)) * 125;
  const domeNorthW = Math.exp(-Math.pow(dist(x, z, -220, -600) / 220, 2)) * 110;
  const domeNorthE = Math.exp(-Math.pow(dist(x, z, 220, -600) / 220, 2)) * 110;
  const domes = bg ? 0 : domeWest + domeEast + domeNorthW + domeNorthE;

  const hydraulicErosion = 0.45 + 0.65 * alpineRidge + 0.30 * massifMacro - 0.35 * couloirErosion;
  
  // Grand surrounding natural alpine massifs
  let mountains = sstep(540, 1300, r) * (180 + massifMacro * 140) * Math.max(0.15, hydraulicErosion) + domes;
  
  // 2. North Mountain Massif & Highland Cathedral Plateau (Solid bedrock backing — Zero gap behind waterfall!)
  if (bg) {
    // [EVR-04 relayout] generic northern massif for the new map layout (landmark terrain is pasted from regions)
    const ridgeN = (fbm(x * 0.004 + 12.0, z * 0.004 + 12.0, 4) - 0.45) * 45.0;
    const north = (24.0 + sstep(-220, -760, z) * 215.0 + ridgeN) * sstep(-150, -330, z) * (1.0 - sstep(1500, 2100, Math.abs(x - 200)));
    mountains = Math.max(mountains, north);
  } else if (z < -540) {
    // Headwall slope behind cataract from y=14.0m plunge basin at z=-550 up to y=182.0m plateau at z=-610
    // Sheer cliff drop right behind the waterfall!
    const headwallDrop = sstep(-550, -585, z);
    const headwallElevation = lerp(14.0, 182.0, headwallDrop);

    // High Alpine Plateau above waterfall (z <= -610, |x| < 320)
    let plateau = 184.5;
    if (z <= -585) {
      const plateauRoll = (fbm(x * 0.005 + 8.0, z * 0.005 + 8.0, 3) - 0.5) * 4.0;
      const cathedralTerrace = Math.exp(-Math.pow(dist(x, z, L.cathedral.x, L.cathedral.z) / 140, 2));
      plateau = 184.5 + plateauRoll * (1.0 - cathedralTerrace * 0.98);
    }

    // Surrounding high mountain crests on northern perimeter
    const ridgeNoise = (fbm(x * 0.004 + 12.0, z * 0.004 + 12.0, 4) - 0.45) * 45.0;
    const cirqueElevation = 24.0 + sstep(-540, -740, z) * 215.0 + ridgeNoise;


    const headwallTerrain = (z <= -585) ? plateau : headwallElevation;
    
    // GRAND CANYON / DESERT EXPANSION
    // Behind the cathedral (z < -750), the plateau fractures into a colossal red-rock canyon system
    let finalHeadwall = headwallTerrain;
    if (z <= -750) {
      const canyonT = Math.min(1.0, (-750 - z) / 200.0);
      // Carve a deep meandering canyon gorge using noise
      const gorgeNoise = (fbm(x * 0.003, z * 0.003, 5) - 0.5) * 2.0;
      // Main canyon fissure along x axis
      const fissure = Math.abs(x + gorgeNoise * 400.0);
      if (fissure < 250) {
        const drop = Math.max(0.0, 1.0 - Math.pow(fissure / 250.0, 0.4));
        finalHeadwall -= drop * 140.0 * canyonT;
      }
      
      // Add mesa plateaus and buttes
      const buttes = Math.max(0.0, fbm(x * 0.008 + 44.0, z * 0.008 + 44.0, 4) - 0.6) * 120.0;
      finalHeadwall += buttes * canyonT;
    }
    
    // Wider notch (72m from center = 144m opening) so waterfall is visible from all angles

    const notchMask = sstep(72, 280, Math.abs(x));
    mountains = Math.max(mountains, lerp(headwallTerrain, cirqueElevation, notchMask));
  }

  const zz = bg ? z + (980 - coastZ(x)) : z;   // [EVR-04] coast-relative south profile
  if (bg) {
    mountains *= 1.0 - sstep(-260, 120, z) * (1.0 - sstep(1350, 1900, Math.abs(x)));
    if (zz > 880) mountains *= Math.max(0, 1.0 - (zz - 880) / 200);
  } else if (z > 60 && z <= 915) {
    const passFactor = sstep(120, 360, Math.abs(x));
    mountains *= (0.01 + 0.99 * passFactor);
  } else if (z > 915) {
    const flankFactor = sstep(380, 580, Math.abs(x - 30));
    const oceanDistTaper = Math.max(0, 1.0 - (z - 880) / 340);
    mountains *= flankFactor * oceanDistTaper;
  }

  // NW Highlands for Summit Rest (High alpine terraces overlooking the lake)
  const hl = Math.exp(-Math.pow(dist(x, z, L.summit.x, L.summit.z) / 340, 2)) * 75;

  // Soft rolling valley meadows (serene pasture undulations)
  const terrace = Math.sin(fbm(x * 0.0026, z * 0.0026, 3) * Math.PI * 4) * 2.2;
  let rolling = (fbm(x * 0.0028 + 5, z * 0.0028 + 5, 3) - 0.5) * 4.5 + terrace;
  if (x < -220 && z > 180) rolling += (fbm(x * 0.010, z * 0.010, 2) - 0.5) * 4.0;
  if (zz > 915) rolling *= Math.max(0, 1.0 - (zz - 915) / 40.0);

  // Dampen rolling hills along the Grand Boulevard and river gorge corridor
  const avenueProximity = Math.abs(x);
  if (avenueProximity < 85 && z >= 20 && z <= 915) {
    const avenueDamp = sstep(18, 85, avenueProximity);
    rolling *= avenueDamp;
  }


  // Base valley floor elevation
  let baseValley = 18.5;

  // Grand Canyon / Desert Badlands Expansion (Far North behind Cathedral z < -650)
  if (!bg && z < -650) {
     const canyonMask = sstep(-650, -850, z);
     // Carve deep ravines
     const canyonNoise = ridgeNoise(x * 0.004, z * 0.004, 5);
     const canyonDepth = lerp(0, 320 * canyonNoise, canyonMask);
     
     // Add flat mesas
     const mesaNoise = fbm(x*0.008, z*0.008, 3);
     if (mesaNoise > 0.6) {
       mountains = lerp(mountains, 250, sstep(0.6, 0.7, mesaNoise) * canyonMask); 
     } else {
       mountains -= canyonDepth;
     }
  }

  if (zz > 20 && zz <= 915) {
    if (zz >= 500) {
      baseValley = 26.0 + ((zz - 500) / 380) * 6.0;
    } else if (zz >= 380) {
      const bt = (zz - 380) / 120;
      baseValley = 21.0 * (1 - bt) + 26.0 * bt;
    } else {
      baseValley = 18.5 + ((zz - 20) / 360) * 2.5;
    }
  }

  // Coastal Beach & 2km Offshore Ocean Bathymetry (Mainland shoreline at z = 980m)
  if (zz >= 880) {
    if (zz <= 980) {
      // Natural white-gold sand beach sloping from Grand Gate shelf (y = 8.5m at z = 880) to ocean surf (y = 0.35m at z = 980)
      const beachFrac = (zz - 880) / 100.0;
      const beachProfile = lerp(8.5, 0.35, sstep(0.0, 1.0, beachFrac));
      baseValley = beachProfile;
    } else {
      // Unbroken deep turquoise open ocean separation (2.0 km wide: z = 980m to z = 2980m)
      // Shelf drops into submerged oceanic trench bathymetry down to y = -42.0m
      const oceanDepthFrac = sstep(980, 1380, zz);
      const trenchNoise = (fbm(x * 0.003 + 2.0, z * 0.003 + 2.0, 3) - 0.5) * 6.0;
      const seaFloor = lerp(-12.0, -42.0 + trenchNoise, oceanDepthFrac);
      baseValley = seaFloor;
    }
  }

  // Combine initial macro terrain
  let h = mountains + hl + rolling + baseValley;

  // Dedicated Carved Riverbed Channels (Inlet and Outlet rivers sit inside deep natural troughs)
  const riverInfo = _riverInfo(x, z, OLD_RIVERS);
  if (!bg && riverInfo.dist < 45.0 && z > -550 && z < 915) {
    const channelWidth = (z > 200) ? 38.0 : 30.0;
    if (riverInfo.dist < channelWidth) {
      const channelMask = Math.cos((riverInfo.dist / channelWidth) * Math.PI * 0.5);
      const targetRiverBed = riverInfo.y - 12.0; // 12.0m deep natural river canyon
      h = Math.min(h, lerp(h, targetRiverBed, channelMask * 0.94));
    }
  }

  // Central Plaza Terrace (x=0, z=20, r=64) - level firm foundation at y=18.5m
  const dPlaza = dist(x, z, L.plaza.x, L.plaza.z);
  if (dPlaza < 76.0) {
    const plazaWeight = sstep(76.0, 52.0, dPlaza);
    h = lerp(h, 18.5, plazaWeight * 0.96);
  }

  // Mirror Lake glacial tarn basin (Center 430, -260, r=295, waterLevel=12.5)
  const dl = dist(x, z, L.lake.x, L.lake.z);
  if (!bg && dl < L.lake.r + 35) {
    const lakeBedTarget = -100.0; // 37.5m deep crystal clear lake basin beneath 12.5m water surface
    const shoreBlend = sstep(L.lake.r - 35, L.lake.r + 35, dl);
    h = lerp(lakeBedTarget, h, shoreBlend);
  }

  // Mountain Waterfall Plunge Pool Basin at (x=0, z=-550, waterLevel=14.5
  const dPlunge = Math.hypot(x, z - (-550));
  if (!bg && dPlunge < 72.0) {
    const poolBedTarget = -84.5; // 33.0m deep churning plunge basin beneath 14.5m water surface
    const poolShoreBlend = sstep(28.0, 72.0, dPlunge);
    h = lerp(poolBedTarget, h, poolShoreBlend);
  }

  // 1. High Alpine Plateau for Highland Sanctuary & Universal Cathedral (z <= -610, |x| < 260)
  if (!bg && z <= -610 && z >= -980 && Math.abs(x) < 260) {
    const plateauEdge = (1.0 - sstep(160, 260, Math.abs(x))) * (1.0 - sstep(-1050, -1130, z));
    const roll = (fbm(x * 0.008 + 8.0, z * 0.008 + 8.0, 2) - 0.5) * 3.5;
    const catTerrace = Math.exp(-Math.pow(dist(x, z, L.cathedral.x, L.cathedral.z) / 100, 2));
    
    // Tarn basin removed (was at z=-515), plateau extends solidly
    const targetH = 184.5 + roll * (1.0 - catTerrace * 0.98);
    h = lerp(h, targetH, plateauEdge * 0.98);
  }

  // Waterfall gorge channel — MUST run AFTER plateau carve to cut through it
  // Carves a deep, wide parabolic couloir from cliff lip (z=-610) down to plunge pool (z=-340)
  if (!bg && Math.abs(x) < 72 && z <= -340 && z >= -610) {
    const gorgeMask = sstep(72.0, 26.0, Math.abs(x));
    let gorgeBedY;
    if (z <= -600) {
      const t = clamp((z - (-610)) / 10.0, 0.0, 1.0);
      gorgeBedY = lerp(158.0, 154.0, t);
    } else {
      const u = clamp((-358 - z) / 242.0, 0.0, 1.0);
      gorgeBedY = 4.5 + Math.pow(u, 1.25) * 153.5 - 3.5;
    }
    h = Math.min(h, lerp(h, gorgeBedY, gorgeMask));
  }

  // 2. Eastern Mountain Sanctuary: Buddhist Zen Pagoda Terrace (x=560, z=-540, y=135m)
  const dEastTemple = dist(x, z, L.buddhistTemple.x, L.buddhistTemple.z);
  if (!bg && dEastTemple < 85) {
    const tWeight = sstep(85, 30, dEastTemple);
    h = lerp(h, L.buddhistTemple.y, tWeight * 0.96);
  }

  // 3. Western Mountain Sanctuary: Moorish Mosque Terrace (x=-480, z=-200, y=96m)
  const dWestMosque = dist(x, z, L.mosque.x, L.mosque.z);
  if (!bg && dWestMosque < 85) {
    const mWeight = sstep(85, 30, dWestMosque);
    h = lerp(h, L.mosque.y, mWeight * 0.96);
  }

  // 3b. Western High Mesa Plateau: Desert Phantasm Tree & Sun-Kiva Terrace (x=-720, z=-340, y=115m)
  const dPhantasm = dist(x, z, L.phantasmTree.x, L.phantasmTree.z);
  if (!bg && dPhantasm < 95) {
    const pWeight = sstep(95, 35, dPhantasm);
    h = lerp(h, L.phantasmTree.y, pWeight * 0.98);
  }


  // 4. KAYA ISLAND: 2.0 KM OFFSHORE ISOLATED SANCTUARY (Center: x = 20, z = 2980, y = 22.0m, r = 340m)
  // Net separation: Exactly 2,000m of unbroken open ocean from mainland shoreline (z = 980m) to island center (z = 2980m).
  // 360° Open Sea Isolation: Completely detached and surrounded on all sides by open water.
  if (!bg && z >= 2400 && z <= 3535.5) {
    // Elliptical main island body (Radius ~340m)
    const islandDistNorm = Math.hypot((x - L.kayaIsland.x) / 340, (z - L.kayaIsland.z) / 320);

    // 4-5 Satellite Sea Stacks & Natural Arches in the Archipelago
    const sat1 = Math.hypot((x - 350) / 75, (z - 3050) / 65);
    const sat2 = Math.hypot((x - -320) / 65, (z - 2850) / 75);
    const sat3 = Math.hypot((x - -100) / 80, (z - 3250) / 70);
    const sat4 = Math.hypot((x - 280) / 65, (z - 3200) / 60);
    const satMin = Math.min(sat1, sat2, sat3, sat4);

    if (islandDistNorm < 1.15) {
      // Towering white limestone cliffs rising 22m sheer from open ocean
      const cliffLip = sstep(1.08, 0.88, islandDistNorm);
      const islandPlateau = lerp(0.35, 22.0, cliffLip);
      const knolls = (fbm(x * 0.008 + 14.2, z * 0.008 + 14.2, 3) - 0.5) * 4.5;
      
      // Central Starlight Temple Monopteros Rotunda Summit (x = 20, z = 2980, y = 22.0m)
      const dTemple = dist(x, z, L.starlightTemple.x, L.starlightTemple.z);
      const templeTerrace = Math.exp(-Math.pow(dTemple / 65, 2)) * 2.5;

      // Siberian Husky Monument Cliff Edge Promontory (x = 25, z = 2920, y = 24.0m)
      const dHusky = dist(x, z, L.huskyStatue.x, L.huskyStatue.z);
      const huskyCliffPlinth = Math.exp(-Math.pow(dHusky / 45, 2)) * 3.5;

      let elevation = islandPlateau + knolls * cliffLip + templeTerrace + huskyCliffPlinth;

      // Flatten foundations
      if (dTemple < 24) {
        elevation = lerp(elevation, L.starlightTemple.y, sstep(24, 18, dTemple));
      }
      if (dHusky < 20) {
        elevation = lerp(elevation, L.huskyStatue.y, sstep(20, 14, dHusky));
      }

      h = Math.max(h, elevation);

      // Submerged Bioluminescent Coral Reef Lagoon surrounding the island (depth -8m to -15m)
      if (islandDistNorm >= 0.92 && islandDistNorm <= 1.25) {
        const lagoonT = Math.sin(clamp((islandDistNorm - 0.92) / (1.25 - 0.92), 0, 1) * Math.PI);
        const lagoonBed = -11.5 + (fbm(x * 0.015, z * 0.015, 2) - 0.5) * 3.5;
        if (h < 0.35) {
          h = lerp(h, lagoonBed, lagoonT * 0.85);
        }
      }
    }

    // Satellite Sea Stacks
    if (satMin < 1.0) {
      const stackHeight = 16.0 + (fbm(x * 0.02, z * 0.02, 2) - 0.5) * 6.0;
      const stackShape = Math.cos(satMin * Math.PI * 0.5);
      const stackElev = stackShape * stackHeight;
      h = Math.max(h, stackElev);
    }
  }

  // Grand Boulevard Corridor & River Canyon Grading
  if (z >= 20 && z <= 915) {
    const roadDist = Math.abs(x);
    if (roadDist < 65) {
      const rf = sstep(65, 18, roadDist);
      if (z >= 500) {
        // Slopes gently down from Meadow/Bridge level (~24m) to Grand Gate dry-land shelf (8.5m at z=880)
        const targetSouthRoad = lerp(24.0, 8.5, clamp((z - 500) / 380.0, 0, 1));
        const roadBlend = lerp(0.85, 1.0, sstep(540, 500, z));
        h = lerp(h, targetSouthRoad, rf * roadBlend);
      } else if (z <= 380) {
        const targetNorthRoad = 18.5 + ((z - 20) / 360) * 3.15;
        const roadBlend = lerp(0.85, 1.0, sstep(340, 380, z));
        h = lerp(h, targetNorthRoad, rf * roadBlend);
      } else {
        // Across the Rainbow Bridge span (z = 380..500):
        // Solid rock abutment shelves perfectly aligning to 21.65 and 24.0
        if (z <= 400) {
          const abWeight = sstep(400, 380, z);
          h = lerp(h, 21.65, abWeight * rf);
        } else if (z >= 480) {
          const abWeight = sstep(480, 500, z);
          h = lerp(h, 24.0, abWeight * rf);
        }
      }
    }
  }

  // Grand Gate Entrance Plaza Terrace (z = 840..915, |x| < 120):
  // Perfectly level and firm dry-land stone plaza terrace at y = 8.5m for the Grand Gate
  if (z >= 840 && z <= 915 && Math.abs(x) < 120) {
    const gateTerraceWeight = sstep(120, 60, Math.abs(x)) * sstep(840, 860, z) * sstep(915, 895, z);
    h = lerp(h, L.gate.y, gateTerraceWeight * 0.95);
  }

  // Continuous River Channel Carving (Guarantees 100% unbroken water flow and open canyon under bridge)
  const { dist: dRiver, y: rWaterY } = _riverInfo(x, z, OLD_RIVERS);
  if (!bg && dRiver < 42.0 && z > -370 && z <= 980) {
    const channelBed = rWaterY - 4.5;
    const bankWeight = sstep(16.0, 42.0, dRiver);
    h = Math.min(h, lerp(channelBed, h, bankWeight));
  }

  return h;
}


function _isUnderWaterOld(x, z) {
  const L = LEGACY_ANCHORS;
  let waterY = L.waterLevel;
  if (z <= -450 && z >= -635 && Math.abs(x) <= 65) waterY = 182.0;
  else if (Math.hypot(x, z - (-550)) < 70) waterY = L.plungeLevel || 18.0;
  else if (z >= 980) waterY = L.oceanLevel || 0.35;
  else {
    const rInfo = _riverInfo(x, z, OLD_RIVERS);
    if (rInfo.dist < 36.0 && z > -550 && z <= 980) waterY = rInfo.y;
  }
  return _legacyHeight(x, z, false) < waterY;
}



// ============================================================
// [EVR-04 v36 relayout] World re-laid out to images/photoreal/eternal_valley_master_layout_map.jpg
// (1 map px ~ 3.16 m, plaza = origin, north = -z). Landmark terrain is NOT re-authored: each landmark's
// v35 terrain patch is pasted at its new map position (REGIONS), on top of a new background (coast arc,
// northern massif, open south valley). Landmark builders run once in "legacy layout" (v35 anchors, v35
// terrain, v35 rivers) and their objects are then translated by the region delta (WorldCore.initAsync),
// so every landmark keeps its exact shape and ground contact. See v36/_PROGRESS.md.
// ============================================================
export function coastZ(x) { return 980.0 - 0.00025 * x * x; }   // map coast arc (gate cove unchanged at x = 0)

export const REGIONS = [   // priority order; o = v35 centre, n = map centre; r/b disc, hx/hz box; b = blend (m)
  { key: 'pagoda',    o: [560, -540],  n: [1200, 190],  r: 85,  b: 45, dy: -10 },
  { key: 'mosque',    o: [-480, -200], n: [-850, 216],  r: 88,  b: 45, dy: -74 },
  { key: 'phantasm',  o: [-720, -340], n: [-930, -620], r: 42,  b: 38, dy: 62 },   // [v36 polish] mesa top only (was r95: the v35 crater walls read as folded sheets)
  { key: 'cathedral', o: [0, -687],    n: [700, -860],  r: 150, b: 70, dy: 80 },
  { key: 'falls',     o: [0, -560],    n: [300, -260],  hx: 260, hz: 240, b: 80 },
  { key: 'lake',      o: [430, -260],  n: [885, 263],   r: 330, b: 50 },
  { key: 'canyon',    o: [0, -1250],   n: [-1000, -560], hx: 480, hz: 330, b: 200, soft: true },  // [v36 polish] low-passed + relief x0.45, wider blend
  { key: 'kaya',      o: [20, 2980],   n: [860, 1190],  r: 470, b: 60, island: true },
];
for (const R of REGIONS) { R.d = [R.n[0] - R.o[0], R.n[1] - R.o[1]]; R.dy = R.dy || 0; }
export const REGION = Object.fromEntries(REGIONS.map((R) => [R.key, R]));
function _regionW(R, x, z, c) {   // weight 0..1 of point (x,z) in region R around centre c
  if (R.r) return sstep(R.r + R.b, R.r, dist(x, z, c[0], c[1]));
  return sstep(R.hx, R.hx - R.b, Math.abs(x - c[0])) * sstep(R.hz, R.hz - R.b, Math.abs(z - c[1]));
}
/** v35 (old) coordinates -> the region they belong to (or null). */
export function regionOfOld(x, z, minW = 0.001) {
  for (const R of REGIONS) if (_regionW(R, x, z, R.o) > minW) return R;
  return null;
}
/** Map a v35 world point to its v36 position (unchanged outside every region). */
export function relocatePoint(x, z) {
  const R = regionOfOld(x, z);
  return R ? [x + R.d[0], z + R.d[1], R.key] : [x, z, null];
}

// v35 anchors / rivers, used while a landmark builder runs in legacy layout
export const LEGACY_ANCHORS = JSON.parse(JSON.stringify(WORLD_50SQKM));
Object.assign(LEGACY_ANCHORS, { summit: { x: -520, z: -470 } });
LEGACY_ANCHORS.plaza = LEGACY_ANCHORS.plazaFountains; LEGACY_ANCHORS.lake = LEGACY_ANCHORS.mirrorLake;
LEGACY_ANCHORS.buddhistTemple = LEGACY_ANCHORS.pagoda; LEGACY_ANCHORS.mosque = LEGACY_ANCHORS.alhambra;
const OLD_RIVERS = [RIVER_INLET.map((p) => p.slice()), RIVER_OUTLET.map((p) => p.slice())];
// v36 map river: plunge pool -> past the plaza's west side -> under the Rainbow Bridge -> v35 lower course to the cove
const NEW_INLET = [
  [300, -250, 14.5], [300, -150, 14.2], [300, -60, 14.0], [190, -105, 13.6], [30, -140, 13.2], [-140, -110, 12.8],
  [-235, 0, 12.4], [-250, 150, 12.0], [-185, 300, 11.6], [-80, 400, 11.2], [0, 440, 11.0],
];
const NEW_OUTLET = [[0, 440, 11.0], [65, 560, 10.4], [115, 680, 9.6], [145, 800, 8.8], [160, 875, 8.3], [165, 918, 7.8]];
function _setArr(dst, src) { dst.length = 0; for (const p of src) dst.push(p.slice()); }
function _riverInfo(x, z, branches) {
  let bestDist = Infinity, bestY = 12.5;
  for (const branch of branches) {
    for (let i = 0; i < branch.length - 1; i++) {
      const [x1, z1, y1] = branch[i], [x2, z2, y2] = branch[i + 1];
      const dx = x2 - x1, dz = z2 - z1, lenSq = dx * dx + dz * dz;
      const t = lenSq > 0 ? clamp(((x - x1) * dx + (z - z1) * dz) / lenSq, 0, 1) : 0;
      const d = Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
      if (d < bestDist) { bestDist = d; bestY = y1 + (y2 - y1) * t; }
    }
  }
  return { dist: bestDist, y: bestY };
}
const _ANCHOR_KEYS = ['gate', 'rainbowBridge', 'treeOfLife', 'plazaFountains', 'alhambra', 'phantasmTree', 'mirrorLake', 'pagoda',
  'floatingTorii', 'waterfallPlunge', 'cathedral', 'kayaIsland', 'huskyStatue', 'starlightTemple'];
const _WORLD_KEYS = { waterfall: 'falls', summit: null, templeOfBaal: 'kaya', jewishTemple: 'kaya' };
export const NEW_ANCHORS = {};
let _legacy = false;
export function isLegacyLayout() { return _legacy; }
/** Swap WORLD anchors + river polylines to v35 (true) or v36 map layout (false). Objects are mutated in place. */
export function setLegacyLayout(on) {
  on = !!on; if (on === _legacy) return; _legacy = on;
  for (const k of _ANCHOR_KEYS) Object.assign(WORLD_50SQKM[k], on ? LEGACY_ANCHORS[k] : NEW_ANCHORS[k]);
  for (const k of Object.keys(_WORLD_KEYS)) Object.assign(WORLD[k], on ? NEW_ANCHORS['_old_' + k] : NEW_ANCHORS['_new_' + k]);
  _setArr(RIVER_INLET, on ? OLD_RIVERS[0] : NEW_INLET); _setArr(RIVER_OUTLET, on ? OLD_RIVERS[1] : NEW_OUTLET);
}
function _initNewLayout() {
  const mv = (o, key) => { if (!o) return o; const R = REGION[key]; const r = { ...o, x: o.x + R.d[0], z: o.z + R.d[1] }; if (typeof o.y === 'number') r.y = o.y + R.dy; return r; };
  const A = LEGACY_ANCHORS, N = NEW_ANCHORS;
  for (const k of _ANCHOR_KEYS) N[k] = { ...A[k] };
  N.alhambra = { ...mv(A.alhambra, 'mosque') };
  N.phantasmTree = mv(A.phantasmTree, 'phantasm');
  N.mirrorLake = mv(A.mirrorLake, 'lake'); N.floatingTorii = mv(A.floatingTorii, 'lake');
  N.pagoda = mv(A.pagoda, 'pagoda');
  N.waterfallPlunge = mv(A.waterfallPlunge, 'falls');
  N.cathedral = mv(A.cathedral, 'cathedral');
  N.kayaIsland = mv(A.kayaIsland, 'kaya'); N.huskyStatue = mv(A.huskyStatue, 'kaya'); N.starlightTemple = mv(A.starlightTemple, 'kaya');
  for (const [k, reg] of Object.entries(_WORLD_KEYS)) {
    N['_old_' + k] = { ...WORLD[k] };
    N['_new_' + k] = reg ? mv(WORLD[k], reg) : { ...WORLD[k] };
  }
  for (const k of _ANCHOR_KEYS) Object.assign(WORLD_50SQKM[k], N[k]);
  for (const k of Object.keys(_WORLD_KEYS)) Object.assign(WORLD[k], N['_new_' + k]);
  _setArr(RIVER_INLET, NEW_INLET); _setArr(RIVER_OUTLET, NEW_OUTLET);
}

_initNewLayout();
export function getRiverInfo(x, z) { return _riverInfo(x, z, [RIVER_INLET, RIVER_OUTLET]); }

// [v36 polish] tamed v35 canyon: 5-tap low-pass (35 m) and relief compressed toward 95 m, so steep v35 walls don't fold on the coarse far mesh
function _softCanyon(x, z) {
  const o = 35;
  const m = (_legacyHeight(x, z, false) * 2 + _legacyHeight(x + o, z, false) + _legacyHeight(x - o, z, false) + _legacyHeight(x, z + o, false) + _legacyHeight(x, z - o, false)) / 6;
  return 165 + (m - 95) * 0.45;
}
function _layoutHeight(x, z) {
  let h = _legacyHeight(x, z, true);
  for (let i = REGIONS.length - 1; i >= 0; i--) {   // lowest priority first, so higher priority overrides
    const R = REGIONS[i];
    const w = _regionW(R, x, z, R.n);
    if (w <= 0) continue;
    const hO = (R.soft ? _softCanyon(x - R.d[0], z - R.d[1]) : _legacyHeight(x - R.d[0], z - R.d[1], false)) + R.dy;
    if (R.island) h = h > 1.0 ? Math.max(h, hO * w + h * (1 - w)) : lerp(h, hO, w);
    else h = lerp(h, hO, w);
  }
  // v36 Kaya Causeway embankment (coast -> island), top 2.6 m, 8 m crown, 18 m toe
  const cd = _causewayDist(x, z);
  if (cd < 18.0) { const top = 2.6 - 5.0 * sstep(4.0, 18.0, cd); if (h < top) h = top; }
  // v36 river channel (same two-stage carve as v35), skipped inside the pasted falls block (already carved there)
  const fw = _regionW(REGION.falls, x, z, REGION.falls.n);
  const ri = getRiverInfo(x, z);
  if (ri.dist < 45.0 && fw < 0.99) {
    let hc = h;
    const cw = 34.0;
    if (ri.dist < cw) hc = Math.min(hc, lerp(hc, ri.y - 12.0, Math.cos((ri.dist / cw) * Math.PI * 0.5) * 0.94));
    if (ri.dist < 42.0) hc = Math.min(hc, lerp(ri.y - 4.5, hc, sstep(16.0, 42.0, ri.dist)));
    h = lerp(hc, h, fw);
  }
  return h;
}

const CAUSEWAY = [[520, 850], [600, 930], [700, 1015]];
function _causewayDist(x, z) {
  let d = 1e9;
  for (let i = 0; i < CAUSEWAY.length - 1; i++) {
    const [ax, az] = CAUSEWAY[i], [bx, bz] = CAUSEWAY[i + 1];
    const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}
export const KAYA_CAUSEWAY = CAUSEWAY;
export function terrainHeightBase(x, z) { return _legacy ? _legacyHeight(x, z, false) : blendAlpineTerrain(x,z,_layoutHeight(x,z)); }
export function terrainHeight(x, z) { return terrainHeightBase(x, z); }

export function isUnderWater(x, z) {
  if (_legacy) return _isUnderWaterOld(x, z);
  if (_causewayDist(x, z) < 6.0) return false;
  for (const R of REGIONS) {
    if (_regionW(R, x, z, R.n) > 0.5 && R.key !== 'canyon') return _isUnderWaterOld(x - R.d[0], z - R.d[1]);
  }
  let waterY = WORLD.waterLevel;
  if (z >= coastZ(x)) waterY = WORLD_50SQKM.oceanLevel || 0.35;
  else { const ri = getRiverInfo(x, z); if (ri.dist < 36.0) waterY = ri.y; }
  return terrainHeight(x, z) < waterY;
}

// ---------- Monumental Distant Alpine Mountain Ring Massif (R = 2200m - 5300m, y = 650m - 1450m) ----------
export function backgroundMountainElevation(x, z) {
  if (hasAlpineElevation()) return terrainHeight(x,z);
  const r = Math.hypot(x, z);
  if (r < 2100 || r > 5500) return 0;

  const RING_INNER = 2200, RING_OUTER = 5300;
  const tNorm = clamp((r - RING_INNER) / (RING_OUTER - RING_INNER), 0, 1);
  
  // Smooth asymmetric bell-curve radial envelope:
  // Starts at r=2200m, surges upwards towards peak alpine massif spine at r=3100m..4400m, then tapers smoothly at r=5300m
  const radialEnvelope = Math.pow(Math.sin(tNorm * Math.PI), 0.72);

  // Directional modulation:
  // North, East, NW, and NE form titanic towering alpine mountain ranges rising up to 1450m;
  // South/SE/SW sector (z > 250) cascades into dramatic maritime alpine fjords and coastal cliffs framing the ocean
  let dirWeight = 1.0;
  if (z > 250) {
    const southFactor = Math.min(1.0, (z - 250) / 730);
    const angleFromSouth = Math.abs(Math.atan2(x, z));
    const oceanGap = Math.max(0, 1.0 - angleFromSouth / 0.95);
    dirWeight = lerp(1.0, 0.22, southFactor * (0.42 + 0.58 * oceanGap));
    if (z > 980) {
      // 360° Open Sea Isolation: Clear all mountains in the southern ocean corridor so Kaya Island is completely surrounded by open water
      const oceanClearance = sstep(980, 1150, z);
      const lateralGap = Math.max(0, 1.0 - Math.abs(x) / 2400.0);
      dirWeight *= (1.0 - oceanClearance * lateralGap);
    }
  }

  // 1. Multi-Octave Sharp Alpine Arêtes (Matterhorn / Grand Teton razor crests)
  const r1 = Math.pow(ridgeNoise(x * 0.00078, z * 0.00078, 6), 2.35) * 940;
  const r2 = Math.pow(ridgeNoise(x * 0.0019 + 11.2, z * 0.0019 + 11.2, 5), 1.85) * 440;
  const r3 = Math.pow(ridgeNoise(x * 0.0042 + 23.7, z * 0.0042 + 23.7, 4), 1.4) * 180;
  const r4 = ridgeNoise(x * 0.0092 + 37.1, z * 0.0092 + 37.1, 3) * 65;

  // 2. Glacial Couloirs & Hydraulic Runoff Erosion Chutes
  const couloir1 = Math.pow(Math.abs(fbm(x * 0.0024 + 7.5, z * 0.0024 + 7.5, 4) - 0.5) * 2.0, 1.85);
  const couloir2 = Math.pow(Math.abs(fbm(x * 0.0065 + 18.2, z * 0.0065 + 18.2, 3) - 0.5) * 2.0, 1.5);
  const erosionFactor = Math.max(0.22, 1.0 - (couloir1 * 0.38 + couloir2 * 0.18));

  // 3. Macro Tectonic Massif Uplift & Cirque Swelling
  const macroTectonic = (fbm(x * 0.00038 + 19.4, z * 0.00038 + 19.4, 4) - 0.36) * 420;

  // 4. Iconic Monumental Alpine Horns, Pyramidal Massifs & Needle Spires
  // NW Matterhorn Pyramidal Horn (x=-1650, z=-3350)
  const hornMatterhorn = Math.exp(-Math.pow(dist(x, z, -1650, -3350) / 460, 2)) * 640;
  // N Grand Teton Cathedral Spire (x=1680, z=-3550)
  const hornGrandTeton = Math.exp(-Math.pow(dist(x, z, 1680, -3550) / 480, 2)) * 680;
  // NNW Mont Blanc Dome & Massif (x=-3450, z=-1450)
  const hornMontBlanc  = Math.exp(-Math.pow(dist(x, z, -3450, -1450) / 520, 2)) * 620;
  // NNE Jungfrau Summit (x=3650, z=-1350)
  const hornJungfrau   = Math.exp(-Math.pow(dist(x, z, 3650, -1350) / 500, 2)) * 590;
  // NE Eiger North Wall (x=2800, z=-2800)
  const hornEigerNorth = Math.exp(-Math.pow(dist(x, z, 2800, -2800) / 450, 2)) * 560;
  // N Monte Rosa Summit (x=-550, z=-4200)
  const hornMonteRosa  = Math.exp(-Math.pow(dist(x, z, -550, -4200) / 510, 2)) * 720;
  // W Monte Cristallo Towers (x=-3800, z=450)
  const hornCristallo  = Math.exp(-Math.pow(dist(x, z, -3800, 450) / 460, 2)) * 510;
  // E Dolomite Spires (x=3900, z=550)
  const hornDolomites  = Math.exp(-Math.pow(dist(x, z, 3900, 550) / 470, 2)) * 530;
  // NW Weisshorn Sharp Arête Horn (x=-2700, z=-3900)
  const hornWeisshorn  = Math.exp(-Math.pow(dist(x, z, -2700, -3900) / 440, 2)) * 580;

  const monumentalPeaks = hornMatterhorn + hornGrandTeton + hornMontBlanc + hornJungfrau +
                          hornEigerNorth + hornMonteRosa + hornCristallo + hornDolomites + hornWeisshorn;

  const baseElevation = 540 * dirWeight;
  const ruggedSpine = (r1 + r2 + r3 + r4 + macroTectonic) * erosionFactor * dirWeight;
  const totalH = (baseElevation + ruggedSpine + monumentalPeaks * dirWeight) * radialEnvelope;

  // Seamless boundary blending with the inner valley terrain at r=2200m
  const innerBlend = Math.max(30.0 * (1.0 - tNorm), totalH);
  return innerBlend;
}

// Master terrain color palette tokens
export const TERRAIN_COLORS = {
  fescueBase: '#2e5c1e',      // Deep rich fescue base tone
  fescueSunlit: '#4a882a',    // Sunlit blade crest tone
  fescueSoil: '#183410',      // Shaded loam & soil hollows
  graniteCliff: '#565e68',    // Weathered slate grey granite bedrock
  graniteCrest: '#6e7682',    // Sunlit granite crest
  screeTalus: '#766e62',      // Scree and talus slopes (warm alpine moraine soil)
  forestConifer: '#22361e',   // Subalpine forest belt (deep conifer green)
  glacialIceCore: '#78a8cc',  // Glacial ice-blue shadow tone
  alpineSnow: '#dce6f0',      // Soft firn snow crest
  ironOxide: '#8e5e2e',       // Mineral iron oxide fracture stains
};

/**
 * Dual-radius baked terrain crevice ambient occlusion calculation.
 * Accurately darkens valleys, couloirs, ravines, and steep cliff faces.
 */
export function computeTerrainCreviceAO(x, z, h = terrainHeight(x, z), slope = 1.0) {
  const epsFine = 2.0;
  const avgFine = (
    terrainHeight(x, z - epsFine) + terrainHeight(x, z + epsFine) +
    terrainHeight(x - epsFine, z) + terrainHeight(x + epsFine, z) +
    terrainHeight(x - epsFine * 0.707, z - epsFine * 0.707) + terrainHeight(x + epsFine * 0.707, z - epsFine * 0.707) +
    terrainHeight(x - epsFine * 0.707, z + epsFine * 0.707) + terrainHeight(x + epsFine * 0.707, z + epsFine * 0.707)
  ) * 0.125;
  const concavityFine = Math.max(0.0, avgFine - h);

  const epsMacro = 10.0;
  const avgMacro = (
    terrainHeight(x, z - epsMacro) + terrainHeight(x, z + epsMacro) +
    terrainHeight(x - epsMacro, z) + terrainHeight(x + epsMacro, z) +
    terrainHeight(x - epsMacro * 0.707, z - epsMacro * 0.707) + terrainHeight(x + epsMacro * 0.707, z - epsMacro * 0.707) +
    terrainHeight(x - epsMacro * 0.707, z + epsMacro * 0.707) + terrainHeight(x + epsMacro * 0.707, z + epsMacro * 0.707)
  ) * 0.125;
  const concavityMacro = Math.max(0.0, avgMacro - h);

  const steepnessAO = Math.min(1.0, slope * 0.70 + 0.30);
  const rawAO = (1.0 - (concavityFine * 0.22 + concavityMacro * 0.09)) * steepnessAO;
  return Math.max(0.28, Math.min(1.0, rawAO));
}

// ---------- Districts ----------
export const DISTRICTS = {
  meadows:  { key: 'meadows',  name: 'Memorial Meadows',  base: 249, color: '#7fae6e',
              blurb: 'Classic garden cemetery. Rolling lawns, old oaks and wrought-iron fences along the grand boulevard.' },
  woodland: { key: 'woodland', name: 'Whispering Pines',  base: 299, color: '#4e7d54',
              blurb: 'A quiet pine forest north of the plaza. Dappled light, ferns and birdsong.' },
  lakefront:{ key: 'lakefront',name: 'Lakeside Rest',     base: 449, color: '#5f93b8',
              blurb: 'Grassy west shore of Mirror Lake. Willows lean over still water.' },
  beach:    { key: 'beach',    name: 'Golden Shores',     base: 499, color: '#d9bd7f',
              blurb: 'The sandy eastern shore. Warm sand, sea-grass and gentle waves.' },
  summit:   { key: 'summit',   name: 'Summit Rest',       base: 599, color: '#9b8ea3',
              blurb: 'Terraced plots high on the northwest slopes, above the morning mist.' },
  desert:   { key: 'desert',   name: 'Desert Bloom',      base: 199, color: '#c8a468',
              blurb: 'A quiet sun-baked corner southwest of the bridge with flowering cacti and red rock.' },
  ocean_cove:{ key: 'ocean_cove', name: 'Crescent Beach Cove', base: 549, color: '#38bdf8',
              blurb: 'Secluded golden sandy cove beneath dramatic 40m sheer cliffs where the Rainbow River cascades directly into the turquoise ocean surf.' },
  highland_sanctuary:{ key: 'highland_sanctuary', name: 'Highland Cathedral Plateau', base: 749, color: '#e2d4b7',
              blurb: 'Majestic high alpine territory above the northern waterfall. Paved scenic promenades, panoramic valley overlooks, and the Grand Universal Cathedral.' },
  kaya_island:{ key: 'kaya_island', name: 'Kaya Island', base: 699, color: '#67e8f9',
              blurb: 'A sacred offshore island sanctuary honoring guardian spirit Husky Kaya. Coral beaches, the 3D Husky crystal beacon, and the monumental sea-cliff Temple of Baal.' },
  kaya_reef:  { key: 'kaya_reef', name: 'Kaya Coral Reef Sanctuary', base: 899, color: '#06b6d4',
              blurb: 'Submerged coral gardens, glowing sea fans, and pearl oyster beds in crystal turquoise ocean depths around Kaya Island.' },
  lake_submerged:{ key: 'lake_submerged', name: 'Lake of Reflection Aquatic Plots', base: 599, color: '#38bdf8',
              blurb: 'Submerged crystal lotus blossoms, polished river jade anchors, and drifting water lilies along the mirror lake bed.' },
  highland_rapids:{ key: 'highland_rapids', name: 'Cataract Lip & Mountain Rapids', base: 799, color: '#93c5fd',
              blurb: 'Dramatic cliffside plots perched along the mountain rapids and the 182-meter glacial cataract crest overlooking the entire valley.' },
  cathedral: { key: 'cathedral', name: 'Hohenzollern Fortress Cathedral', base: 599, color: '#e5c158',
              blurb: 'High alpine citadel ramparts perched on towering crags with sweeping views of the entire valley.' },
  cathedral_interior: { key: 'cathedral_interior', name: 'Asamkirche Rococo Sanctuary', base: 749, color: '#f3e5ab',
              blurb: 'Gilded Solomonic marble columns, sacred ceiling frescoes, and divine god-rays pouring into the celestial nave.' },
  desert_interior: { key: 'desert_interior', name: 'Pueblo Sun-Kiva Sanctuary', base: 360, color: '#d97745',
              blurb: 'Sacred red sandstone cliff-temple with pine timber vigas, glowing stone hearth, and a natural celestial skylight beam.' },
  mosque: { key: 'mosque', name: 'Moorish Alhambra Oasis', base: 480, color: '#2dd4bf',
              blurb: 'Serene palace courtyard with tranquil reflecting pool, slender cypress trees, and delicate carved colonnades.' },
  mosque_interior: { key: 'mosque_interior', name: 'Alhambra Muqarnas Sanctuary', base: 560, color: '#14b8a6',
              blurb: 'Intricate vaulted muqarnas honeycomb dome, lapis lazuli zellige tilework, and a central bubbling marble fountain.' },
  pagoda: { key: 'pagoda', name: 'Five-Tiered Zen Pagoda', base: 480, color: '#f87171',
              blurb: 'Tranquil Japanese garden sanctuary with weeping willows, swimming golden koi, and floating cherry blossom petals.' },
  pagoda_interior: { key: 'pagoda_interior', name: 'Zen Buddha Sanctuary', base: 590, color: '#fb923c',
              blurb: 'Aromatic sandalwood incense, tatami meditation mats, and a luminous golden Buddha overlooking the rock garden.' },
  waterfall: { key: 'waterfall', name: 'Great North Waterfall', base: 499, color: '#60a5fa',
              blurb: 'Thundering 182-meter glacial waterfall plunging from high granite cliffs into refreshing rainbow mist.' },
  lake: { key: 'lake', name: 'Mirror Lake Shallows', base: 449, color: '#38bdf8',
              blurb: 'Still, crystalline lake waters reflecting the surrounding peaks, willows, and floating water lilies.' },
};

export const DISTRICT_NAMES = {
  meadows: 'Memorial Meadows', woodland: 'Whispering Pines',
  lakefront: 'Lakeside Rest', beach: 'Golden Shores',
  summit: 'Summit Rest', desert: 'Desert Bloom',
  ocean_cove: 'Crescent Beach Cove', highland_sanctuary: 'Highland Cathedral Plateau',
  kaya_island: 'Kaya Island', kaya_reef: 'Kaya Coral Reef Sanctuary',
  lake_submerged: 'Lake of Reflection Aquatic Plots', highland_rapids: 'Cataract Lip & Mountain Rapids',
  cathedral: 'Hohenzollern Fortress Cathedral', cathedral_interior: 'Asamkirche Rococo Sanctuary',
  desert_interior: 'Pueblo Sun-Kiva Sanctuary', mosque: 'Moorish Alhambra Oasis',
  mosque_interior: 'Alhambra Muqarnas Sanctuary', pagoda: 'Five-Tiered Zen Pagoda',
  pagoda_interior: 'Zen Buddha Sanctuary', waterfall: 'Great North Waterfall',
  lake: 'Mirror Lake Shallows',
};

// District key mappings for aliases/legacy strings
export const DISTRICT_KEY_MAP = {
  memorial_meadows: 'meadows',
  whispering_pines: 'woodland',
  lakeside_rest: 'lakefront',
  golden_shores: 'beach',
  summit_rest: 'summit',
  desert_bloom: 'desert',
  ocean_cove: 'ocean_cove',
  highland_sanctuary: 'highland_sanctuary',
  starlight_isle: 'kaya_island',
  kaya_island: 'kaya_island',
  kaya_reef: 'kaya_reef',
  lake_submerged: 'lake_submerged',
  highland_rapids: 'highland_rapids',
  cathedral: 'cathedral',
  cathedral_interior: 'cathedral_interior',
  desert: 'desert',
  desert_interior: 'desert_interior',
  mosque: 'mosque',
  mosque_interior: 'mosque_interior',
  pagoda: 'pagoda',
  pagoda_interior: 'pagoda_interior',
  waterfall: 'waterfall',
  lake: 'lake',
};

// ---------- Roads (polylines, in world coords) ----------
export const ROADS = [
  { name: 'Grand Boulevard', w: 26, pts: [[0, 940], [0, 880], [0, 720], [0, 560], [0, 440], [0, 320], [0, 180], [0, 82]] },
  { name: 'Ocean Cliff Path',w: 12, pts: [[0, 880], [15, 920], [35, 950]] },
  { name: 'Plaza Ring',      w: 14, ring: true, cx: WORLD.plaza.x, cz: WORLD.plaza.z, r: WORLD.plaza.r },
  // [EVR-04 relayout] main paths drawn on the master map
  { name: 'Cataract Trail',  w: 12, pts: [[52, -18], [120, -60], [190, -40], [250, -20], [330, -20]] },
  { name: 'Lakeshore Way',   w: 12, pts: [[60, 30], [220, 60], [400, 120], [560, 180], [590, 230]] },
  { name: 'Shoreline Path',  w: 10, pts: [[590, 230], [640, 420], [800, 580], [980, 590], [1150, 470], [1215, 330], [1200, 270]] },
  { name: 'Oasis Road',      w: 12, pts: [[-60, 30], [-300, 60], [-520, 120], [-700, 190], [-760, 216]] },
  { name: 'Canyon Trail',    w: 10, pts: [[-850, 128], [-860, 0], [-820, -150], [-800, -330], [-860, -480], [-900, -560]] },
  { name: 'Desert Trail',    w: 12, pts: [[-16, 560], [-160, 490], [-320, 450], [-460, 390], [-600, 330], [-760, 290]] },
  { name: 'Meadow Row E',    w: 8,  pts: [[18, 480], [150, 440], [260, 380]] },
  { name: 'Meadow Row W',    w: 8,  pts: [[-30, 500], [-160, 470], [-280, 420]] },
  { name: 'Coast Road East', w: 10, pts: [[20, 860], [180, 860], [330, 860], [470, 870], [540, 880]] },
  { name: 'Kaya Causeway',   w: 10, pts: [[520, 850], [600, 930], [700, 1015]] },
  { name: 'Summit Ascent',   w: 12, pts: [[-52, -8], [-180, -70], [-300, -150], [-360, -250], [-560, -440], [-520, -420]] },
];
// v35 paths that belong to a relocated landmark move with it
for (const r of [
  { name: 'Cathedral Terrace Way', w: 12, pts: [[-120, -560], [-80, -800], [0, -880], [80, -800], [120, -560]], reg: 'cathedral' },
  { name: 'Buddhist Ridge Path', w: 10, pts: [[440, -440], [480, -480], [510, -520]], reg: 'pagoda' },
  { name: 'Moorish Terrace Walk', w: 10, pts: [[-560, -180], [-640, -190], [-650, -192]], reg: 'mosque' },
  { name: 'Kaya Island Promenade', w: 12, pts: [[65, 2870], [45, 2980], [-80, 3030], [-150, 3120]], reg: 'kaya' },
]) {
  const d = REGION[r.reg].d;
  ROADS.push({ name: r.name, w: r.w, pts: r.pts.map(([x, z]) => [x + d[0], z + d[1]]) });
}

export function distToRoads(x, z) {
  let best = Infinity;
  for (const r of ROADS) {
    if (r.ring) {
      best = Math.min(best, Math.abs(dist(x, z, r.cx, r.cz) - r.r));
      continue;
    }
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i], [x2, z2] = r.pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const t = clamp(((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, dist(x, z, x1 + dx * t, z1 + dz * t));
    }
  }
  return best;
}

// ---------- Pet memorial flavor (for pre-occupied plots) ----------
export const PET_NAMES = [
  'Kaya', 'Luna', 'Bella', 'Charlie', 'Lucy', 'Cooper', 'Max', 'Bailey', 'Daisy',
  'Sadie', 'Milo', 'Buddy', 'Rocky', 'Oliver', 'Leo', 'Stella', 'Bear',
  'Sophie', 'Chloe', 'Zoe', 'Lola', 'Jack', 'Toby', 'Penny', 'Cody',
  'Buster', 'Duke', 'Harley', 'Rosie', 'Maggie', 'Sam', 'Gus', 'Finn',
  'Barnaby', 'Cleo', 'Jasper', 'Freya', 'Atlas', 'Willow', 'Shadow', 'Scout'
];
export const SPECIES = ['Dog', 'Cat', 'Horse', 'Rabbit', 'Bird', 'Guinea Pig', 'Ferret', 'Hamster', 'Reptile', 'Other'];
export const EPITAPHS = [
  'Forever in our hearts.', 'Until we meet at the bridge.', 'The best boy.',
  'A true and faithful friend.', 'Running free in sunny meadows.', 'Sleep well, sweet girl.',
  'Always by our side in spirit.', 'You brought so much joy.', 'Our companion across the years.',
  'A loyal friend rests here.','Small paws leave the deepest prints.','Run free, sweet soul.',
  'The house is quiet without you.','Good night, little hunter.','Always in our hearts.',
  'Thank you for every wag.','Purring somewhere beyond the stars.','Our sunshine on four legs.',
];

// ---------- Plot generation ----------
function districtRegions() {
  // Each region: anchor grid rows of plots. rows: [startX, startZ, cols, rows, dx, dz, rowStagger]
  return {
    meadows: [
      { x0: -270, z0: 260, cols: 12, rows: 6, dx: 44, dz: 52 },
      { x0: 60,   z0: 260, cols: 12, rows: 6, dx: 44, dz: 52 },
      { x0: -240, z0: 590, cols: 9,  rows: 4, dx: 46, dz: 54 },
      { x0: 90,   z0: 590, cols: 9,  rows: 4, dx: 46, dz: 54 },
    ],
    woodland: [
      { x0: -170, z0: -560, cols: 7, rows: 6, dx: 52, dz: 58 },
      { x0: 90,   z0: -560, cols: 5, rows: 5, dx: 54, dz: 60 },
    ],
    lakefront: [
      { x0: 30,  z0: -430, cols: 3, rows: 9, dx: 38, dz: 44 },  // west shore
      { x0: 200, z0: 66,   cols: 6, rows: 3, dx: 44, dz: 42 },  // south shore
    ],
    beach: [
      { x0: 560, z0: 96,  cols: 6, rows: 3, dx: 44, dz: 44 },   // SE sandy shore
      { x0: 660, z0: -80, cols: 3, rows: 5, dx: 40, dz: 46 },   // east shore
    ],
    summit: [
      { x0: -640, z0: -560, cols: 6, rows: 5, dx: 48, dz: 54 },
      { x0: -450, z0: -260, cols: 4, rows: 4, dx: 48, dz: 52 },
    ],

    desert: [
      { x0: -620, z0: 220, cols: 7, rows: 5, dx: 50, dz: 56 },
      { x0: -400, z0: 470, cols: 6, rows: 4, dx: 50, dz: 56 },
      // The Phantasm Tree & Sun-Kiva Mesa
      { x0: -500, z0: 300, cols: 6, rows: 4, dx: 34, dz: 34 },
      // NEW CANYON REAL ESTATE
      { x0: -300, z0: -900, cols: 8, rows: 6, dx: 45, dz: 45 },
      { x0: 100, z0: -850, cols: 6, rows: 5, dx: 55, dz: 45 },
      { x0: -500, z0: -1100, cols: 10, rows: 8, dx: 45, dz: 45 },
    ],

    ocean_cove: [
      { x0: -160, z0: 910,  cols: 4, rows: 2, dx: 42, dz: 44 },  // West mountain cliffside overlook
      { x0: 20,   z0: 1060, cols: 6, rows: 4, dx: 44, dz: 46 },  // Golden sandy beach cove down at sea level
      { x0: 120,  z0: 1120, cols: 4, rows: 3, dx: 46, dz: 48 },  // Seaside surf plots
    ],
    highland_sanctuary: [
      { x0: -180, z0: -580, cols: 8, rows: 4, dx: 46, dz: 44 },  // High alpine promenade plots
      { x0: 40,   z0: -580, cols: 7, rows: 4, dx: 46, dz: 44 },  // East waterfall plateau plots
      { x0: -140, z0: -880, cols: 6, rows: 3, dx: 48, dz: 48 },  // Cathedral north garden plots
    ],

    kaya_island: [
      { x0: -60, z0: 2860, cols: 6, rows: 4, dx: 30, dz: 30 },
      { x0: 20,  z0: 2910, cols: 8, rows: 3, dx: 28, dz: 28 },
      { x0: -150,z0: 2980, cols: 4, rows: 5, dx: 25, dz: 35 },
      // Satellite Island plots
      { x0: 300, z0: 3020, cols: 5, rows: 3, dx: 30, dz: 30 },
      { x0: -350, z0: 2820, cols: 4, rows: 4, dx: 30, dz: 30 },
      { x0: 50, z0: 3220, cols: 6, rows: 4, dx: 30, dz: 30 }
    ],

    kaya_reef: [
      { x0: -80,  z0: 3080, cols: 6, rows: 3, dx: 32, dz: 32 },  // Submerged South Coral Shelf
      { x0: 40,   z0: 3050, cols: 5, rows: 3, dx: 32, dz: 32 },  // Submerged East Anemone Garden
    ],
    lake_submerged: [
      { x0: 380,  z0: -240, cols: 4, rows: 3, dx: 36, dz: 36 },  // Submerged Lotus Garden Center
      { x0: 460,  z0: -320, cols: 4, rows: 3, dx: 36, dz: 36 },  // Submerged Crystal Bed
    ],
    highland_rapids: [
      { x0: -50,  z0: -480, cols: 4, rows: 3, dx: 26, dz: 26 },  // Rapids Lip West
      { x0: 20,   z0: -480, cols: 4, rows: 3, dx: 26, dz: 26 },  // Cataract Crest East
    ],
  };
}

const _PLOT_REGION = { lakefront: 'lake', beach: 'lake', lake_submerged: 'lake', kaya_island: 'kaya', kaya_reef: 'kaya',
  highland_sanctuary: 'falls', highland_rapids: 'falls', woodland: 'falls' };
export function generatePlots() {
  const wasLegacy = _legacy; setLegacyLayout(true);
  try { return _relocatePlots(_generatePlotsV35()); } finally { setLegacyLayout(wasLegacy); }
}
function _relocatePlots(plots) {
  setLegacyLayout(false);
  const out = [];
  for (const p of plots) {
    let key = _PLOT_REGION[p.district];
    if (p.district === 'desert' && p.z < -700) key = 'canyon';
    if (p.district === 'cathedral_interior') key = 'cathedral';
    if (p.id === 'KY-01') key = 'kaya';
    if (!key) { const R = regionOfOld(p.x, p.z, 0.5); key = R ? R.key : null; }
    const R = key ? REGION[key] : null;
    const oldGround = _legacyHeight(p.x, p.z, false);
    const nx = R ? p.x + R.d[0] : p.x, nz = R ? p.z + R.d[1] : p.z;
    const ng = terrainHeight(nx, nz);
    const sub = p.district === 'kaya_reef' || p.district === 'lake_submerged';
    if (!sub && p.district !== 'cathedral_interior') {
      if (ng < (nz >= coastZ(nx) - 60 ? 0.35 : WORLD.waterLevel) + 0.8) continue;   // now in sea / river / lake
      if (distToRiver(nx, nz) < 24 && p.district !== 'highland_rapids') continue;
    }
    out.push({ ...p, x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10, h: Math.round((p.h - oldGround + ng) * 100) / 100 });
  }
  return out;
}
function _generatePlotsV35() {
  const rng = mulberry32(WORLD_SEED);
  const plots = [];
  const regions = districtRegions();
  const counters = {};

  for (const [dk, regs] of Object.entries(regions)) {
    const d = DISTRICTS[dk];
    counters[dk] = 0;
    for (const rg of regs) {
      for (let r = 0; r < rg.rows; r++) {
        for (let c = 0; c < rg.cols; c++) {
          const jx = (rng() - 0.5) * 10, jz = (rng() - 0.5) * 10;
          const x = rg.x0 + c * rg.dx + jx + (r % 2 ? rg.dx * 0.35 : 0);
          const z = rg.z0 + r * rg.dz + jz;
          const h = terrainHeight(x, z);
          const isSubmerged = dk === 'kaya_reef' || dk === 'lake_submerged';
          const localWater = (dk === 'ocean_cove' || dk === 'kaya_island' || dk === 'kaya_reef') ? (WORLD.oceanLevel || 0.35) : WORLD.waterLevel;
          
          if (!isSubmerged && h < localWater + 0.8) continue;
          if (dk === 'kaya_reef' && (h > -0.5 || h < -38.0)) continue;
          if (h > 120 && dk !== 'summit' && dk !== 'highland_sanctuary' && dk !== 'highland_rapids') continue;
          if (dk === 'summit' && h > 150) continue;
          if (dk === 'highland_sanctuary' && (h < 175 || h > 198)) continue;
          if (dk === 'highland_rapids' && (h < 64 || h > 84)) continue;

          const dr = distToRoads(x, z);
          if (dr < 12) continue;
          if (dist(x, z, WORLD.plaza.x, WORLD.plaza.z) < WORLD.plaza.r + 24) continue;
          if (dk !== 'highland_rapids' && distToRiver(x, z) < 24) continue; // keep river channels clear of plots
          if (Math.hypot(x, z - (-550)) < 68) continue; // keep plunge pool clear of plots
          if (Math.hypot(x, z - (-880)) < 55) continue; // keep Cathedral Glacial Tarn clear of plots
          if (dist(x, z, WORLD.cathedral.x, WORLD.cathedral.z) < 65) continue; // clear cathedral footprint
          if (dist(x, z, WORLD.buddhistTemple.x, WORLD.buddhistTemple.z) < 45) continue; // clear buddhist temple
          if (dist(x, z, WORLD.mosque.x, WORLD.mosque.z) < 45) continue; // clear mosque
          if (dist(x, z, WORLD.templeOfBaal.x, WORLD.templeOfBaal.z) < 48) continue; // clear temple of baal
          if (dist(x, z, WORLD.kayaIsland.x, WORLD.kayaIsland.z) < 32) continue; // clear husky crystal beacon
          const dLake = dist(x, z, WORLD.lake.x, WORLD.lake.z) - WORLD.lake.r;
          if ((dk === 'lakefront' || dk === 'beach') && dLake < 8) continue;

          counters[dk]++;
          const num = counters[dk];
          const roll = rng();
          const size = roll > 0.9 ? 'estate' : roll > 0.65 ? 'premium' : 'standard';
          const sizeMult = size === 'estate' ? 3.7 : size === 'premium' ? 1.8 : 1;
          const tier = size === 'estate' ? 3 : size === 'premium' ? 2 : 1;

          let price = d.base * sizeMult;
          if (dLake > 0 && dLake < 70) price *= 1.3;                          // waterfront
          if (dist(x, z, WORLD.plaza.x, WORLD.plaza.z) < 220) price *= 1.15;  // near plaza
          if (dr < 26) price *= 1.08;                                          // road access
          if (dk === 'summit' && h > 60) price *= 1.2;                        // view premium
          price = Math.round(price / 10) * 10 - 1;                            // $xx9

          const occupied = rng() < 0.22;
          let memorial = null, decor = [];
          if (occupied) {
            const species = SPECIES[Math.floor(rng() * SPECIES.length)];
            const born = 2005 + Math.floor(rng() * 14);
            const died = born + 4 + Math.floor(rng() * 14);
            memorial = {
              petName: PET_NAMES[Math.floor(rng() * PET_NAMES.length)],
              species,
              years: `${born} – ${Math.min(died, 2026)}`,
              epitaph: EPITAPHS[Math.floor(rng() * EPITAPHS.length)],
              owner: 'A loving family',
              gifts: Math.floor(rng() * 18),
            };
            const styles = ['classic', 'obelisk', 'heart', 'slab', 'statue'];
            decor.push({ type: 'headstone', style: styles[Math.floor(rng() * styles.length)] });
            if (rng() > 0.4) decor.push({ type: 'flowers' });
            if (rng() > 0.7) decor.push({ type: 'tree' });
            if (rng() > 0.8) decor.push({ type: 'bench' });
            if (rng() > 0.85) decor.push({ type: 'lantern' });
          }

          let plotH = Math.round(h * 100) / 100;
          if (dk === 'lake_submerged') plotH = Math.round((WORLD.waterLevel - 5.5) * 100) / 100;
          if (dk === 'kaya_reef') plotH = Math.round(Math.max(-16.0, h) * 100) / 100;

          plots.push({
            id: `${dk.slice(0, 2).toUpperCase()}-${String(num).padStart(3, '0')}`,
            district: dk, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10,
            h: plotH,
            rot: Math.atan2(WORLD.plaza.x - x, WORLD.plaza.z - z),
            size, tier, price, status: occupied ? 'occupied' : 'available',
            avail: !occupied,
            memorial, decor,
          });
        }
      }
    }
  }
  
          // Dedicated Landmark & Aerial Sanctuary Plots
          plots.push(
            {
              id: 'PT-01',
              code: 'PT-01',
              district: 'desert',
              name: 'Phantasm Tree Bough Sanctuary',
              title: 'Phantasm Tree Bough Sanctuary',
              x: -460,
              z: 340,
              h: Math.round((terrainHeight(-460, 340) + 18.5) * 100) / 100,
              rot: 0,
              type: 'desert',
              size: 'estate',
              tier: 4,
              price: 4800,
              status: 'available',
              avail: true,
              highlight: true,
              memorial: null,
              decor: [{ type: 'statue', style: 'celestial_tree' }]
            },
            {
              id: 'PT-02',
              code: 'PT-02',
              district: 'desert',
              name: 'Sun-Kiva Sacred Hearth Sanctuary',
              title: 'Sun-Kiva Sacred Hearth Sanctuary',
              x: -435,
              z: 350,
              h: Math.round((terrainHeight(-435, 350) + 0.8) * 100) / 100,
              rot: 0,
              type: 'desert',
              size: 'premium',
              tier: 3,
              price: 3200,
              status: 'available',
              avail: true,
              highlight: true,
              memorial: null,
              decor: [{ type: 'hearth', style: 'pueblo_kiva' }]
            },
            {
              id: 'KY-01',
              code: 'KY-01',
              district: 'kaya_island',
              name: 'Kaya Guardian Siberian Husky Overlook',
              title: 'Kaya Guardian Siberian Husky Overlook',
              x: 25,
              z: 2920,
              h: Math.round((terrainHeight(25, 2920) + 3.8) * 100) / 100,
              rot: Math.PI,
              type: 'kaya_island',
              size: 'estate',
              tier: 4,
              price: 5200,
              status: 'available',
              avail: true,
              highlight: true,
              memorial: null,
              decor: [{ type: 'statue', style: 'husky_monument' }]
            },
            { id: 'CATH_ROOF_1', district: 'cathedral_interior', x: WORLD.cathedral.x - 20, z: WORLD.cathedral.z + 10, h: terrainHeight(WORLD.cathedral.x, WORLD.cathedral.z) + 40, rot: 0, type: 'cathedral_interior', name: 'Fresco Balcony West #1', size: 'premium', tier: 3, avail: true, status: 'available' },
            { id: 'CATH_ROOF_2', district: 'cathedral_interior', x: WORLD.cathedral.x, z: WORLD.cathedral.z - 15, h: terrainHeight(WORLD.cathedral.x, WORLD.cathedral.z) + 42, rot: 0, type: 'cathedral_interior', name: 'Gilded Rococo Altar Chancel #2', size: 'estate', tier: 4, avail: true, status: 'available' },
            { id: 'CATH_ROOF_3', district: 'cathedral_interior', x: WORLD.cathedral.x + 20, z: WORLD.cathedral.z + 10, h: terrainHeight(WORLD.cathedral.x, WORLD.cathedral.z) + 40, rot: 0, type: 'cathedral_interior', name: 'Fresco Balcony East #3', size: 'premium', tier: 3, avail: true, status: 'available' }
          );

  return plots;
}

export const SIZE_LABELS = { standard: 'Standard Plot', premium: 'Premium Plot', estate: 'Estate Plot' };
export const SIZE_DIMS = { standard: [10, 14], premium: [14, 18], estate: [20, 26] };
