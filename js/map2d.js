// ============================================================
// ETERNAL VALLEY — Master Cartographic 2D Layout Map Engine
// Authoritative single-world layout detailing all terrestrial biomes,
// natural water networks, bathymetric underwater realms, and the
// 15-stage continuous Veo Drone Flight Path.
// ============================================================

import { WORLD, DISTRICTS, ROADS, RIVER_INLET, RIVER_OUTLET, terrainHeight } from './terrain.js?v=73';

// 15 Geographic Stages in True Valley Land-and-Water Spatial Order
export const TOUR_WAYPOINTS = [
  { stage: 0, id: 'grand-gate-closed', name: 'The Grand Gates (Closed)', sub: 'Monumental Gilded Portal', x: 0, z: 920, y: 8.5, uw: false, icon: '🚪', color: '#e5c158' },
  { stage: 1, id: 'grand-gate-open', name: 'The Grand Gates (Open)', sub: 'Triumphal Sanctuary Portal', x: 0, z: 880, y: 8.5, uw: false, icon: '🏛️', color: '#e5c158' },
  { stage: 2, id: 'rainbow-bridge', name: 'The Rainbow Bridge', sub: 'Prismatic River Arch', x: 0, z: 440, y: 18, uw: false, icon: '🌈', color: '#e5c158' },
  { stage: 3, id: 'central-plaza', name: 'Central Plaza & Eternal Tree', sub: 'Valley Heart & Living Fountain', x: 0, z: 20, y: 15, uw: false, icon: '⛲', color: '#e5c158' },
  { stage: 4, id: 'waterfall', name: 'Great Cataract Waterfall', sub: '182m Northern Cascade Ascent', x: 0, z: -550, y: 120, uw: false, icon: '🌊', color: '#e5c158' },
  { stage: 5, id: 'underwater-plunge-pool', name: 'Cataract Plunge Pool', sub: 'Glacial Shallows & Boulders', x: 0, z: -460, y: -18, uw: true, icon: '🫧', color: '#00e5ff' },
  { stage: 6, id: 'cathedral', name: 'Universal Cathedral Citadel', sub: 'Hohenzollern Crag & Spire', x: 0, z: -687, y: 182, uw: false, icon: '🏰', color: '#e5c158' },
  { stage: 7, id: 'cathedral-interior', name: 'Cathedral Sacred Nave', sub: 'Gilded Rococo Starlight Vault', x: 0, z: -687, y: 182, uw: false, icon: '✨', color: '#ffd700' },
  { stage: 8, id: 'desert-canyon', name: 'Phantasm Tree & Canyon', sub: 'Glowing Elder Tree & Red Mesa', x: -720, z: -340, y: 115, uw: false, icon: '🌳', color: '#e5c158' },
  { stage: 9, id: 'kiva-interior', name: 'Ancestral Sun-Kiva', sub: 'Circular Stone Fire Sanctuary', x: -720, z: -340, y: 115, uw: false, icon: '🔥', color: '#ffd700' },
  { stage: 10, id: 'moorish-oasis', name: 'Moorish Alhambra Oasis', sub: 'Reflecting Pools & Cypress', x: -480, z: -200, y: 96, uw: false, icon: '🕌', color: '#e5c158' },
  { stage: 11, id: 'moorish-interior', name: 'Moorish Muqarnas Court', sub: 'Stalactite Vaults & Fountain', x: -480, z: -200, y: 96, uw: false, icon: '💠', color: '#ffd700' },
  { stage: 12, id: 'waterfall-lake', name: 'Mirror Lake Surface', sub: 'Lotus Water Lily Basin', x: 380, z: -220, y: 13, uw: false, icon: '🪷', color: '#e5c158' },
  { stage: 13, id: 'underwater-koi-shallows', name: 'Underwater Koi Shallows', sub: 'Sunken Pedestals & Golden Koi', x: 430, z: -260, y: -8, uw: true, icon: '🐟', color: '#00e5ff' },
  { stage: 14, id: 'zen-pagoda', name: 'Five-Tiered Zen Pagoda', sub: 'Cherry Blossom Shore', x: 560, z: -540, y: 135, uw: false, icon: '⛩️', color: '#e5c158' },
  { stage: 15, id: 'pagoda-interior', name: 'Zen Pagoda Shrine', sub: 'Incense Tatami Sanctuary', x: 560, z: -540, y: 135, uw: false, icon: '🕯️', color: '#ffd700' },
  { stage: 16, id: 'kaya-island', name: 'Kaya Island', sub: 'Siberian Husky Spirit Companion', x: 20, z: 2980, y: 22, uw: false, icon: '🐾', color: '#e5c158' },
  { stage: 17, id: 'underwater-coral-reef', name: 'Sunken Coral Reef Sanctuary', sub: 'Turquoise Lagoon & Sea Turtles', x: 70, z: 3120, y: -12, uw: true, icon: '🪸', color: '#00e5ff' },
  { stage: 18, id: 'underwater-abyssal-trench', name: 'Oceanic Abyssal Trench', sub: 'Bioluminescent Marine Vaults', x: 100, z: 3350, y: -42, uw: true, icon: '🌌', color: '#00e5ff' }
];

// 4 Distinct Bathymetric Underwater Realms
export const UNDERWATER_ZONES = [
  {
    id: 'plunge-pool',
    name: 'Cataract Plunge Pool',
    depth: '18m Depth',
    sub: 'Glacial Tarn & Submerged Granite Shallows',
    cx: 0, cz: -460, rx: 75, rz: 55,
    fill: 'rgba(0, 180, 216, 0.28)',
    stroke: '#00b4d8'
  },
  {
    id: 'koi-shallows',
    name: 'Mirror Lake Koi Shallows',
    depth: '8m Depth',
    sub: 'Freshwater Submerged Lotus Altars',
    cx: 430, cz: -260, rx: 200, rz: 150,
    fill: 'rgba(72, 202, 228, 0.24)',
    stroke: '#48cae4'
  },
  {
    id: 'coral-lagoon',
    name: 'Kaya Coral Lagoon',
    depth: '12m Depth',
    sub: 'Turquoise Reef Gardens & Sea Turtle Preserve',
    cx: 70, cz: 3120, rx: 230, rz: 170,
    fill: 'rgba(0, 245, 212, 0.25)',
    stroke: '#00f5d4'
  },
  {
    id: 'abyssal-trench',
    name: 'Oceanic Abyssal Trench',
    depth: '42m Depth',
    sub: 'Bioluminescent Hydrothermal Vents & Ray Depths',
    cx: 100, cz: 3350, rx: 360, rz: 200,
    fill: 'rgba(11, 19, 43, 0.55)',
    stroke: '#5bc0be'
  }
];

export class Map2D {
  constructor(canvas, plots, onPlotClick) {
    this.cv = canvas || (typeof document !== 'undefined' ? (document.getElementById('canvas2d') || document.querySelector('canvas#canvas2d') || document.createElement('canvas')) : null);
    this.ctx = this.cv?.getContext?.('2d');
    this.plots = plots || [];
    this.onPlotClick = onPlotClick;
    this.scale = 0.20;
    this.cx = 0; this.cz = 600;       // Centered to frame valley basin, northern cathedral, and southern Kaya Island
    this.hover = null;
    this.hoverWp = null;
    this.selected = null;
    this.activeWp = null;
    
    // Layer Toggles
    this.showFlightPath = true;
    this.showUnderwater = true;
    this.showPlots = true;
    this.showMasterPainting = true;
    this.showTerrainContours = true;
    
    // Master Layout Painting Image
    this._masterImg = null;
    this._loadMasterImage();

    this._bind();
    this._bg = null;

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => { this._resize(); this.draw(); });
    }
    this._onResize = () => { this._resize(); this.draw(); };
    if (typeof addEventListener === 'function') {
      addEventListener('resize', this._onResize);
    }
    
    // Animation loop for pulsing flightpath & radar drone cursor
    this._animTime = 0;
    this._animLoop = () => {
      this._animTime += 0.025;
      if (this.cv && this.cv.parentElement && !this.cv.parentElement.classList.contains('hidden')) {
        this.draw();
      }
      this._rafId = requestAnimationFrame(this._animLoop);
    };
    this._rafId = requestAnimationFrame(this._animLoop);
  }

  _loadMasterImage() {
    if (typeof Image === 'undefined') return;
    this._masterImg = new Image();
    this._masterImg.src = 'images/photoreal/eternal_valley_master_layout_map.jpg';
    this._masterImg.onload = () => {
      this._masterImgLoaded = true;
      if (this.showMasterPainting) this.draw();
    };
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (typeof removeEventListener === 'function') {
      removeEventListener('resize', this._onResize);
      removeEventListener('pointermove', this._onPointerMove);
      removeEventListener('pointerup', this._onPointerUp);
    }
    this.cv?.removeEventListener?.('pointerdown', this._onPointerDown);
    this.cv?.removeEventListener?.('wheel', this._onWheel);
  }

  _resize() {
    if (!this.cv) return;
    const p = this.cv.parentElement;
    const r = p ? p.getBoundingClientRect() : { width: (typeof window !== 'undefined' ? window.innerWidth : 800), height: (typeof window !== 'undefined' ? window.innerHeight : 600) };
    if (r.width < 1 || r.height < 1) return;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.cv.width = r.width * dpr;
    this.cv.height = r.height * dpr;
    this.cv.style.width = r.width + 'px';
    this.cv.style.height = r.height + 'px';
    this._bg = null;
  }

  // world → screen (north = -z, so world z increases downward on screen)
  w2s(x, z) {
    const k = this.scale * (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    return [this.cv.width / 2 + (x - this.cx) * k, this.cv.height / 2 + (z - this.cz) * k];
  }
  
  // screen → world
  s2w(px, py) {
    const k = this.scale * (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    return [(px * (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) - this.cv.width / 2) / k + this.cx,
            (py * (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) - this.cv.height / 2) / k + this.cz];
  }

  _bind() {
    let drag = null;
    this._onPointerDown = e => {
      const rect = this.cv.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      if (this._handleHudClick(clickX, clickY)) return;

      drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false };
    };
    
    this._onPointerMove = e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        this.cx = drag.cx - dx / this.scale;
        this.cz = drag.cz - dy / this.scale;
        this.draw();
      } else if (e.target === this.cv) {
        const rect = this.cv.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const [wx, wz] = this.s2w(mx, my);
        this._mouseWorld = [wx, wz];

        const wp = this._waypointAt(wx, wz);
        const p = wp ? null : this._plotAt(wx, wz);
        
        let needRedraw = false;
        if (wp !== this.hoverWp) { this.hoverWp = wp; needRedraw = true; }
        if (p !== this.hover) { this.hover = p; needRedraw = true; }
        if (needRedraw) this.draw();
        
        this.cv.style.cursor = (wp || p) ? 'pointer' : 'grab';
      }
    };
    
    this._onPointerUp = e => {
      if (drag && !drag.moved && e.target === this.cv) {
        const rect = this.cv.getBoundingClientRect();
        const [wx, wz] = this.s2w(e.clientX - rect.left, e.clientY - rect.top);
        
        const wp = this._waypointAt(wx, wz);
        if (wp) {
          this.activeWp = wp;
          this._onWaypointClick(wp);
          this.draw();
          drag = null;
          return;
        }

        const p = this._plotAt(wx, wz);
        if (p) {
          this.selected = p;
          this.onPlotClick?.(p);
          this.draw();
        }
      }
      drag = null;
    };

    this._onWheel = e => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 0.87;
      this.scale = Math.min(3.5, Math.max(0.08, this.scale * f));
      this._bg = null;
      this.draw();
    };

    this.cv.addEventListener('pointerdown', this._onPointerDown);
    addEventListener('pointermove', this._onPointerMove);
    addEventListener('pointerup', this._onPointerUp);
    this.cv.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _handleHudClick(mx, my) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const barW = 440 * dpr;
    const barH = 36 * dpr;
    const barX = (this.cv.width - barW) / 2;
    const barY = 16 * dpr;
    
    const sx = mx * dpr;
    const sy = my * dpr;

    if (sx >= barX && sx <= barX + barW && sy >= barY && sy <= barY + barH) {
      const btnW = barW / 4;
      const idx = Math.floor((sx - barX) / btnW);
      if (idx === 0) { this.showFlightPath = !this.showFlightPath; }
      else if (idx === 1) { this.showUnderwater = !this.showUnderwater; }
      else if (idx === 2) { this.showPlots = !this.showPlots; }
      else if (idx === 3) {
        this.showMasterPainting = !this.showMasterPainting;
        this._bg = null;
      }
      this.draw();
      return true;
    }
    return false;
  }

  _waypointAt(wx, wz) {
    if (!this.showFlightPath) return null;
    let best = null, bd = 28 / this.scale + 12;
    for (const wp of TOUR_WAYPOINTS) {
      const d = Math.hypot(wp.x - wx, wp.z - wz);
      if (d < bd) { bd = d; best = wp; }
    }
    return best;
  }

  _plotAt(wx, wz) {
    if (!this.showPlots) return null;
    let best = null, bd = 14 / this.scale + 6;
    for (const p of this.plots) {
      const d = Math.hypot(p.x - wx, p.z - wz);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _onWaypointClick(wp) {
    if (window.VeoTourController && typeof window.VeoTourController.jumpToStage === 'function') {
      window.VeoTourController.jumpToStage(wp.stage);
    }
    if (window.VeoTourController && typeof window.VeoTourController.openInspector === 'function') {
      const lm = window.VeoTourController.landmarks?.[wp.stage] || {
        id: wp.id,
        stage: wp.stage,
        name: wp.name,
        sub: wp.sub,
        extImg: 'images/photoreal/' + wp.id + '.jpg',
        lore: wp.name + ': ' + wp.sub + '. Part of the unified Eternal Valley sanctuary layout.'
      };
      window.VeoTourController.openInspector(lm);
    }
  }

  select(plot) {
    this.selected = plot;
    if (plot) {
      this.cx = plot.x; this.cz = plot.z;
      this.scale = Math.max(this.scale, 0.8);
      this._bg = null;
    }
    this.draw();
  }

  // ------- High-Fidelity Cartographic Background Layer -------
  _renderBG() {
    const bg = document.createElement('canvas');
    bg.width = this.cv.width; bg.height = this.cv.height;
    const c = bg.getContext('2d');
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    // Master Painting Overlay Mode
    if (this.showMasterPainting && this._masterImg && this._masterImg.complete) {
      const [tlX, tlY] = this.w2s(-1200, -850);
      const [brX, brY] = this.w2s(1200, 2800);
      c.drawImage(this._masterImg, tlX, tlY, brX - tlX, brY - tlY);
      return bg;
    }

    // Topographical terrain sampling
    const step = 7 * dpr;
    for (let py = 0; py < bg.height; py += step) {
      for (let px = 0; px < bg.width; px += step) {
        const [wx, wz] = this.s2w(px / dpr, py / dpr);
        
        if (wz > 2300) {
          c.fillStyle = '#0a1424';
          c.fillRect(px, py, step, step);
          continue;
        } else if (wz > 1450 && Math.abs(wx) > 420) {
          c.fillStyle = '#1b4d6e';
          c.fillRect(px, py, step, step);
          continue;
        } else if (Math.abs(wx) > 1050 || Math.abs(wz) > 1050) {
          c.fillStyle = '#b4bfad';
          c.fillRect(px, py, step, step);
          continue;
        }

        const h = terrainHeight(wx, wz);
        let col;
        if (h < WORLD.waterLevel) {
          col = '#3b86b4';
        } else if (wx < -200 && wz > 140 && h < 95) {
          col = '#c87850';
        } else if (wz < -580 && Math.abs(wx) < 320) {
          col = '#d5c7b0';
        } else if (h > 190) {
          col = '#edf0f4';
        } else if (h > 95) {
          col = '#9b9283';
        } else {
          const dLake = Math.hypot(wx - WORLD.lake.x, wz - WORLD.lake.z) - WORLD.lake.r;
          if (dLake < 28 && wx > WORLD.lake.x - 80) col = '#e4d29e';
          else if (wz < -380 && Math.abs(wx) < 260) col = '#59844f';
          else if (wz > 1400) col = '#44854f';
          else col = '#7fa76a';
        }
        c.fillStyle = col;
        c.fillRect(px, py, step, step);
      }
    }

    // Moorish Oasis Courtyard & Reflecting Pool
    if (WORLD.mosque) {
      const [mx, my] = this.w2s(WORLD.mosque.x, WORLD.mosque.z);
      c.fillStyle = '#f8f4ec';
      c.fillRect(mx - 26 * dpr, my - 34 * dpr, 52 * dpr, 68 * dpr);
      c.fillStyle = '#149ab4';
      c.fillRect(mx - 11 * dpr, my - 24 * dpr, 22 * dpr, 48 * dpr);
      c.strokeStyle = '#d4af37';
      c.lineWidth = 1.5 * dpr;
      c.strokeRect(mx - 26 * dpr, my - 34 * dpr, 52 * dpr, 68 * dpr);
    }

    // Buddhist Pagoda Courtyard & Zen Pond
    if (WORLD.buddhistTemple) {
      const [px, py] = this.w2s(WORLD.buddhistTemple.x, WORLD.buddhistTemple.z);
      c.fillStyle = '#9e4736';
      c.beginPath();
      c.arc(px, py, 16 * dpr, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#d4af37';
      c.lineWidth = 2 * dpr;
      c.stroke();
    }

    // River Network (Inlet from falls and Outlet under Rainbow bridge)
    c.strokeStyle = '#5ba2c8';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(5, 32 * this.scale * dpr * 0.7);
    for (const branch of [RIVER_INLET, RIVER_OUTLET]) {
      c.beginPath();
      branch.forEach(([x, z], i) => {
        const [sx, sy] = this.w2s(x, z);
        i ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
      });
      c.stroke();
    }

    // Paved Roads & Grand Boulevard
    c.strokeStyle = '#dbcca8';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const r of ROADS) {
      c.lineWidth = Math.max(2.5, r.w * this.scale * dpr * 0.7);
      c.beginPath();
      if (r.ring) {
        const [sx, sy] = this.w2s(r.cx + r.r, r.cz);
        c.moveTo(sx, sy);
        for (let a = 1; a <= 40; a++) {
          const t = (a / 40) * Math.PI * 2;
          const [x, y] = this.w2s(r.cx + Math.cos(t) * r.r, r.cz + Math.sin(t) * r.r);
          c.lineTo(x, y);
        }
      } else {
        r.pts.forEach(([x, z], i) => {
          const [sx, sy] = this.w2s(x, z);
          i ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
        });
      }
      c.stroke();
    }

    // Central Colonnade Plaza & Living Fountain
    const [czx, czy] = this.w2s(WORLD.plaza.x, WORLD.plaza.z);
    c.fillStyle = '#f5efe0';
    c.beginPath();
    c.arc(czx, czy, WORLD.plaza.r * this.scale * dpr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#d4af37';
    c.lineWidth = 2 * dpr;
    c.stroke();
    c.fillStyle = '#2ca0ca';
    c.beginPath();
    c.arc(czx, czy, 16 * this.scale * dpr, 0, Math.PI * 2);
    c.fill();

    // The Grand Triumphal Gate
    const [gx, gy] = this.w2s(WORLD.gate.x, WORLD.gate.z);
    c.strokeStyle = '#e5c158';
    c.lineWidth = 3.6 * dpr;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(gx - 18 * dpr, gy + 12 * dpr); c.lineTo(gx - 18 * dpr, gy - 10 * dpr);
    c.moveTo(gx + 18 * dpr, gy + 12 * dpr); c.lineTo(gx + 18 * dpr, gy - 10 * dpr);
    c.moveTo(gx - 22 * dpr, gy - 10 * dpr); c.lineTo(gx + 22 * dpr, gy - 10 * dpr);
    c.stroke();

    // The Rainbow Bridge: Carrara Marble Roadway, 7-Band Prismatic Radiant Arc & Kaya Belvedere
    const [bx, by] = this.w2s(WORLD.bridge.x, WORLD.bridge.z);
    
    // 1. Classical Bridge Roadbed Deck Spanning River
    c.save();
    c.shadowColor = 'rgba(0, 0, 0, 0.45)';
    c.shadowBlur = 8 * dpr;
    c.fillStyle = '#e8dec8';
    c.beginPath();
    c.roundRect(bx - 14 * dpr, by - 24 * dpr, 28 * dpr, 48 * dpr, 6 * dpr);
    c.fill();
    c.strokeStyle = '#c4b595';
    c.lineWidth = 1.5 * dpr;
    c.stroke();

    // Center Starlight Runner Strip
    c.fillStyle = '#fffae8';
    c.fillRect(bx - 1.5 * dpr, by - 22 * dpr, 3 * dpr, 44 * dpr);

    // Flanking Gilded Balustrades
    c.fillStyle = '#f0c05a';
    c.fillRect(bx - 13.5 * dpr, by - 23 * dpr, 2 * dpr, 46 * dpr);
    c.fillRect(bx + 11.5 * dpr, by - 23 * dpr, 2 * dpr, 46 * dpr);
    c.restore();

    // 2. Kaya Starlight Belvedere Rotunda Platform (Apex East Flank)
    const [pavX, pavY] = this.w2s(WORLD.bridge.x + 24, WORLD.bridge.z);
    c.save();
    c.shadowColor = 'rgba(103, 232, 249, 0.5)';
    c.shadowBlur = 6 * dpr;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(pavX, pavY, 8 * dpr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#f5c542';
    c.lineWidth = 1.8 * dpr;
    c.stroke();
    // Central Celestial Core
    c.fillStyle = '#67e8f9';
    c.beginPath();
    c.arc(pavX, pavY, 3 * dpr, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 3. Shimmering River Water Rainbow Reflection under the Arch
    c.save();
    c.globalAlpha = 0.42;
    const BANDS_INV = ['#8f57b8', '#5566c4', '#4a9fd8', '#63c268', '#f2d04a', '#ee9740', '#e05a4f'];
    BANDS_INV.forEach((col, i) => {
      c.strokeStyle = col;
      c.lineWidth = 1.8 * dpr;
      c.beginPath();
      c.arc(bx, by - 4 * dpr, (14 - i * 1.6) * dpr, 0, Math.PI);
      c.stroke();
    });
    c.restore();

    // 4. Luminous 7-Band Prismatic Rainbow Arc Soaring in Celestial Radiance
    c.save();
    c.shadowColor = 'rgba(255, 235, 120, 0.75)';
    c.shadowBlur = 12 * dpr;
    c.lineCap = 'round';
    c.lineWidth = 3.2 * dpr;
    const BANDS = ['#e05a4f', '#ee9740', '#f2d04a', '#63c268', '#4a9fd8', '#5566c4', '#8f57b8'];
    BANDS.forEach((col, i) => {
      c.strokeStyle = col;
      c.beginPath();
      c.arc(bx, by + 6 * dpr, (22 - i * 2.5) * dpr, Math.PI, 0);
      c.stroke();
    });
    c.restore();

    // Kaya Island & Female Siberian Husky Monument (South Coast offshore)
    const [kx, ky] = this.w2s(WORLD.kayaIsland.x, WORLD.kayaIsland.z);
    c.fillStyle = '#3e7e4a';
    c.beginPath();
    c.arc(kx, ky, 80 * this.scale * dpr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#e4d29e';
    c.lineWidth = 3 * dpr;
    c.stroke();
    // Husky Statue Pedestal
    c.fillStyle = '#f5efe0';
    c.fillRect(kx - 10 * dpr, ky - 10 * dpr, 20 * dpr, 20 * dpr);
    c.strokeStyle = '#d4af37';
    c.lineWidth = 1.5 * dpr;
    c.strokeRect(kx - 10 * dpr, ky - 10 * dpr, 20 * dpr, 20 * dpr);
    c.fillStyle = '#f5c542';
    c.font = `bold ${12 * dpr}px Georgia, serif`;
    c.textAlign = 'center';
    c.fillText('🐾 KAYA ISLAND', kx, ky + 24 * dpr);
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    c.font = `italic 500 ${10 * dpr}px Georgia, serif`;
    c.fillText('Siberian Husky Kaya — Island Spirit Companion', kx, ky + 36 * dpr);

    // Desert Canyon & The Phantasm Tree (West Mesa)
    const [ptx, pty] = this.w2s(-460, 340);
    c.fillStyle = '#b85834';
    c.beginPath();
    c.arc(ptx, pty, 36 * this.scale * dpr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#d4af37';
    c.lineWidth = 1.5 * dpr;
    c.stroke();
    // Phantasm Tree Glowing Canopy
    c.fillStyle = 'rgba(186, 104, 200, 0.45)';
    c.beginPath();
    c.arc(ptx, pty, 18 * dpr, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e1bee7';
    c.beginPath();
    c.arc(ptx, pty, 8 * dpr, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffd54f';
    c.font = `bold ${11 * dpr}px Georgia, serif`;
    c.textAlign = 'center';
    c.fillText('✨ THE PHANTASM TREE', ptx, pty - 24 * dpr);
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    c.font = `italic 500 ${9 * dpr}px Georgia, serif`;
    c.fillText('Desert Canyon & Pueblo Kiva', ptx, pty - 12 * dpr);

    return bg;
  }

  draw() {
    if (this.cv.width < 1 || this.cv.height < 1) return;
    if (!this._bg) this._bg = this._renderBG();
    
    const c = this.ctx;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this._bg, 0, 0);

    // 1. Render Bathymetric Underwater Realms
    if (this.showUnderwater) {
      for (const uz of UNDERWATER_ZONES) {
        const [sx, sy] = this.w2s(uz.cx, uz.cz);
        const rx = uz.rx * this.scale * dpr;
        const rz = uz.rz * this.scale * dpr;
        
        c.save();
        c.beginPath();
        c.ellipse(sx, sy, rx, rz, 0, 0, Math.PI * 2);
        c.fillStyle = uz.fill;
        c.fill();
        c.strokeStyle = uz.stroke;
        c.lineWidth = 1.8 * dpr;
        c.setLineDash([4 * dpr, 4 * dpr]);
        c.stroke();
        c.restore();

        c.fillStyle = uz.stroke;
        c.font = `600 ${10 * dpr}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillText(`SUBMERGED: ${uz.name} (${uz.depth})`, sx, sy + rz + 14 * dpr);
      }
    }

    // 2. Render Continuous 15-Stage Veo Drone Flight Path (Smooth Catmull-Rom Cubic Bezier Spline)
    if (this.showFlightPath) {
      c.save();
      c.lineCap = 'round';
      c.lineJoin = 'round';

      const N = TOUR_WAYPOINTS.length;
      for (let i = 0; i < N; i++) {
        const pPrev = TOUR_WAYPOINTS[(i - 1 + N) % N];
        const p1 = TOUR_WAYPOINTS[i];
        const p2 = TOUR_WAYPOINTS[(i + 1) % N];
        const pNext = TOUR_WAYPOINTS[(i + 2) % N];

        // Screen-space coordinates
        const [x1, y1] = this.w2s(p1.x, p1.z);
        const [x2, y2] = this.w2s(p2.x, p2.z);

        // Catmull-Rom tangents converted to Cubic Bezier control points
        const cp1x = x1 + (x2 - this.w2s(pPrev.x, pPrev.z)[0]) / 6;
        const cp1y = y1 + (y2 - this.w2s(pPrev.x, pPrev.z)[1]) / 6;
        const cp2x = x2 - (this.w2s(pNext.x, pNext.z)[0] - x1) / 6;
        const cp2y = y2 - (this.w2s(pNext.x, pNext.z)[1] - y1) / 6;

        const isSubmarine = p1.uw || p2.uw;
        c.beginPath();
        c.moveTo(x1, y1);
        c.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        
        if (isSubmarine) {
          c.strokeStyle = '#00f5d4';
          c.lineWidth = 2.8 * dpr;
          c.setLineDash([6 * dpr, 4 * dpr]);
        } else {
          c.strokeStyle = '#f5c542';
          c.lineWidth = 2.4 * dpr;
          c.setLineDash([]);
        }
        c.stroke();
      }
      c.restore();

      const totalStages = TOUR_WAYPOINTS.length;
      let curStageFloat = (this._animTime * 0.25) % totalStages;
      
      if (window.VeoTourController && window.VeoTourController.video && !window.VeoTourController.video.paused) {
        const v = window.VeoTourController.video;
        const dur = v.duration || 60.0;
        const curT = v.currentTime || 0;
        curStageFloat = (curT / dur) * totalStages;
      }

      const curIdx = Math.floor(curStageFloat);
      const nextIdx = (curIdx + 1) % totalStages;
      const frac = curStageFloat - curIdx;
      const curWp = TOUR_WAYPOINTS[curIdx];
      const nextWp = TOUR_WAYPOINTS[nextIdx];
      const prevWp = TOUR_WAYPOINTS[(curIdx - 1 + totalStages) % totalStages];
      const nextNextWp = TOUR_WAYPOINTS[(curIdx + 2) % totalStages];

      // World-space Catmull-Rom cubic bezier control points for drone position
      const cp1_wx = curWp.x + (nextWp.x - prevWp.x) / 6;
      const cp1_wz = curWp.z + (nextWp.z - prevWp.z) / 6;
      const cp2_wx = nextWp.x - (nextNextWp.x - curWp.x) / 6;
      const cp2_wz = nextWp.z - (nextNextWp.z - curWp.z) / 6;

      const t = frac, mt = 1 - t;
      const droneWx = mt*mt*mt * curWp.x + 3*mt*mt*t * cp1_wx + 3*mt*t*t * cp2_wx + t*t*t * nextWp.x;
      const droneWz = mt*mt*mt * curWp.z + 3*mt*mt*t * cp1_wz + 3*mt*t*t * cp2_wz + t*t*t * nextWp.z;
      const [dsx, dsy] = this.w2s(droneWx, droneWz);

      const pulseR = (10 + Math.sin(this._animTime * 4) * 4) * dpr;
      c.beginPath();
      c.arc(dsx, dsy, pulseR, 0, Math.PI * 2);
      c.fillStyle = curWp.uw ? 'rgba(0, 245, 212, 0.35)' : 'rgba(245, 197, 66, 0.35)';
      c.fill();

      c.beginPath();
      c.arc(dsx, dsy, 5 * dpr, 0, Math.PI * 2);
      c.fillStyle = curWp.uw ? '#00f5d4' : '#ffffff';
      c.fill();
      c.strokeStyle = '#12161a';
      c.lineWidth = 1.5 * dpr;
      c.stroke();

      // 3. Render 15 Interactive Waypoint Pins
      for (const wp of TOUR_WAYPOINTS) {
        const [sx, sy] = this.w2s(wp.x, wp.z);
        if (sx < -40 || sy < -40 || sx > this.cv.width + 40 || sy > this.cv.height + 40) continue;

        const isHovered = (wp === this.hoverWp);
        const isActive = (wp === this.activeWp);
        const pinR = (isHovered ? 13 : 9) * dpr;

        c.beginPath();
        c.arc(sx, sy, pinR + 3 * dpr, 0, Math.PI * 2);
        c.fillStyle = wp.uw ? 'rgba(0, 229, 255, 0.3)' : 'rgba(229, 193, 88, 0.3)';
        c.fill();

        c.beginPath();
        c.arc(sx, sy, pinR, 0, Math.PI * 2);
        c.fillStyle = wp.uw ? '#00b4d8' : (isActive ? '#ffd700' : '#222831');
        c.fill();
        c.strokeStyle = wp.uw ? '#90e0ef' : '#f5c542';
        c.lineWidth = 2 * dpr;
        c.stroke();

        c.fillStyle = wp.uw ? '#ffffff' : (isActive ? '#12161a' : '#f5c542');
        c.font = `bold ${isHovered ? 11 : 9}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(wp.stage.toString(), sx, sy);
        c.textBaseline = 'alphabetic';

        c.fillStyle = '#ffffff';
        c.font = `600 ${10 * dpr}px system-ui, sans-serif`;
        c.shadowColor = 'rgba(0,0,0,0.85)';
        c.shadowBlur = 4 * dpr;
        c.fillText(wp.name, sx, sy - pinR - 4 * dpr);
        c.shadowBlur = 0;
      }
    }

    // 4. Render Memorial Plots
    if (this.showPlots) {
      const r = Math.max(2.2, 5 * this.scale) * dpr;
      for (const p of this.plots) {
        const [sx, sy] = this.w2s(p.x, p.z);
        if (sx < -20 || sy < -20 || sx > this.cv.width + 20 || sy > this.cv.height + 20) continue;
        c.beginPath();
        c.arc(sx, sy, p.size === 'estate' ? r * 1.5 : p.size === 'premium' ? r * 1.2 : r, 0, Math.PI * 2);
        c.fillStyle = p.status === 'available' ? '#79c164' : '#8b95a3';
        c.fill();
        if (p === this.hover || p === this.selected) {
          c.lineWidth = 3 * dpr;
          c.strokeStyle = p === this.selected ? '#e8b23a' : '#ffffff';
          c.stroke();
        }
      }
    }

    // 5. Waypoint Hover Inspection Tooltip
    if (this.hoverWp) {
      const wp = this.hoverWp;
      const [sx, sy] = this.w2s(wp.x, wp.z);
      const title = `STAGE ${wp.stage} · ${wp.name.toUpperCase()}`;
      const subtitle = `${wp.sub} · ${wp.uw ? '🌊 Submerged Realm (' + Math.abs(wp.y) + 'm)' : '⛰️ Aerial Flight (+' + wp.y + 'm)'}`;
      const cta = 'Click to jump tour & inspect photoreal sanctuary ➔';

      c.font = `bold ${12 * dpr}px system-ui, sans-serif`;
      const w1 = c.measureText(title).width;
      c.font = `${11 * dpr}px system-ui, sans-serif`;
      const w2 = c.measureText(subtitle).width;
      const cardW = Math.max(w1, w2, 280 * dpr) + 24 * dpr;
      const cardH = 68 * dpr;
      const cardX = Math.min(this.cv.width - cardW - 10, Math.max(10, sx - cardW / 2));
      const cardY = sy > cardH + 40 * dpr ? sy - cardH - 18 * dpr : sy + 24 * dpr;

      c.fillStyle = 'rgba(18, 24, 32, 0.95)';
      c.beginPath();
      c.roundRect(cardX, cardY, cardW, cardH, 8 * dpr);
      c.fill();
      c.strokeStyle = wp.uw ? '#00e5ff' : '#e5c158';
      c.lineWidth = 1.5 * dpr;
      c.stroke();

      c.textAlign = 'left';
      c.fillStyle = wp.uw ? '#00e5ff' : '#f5c542';
      c.font = `bold ${12 * dpr}px system-ui, sans-serif`;
      c.fillText(title, cardX + 12 * dpr, cardY + 20 * dpr);

      c.fillStyle = '#cfd8dc';
      c.font = `${11 * dpr}px system-ui, sans-serif`;
      c.fillText(subtitle, cardX + 12 * dpr, cardY + 38 * dpr);

      c.fillStyle = '#90caf9';
      c.font = `italic ${10 * dpr}px system-ui, sans-serif`;
      c.fillText(cta, cardX + 12 * dpr, cardY + 54 * dpr);
    } else if (this.hover) {
      const p = this.hover;
      const [sx, sy] = this.w2s(p.x, p.z);
      const txt = `${p.id} · ${DISTRICTS[p.district]?.name || p.district} · ${p.status === 'available' ? '$' + p.price : 'Reserved'}`;
      c.font = `600 ${12 * dpr}px system-ui, sans-serif`;
      const w = c.measureText(txt).width + 20 * dpr;
      c.fillStyle = 'rgba(18, 24, 32, 0.92)';
      const bx = sx - w / 2, by = sy - 38 * dpr;
      c.beginPath();
      c.roundRect(bx, by, w, 26 * dpr, 6 * dpr);
      c.fill();
      c.strokeStyle = '#e5c158';
      c.lineWidth = 1 * dpr;
      c.stroke();
      c.fillStyle = '#f3ead6';
      c.textAlign = 'center';
      c.fillText(txt, sx, by + 17 * dpr);
    }

    // 6. Master Map Instruments
    this._renderMapInstruments(c, dpr);
  }

  _renderMapInstruments(c, dpr) {
    // --- Compass Rose ---
    const crX = 42 * dpr;
    const crY = 54 * dpr;
    const crR = 24 * dpr;
    c.save();
    c.translate(crX, crY);
    c.strokeStyle = 'rgba(245, 197, 66, 0.7)';
    c.lineWidth = 1.2 * dpr;
    c.beginPath();
    c.arc(0, 0, crR, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#e05a4f';
    c.beginPath();
    c.moveTo(0, -crR); c.lineTo(5 * dpr, 0); c.lineTo(-5 * dpr, 0);
    c.fill();
    c.fillStyle = '#78909c';
    c.beginPath();
    c.moveTo(0, crR); c.lineTo(5 * dpr, 0); c.lineTo(-5 * dpr, 0);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = `bold ${10 * dpr}px Georgia, serif`;
    c.textAlign = 'center';
    c.fillText('N', 0, -crR - 4 * dpr);
    c.fillText('S', 0, crR + 12 * dpr);
    c.restore();

    // --- Dynamic Metric Scale Bar ---
    const scalePx = 100 * dpr;
    const metersInScale = Math.round(scalePx / (this.scale * dpr));
    const sbX = 24 * dpr;
    const sbY = this.cv.height - 28 * dpr;
    c.fillStyle = '#ffffff';
    c.font = `600 ${10 * dpr}px system-ui, sans-serif`;
    c.textAlign = 'left';
    c.fillText(`SCALE: ~${metersInScale} METERS`, sbX, sbY - 8 * dpr);
    c.strokeStyle = '#f5c542';
    c.lineWidth = 3 * dpr;
    c.beginPath();
    c.moveTo(sbX, sbY);
    c.lineTo(sbX + scalePx, sbY);
    c.stroke();

    // --- Cursor Coordinates ---
    if (this._mouseWorld) {
      const [wx, wz] = this._mouseWorld;
      const h = Math.round(terrainHeight(wx, wz));
      const coordTxt = `SANCTUARY COORDINATES · X: ${Math.round(wx)}m | Z: ${Math.round(wz)}m | ELEVATION: ${h}m`;
      c.font = `500 ${11 * dpr}px monospace`;
      c.textAlign = 'center';
      c.fillStyle = 'rgba(240, 244, 248, 0.85)';
      c.fillText(coordTxt, this.cv.width / 2, this.cv.height - 18 * dpr);
    }

    // --- Interactive Layer Toggle Bar ---
    const barW = 440 * dpr;
    const barH = 34 * dpr;
    const barX = (this.cv.width - barW) / 2;
    const barY = 16 * dpr;

    c.fillStyle = 'rgba(15, 20, 28, 0.92)';
    c.beginPath();
    c.roundRect(barX, barY, barW, barH, 6 * dpr);
    c.fill();
    c.strokeStyle = 'rgba(245, 197, 66, 0.6)';
    c.lineWidth = 1 * dpr;
    c.stroke();

    const tabs = [
      { label: '🚁 Flight Path', active: this.showFlightPath },
      { label: '🌊 Underwater', active: this.showUnderwater },
      { label: '🟢 Plot Grid', active: this.showPlots },
      { label: '🖼️ Master Map', active: this.showMasterPainting }
    ];

    const tabW = barW / 4;
    tabs.forEach((tab, i) => {
      const tx = barX + i * tabW;
      if (tab.active) {
        c.fillStyle = 'rgba(245, 197, 66, 0.22)';
        c.beginPath();
        c.roundRect(tx + 2 * dpr, barY + 2 * dpr, tabW - 4 * dpr, barH - 4 * dpr, 4 * dpr);
        c.fill();
      }
      c.fillStyle = tab.active ? '#ffd54f' : '#8fa3b0';
      c.font = `600 ${11 * dpr}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.fillText(tab.label, tx + tabW / 2, barY + 21 * dpr);
    });
  }
}
