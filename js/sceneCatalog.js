// Photography is presentation; plots and prices always come from the canonical catalog.
// Explicit scene IDs distinguish interiors and aquatic habitats that Veo groups together.
const SCENE_DISTRICTS = Object.freeze({
  'grand-gate-closed': ['meadows'],
  'grand-gate-open': ['meadows'],
  'rainbow-bridge': ['meadows', 'woodland'],
  'central-plaza': ['meadows'],
  waterfall: ['waterfall', 'highland_rapids'],
  'underwater-plunge-pool': [],
  cathedral: ['cathedral', 'highland_sanctuary'],
  'cathedral-interior': ['cathedral_interior'],
  'desert-canyon': ['desert'],
  'kiva-interior': ['desert_interior'],
  'moorish-oasis': ['mosque'],
  'moorish-interior': ['mosque_interior'],
  'waterfall-lake': ['lake', 'lakefront', 'beach'],
  'underwater-koi': ['lake_submerged'],
  'zen-pagoda': ['pagoda'],
  'pagoda-interior': ['pagoda_interior'],
  'kaya-island': ['kaya_island'],
  'underwater-coral-reef': ['kaya_reef'],
  'underwater-abyss': [],
  'valley-overview': [],
  'rainbow-river': ['meadows', 'woodland'],
  'sun-kiva-exterior': ['desert'],
  'underwater-bathymetric': ['ocean_cove'],
});

const CANONICAL_DISTRICTS = new Set([
  'meadows', 'woodland', 'lakefront', 'beach', 'summit', 'desert',
  'ocean_cove', 'highland_sanctuary', 'kaya_island', 'kaya_reef',
  'lake_submerged', 'highland_rapids', 'cathedral', 'cathedral_interior',
  'desert_interior', 'mosque', 'mosque_interior', 'pagoda', 'pagoda_interior',
  'waterfall', 'lake',
]);

const PREFERRED_SCENES = Object.freeze({
  meadows: 'central-plaza', woodland: 'rainbow-bridge',
  lakefront: 'waterfall-lake', beach: 'waterfall-lake', lake: 'waterfall-lake',
  desert: 'desert-canyon', desert_interior: 'kiva-interior',
  highland_sanctuary: 'cathedral', cathedral: 'cathedral',
  cathedral_interior: 'cathedral-interior',
  highland_rapids: 'waterfall', waterfall: 'waterfall',
  mosque: 'moorish-oasis', mosque_interior: 'moorish-interior',
  pagoda: 'zen-pagoda', pagoda_interior: 'pagoda-interior',
  kaya_island: 'kaya-island', kaya_reef: 'underwater-coral-reef',
  lake_submerged: 'underwater-koi',
});

/** Canonical district keys represented by a scene. Empty means no mapped inventory. */
export function sceneDistricts(scene) {
  const id = typeof scene === 'string' ? scene : scene?.id;
  if (Object.hasOwn(SCENE_DISTRICTS, id)) return [...SCENE_DISTRICTS[id]];
  const key = typeof scene === 'string' ? scene : scene?.districtKey;
  return CANONICAL_DISTRICTS.has(key) ? [key] : [];
}

/**
 * Return real plot objects, with owned plots first. Never invent stock or price.
 * Ambiguous IDs are excluded because persisted ownership is keyed by ID alone.
 * Occupied plots remain viewable even when no resale price has been configured.
 */
export function plotsForScene(scene, plots, ownedPlots = {}) {
  if (!Array.isArray(plots)) return [];
  const districts = new Set(sceneDistricts(scene));
  if (!districts.size) return [];
  const ids = new Map();
  for (const plot of plots) {
    if (plot && typeof plot.id === 'string' && plot.id) ids.set(plot.id, (ids.get(plot.id) || 0) + 1);
  }
  const owned = id => Object.hasOwn(ownedPlots || {}, id);
  const rank = plot => owned(plot.id) ? 0 : plot.status === 'available' ? 1 : 2;
  return plots.filter(plot => {
    if (!plot || ids.get(plot.id) !== 1 || !districts.has(plot.district)) return false;
    if (plot.status === 'occupied') return true;
    return plot.status === 'available' && typeof plot.price === 'number' && Number.isFinite(plot.price) && plot.price > 0;
  }).sort((a, b) => rank(a) - rank(b));
}

/** Find a matching existing scene; a missing district never falls back to the gate. */
export function sceneForPlot(plot, scenes) {
  if (!plot?.district || !Array.isArray(scenes)) return null;
  const preferred = PREFERRED_SCENES[plot.district];
  return scenes.find(scene => scene.id === preferred)
    || scenes.find(scene => sceneDistricts(scene).includes(plot.district))
    || null;
}

/** Use the same artwork as the established photographic experience. */
export function sceneImage(scene) {
  if (!scene) return '';
  if (scene.extImg?.startsWith('images/cinematic-v2/')) return scene.extImg;
  if (Object.hasOwn(SCENE_DISTRICTS, scene.id)) return `images/cinematic-v2/${scene.id}-4k.jpg`;
  return scene.extImg || '';
}
