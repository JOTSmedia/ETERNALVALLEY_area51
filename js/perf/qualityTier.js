// EVR-04 perf: ONE per-device quality tier, read everywhere instead of ad-hoc UA tests.
// Tier: 'desktop' | 'mobile' | 'low' (+ 'lite' = no world, see deviceTier.js). Override: ?tier=lite|low|mobile|desktop or localStorage 'ev_tier'.
const UA_MOBILE = () => typeof navigator !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth <= 768));

export const TIERS = {
  desktop: { dprCap: 2.0, drsFloor: 1.0, shadows: true,  shadowMapSize: 2048, cascades: 3, maxFar: 350,
             composer: true, gtao: true, gtaoScale: 0.5, bloom: true, godRays: false, smaa: true, msaa: 4,
             texTier: '4k', terrainLayerRes: 1024, envUrl: 'images/textures/table_mountain_2_1k_env.hdr',
             lodBias: 1.0, landmarkRadius: 3000, underwaterRadius: 450, fishRadius: 300 },
  mobile:  { dprCap: 1.5, drsFloor: 0.75, shadows: false, shadowMapSize: 1024, cascades: 2, maxFar: 250,
             composer: false, gtao: false, gtaoScale: 0.5, bloom: false, godRays: false, smaa: false, msaa: 0,
             texTier: '1k', terrainLayerRes: 512, envUrl: 'images/textures/table_mountain_2_1k_env.hdr',
             lodBias: 0.6, landmarkRadius: 1800, underwaterRadius: 300, fishRadius: 180 },
  low:     { dprCap: 1.0, drsFloor: 0.6, shadows: false, shadowMapSize: 512, cascades: 1, maxFar: 150,
             composer: false, gtao: false, gtaoScale: 0.5, bloom: false, godRays: false, smaa: false, msaa: 0,
             texTier: '512', terrainLayerRes: 512, envUrl: 'images/textures/table_mountain_2_1k_env.hdr',
             lodBias: 0.4, landmarkRadius: 1200, underwaterRadius: 200, fishRadius: 120 },
};

import { EV_DEVICE } from './deviceTier.js?v=73'; // EVR-06: one boot-time device probe (no three.js)

export function detectTier() {
  if (typeof window === 'undefined') return 'desktop';
  // EVR-06: the tier is decided ONCE at boot by deviceTier.js (deviceMemory, GPU string, probe,
  // ?tier= / localStorage override). 'lite' builds no world; if a 3D view is still forced
  // (e.g. the globe/thumbnail renderers) it gets the 'low' caps.
  const t = EV_DEVICE.tier;
  return t === 'lite' ? 'low' : (TIERS[t] ? t : 'desktop');
}

export const EV_TIER = detectTier();

// EVR-06 memory caps. The drawing buffer is capped in PIXELS (not just DPR): a 1440x900 @2x Mac
// screen is 5.2 Mpx and the desktop post chain (MSAA HalfFloat composer + bloom + SMAA + GTAO)
// costs ~60 B/px, so DPR 2 alone was ~0.9 GB of render targets (2.6 GB on a 2560x1440 @2x display).
// memClass = navigator.deviceMemory (GB), or 8 on desktop browsers that don't expose it (Safari/Firefox).
const _memClass = (EV_DEVICE && EV_DEVICE.memClass) || 8;
const _big = _memClass >= 8;
export const EV_CAPS = Object.freeze({
  desktop: { maxPixels: _big ? 8294400 : 2.4e6, dprCap: 2.0, composerSamples: 0, shadowMapSize: _big ? 4096 : 2048,
             cascades: 3, backdrop: _big ? 'desktop' : 'mobile', terrainLayerRes: _big ? 1024 : 512, freeCpuTextures: true },
  mobile:  { maxPixels: 1.2e6, dprCap: 1.25, composerSamples: 0, shadowMapSize: 1024, cascades: 2, backdrop: 'mobile', terrainLayerRes: 512, freeCpuTextures: true },
  low:     { maxPixels: 0.8e6, dprCap: 1.0, composerSamples: 0, shadowMapSize: 512,  cascades: 2, backdrop: 'mobile', terrainLayerRes: 512, freeCpuTextures: true },
}[EV_TIER]);

export const EV_PERF = Object.freeze({ tier: EV_TIER, device: EV_DEVICE.tier, ...TIERS[EV_TIER], ...EV_CAPS });
if (typeof window !== 'undefined') window.EV_PERF = EV_PERF;
