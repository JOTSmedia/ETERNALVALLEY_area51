import { plotsForScene, sceneImage } from './sceneCatalog.js?v=73';
import { State } from './state.js?v=73';
// ============================================================
// ETERNAL VALLEY — Interactive Veo Drone Tour & Photoreal Sanctuary Engine
// Provides interactive video flight over the sanctuary, live spatial radar,
// clickable landmark waypoints, seamless area blending, and interactive plot pins.
// Geographically interwoven: Each underwater realm appears seamlessly following
// its corresponding terrestrial water landmark (Falls -> Plunge Pool,
// Mirror Lake -> Koi Shallows, Kaya Island -> Coral Reef -> Ocean Abyss).
// ============================================================

export const VEO_LANDMARKS = [
  {
    id: 'grand-gate-closed',
    stage: 0,
    name: 'The Grand Gates of Eternal Valley',
    districtKey: 'meadows',
    sub: 'Majestic gilded gates at the southern threshold of the sanctuary.',
    tStart: 0.0,
    tEnd: 3.1,
    radarX: 0.50,
    radarY: 0.92,
    extImg: 'images/photoreal/veo_closed_gate_1788571951195.jpg',
    intImg: 'images/photoreal/veo_grand_gate_open.jpg',
    extLabel: 'Closed Gilded Portal',
    intLabel: 'Open Portal Arch',
    lore: 'The southern entrance to Eternal Valley is guarded by soaring Carrara marble arches and monumental gilded filigree gates adorned with lion crests and peaceful dove emblems. Here, the journey into the eternal sanctuary begins.',
    plots: ['plot-m-01', 'plot-m-02'],
    videoPlots: [
      {
        id: 'plot-m-01',
        code: 'G-01',
        title: 'Grand Gate Portal Sanctuary',
        tier: 'Founder Pinnacle',
        price: 3200,
        status: 'available',
        x: 38,
        y: 60,
        highlight: true
      }
    ]
  },
  {
    id: 'grand-gate-open',
    stage: 1,
    name: 'The Triumphal Archway Opening',
    districtKey: 'meadows',
    sub: 'The ornate gates swing wide open, welcoming you into paradise.',
    tStart: 3.1,
    tEnd: 6.8,
    radarX: 0.50,
    radarY: 0.84,
    extImg: 'images/photoreal/veo_grand_gate_open.jpg',
    intImg: 'images/photoreal/veo_closed_gate_1788571951195.jpg',
    extLabel: 'Open Portal Arch',
    intLabel: 'Closed Gilded Portal',
    lore: 'As the gates swing wide open inward, the sunlit cobblestone and lavender promenade welcomes travelers into the valley basin. Ahead, the crystal arches of the Rainbow Bridge gleam over the turquoise river.',
    plots: ['plot-m-03', 'plot-m-04'],
    videoPlots: [
      {
        id: 'plot-m-03',
        code: 'G-02',
        title: 'Lavender Promenade Plot',
        tier: 'Meadow Tier',
        price: 1850,
        status: 'available',
        x: 52,
        y: 72,
        highlight: true
      }
    ]
  },
  {
    id: 'rainbow-bridge',
    stage: 2,
    name: 'The Rainbow Bridge Crest',
    districtKey: 'meadows',
    sub: 'Prismatic crystalline arch spanning the tranquil Rainbow River.',
    tStart: 6.8,
    tEnd: 10.7,
    radarX: 0.50,
    radarY: 0.70,
    extImg: 'images/photoreal/veo_rainbow_bridge_1788571479328.jpg',
    intImg: null,
    extLabel: 'Bridge Skyway',
    intLabel: null,
    lore: 'The legendary Rainbow Bridge arches over the turquoise waters of the valley river with soaring Gothic pointed crystal trusses and gold spandrels. Its luminous surface refracts the eternal dawn, creating iridescent ribbons of light that guide companions home.',
    plots: ['plot-m-05', 'plot-m-06', 'plot-m-07', 'plot-m-08'],
    videoPlots: [
      {
        id: 'plot-m-05',
        code: 'M-05',
        title: 'Rainbow Crest Memorial',
        tier: 'Prismatic Tier',
        price: 2200,
        status: 'available',
        x: 45,
        y: 48,
        highlight: true
      },
      {
        id: 'plot-m-07',
        code: 'M-07',
        title: 'Riverbank Blossom Plot',
        tier: 'Meadow Tier',
        price: 1800,
        status: 'available',
        x: 70,
        y: 66
      }
    ]
  },
  {
    id: 'central-plaza',
    stage: 3,
    name: 'Central Plaza & Eternal Tree Fountain',
    districtKey: 'meadows',
    sub: 'Heart of the sanctuary with celestial starburst fountains and colonnades.',
    tStart: 10.7,
    tEnd: 14.6,
    radarX: 0.50,
    radarY: 0.52,
    extImg: 'images/photoreal/veo_central_plaza_1788571496051.jpg',
    intImg: null,
    extLabel: 'Plaza Basin',
    intLabel: null,
    lore: 'The gathering crossroads of the sanctuary, where companions run and play in endless sunshine around the tiered fountain and ancient flowering trees. Golden mosaic starbursts gleam through crystal water.',
    plots: ['plot-m-09', 'plot-m-10', 'plot-m-11', 'plot-m-12'],
    videoPlots: [
      {
        id: 'plot-m-09',
        code: 'M-09',
        title: 'Star Fountain Garden',
        tier: 'Celestial Tier',
        price: 3000,
        status: 'available',
        x: 42,
        y: 55,
        highlight: true
      },
      {
        id: 'plot-m-11',
        code: 'M-11',
        title: 'Plaza Colonnade Terrace',
        tier: 'Heritage',
        price: 2100,
        status: 'available',
        x: 62,
        y: 42
      }
    ]
  },
  {
    id: 'waterfall',
    stage: 4,
    name: 'Great Cataract Waterfall (Ascent)',
    districtKey: 'waterfall',
    sub: '182-meter sheer northern cascade rising toward the heavens.',
    tStart: 14.6,
    tEnd: 18.5,
    radarX: 0.50,
    radarY: 0.32,
    extImg: 'images/photoreal/veo_waterfall_1788571511375.jpg',
    intImg: null,
    extLabel: 'Waterfall Headwall',
    intLabel: null,
    lore: 'A breathtaking 182-meter sheer granite cataract where glacial waters pour into the emerald basin below. Prismatic mist rises through the pines, filling the mountain air with cleansing serenity.',
    plots: ['plot-w-01', 'plot-w-02', 'plot-w-03', 'plot-w-04'],
    videoPlots: [
      {
        id: 'plot-w-01',
        code: 'W-01',
        title: 'Cataract Mist Sanctuary',
        tier: 'Cascades Tier',
        price: 2800,
        status: 'available',
        x: 38,
        y: 52,
        highlight: true
      },
      {
        id: 'plot-w-03',
        code: 'W-03',
        title: 'Rainbow Spray Terrace',
        tier: 'Cascades Tier',
        price: 2400,
        status: 'available',
        x: 66,
        y: 62
      }
    ]
  },
  {
    id: 'underwater-plunge-pool',
    stage: 5,
    name: 'Cataract Plunge Pool (Underwater Realm)',
    districtKey: 'underwater',
    isUnderwater: true,
    sub: 'Submerged freshwater sanctuary beneath the falls amidst mossy glacial boulders.',
    tStart: 18.5,
    tEnd: 22.0,
    radarX: 0.50,
    radarY: 0.38,
    extImg: 'images/photoreal/veo_underwater_plunge_pool.jpg',
    intImg: 'images/photoreal/veo_waterfall_1788571511375.jpg',
    extLabel: 'Submerged Shallows (UW)',
    intLabel: 'Great Waterfall',
    lore: 'Beneath the thundering cascade lies an aquatic realm of crystalline turquoise waters, illuminated by shimmering shafts of sunlight. Glacial boulders draped in golden moss create quiet underwater grottos for resting spirits.',
    plots: ['plot-w-uw1', 'plot-w-uw2', 'plot-w-uw3'],
    videoPlots: [
      {
        id: 'plot-w-uw1',
        code: 'UW-W1',
        title: 'Glacial Plunge Altar',
        tier: 'Aquatic Tier',
        price: 3100,
        status: 'available',
        x: 42,
        y: 58,
        highlight: true
      }
    ]
  },
  {
    id: 'cathedral',
    stage: 6,
    name: 'Universal Cathedral Citadel (Exterior)',
    districtKey: 'cathedral',
    sub: 'Hohenzollern spires perched upon the sheer northern mountain crag.',
    tStart: 22.0,
    tEnd: 25.9,
    radarX: 0.50,
    radarY: 0.18,
    extImg: 'images/photoreal/veo_cathedral_exterior_1788571528669.jpg',
    intImg: 'images/photoreal/veo_cathedral_interior_1788571546191.jpg',
    extLabel: 'Cathedral Spire Citadel',
    intLabel: 'Sacred Nave (Interior)',
    lore: 'Perched upon a sheer mountain promontory overlooking the entire valley, the Universal Cathedral combines Gothic spires, Romanesque arcades, and a golden dome. A sanctuary honoring all spiritual traditions.',
    plots: ['plot-c-01', 'plot-c-02', 'plot-c-03', 'plot-c-04'],
    videoPlots: [
      {
        id: 'plot-c-01',
        code: 'C-01',
        title: 'Cathedral Spire Pinnacle',
        tier: 'Citadel Tier',
        price: 4500,
        status: 'available',
        x: 48,
        y: 40,
        highlight: true
      },
      {
        id: 'plot-c-03',
        code: 'C-03',
        title: 'Gilded Arcade Balcony',
        tier: 'Citadel Tier',
        price: 3600,
        status: 'available',
        x: 68,
        y: 58
      }
    ]
  },
  {
    id: 'cathedral-interior',
    stage: 7,
    name: 'Universal Cathedral (Sacred Nave)',
    districtKey: 'cathedral',
    sub: 'Inside the gilded Rococo vaulted nave with starlight clerestory.',
    tStart: 25.9,
    tEnd: 29.8,
    radarX: 0.50,
    radarY: 0.18,
    extImg: 'images/photoreal/veo_cathedral_interior_1788571546191.jpg',
    intImg: 'images/photoreal/veo_cathedral_exterior_1788571528669.jpg',
    extLabel: 'Sacred Rococo Nave',
    intLabel: 'Citadel Exterior',
    lore: 'Stepping into the cathedral nave reveals towering red marble Solomonic columns, gilded vaulting, and celestial ceiling frescoes. Sunlight pours through antique stained glass, illuminating rows of consecrated memorial shrines in eternal peace.',
    plots: ['plot-c-05', 'plot-c-06'],
    videoPlots: [
      {
        id: 'plot-c-05',
        code: 'C-05',
        title: 'Nave Solomonic Pillar Altar',
        tier: 'Cathedral Sanctuary',
        price: 5200,
        status: 'available',
        x: 46,
        y: 54,
        highlight: true
      }
    ]
  },
  {
    id: 'desert-canyon',
    stage: 8,
    name: 'Desert Canyon & The Phantasm Tree (Exterior)',
    districtKey: 'canyon',
    sub: 'Navajo sandstone mesa with bioluminescent elder tree and Sun-Kiva.',
    tStart: 29.8,
    tEnd: 33.7,
    radarX: 0.28,
    radarY: 0.34,
    extImg: 'images/photoreal/veo_desert_phantasm_tree.jpg',
    intImg: 'images/photoreal/omni_pueblo_interior_1788572582730.jpg',
    extLabel: 'The Phantasm Tree Mesa',
    intLabel: 'Sun-Kiva Interior',
    lore: 'The western canyon opens into tiered crimson Navajo sandstone bluffs. Here stands The Phantasm Tree, glowing with bioluminescent violet, cyan, and gold starlight foliage over the stone circular Sun-Kiva.',
    plots: ['plot-cn-01', 'plot-cn-02', 'plot-cn-03', 'plot-cn-04'],
    videoPlots: [
      {
        id: 'plot-cn-01',
        code: 'CN-01',
        title: 'Phantasm Tree Horizon',
        tier: 'Canyon Tier',
        price: 2600,
        status: 'available',
        x: 42,
        y: 50,
        highlight: true
      }
    ]
  },
  {
    id: 'kiva-interior',
    stage: 9,
    name: 'Ancestral Sun-Kiva (Sacred Interior)',
    districtKey: 'canyon',
    sub: 'Subterranean sandstone ceremonial kiva with eternal fire hearth.',
    tStart: 33.7,
    tEnd: 37.6,
    radarX: 0.28,
    radarY: 0.34,
    extImg: 'images/photoreal/omni_pueblo_interior_1788572582730.jpg',
    intImg: 'images/photoreal/veo_desert_phantasm_tree.jpg',
    extLabel: 'Sun-Kiva Interior',
    intLabel: 'Canyon Mesa Exterior',
    lore: 'Carved directly into red desert rock, the circular Sun-Kiva features a central glowing hearth, rough-hewn log vigas, and ceremonial stone banquettes honoring Native American and ancient traditions.',
    plots: ['plot-cn-05', 'plot-cn-06'],
    videoPlots: [
      {
        id: 'plot-cn-05',
        code: 'CN-05',
        title: 'Ancestral Hearth Altar',
        tier: 'Canyon Tier',
        price: 2900,
        status: 'available',
        x: 50,
        y: 62,
        highlight: true
      }
    ]
  },
  {
    id: 'moorish-oasis',
    stage: 10,
    name: 'Moorish Alhambra Oasis (Exterior)',
    districtKey: 'oasis',
    sub: 'Tranquil reflecting pools and horseshoe colonnades under palm groves.',
    tStart: 37.6,
    tEnd: 41.5,
    radarX: 0.24,
    radarY: 0.58,
    extImg: 'images/photoreal/veo_moorish_oasis_1788571564882.jpg',
    intImg: 'images/photoreal/omni_moorish_interior_1788572556838.jpg',
    extLabel: 'Oasis Courtyard',
    intLabel: 'Muqarnas Court (Interior)',
    lore: 'Inspired by the Alhambra, this tranquil desert haven features long reflecting pools flanked by slender cypress trees, orange blossoms, and horseshoe-arched pavilions.',
    plots: ['plot-o-01', 'plot-o-02', 'plot-o-03'],
    videoPlots: [
      {
        id: 'plot-o-01',
        code: 'O-01',
        title: 'Alhambra Pool Pavilion',
        tier: 'Oasis Tier',
        price: 3400,
        status: 'available',
        x: 48,
        y: 52,
        highlight: true
      }
    ]
  },
  {
    id: 'moorish-interior',
    stage: 11,
    name: 'Moorish Oasis Muqarnas Court (Interior)',
    districtKey: 'oasis',
    sub: 'Intricate stalactite vaulting, zellij tilework, and marble basin.',
    tStart: 41.5,
    tEnd: 45.4,
    radarX: 0.24,
    radarY: 0.58,
    extImg: 'images/photoreal/omni_moorish_interior_1788572556838.jpg',
    intImg: 'images/photoreal/veo_moorish_oasis_1788571564882.jpg',
    extLabel: 'Muqarnas Court (Interior)',
    intLabel: 'Oasis Courtyard',
    lore: 'Inside the pavilion court, light filters through pierced geometric screens onto intricate honeycombed Muqarnas vaulting and emerald zellij tiles. A central bubbling marble fountain echoes with gentle peace.',
    plots: ['plot-o-04', 'plot-o-05'],
    videoPlots: [
      {
        id: 'plot-o-04',
        code: 'O-04',
        title: 'Zellij Alcove Sanctuary',
        tier: 'Oasis Tier',
        price: 3800,
        status: 'available',
        x: 52,
        y: 60,
        highlight: true
      }
    ]
  },
  {
    id: 'waterfall-lake',
    stage: 12,
    name: 'Mirror Lake Surface & Cascades',
    districtKey: 'lake',
    sub: 'Glassy emerald alpine waters reflecting the eastern peaks.',
    tStart: 45.4,
    tEnd: 48.9,
    radarX: 0.72,
    radarY: 0.42,
    extImg: 'images/photoreal/veo_waterfall_lake_1788571971638.jpg',
    intImg: null,
    extLabel: 'Mirror Lake Basin',
    intLabel: null,
    lore: 'A serene alpine lake where mountain streams feed quiet shallows filled with floating lotus blossoms. The glassy surface creates perfect reflections of snowcapped peaks.',
    plots: ['plot-l-01', 'plot-l-02', 'plot-l-03'],
    videoPlots: [
      {
        id: 'plot-l-01',
        code: 'L-01',
        title: 'Mirror Water Lily Shore',
        tier: 'Lakeside Tier',
        price: 2400,
        status: 'available',
        x: 44,
        y: 60,
        highlight: true
      }
    ]
  },
  {
    id: 'underwater-koi',
    stage: 13,
    name: 'Underwater Koi Shallows (Aquatic Realm)',
    districtKey: 'underwater',
    isUnderwater: true,
    sub: 'Golden Nishikigoi gliding through crystal sunlit freshwater flora.',
    tStart: 48.9,
    tEnd: 52.4,
    radarX: 0.72,
    radarY: 0.42,
    extImg: 'images/photoreal/veo_underwater_koi_shallows.jpg',
    intImg: 'images/photoreal/veo_waterfall_lake_1788571971638.jpg',
    extLabel: 'Koi Shallows (UW)',
    intLabel: 'Mirror Lake Surface',
    lore: 'Gliding beneath the surface of Mirror Lake into a freshwater sanctuary populated by gentle golden Nishikigoi koi. Submerged white stone pedestals and lotus stems sway in the gentle currents.',
    plots: ['plot-l-uw1', 'plot-l-uw2'],
    videoPlots: [
      {
        id: 'plot-l-uw1',
        code: 'UW-L1',
        title: 'Golden Koi Sanctuary',
        tier: 'Aquatic Tier',
        price: 3300,
        status: 'available',
        x: 46,
        y: 55,
        highlight: true
      }
    ]
  },
  {
    id: 'zen-pagoda',
    stage: 14,
    name: 'Five-Tiered Zen Pagoda (Exterior)',
    districtKey: 'pagoda',
    sub: 'Vermilion tiered pagoda rising above cherry blossom terraces.',
    tStart: 52.4,
    tEnd: 56.3,
    radarX: 0.78,
    radarY: 0.52,
    extImg: 'images/photoreal/veo_zen_pagoda_1788571581239.jpg',
    intImg: 'images/photoreal/omni_pagoda_interior_1788572569485.jpg',
    extLabel: 'Pagoda Tier Spire',
    intLabel: 'Zen Shrine (Interior)',
    lore: 'Perched on the eastern shore, the five-tiered pagoda embodies Buddhist mindfulness. Curved copper eaves and vermilion columns rise amid cherry blossom trees and raked Zen gravel gardens.',
    plots: ['plot-p-01', 'plot-p-02', 'plot-p-03'],
    videoPlots: [
      {
        id: 'plot-p-01',
        code: 'P-01',
        title: 'Cherry Blossom Terrace',
        tier: 'Pagoda Tier',
        price: 3800,
        status: 'available',
        x: 55,
        y: 45,
        highlight: true
      }
    ]
  },
  {
    id: 'pagoda-interior',
    stage: 15,
    name: 'Zen Pagoda Shrine (Sacred Interior)',
    districtKey: 'pagoda',
    sub: 'Serene incense-lit tatami sanctuary with polished cedar woodwork.',
    tStart: 56.3,
    tEnd: 60.2,
    radarX: 0.78,
    radarY: 0.52,
    extImg: 'images/photoreal/omni_pagoda_interior_1788572569485.jpg',
    intImg: 'images/photoreal/veo_zen_pagoda_1788571581239.jpg',
    extLabel: 'Zen Shrine (Interior)',
    intLabel: 'Pagoda Tier Spire',
    lore: 'The interior of the pagoda provides a place of pure tranquility: natural tatami mats, paper shoji screens, and a serene golden Buddha statue surrounded by gently flickering candlelight.',
    plots: ['plot-p-04', 'plot-p-05'],
    videoPlots: [
      {
        id: 'plot-p-04',
        code: 'P-04',
        title: 'Shoji Shrine Memorial',
        tier: 'Pagoda Tier',
        price: 4100,
        status: 'available',
        x: 48,
        y: 58,
        highlight: true
      }
    ]
  },
  {
    id: 'kaya-island',
    stage: 16,
    name: 'Kaya Island & Siberian Husky Monument',
    districtKey: 'island',
    sub: 'Offshore clifftop promontory and marble monument honoring Kaya.',
    tStart: 60.2,
    tEnd: 64.3,
    radarX: 0.82,
    radarY: 0.80,
    extImg: 'images/photoreal/veo_kaya_island_husky_statue.jpg',
    intImg: null,
    extLabel: 'Kaya Clifftop Plinth',
    intLabel: null,
    lore: 'An emerald island rising from sapphire ocean waters off the southern coast. Atop its highest bluff stands the magnificent bronze and marble monument of the female Siberian Husky Kaya, watching eternally over all companion animals.',
    plots: ['plot-k-01', 'plot-k-02', 'plot-k-03'],
    videoPlots: [
      {
        id: 'plot-k-01',
        code: 'K-01',
        title: 'Husky Bluff Crest',
        tier: 'Island Pinnacle',
        price: 4200,
        status: 'available',
        x: 52,
        y: 48,
        highlight: true
      }
    ]
  },
  {
    id: 'underwater-coral-reef',
    stage: 17,
    name: 'Sunken Coral Reef Sanctuary (Underwater Realm)',
    districtKey: 'underwater',
    isUnderwater: true,
    sub: 'Bioluminescent coral gardens and sea life in turquoise waters.',
    tStart: 64.3,
    tEnd: 67.4,
    radarX: 0.86,
    radarY: 0.86,
    extImg: 'images/photoreal/veo_underwater_coral_reef.jpg',
    intImg: 'images/photoreal/veo_kaya_island_husky_statue.jpg',
    extLabel: 'Coral Reef (UW)',
    intLabel: 'Kaya Island Coast',
    lore: 'Surrounding the rocky shoals of Kaya Island lies a vibrant coral reef alive with purple sea fans, golden anemones, and schools of blue damselfish swimming over submerged columns.',
    plots: ['plot-k-uw1', 'plot-k-uw2'],
    videoPlots: [
      {
        id: 'plot-k-uw1',
        code: 'UW-K1',
        title: 'Sunken Coral Garden',
        tier: 'Reef Tier',
        price: 3600,
        status: 'available',
        x: 50,
        y: 52,
        highlight: true
      }
    ]
  },
  {
    id: 'underwater-abyss',
    stage: 18,
    name: 'Oceanic Abyssal Trench (Deep Abyss)',
    districtKey: 'underwater',
    isUnderwater: true,
    sub: 'Deep underwater sanctuary with ethereal luminous vents.',
    tStart: 67.4,
    tEnd: 72.9,
    radarX: 0.90,
    radarY: 0.92,
    extImg: 'images/photoreal/veo_underwater_abyssal_trench.jpg',
    intImg: 'images/photoreal/veo_underwater_coral_reef.jpg',
    extLabel: 'Abyssal Trench (UW)',
    intLabel: 'Coral Reef (UW)',
    lore: 'Descending into the deep sapphire abyss off the southern continental shelf. Bioluminescent dolphins and giant manta rays glide through ancient volcanic spires crowned with radiant cyan crystals.',
    plots: ['plot-k-uw4', 'plot-k-uw5'],
    videoPlots: [
      {
        id: 'plot-k-uw4',
        code: 'UW-K4',
        title: 'Bioluminescent Abyss Vault',
        tier: 'Abyssal Pinnacle',
        price: 6500,
        status: 'available',
        x: 44,
        y: 56,
        highlight: true
      }
    ]
  }
];

class VeoTourController {
  constructor() {
    this.container = null;
    this.video = null;
    this.radarCanvas = null;
    this.radarCtx = null;
    this.activeStage = VEO_LANDMARKS[0];
    this.landmarks = VEO_LANDMARKS;
    this.isPlaying = false;
    this.isMuted = true;
    this.currentViewMode = 'exterior';
    this.activeInspectionLandmark = null;
    this._rafId = null;
    this._initialized = false;
    this._renderedStageId = null;
  }

  init() {
    if (this._initialized) return;
    this.container = document.getElementById('veoDroneTourContainer');
    this.video = document.getElementById('veoDroneTourVideo');
    this.radarCanvas = document.getElementById('veoRadarCanvas');
    if (this.radarCanvas) {
      this.radarCtx = this.radarCanvas.getContext('2d');
    }

    if (!this.container || !this.video) {
      console.warn('[VeoTourController] DOM elements not ready, deferred.');
      return;
    }

    this._bindVideoEvents();
    this._bindOverlayEvents();
    this._drawRadar(0.0);
    this._updateVideoPlots(this.activeStage);
    this._initialized = true;
    console.log('[VeoTourController] Initialized successfully with 15 geographically interwoven land-and-water stages.');
  }

  _bindVideoEvents() {
    if (!this.video) return;

    this.video.addEventListener('timeupdate', () => {
      const t = this.video.currentTime;
      this._updateProgress(t);
      this._updateActiveStage(t);
      this._updateVideoPlots(this.activeStage);
      this._drawRadar(t / (this.video.duration || 60.0));
    });

    this.video.addEventListener('play', () => {
      this.isPlaying = true;
      this._updatePlayButton(true);
    });

    this.video.addEventListener('pause', () => {
      this.isPlaying = false;
      this._updatePlayButton(false);
    });

    this.video.addEventListener('ended', () => {
      this.video.currentTime = 0;
      this.video.play().catch(() => {});
    });
  }

  _bindOverlayEvents() {
    const clickSurface = document.getElementById('veoClickSurface');
    if (clickSurface) {
      clickSurface.addEventListener('click', (e) => {
        if (
          e.target.closest('#veoFlightControls') ||
          e.target.closest('#veoValleyRadar') ||
          e.target.closest('.veo-plot-pin') ||
          e.target.closest('.veo-no-click')
        ) {
          return;
        }
        this.openAreaInspection(this.activeStage.id);
      });
    }

    const playBtn = document.getElementById('veoPlayBtn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }

    const soundBtn = document.getElementById('veoSoundBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMute();
      });
    }

    const exitBtn = document.getElementById('veoExitBtn');
    if (exitBtn) {
      exitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exitTourTo3D();
      });
    }

    const switch3dBtn = document.getElementById('veoSwitch3dBtn');
    if (switch3dBtn) {
      switch3dBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exitTourTo3D();
      });
    }

    const mapBtn = document.getElementById('veoOpenMapBtn');
    if (mapBtn) {
      mapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.UI && typeof window.UI.show2D === 'function') {
          window.UI.show2D();
        }
      });
    }

    const v2dTourBtn = document.getElementById('view2dReturnTourBtn');
    if (v2dTourBtn) {
      v2dTourBtn.addEventListener('click', () => {
        if (window.UI && typeof window.UI.startDroneTour === 'function') {
          window.UI.startDroneTour(this.activeStage?.stage || 0);
        }
      });
    }

    const v2d3dBtn = document.getElementById('view2dReturn3dBtn');
    if (v2d3dBtn) {
      v2d3dBtn.addEventListener('click', () => {
        if (window.UI && typeof window.UI.show3D === 'function') {
          window.UI.show3D();
        }
      });
    }

    const scrubBar = document.getElementById('veoScrubBar');
    if (scrubBar) {
      scrubBar.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = scrubBar.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetTime = frac * (this.video.duration || 60.0);
        this.video.currentTime = targetTime;
        if (!this.isPlaying) this.video.play().catch(() => {});
      });
    }

    const pillsContainer = document.getElementById('veoLandmarkPills');
    if (pillsContainer) {
      pillsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.veo-landmark-pill');
        if (!btn) return;
        e.stopPropagation();
        const id = btn.dataset.landmarkId;
        this.jumpToLandmark(id);
      });
    }

    const modalClose = document.getElementById('veoModalClose');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeAreaInspection());
    }

    const modalBackdrop = document.getElementById('veoModalBackdrop');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', () => this.closeAreaInspection());
    }

    const modalResume = document.getElementById('veoModalResumeTour');
    if (modalResume) {
      modalResume.addEventListener('click', () => {
        this.closeAreaInspection();
        this.video.play().catch(() => {});
      });
    }

    const modal3d = document.getElementById('veoModalExplore3d');
    if (modal3d) {
      modal3d.addEventListener('click', () => {
        const lm = this.activeInspectionLandmark || this.activeStage;
        this.closeAreaInspection();
        this.exitTourTo3D(lm.districtKey);
      });
    }

    const viewExtBtn = document.getElementById('veoToggleExterior');
    const viewIntBtn = document.getElementById('veoToggleInterior');
    if (viewExtBtn && viewIntBtn) {
      viewExtBtn.addEventListener('click', () => this.setModalView('exterior'));
      viewIntBtn.addEventListener('click', () => this.setModalView('interior'));
    }
  }

  start(stageIdOrIndex = 0) {
    if (!this._initialized) this.init();
    if (!this.container || !this.video) {
      this.container = document.getElementById('veoDroneTourContainer');
      this.video = document.getElementById('veoDroneTourVideo');
      if (!this._initialized && this.container && this.video) this.init();
    }
    if (!this.container || !this.video) return;

    window.UI?._setView({view:'view3d',btn:'btnDroneTour'});
    window.UI?.world?.stop();
    document.body.classList.add('is-film');
    const stage = document.getElementById('stage');
    if (stage) {
      stage.classList.remove('hidden');
      stage.classList.add('is-active');
    }
    const view3d = document.getElementById('view3d');
    if (view3d) {
      view3d.classList.remove('hidden');
      view3d.classList.add('is-active');
    }

    this.container.classList.remove('hidden');
    this.container.classList.add('is-active');
    this.container.style.display = 'block';
    this.container.style.zIndex = '1000';
    this.container.style.opacity = '1';

    let targetTime = 0.0;
    if (typeof stageIdOrIndex === 'number' && VEO_LANDMARKS[stageIdOrIndex]) {
      targetTime = VEO_LANDMARKS[stageIdOrIndex].tStart;
      this.activeStage = VEO_LANDMARKS[stageIdOrIndex];
    } else if (typeof stageIdOrIndex === 'string') {
      const found = VEO_LANDMARKS.find(l => l.id === stageIdOrIndex || l.districtKey === stageIdOrIndex);
      if (found) {
        targetTime = found.tStart;
        this.activeStage = found;
      }
    }

    this.video.currentTime = targetTime;
    this._updateHUD(this.activeStage);
    this._updateVideoPlots(this.activeStage);

    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isPlaying = true;
          this._updatePlayButton(true);
          const prompt = document.getElementById('veoAutoplayPrompt');
          if (prompt) prompt.classList.add('hidden');
        })
        .catch(err => {
          console.warn('[VeoTourController] Autoplay prevented, trying muted autoplay fallback:', err);
          this.video.muted = true;
          this.isMuted = true;
          this.video.play()
            .then(() => {
              this.isPlaying = true;
              this._updatePlayButton(true);
              const prompt = document.getElementById('veoAutoplayPrompt');
              if (prompt) prompt.classList.add('hidden');
            })
            .catch(err2 => {
              console.warn('[VeoTourController] Muted autoplay also blocked, showing prompt:', err2);
              this.isPlaying = false;
              this._updatePlayButton(false);
              const prompt = document.getElementById('veoAutoplayPrompt');
              if (prompt) prompt.classList.remove('hidden');
            });
        });
    }

    const topBtn = document.getElementById('btnDroneTour');
    if (topBtn) {
      document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
      topBtn.classList.add('active');
    }
  }

  openInspector(lm) {
    if (!lm) return;
    const landmarkId = typeof lm === 'string' ? lm : (lm.id || lm.districtKey);
    this.openAreaInspection(landmarkId);
  }

  stop() {
    document.body.classList.remove('is-film');
    if (!this.container || !this.video) return;
    this.video.pause();
    this.isPlaying = false;
    this._updatePlayButton(false);
    this.container.classList.add('hidden');
    this.container.classList.remove('is-active');
    this.container.style.display = 'none';
    this.closeAreaInspection();
    this._renderedStageId = null;
    const overlay = document.getElementById('veoVideoPlotsOverlay');
    if (overlay) overlay.innerHTML = '';
  }

  togglePlay() {
    if (!this.video) return;
    if (this.video.paused) {
      this.video.play().catch(() => {});
    } else {
      this.video.pause();
    }
  }

  toggleMute() {
    if (!this.video) return;
    this.isMuted = !this.isMuted;
    this.video.muted = this.isMuted;
    const soundBtn = document.getElementById('veoSoundBtn');
    if (soundBtn) {
      soundBtn.innerHTML = this.isMuted
        ? '<span class="veo-icon"></span>'
        : '<span class="veo-icon"></span>';
      soundBtn.title = this.isMuted ? 'Unmute Audio' : 'Mute Audio';
    }
  }

  jumpToLandmark(landmarkId) {
    const lm = VEO_LANDMARKS.find(l => l.id === landmarkId || l.districtKey === landmarkId);
    if (!lm || !this.video) return;
    this.video.currentTime = lm.tStart + 0.05;
    this._updateVideoPlots(lm);
    if (this.video.paused) this.video.play().catch(() => {});
  }

  jumpToStage(stageIndex) {
    const lm = VEO_LANDMARKS.find(l => l.stage === stageIndex);
    if (!lm || !this.video) return;
    this.video.currentTime = lm.tStart + 0.05;
    this._updateVideoPlots(lm);
    if (this.video.paused) this.video.play().catch(() => {});
  }

  exitTourTo3D() {
    const destination=this.activeInspectionLandmark?.id||this.activeStage?.id;
    this.stop();window.UI?.showPhotographic?.(destination);
  }

  _updatePlayButton(isPlaying) {
    const playBtn = document.getElementById('veoPlayBtn');
    if (playBtn) {
      playBtn.innerHTML = isPlaying
        ? '<span class="veo-icon"></span>'
        : '<span class="veo-icon"></span>';
      playBtn.title = isPlaying ? 'Pause Tour' : 'Resume Tour';
    }
  }

  _updateProgress(currentTime) {
    const total = this.video.duration || 60.0;
    const pct = Math.max(0, Math.min(100, (currentTime / total) * 100));

    const fill = document.getElementById('veoScrubFill');
    if (fill) fill.style.width = `${pct}%`;

    const timeText = document.getElementById('veoTimeText');
    if (timeText) {
      const curM = Math.floor(currentTime / 60);
      const curS = Math.floor(currentTime % 60).toString().padStart(2, '0');
      const totM = Math.floor(total / 60);
      const totS = Math.floor(total % 60).toString().padStart(2, '0');
      timeText.textContent = `${curM}:${curS} / ${totM}:${totS}`;
    }
  }

  _updateActiveStage(t) {
    let matched = VEO_LANDMARKS[0];
    for (let i = 0; i < VEO_LANDMARKS.length; i++) {
      const lm = VEO_LANDMARKS[i];
      if (t >= lm.tStart && (t < lm.tEnd || i === VEO_LANDMARKS.length - 1)) {
        matched = lm;
        break;
      }
    }

    if (this.activeStage.id !== matched.id) {
      this.activeStage = matched;
      this._updateHUD(matched);
      this._updateVideoPlots(matched);
    }
  }

  _updateHUD(lm) {
    const badge = document.getElementById('veoBeaconBadge');
    if (badge) {
      const stageStr = lm.stage === 0
        ? 'SANCTUARY OVERVIEW'
        : (lm.isUnderwater ? `UNDERWATER REALM · STAGE ${lm.stage}/18` : `STAGE ${lm.stage}/18`);
      badge.innerHTML = `
        <div class="veo-beacon-pill ${lm.isUnderwater ? 'is-underwater' : ''}">
          <span class="veo-beacon-dot ${lm.isUnderwater ? 'dot-uw' : ''}"></span>
          <span class="veo-beacon-stage">${stageStr}</span>
          <span class="veo-beacon-title">${lm.name}</span>
        </div>
        <div class="veo-beacon-hint">✦ Choose a destination, stop, and explore its plots</div>
      `;
    }

    document.querySelectorAll('.veo-landmark-pill').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.landmarkId === lm.id);
    });
  }

  _updateVideoPlots(currentStage) {
    const overlay=document.getElementById('veoVideoPlotsOverlay');
    if(!overlay || !currentStage || this._renderedStageId===currentStage.id)return;
    this._renderedStageId=currentStage.id;overlay.replaceChildren();
    const button=document.createElement('button');button.type='button';button.className='film-destination-plots veo-no-click';
    button.textContent='Stop here · View plots & memorials';
    button.onclick=e=>{e.stopPropagation();this.video.pause();window.UI?.showPhotographic?.(currentStage.id,{browse:true});};
    overlay.appendChild(button);
  }
  _drawRadar(normProgress) {
    if (!this.radarCtx || !this.radarCanvas) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar Circular Border & Grid
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 14, 18, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Concentric sweep rings
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, (w / 2 - 4) * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(w / 2, 4);
    ctx.lineTo(w / 2, h - 4);
    ctx.moveTo(4, h / 2);
    ctx.lineTo(w - 4, h / 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.stroke();
    ctx.restore();

    // 2. Continuous Topographical Flight River & Path
    ctx.save();
    ctx.beginPath();
        const pts = [
      { x: 0.50, y: 0.92 }, // 0. Closed Gates
      { x: 0.50, y: 0.84 }, // 1. Open Portal Arch
      { x: 0.50, y: 0.70 }, // 2. Rainbow Bridge
      { x: 0.50, y: 0.52 }, // 3. Central Plaza & Living Fountain
      { x: 0.50, y: 0.32 }, // 4. Waterfall Ascent
      { x: 0.50, y: 0.38 }, // 5. Plunge Pool (UW)
      { x: 0.50, y: 0.18 }, // 6. Cathedral Citadel
      { x: 0.50, y: 0.18 }, // 7. Cathedral Nave
      { x: 0.28, y: 0.34 }, // 8. Canyon Mesa
      { x: 0.28, y: 0.34 }, // 9. Sun-Kiva Interior
      { x: 0.24, y: 0.58 }, // 10. Moorish Oasis
      { x: 0.24, y: 0.58 }, // 11. Muqarnas Court
      { x: 0.72, y: 0.42 }, // 12. Mirror Lake
      { x: 0.72, y: 0.42 }, // 13. Koi Shallows (UW)
      { x: 0.78, y: 0.52 }, // 14. Zen Pagoda
      { x: 0.78, y: 0.52 }, // 15. Pagoda Shrine
      { x: 0.82, y: 0.80 }, // 16. Kaya Island
      { x: 0.86, y: 0.86 }, // 17. Coral Reef (UW)
      { x: 0.90, y: 0.92 }  // 18. Abyssal Trench (UW)
    ];

    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h);
    }
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 3. Landmark Nodes on Radar
    VEO_LANDMARKS.forEach((lm) => {
      const lx = lm.radarX * w;
      const ly = lm.radarY * h;
      const isCur = lm.id === this.activeStage.id;

      ctx.beginPath();
      ctx.arc(lx, ly, isCur ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isCur
        ? (lm.isUnderwater ? '#38d9d2' : '#e8c04a')
        : (lm.isUnderwater ? 'rgba(56, 217, 210, 0.55)' : 'rgba(255, 255, 255, 0.45)');
      ctx.fill();

      if (isCur) {
        ctx.beginPath();
        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
        ctx.strokeStyle = lm.isUnderwater ? 'rgba(56, 217, 210, 0.65)' : 'rgba(232, 192, 74, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // 4. Smooth Interpolated Live Drone Position
    const totalDuration = this.video.duration || 60.0;
    const curTime = normProgress * totalDuration;

    let activeIdx = 0;
    for (let i = 0; i < VEO_LANDMARKS.length; i++) {
      if (curTime >= VEO_LANDMARKS[i].tStart && (curTime <= VEO_LANDMARKS[i].tEnd || i === VEO_LANDMARKS.length - 1)) {
        activeIdx = i;
        break;
      }
    }
    const currentLM = VEO_LANDMARKS[activeIdx];
    const span = Math.max(0.01, currentLM.tEnd - currentLM.tStart);
    const stageFrac = Math.max(0, Math.min(1, (curTime - currentLM.tStart) / span));

    const p1 = pts[Math.min(pts.length - 1, activeIdx)];
    const p2 = pts[Math.min(pts.length - 1, activeIdx + 1)];
    const curX = (p1.x + (p2.x - p1.x) * stageFrac) * w;
    const curY = (p1.y + (p2.y - p1.y) * stageFrac) * h;

    // Glowing Drone Pip
    ctx.save();
    const isUW = currentLM.isUnderwater;
    const grad = ctx.createRadialGradient(curX, curY, 0, curX, curY, 12);
    grad.addColorStop(0, isUW ? 'rgba(200, 255, 250, 0.95)' : 'rgba(255, 240, 160, 0.9)');
    grad.addColorStop(0.4, isUW ? 'rgba(56, 217, 210, 0.65)' : 'rgba(232, 192, 74, 0.6)');
    grad.addColorStop(1, isUW ? 'rgba(56, 217, 210, 0)' : 'rgba(232, 192, 74, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(curX, curY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  openAreaInspection(landmarkOrDistrictId, targetPlotId = null) {
    const lm = VEO_LANDMARKS.find(l => l.id === landmarkOrDistrictId || l.districtKey === landmarkOrDistrictId) || this.activeStage;
    this.activeInspectionLandmark = lm;
    this.currentViewMode = 'exterior';

    if (this.video && !this.video.paused) {
      this.video.pause();
    }

    const modal = document.getElementById('veoAreaInspectionModal');
    if (!modal) return;

    const imgEl = document.getElementById('veoModalHeroImg');
    if (imgEl) {
      imgEl.src = sceneImage(lm);
      imgEl.alt = lm.name;
    }

    const titleEl = document.getElementById('veoModalTitle');
    if (titleEl) titleEl.textContent = lm.name;

    const subEl = document.getElementById('veoModalSub');
    if (subEl) {
      subEl.textContent = `${lm.sub} · District: ${lm.districtKey.toUpperCase()}${lm.isUnderwater ? ' · AQUATIC REALM' : ''}`;
    }

    const loreEl = document.getElementById('veoModalLore');
    if (loreEl) loreEl.textContent = lm.lore;

    const toggleContainer = document.getElementById('veoModalViewToggle');
    const viewExtBtn = document.getElementById('veoToggleExterior');
    const viewIntBtn = document.getElementById('veoToggleInterior');

    if (lm.intImg) {
      if (toggleContainer) toggleContainer.style.display = 'flex';
      if (viewExtBtn) viewExtBtn.textContent = lm.extLabel || 'Primary Architecture';
      if (viewIntBtn) viewIntBtn.textContent = lm.intLabel || 'Submerged/Interior View';
      this.setModalView('exterior');
    } else {
      if (toggleContainer) toggleContainer.style.display = 'none';
    }

    this._populateModalPlots(lm, targetPlotId);

    modal.classList.remove('hidden');
    modal.classList.add('is-active');
  }

  setModalView(mode) {
    this.currentViewMode = mode;
    const lm = this.activeInspectionLandmark;
    if (!lm) return;

    const imgEl = document.getElementById('veoModalHeroImg');
    const viewExtBtn = document.getElementById('veoToggleExterior');
    const viewIntBtn = document.getElementById('veoToggleInterior');

    if (imgEl) {
      imgEl.style.opacity = '0.3';
      setTimeout(() => {
        imgEl.src = (mode === 'interior' && lm.intImg) ? lm.intImg : sceneImage(lm);
        imgEl.style.opacity = '1';
      }, 150);
    }

    if (viewExtBtn) viewExtBtn.classList.toggle('is-active', mode === 'exterior');
    if (viewIntBtn) viewIntBtn.classList.toggle('is-active', mode === 'interior');
  }

  _populateModalPlots(lm, targetPlotId = null) {
    const list=document.getElementById('veoModalPlotsList');if(!list)return;
    list.replaceChildren();
    const plots=plotsForScene(lm,window.UI?.plots||[],State.data?.ownedPlots||{});
    for(const plot of plots.slice(0,12)) {
      const card=document.createElement('button');card.type='button';card.className='photo-plot-card';
      const title=document.createElement('strong');title.textContent=`Plot ${plot.id}`;
      const detail=document.createElement('span');detail.textContent=plot.status==='available'?`$${plot.price.toLocaleString()} · View plot`:`${plot.memorial?.petName||'Beloved companion'} · Visit memorial`;
      card.append(title,detail);card.onclick=()=>this.reservePlot(plot);list.appendChild(card);
    }
    if(!plots.length){const empty=document.createElement('p');empty.textContent='No catalog plots are available for this destination yet.';list.appendChild(empty);}
  }

  async reservePlot(plot) {
    const canonical=window.UI?.plots?.find(p=>p===plot);
    if(!canonical)return;
    this.closeAreaInspection();
    await window.UI?.visitPhotographicPlot?.(canonical);
  }

  closeAreaInspection() {
    const modal = document.getElementById('veoAreaInspectionModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('is-active');
    }
    this.activeInspectionLandmark = null;
  }
}

export const veoTourController = new VeoTourController();
export const veoTour = veoTourController;
export const VeoTour = veoTourController;
if (typeof window !== 'undefined') {
  window.veoTourController = veoTourController;
  window.veoTour = veoTourController;
  window.VeoTour = veoTourController;
  window.VeoTourController = veoTourController;
}
