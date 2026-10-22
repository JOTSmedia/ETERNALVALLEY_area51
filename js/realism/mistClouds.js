// [v36 EVR-04] golden-hour valley mist bands + clouds above the northern ridges.
// Procedural canvas textures only (no download). Desktop: 7 mist bands + 14 clouds; mobile: 4 + 8.
import * as THREE from 'three';
import { terrainHeight } from '../terrain.js?v=73';

function noiseCanvas(w, h, seed, soft) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < (soft ? 70 : 40); i++) {
    const x = w * (0.1 + 0.8 * rnd()), y = h * (0.35 + 0.3 * rnd()), r = (soft ? 0.10 : 0.16) * w * (0.5 + rnd());
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${soft ? 0.10 : 0.22})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (soft ? 0.35 : 0.55), 0, 0, Math.PI * 2); g.fill();
  }
  // [v36 polish] feather all four borders to zero: blobs clipped at the canvas edge drew hard white lines along the band edges
  g.globalCompositeOperation = 'destination-in';
  for (const [x1, y1] of [[w, 0], [0, h]]) {
    const lg = g.createLinearGradient(0, 0, x1, y1);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.18, 'rgba(0,0,0,1)'); lg.addColorStop(0.82, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildMistClouds(scene, { mobile = false, sunColor = new THREE.Color(1.0, 0.86, 0.66) } = {}) {
  const group = new THREE.Group(); group.name = 'EV_MistClouds';
  const mistTex = noiseCanvas(512, 128, 7, true), cloudTex = noiseCanvas(512, 256, 19, false);
  const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.18,
    color: new THREE.Color(1.0, 0.93, 0.82), fog: true, side: THREE.DoubleSide });
  // low bands along the valley floor (river corridor, lake basin, plaza meadows), 6-18 m above ground
  const bands = [[-180, 120, 0.2], [60, -180, -0.4], [300, 300, 0.9], [820, 260, 0.1], [-520, 360, -0.2], [200, 650, 0.5], [-60, 520, 1.2]];
  bands.slice(0, mobile ? 4 : 7).forEach(([x, z, r], i) => {
    const bm = mistMat.clone();   // [v36 polish] own material: the per-band opacity below needs it
    const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 220), bm);
    m.rotation.set(-Math.PI / 2, 0, r);
    m.position.set(x, Math.max(14, terrainHeight(x, z)) + 9 + (i % 3) * 4, z);
    m.renderOrder = 2; group.add(m);
    // [v36 polish] fade bands out as the camera climbs above them (overhead/top-down views showed streaks)
    // and when the camera is level with them (grazing angle turned a band into a white wall); base opacity halved (0.18 -> 0.10)
    m.onBeforeRender = (r, sc, cam) => { const dy = cam.position.y - m.position.y;
      bm.opacity = 0.10 * (1 - THREE.MathUtils.smoothstep(dy, 40, 160)) * THREE.MathUtils.smoothstep(Math.abs(dy), 4, 28); };
  });
  // clouds: camera-facing sprites above the north massif and the far ridges
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.8, color: sunColor.clone().lerp(new THREE.Color(1, 1, 1), 0.45), fog: false });
  let s = 31; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (mobile ? 8 : 14); i++) {
    const sp = new THREE.Sprite(cloudMat);
    const x = -1600 + 3400 * rnd(), z = -1000 - 900 * rnd();
    sp.position.set(x, 560 + 260 * rnd(), z);
    const w = 500 + 600 * rnd(); sp.scale.set(w, w * 0.32, 1);
    group.add(sp);
  }
  scene.add(group);
  return group;
}
