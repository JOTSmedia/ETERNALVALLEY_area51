// Dimensional Gothic exterior inspired by the site's cathedral film reference.
// Original geometry; native 4096px Poly Haven scans are credited in LICENSES.md.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scannedPBR, initScannedMaterials } from './scannedMaterials.js?v=73';
import { worldSpaceSurface } from './nearField.js?v=73';

const TAU = Math.PI * 2;

/**
 * Returns an unplaced local exterior. Attach to the existing cathedral group;
 * replace only its original first two exterior meshes and retain the interior.
 * Nave floor y=27; open entrance faces +Z, centred at x=0,z=35.
 */
export function buildCathedralExterior(world) {
  if (world?.renderer) initScannedMaterials(world.renderer);
  const group = new THREE.Group(); group.name = 'EV_CathedralExterior';
  const materials = {
    stone: new THREE.MeshStandardMaterial({ ...scannedPBR('stone'), color: 0xd8c6a7, roughness: .94, vertexColors: true }),
    trim: new THREE.MeshStandardMaterial({ ...scannedPBR('stone'), color: 0xe0d2b8, roughness: .9, vertexColors: true }),
    foundation: new THREE.MeshStandardMaterial({ ...scannedPBR('rock'), color: 0x887d66, roughness: 1, vertexColors: true }),
    paving: new THREE.MeshStandardMaterial({ ...scannedPBR('paving'), color: 0x9c9789, roughness: .95, vertexColors: true }),
    slate: new THREE.MeshStandardMaterial({ ...scannedPBR('roof'), color: 0x666f76, roughness: .84, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0x646b68, roughness: .66, metalness: .45, vertexColors: true }),
    recess: new THREE.MeshStandardMaterial({ color: 0x101619, roughness: .9, vertexColors: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0x455457, roughness: .29, metalness: .38, vertexColors: true }),
  };
  for (const key of ['stone', 'trim', 'foundation', 'paving', 'slate']) {
    materials[key].normalScale.setScalar(key === 'slate' ? .55 : .45);
    worldSpaceSurface(materials[key], key === 'slate' ? 3.0 : key === 'foundation' ? 4.2 : 2.2, null, true);
  }
  // Slate scan is deliberately neutralized; the source's warm tile pigment
  // must not turn the cathedral's cold blue-grey roofing terracotta.
  const roofCompile = materials.slate.onBeforeCompile;
  materials.slate.onBeforeCompile = function(shader, renderer) {
    roofCompile.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      'diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * vec3(0.86, 0.94, 1.0);\n#include <color_fragment>');
  };
  materials.slate.customProgramCacheKey = () => 'cathedral-slate-world-v1';
  const buckets = Object.fromEntries(Object.keys(materials).map(k => [k, []]));
  let serial = 0;
  function emit(geometry, key = 'stone', frame = null, shade = 1) {
    if (frame) geometry.applyMatrix4(frame);
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
    const n = geometry.attributes.position.count;
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    // Subtle variation lives in actual stone units rather than repeating decals.
    const v = shade * (.965 + .035 * Math.sin(++serial * 12.9898));
    const colors = new Float32Array(n * 3); colors.fill(v);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const attr of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(attr)) geometry.deleteAttribute(attr);
    geometry.clearGroups(); buckets[key].push(geometry);
  }
  function frame(x, y, z, yaw = 0) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  }
  function box(w, h, d, x, y, z, key = 'stone', transform = null, tilt = 0) {
    const g = new THREE.BoxGeometry(w, h, d); if (tilt) g.rotateZ(tilt); g.translate(x, y, z); emit(g, key, transform);
  }
  function cylinder(rt, rb, h, x, y, z, key = 'stone', segments = 32, transform = null) {
    const g = new THREE.CylinderGeometry(rt, rb, h, segments); g.translate(x, y, z); emit(g, key, transform);
  }
  function rod(a, b, radius, key = 'trim', transform = null, segments = 6) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    if (delta.length() < .0001) return;
    const g = new THREE.CylinderGeometry(radius, radius, delta.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate(...from.add(to).multiplyScalar(.5).toArray()); emit(g, key, transform);
  }
  function pointed(path, w, h, x = 0, y = 0, reverse = false) {
    const s = h * .64;
    if (!reverse) {
      path.moveTo(x - w / 2, y); path.lineTo(x + w / 2, y); path.lineTo(x + w / 2, y + s);
      path.quadraticCurveTo(x + w / 2, y + h * .84, x, y + h);
      path.quadraticCurveTo(x - w / 2, y + h * .84, x - w / 2, y + s); path.closePath();
    } else {
      path.moveTo(x - w / 2, y); path.lineTo(x - w / 2, y + s);
      path.quadraticCurveTo(x - w / 2, y + h * .84, x, y + h);
      path.quadraticCurveTo(x + w / 2, y + h * .84, x + w / 2, y + s);
      path.lineTo(x + w / 2, y); path.closePath();
    }
    return path;
  }
  function solidShape(shape, depth, z, key, transform, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8, steps: 1 });
    g.translate(0, 0, z); emit(g, key, transform);
  }
  function archFrame(w, h, thickness, x, y, z, transform, key = 'trim', depth = .32) {
    const s = pointed(new THREE.Shape(), w + thickness * 2, h + thickness * 1.5, x, y - thickness);
    s.holes.push(pointed(new THREE.Path(), w, h, x, y, true));
    solidShape(s, depth, z, key, transform, .035);
  }
  function lancet(x, y, w, h, transform, elaborate = true) {
    // Glass sits behind a real opening through the stone wall, not on its face.
    solidShape(pointed(new THREE.Shape(), w, h, x, y), .06, -1.0, 'glass', transform);
    archFrame(w, h, .45, x, y, -.1, transform);
    archFrame(w + 1.12, h + .8, .22, x, y - .35, .02, transform, 'stone', .24);
    box(w + 1.6, .42, 1.1, x, y - .4, .15, 'trim', transform);
    const count = w > 8 ? 4 : 2;
    for (let i = 1; i < count; i++) box(.15, h * .68, .3, x - w / 2 + i * w / count, y + h * .34, -.25, 'trim', transform);
    const subW = w / count - .23;
    for (let i = 0; i < count; i++) archFrame(subW, h * .71, .12, x - w / 2 + (i + .5) * w / count, y + .12, -.3, transform, 'trim', .25);
    // Small stone circles and trefoils make a readable Gothic tracery network.
    const ringRadius = w * .16;
    const ring = new THREE.TorusGeometry(ringRadius, Math.max(.10, w * .015), 5, 18);
    ring.translate(x, y + h * .79, -.12); emit(ring, 'trim', transform);
    if (elaborate && w > 5) {
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + Math.PI / 2;
        const g = new THREE.TorusGeometry(ringRadius * .46, .11, 5, 14);
        g.translate(x + Math.cos(a) * ringRadius * .38, y + h * .79 + Math.sin(a) * ringRadius * .38, -.10); emit(g, 'trim', transform);
      }
      for (const sign of [-1, 1]) rod([x + sign * w * .25, y + h * .65, -.2], [x, y + h * .92, -.2], .13, 'trim', transform);
    }
    // Lead cames and shaded panes are geometry as well; no luminous poster.
    for (let yy = 1.4; yy < h * .64; yy += 1.45) box(w, .035, .09, x, y + yy, -.91, 'metal', transform);
    for (let xx = -w / 2 + .55; xx < w / 2; xx += .75) box(.035, h * .64, .09, x + xx, y + h * .32, -.91, 'metal', transform);
  }
  function wall(w, h, transform, windows = [], portal = null, peak = 0, depth = 2.2) {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0);
    if (portal) {
      const [dw, dh] = portal;
      s.lineTo(-dw / 2, 0); s.lineTo(-dw / 2, dh * .64);
      s.quadraticCurveTo(-dw / 2, dh * .84, 0, dh);
      s.quadraticCurveTo(dw / 2, dh * .84, dw / 2, dh * .64); s.lineTo(dw / 2, 0);
    }
    s.lineTo(w / 2, 0); s.lineTo(w / 2, h);
    if (peak) s.lineTo(0, h + peak);
    s.lineTo(-w / 2, h); s.closePath();
    for (const [x, y, ww, hh] of windows) s.holes.push(pointed(new THREE.Path(), ww, hh, x, y, true));
    solidShape(s, depth, -depth, 'stone', transform);
    for (const win of windows) lancet(...win, transform);
    if (portal) {
      for (let i = 0; i < 4; i++) archFrame(portal[0] + i * .65, portal[1] + i * .5, .25, 0, -i * .1, i * .19, transform);
      for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
        cylinder(.16, .2, portal[1] * .64, sign * (portal[0] / 2 + .4 + i * .3), portal[1] * .32, .25 + i * .19, 'trim', 8, transform);
      }
    }
    // Horizontal masonry bands stop at windows because the openings are real.
    box(w + .45, .35, .55, 0, h - 1.5, .15, 'trim', transform);
    box(w + .8, .48, .85, 0, h + .05, .2, 'trim', transform);
    if (peak) for (const sign of [-1, 1]) rod([sign * (w / 2 + .3), h + .3, .3], [0, h + peak + .55, .3], .35, 'trim', transform, 8);
  }
  function roof(width, length, eave, ridge, x = 0, z = 0, transform = null) {
    const rise = ridge - eave, run = width / 2, slope = Math.hypot(run, rise), angle = Math.atan2(rise, run);
    for (const sign of [-1, 1]) {
      box(slope, .42, length, x + sign * width / 4, (ridge + eave) / 2, z, 'slate', transform, -sign * angle);
      // Thin courses articulate the slate scale without tiled facade imagery.
      for (let t = .04; t < .98; t += .023) {
        box(.075, .055, length + .15, x + sign * run * (1 - t), eave + rise * t + .24, z, 'slate', transform, -sign * angle);
      }
      rod([x + sign * run, eave, z - length / 2], [x + sign * run, eave, z + length / 2], .16, 'metal', transform);
    }
    rod([x, ridge + .3, z - length / 2 - .3], [x, ridge + .3, z + length / 2 + .3], .24, 'metal', transform, 8);
    for (const zz of [-length / 2, length / 2]) for (const sign of [-1, 1]) rod([x + sign * run, eave + .2, z + zz], [x, ridge + .3, z + zz], .22, 'trim', transform);
  }
  function pinnacle(x, y, z, scale = 1) {
    box(1.0 * scale, 1.4 * scale, 1.0 * scale, x, y + .7 * scale, z, 'trim');
    cylinder(.48 * scale, .65 * scale, 1.2 * scale, x, y + 2 * scale, z, 'trim', 8);
    cylinder(0, .64 * scale, 4.7 * scale, x, y + 4.95 * scale, z, 'trim', 8);
    cylinder(.08 * scale, .12 * scale, 1.3 * scale, x, y + 7.7 * scale, z, 'metal', 6);
    for (let i = 0; i < 3; i++) for (const sign of [-1, 1]) {
      const g = new THREE.OctahedronGeometry(.22 * scale, 0); g.scale(1, 1.5, 1); g.translate(x + sign * (.44 - i * .12) * scale, y + (3.5 + i) * scale, z); emit(g, 'trim');
    }
  }
  function roundTower(x, z, base, height, radius, crenellated = true) {
    const top = base + height;
    const shaft = new THREE.CylinderGeometry(radius, radius + .55, height, 48, 1, crenellated);
    shaft.translate(x, base + height / 2, z); emit(shaft, 'stone');
    cylinder(radius + .6, radius + 1.2, 2.2, x, base + 1.1, z, 'foundation', 48);
    for (let y = base + 7; y < top - 3; y += 9) {
      cylinder(radius + .18, radius + .26, .35, x, y, z, 'trim', 48);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + (Math.floor(y) % 2) * .22;
        const f = frame(x + Math.sin(a) * (radius + .13), y - 3.1, z + Math.cos(a) * (radius + .13), a);
        // Narrow arrow slits with thick projecting archivolts cast deep shadows.
        solidShape(pointed(new THREE.Shape(), .56, 3.0), .035, 0, 'recess', f);
        archFrame(.56, 3, .22, 0, 0, .01, f, 'trim', .4);
      }
    }
    if (!crenellated) {
      cylinder(radius + .55, radius + .18, 1.2, x, top - .6, z, 'trim', 48);
      cylinder(0, radius + .8, radius * 4.6, x, top + radius * 2.3, z, 'slate', 32);
      for (let y = .12; y < .9; y += .1) cylinder((radius + .8) * (1 - y), (radius + .8) * (1 - y) + .11, .12, x, top + radius * 4.6 * y, z, 'metal', 32);
      rod([x, top + radius * 4.6, z], [x, top + radius * 4.6 + 2.5, z], .09, 'metal');
      return;
    }
    // Open, recessed roof well with an annular battlement rather than a cone.
    const ring = new THREE.Shape(); ring.absarc(0, 0, radius + .95, 0, TAU, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, radius - .8, 0, TAU, true); ring.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(ring, { depth: 1.8, bevelEnabled: false, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); g.translate(x, top - 1.6, z); emit(g, 'trim');
    cylinder(radius - .8, radius - .8, .3, x, top - 2.1, z, 'recess', 48);
    const n = Math.max(14, Math.round(radius * 3));
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, f = frame(x, top, z, a);
      box(TAU * radius / n * .53, 2.3, 1.7, 0, 1.15, radius, 'stone', f);
      box(TAU * radius / n * .58, .23, 1.85, 0, 2.4, radius, 'trim', f);
      box(.42, 1.6, .7, 0, -2.25, radius + .15, 'trim', f);
    }
  }
  function crenellations(length, y, f, opening = 0) {
    box(length, .35, 2.2, 0, y - .5, 0, 'trim', f);
    for (let x = -length / 2 + 1; x < length / 2; x += 3) if (Math.abs(x) > opening / 2 + .5) {
      box(1.65, 2.3, 1.7, x, y + .8, 0, 'stone', f);
      box(1.85, .22, 1.95, x, y + 2, 0, 'trim', f);
    }
  }
  function steps(width, fromY, toY, frontZ, backZ) {
    const n = Math.ceil((toY - fromY) / .32), tread = (frontZ - backZ) / n;
    for (let i = 0; i < n; i++) box(width, .34, tread + .035, 0, fromY + (i + .5) * (toY - fromY) / n, frontZ - (i + .5) * tread, 'paving');
    for (const sign of [-1, 1]) rod([sign * (width / 2 + .3), fromY + 1.25, frontZ], [sign * (width / 2 + .3), toY + 1.25, backZ], .3, 'trim');
  }

  // Fortified terraces: the central stair slot remains physically open.
  box(116, 27, 120, 0, 13.5, -8, 'foundation');
  for (const sign of [-1, 1]) {
    box(52, 27, 18, sign * 32, 13.5, 61, 'foundation');
    box(52, .7, 138, sign * 32, 27, 1, 'paving');
  }
  box(12, .7, 120, 0, 27, -8, 'paving');
  box(126, 8, 26, 0, 4, 75, 'foundation');
  for (const sign of [-1, 1]) { box(57, 8, 14, sign * 34.5, 4, 95, 'foundation'); box(57, .6, 39, sign * 34.5, 8.1, 82.5, 'paving'); }
  box(12, .6, 26, 0, 8.1, 75, 'paving');
  steps(10, 8.4, 27.35, 87, 52);
  steps(10, .3, 8.4, 104, 88);
  for (const sign of [-1, 1]) {
    const f = frame(sign * 58.3, 0, 1, sign * Math.PI / 2);
    wall(138, 29, f, [], null, 0, 3.2); crenellations(138, 29, f);
    for (let y = 3; y < 27; y += 3) box(138, .18, .25, 0, y, .09, 'trim', f);
  }
  const rearCurtain = frame(0, 0, -68.3, Math.PI);
  wall(116, 29, rearCurtain, [], null, 0, 3); crenellations(116, 29, rearCurtain);
  const frontCurtain = frame(0, 8, 70.3);
  wall(116, 22, frontCurtain, [], [11, 21], 0, 3.5); crenellations(116, 22, frontCurtain, 12);
  // A roofed gatehouse flanks, but never closes, the upper entry stair.
  for (const sign of [-1, 1]) {
    roundTower(sign * 12, 70, 8, 29, 4.3, true);
    roundTower(sign * 53, 65, 0, 34 + (sign > 0 ? 2 : 0), 6.1, true);
    roundTower(sign * 53, -63, 0, 36, 5.5, true);
    const f = frame(sign * 63.3, 0, 84, sign * Math.PI / 2);
    wall(36, 10, f); crenellations(36, 10, f);
    roundTower(sign * 60, 98, 0, 13, 4, true);
    wall(54, 11, frame(sign * 35, 0, 102.3)); crenellations(54, 11, frame(sign * 35, 0, 102.3));
  }

  // Main sanctuary: actual apertures surround the preserved vaulted interior.
  wall(50, 46, frame(0, 27, 35), [[0, 19, 11, 23], [-17, 13, 4, 22], [17, 13, 4, 22], [0, 51, 2.6, 9], [-6, 48, 1.5, 5.5], [6, 48, 1.5, 5.5], [-11, 47, 1.1, 3.8], [11, 47, 1.1, 3.8]], [8, 14], 28);
  wall(50, 46, frame(0, 27, -35, Math.PI), [[0, 16, 10, 25], [-17, 14, 4, 21], [17, 14, 4, 21], [0, 51, 2.6, 9], [-6, 48, 1.5, 5.5], [6, 48, 1.5, 5.5]], null, 28);
  for (const sign of [-1, 1]) {
    const side = frame(sign * 25, 27, 0, sign * Math.PI / 2);
    wall(70, 46, side, [-26, -13, 0, 13, 26].map(z => [z, 29, 4.4, 14.3]));
    const aisle = frame(sign * 39, 27, 0, sign * Math.PI / 2);
    wall(56, 27, aisle, [-20, -10, 0, 10, 20].map(z => [z, 4, 4.5, 19]));
    for (const zz of [-28, 28]) wall(16, 27, frame(sign * 32, 27, zz, zz < 0 ? Math.PI : 0), [[0, 5, 4.5, 17]], null, 15);
    roof(18, 60, 54, 69, sign * 32, 0);
    for (const zz of [-28, -14, 0, 14, 28]) {
      // Four setbacks, projecting caps and a pinnacle give each pier a real
      // structural profile. No single rectangular pillar silhouette.
      for (let i = 0; i < 4; i++) {
        const h = i === 3 ? 5 : 7, yy = 27 + i * 7 + h / 2;
        box(5.3 - i * .8, h, 2.7 - i * .3, sign * (40.4 - i * .35), yy, zz, 'stone');
        box(5.5 - i * .8, .4, 2.95 - i * .3, sign * (40.4 - i * .35), 27 + i * 7 + h, zz, 'trim');
      }
      pinnacle(sign * 39.4, 53.5, zz, .75);
      box(2.2, 19, 2.0, sign * 25.6, 63.5, zz, 'stone');
      box(2.8, .5, 2.7, sign * 25.6, 73.2, zz, 'trim');
      // Tapered flying arch, open beneath, joining the tall nave to its pier.
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(sign * (26 + 13 * t), 67.5 - 11 * t + 2.2 * Math.sin(Math.PI * t), zz)); }
      const curve = new THREE.CatmullRomCurve3(pts); emit(new THREE.TubeGeometry(curve, 24, .54, 6, false), 'trim');
      pinnacle(sign * 25.6, 73.4, zz, .65);
    }
    for (const zz of [-21, 0, 21]) {
      const f = frame(sign * 18.1, 82, zz, sign * Math.PI / 2);
      wall(5.4, 5.3, f, [[0, .6, 2.4, 4.0]], null, 3.6, .7);
      roof(6.2, 5.4, 5.4, 9.1, 0, -2.5, f);
      pinnacle(sign * 18.1, 90.4, zz, .25);
    }
  }
  roof(54, 74, 73.2, 101.4);
  for (const zz of [-35, 35]) {
    pinnacle(0, 101.5, zz, .65);
    for (const sign of [-1, 1]) {
      roundTower(sign * 27, zz - (zz > 0 ? 2 : -2), 27, zz > 0 ? 49 : 54, 3.8, false);
      // Engaged corner quoins form visible masonry edges.
      for (let y = 29; y < 72; y += 1.35) box(2.7, .65, .5, sign * 23.6, y, zz + Math.sign(zz) * .16, 'trim');
    }
  }
  // Asymmetrical round keeps echo the film still's unmistakable skyline.
  roundTower(-10, -47, 27, 99, 5.6, true);
  roundTower(8, -48, 27, 108, 5.1, true);
  wall(27, 37, frame(-1, 27, -42, Math.PI), [[-7, 9, 3, 18], [7, 9, 3, 18]]);
  roof(27, 19, 64, 81, -1, -43);
  // Front porch stairs, stepped plinth and two small entry spires.
  for (let i = 0; i < 3; i++) for (const sign of [-1, 1]) box(19, .36, 1.1, sign * 15, 27.25 + i * .12, 36.5 + i * .7, 'paving');
  for (const sign of [-1, 1]) { box(2, 15, 2.2, sign * 6.3, 34.5, 36.5, 'stone'); pinnacle(sign * 6.3, 42.5, 36.5, .8); }

  let triangles = 0;
  for (const [key, parts] of Object.entries(buckets)) {
    if (!parts.length) { materials[key].dispose(); continue; }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(g => g.dispose());
    if (!geometry) throw new Error(`Cathedral geometry merge failed: ${key}`);
    for (const value of geometry.attributes.position.array) if (!Number.isFinite(value)) throw new Error(`Non-finite cathedral geometry: ${key}`);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = `EV_Cathedral_${key}`;
    mesh.castShadow = key !== 'glass'; mesh.receiveShadow = true; group.add(mesh);
    triangles += geometry.attributes.position.count / 3;
  }
  group.userData = {
    floorY: 27.35,
    entrance: { x: 0, y: 27.35, z: 35, width: 8, height: 14, facing: '+Z' },
    stairs: [{ from: [0, .3, 104], to: [0, 8.4, 88], width: 10 }, { from: [0, 8.4, 87], to: [0, 27.35, 52], width: 10 }],
    footprint: { minX: -66, maxX: 66, minZ: -72, maxZ: 105 },
    triangles, draws: group.children.length,
    dispose() { group.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); }); },
  };
  return group;
}
