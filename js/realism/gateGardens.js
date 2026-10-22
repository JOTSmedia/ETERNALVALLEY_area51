// Original, dimensional entrance planting inspired by the site's gate film still.
// All geometry is authored here; the stone/soil maps and tree scans retain their
// existing Poly Haven CC0 provenance in LICENSES.md. No whole-plant billboards.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight, mulberry32, WORLD } from '../terrain.js?v=73';
import { gateApproachCenter } from './triumphalGate.js?v=73';
import { scannedPBR } from './scannedMaterials.js?v=73';
import { impostorForest, worldSpaceSurface } from './nearField.js?v=73';
import { wildflowerGeometry, wildflowerMaterial } from './wildflowers.js?v=73';

function colorGeometry(geometry, color) {
  const c = new THREE.Color(color), values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b; }
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

// A folded, pointed leaf: four triangles across two planes, not an image card.
function leaf(length, width, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -width / 2, length * .42, .018, 0, length * .48, .065,
    0, 0, 0, 0, length * .48, .065, width / 2, length * .42, .018,
    -width / 2, length * .42, .018, 0, length, .12, 0, length * .48, .065,
    width / 2, length * .42, .018, 0, length * .48, .065, 0, length, .12,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(24), 2));
  g.computeVertexNormals();
  return colorGeometry(g, color);
}

function lavenderBush(seed, blossomColor) {
  const rng = mulberry32(seed), parts = [];
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.39996, r = Math.sqrt(rng()) * .36;
    const g = leaf(.21 + rng() * .20, .025 + rng() * .02, i % 3 ? 0x536546 : 0x6a7552);
    g.rotateZ(.5 + rng() * .7); g.rotateY(angle);
    g.translate(Math.cos(angle) * r, rng() * .13, Math.sin(angle) * r);
    parts.push(g);
  }
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.39996, r = .10 + Math.sqrt(rng()) * .29;
    const height = .50 + rng() * .28, tilt = (rng() - .5) * .22;
    const stem = colorGeometry(new THREE.CylinderGeometry(.004, .008, height, 3, 1, true), 0x576343);
    stem.translate(0, height / 2, 0);
    // Four stacked, tapered whorls give the flowering spike a textured silhouette.
    for (let b = 0; b < 4; b++) {
      const bud = colorGeometry(new THREE.OctahedronGeometry(.024 - b * .003, 0), blossomColor);
      bud.scale(1, 1.65, 1); bud.rotateY(b * 1.9);
      bud.translate(0, height - .13 + b * .043, 0); parts.push(bud);
      bud.rotateZ(tilt); bud.rotateY(angle); bud.translate(Math.cos(angle) * r, .02, Math.sin(angle) * r);
    }
    stem.rotateZ(tilt); stem.rotateY(angle);
    stem.translate(Math.cos(angle) * r, 0, Math.sin(angle) * r); parts.push(stem);
  }
  // Merge non-indexed consistently: folded leaves are already non-indexed.
  const ready = parts.map(g => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(ready, false);
  for (const g of new Set([...ready, ...parts])) g.dispose();
  result.computeBoundingSphere();
  return result;
}

// Existing gate architecture has a solid esplanade and a raised marble apron.
// Respect those walkable surfaces instead of burying plants in terrain below.
function groundHeight(x, z) {
  const gx = x - WORLD.gate.x, gz = z - WORLD.gate.z;
  let height = terrainHeight(x, z);
  if (Math.abs(gx) < 144 && gz > -60 && gz < 180) height = Math.max(height, WORLD.gate.y + .2);
  if (Math.abs(gx) < 48 && gz > -45 && gz < 165) height = Math.max(height, WORLD.gate.y + 1.25);
  return height;
}

function matrix(x, z, rotation, scale = 1, lift = .16) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, groundHeight(x, z) + lift, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation),
    new THREE.Vector3(scale, scale, scale));
}

function instances(group, name, geometry, material, matrices) {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name;
  mesh.computeBoundingSphere(); group.add(mesh);
  return mesh;
}

/** Call once after _gate() and before buildHeroTrees(world). World coordinates. */
export function buildGateGardens(world) {
  if (world.scene.getObjectByName('EV_GateGardens')) return world.scene.getObjectByName('EV_GateGardens');
  const group = new THREE.Group(); group.name = 'EV_GateGardens';
  const rng = mulberry32(810247), beds = [], plants = [[], [], []], accents = [], edging = [];
  const foliageMaterial = wildflowerMaterial();
  const soil = new THREE.MeshStandardMaterial({ ...scannedPBR('mud'), color: 0x756c56, roughness: 1 });
  worldSpaceSurface(soil, 2.0);
  const stone = new THREE.MeshStandardMaterial({ ...scannedPBR('stone'), color: 0xc0b8a5, roughness: .87 });
  worldSpaceSurface(stone, 1.8);
  // Lavender borders follow the same curved, eleven-metre approach as the gate.
  // The flared threshold remains clear for the flight and walking route.
  for (const side of [-1, 1]) {
    beds.push({side, start: 914, length: 119, width: 4.8, x: 9.2, bend: .5, count: 520});
    beds.push({side, start: 906, length: 122, width: 7.4, x: 62, bend: 6, count: 640});
  }
  for (const bed of beds) {
    const center = t => gateApproachCenter(bed.start + bed.length * t) + bed.side * (bed.x + Math.sin(t * Math.PI * 2 - .4) * bed.bend);
    // A closed raised soil ribbon follows the terrain / actual architectural
    // platform, with small irregularities rather than a floating flat plane.
    const points = [], uvs = [], indices = [], steps = 64;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, z = bed.start + bed.length * t;
      const taper = .30 + .70 * Math.pow(Math.sin(Math.PI * t), .45);
      for (const edge of [-1, 1]) {
        const x = center(t) + edge * bed.width * .5 * taper;
        const y = groundHeight(x, z);
        points.push(x, y + .20, z, x, y + .01, z);
        uvs.push(x / 2, z / 2, x / 2, z / 2);
      }
      if (i < steps) {
        const a = i * 4, b = a + 4;
        indices.push(a, b, a + 2, b, b + 2, a + 2);
        indices.push(a + 1, b, a, a + 1, b + 1, b);
        indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
      }
    }
    indices.push(0, 2, 1, 1, 2, 3);
    const last = steps * 4;
    indices.push(last, last + 1, last + 2, last + 1, last + 3, last + 2);
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    ribbon.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ribbon.setIndex(indices); ribbon.computeVertexNormals();
    const earth = new THREE.Mesh(ribbon, soil); earth.receiveShadow = true; earth.name = 'EV_GardenSoil'; group.add(earth);
    // Warm, weathered low stone edging defines the planting without blocking it.
    for (let i = 0; i < 100; i++) {
      const t = (i + .5) / 100, z = bed.start + bed.length * t;
      const taper = .30 + .70 * Math.pow(Math.sin(Math.PI * t), .45);
      const yaw = Math.atan2(center(Math.min(1, t + .01)) - center(Math.max(0, t - .01)), bed.length * .02);
      for (const side of [-1, 1]) {
        const x = center(t) + side * bed.width * .5 * taper;
        const m = matrix(x, z, yaw, 1, .17);
        m.scale(new THREE.Vector3(.30, .33 + rng() * .04, bed.length / 100 * .95));
        edging.push(m);
      }
    }
    for (let i = 0; i < bed.count; i++) {
      const t = (i + rng() * .6) / bed.count;
      const taper = .30 + .70 * Math.pow(Math.sin(Math.PI * t), .45);
      const x = center(t) + (rng() - .5) * Math.max(.1, bed.width * taper - .9);
      const z = bed.start + t * bed.length;
      plants[i % 3].push(matrix(x, z, rng() * Math.PI * 2, 1.45 + rng() * .75, .20));
      if (i % 14 === 0) accents.push(matrix(x + .3, z + .4, rng() * 6.28, 1.3 + rng() * .3, .20));
    }
  }
  const palettes = [0x746a8c, 0x81748e, 0x6c6b86];
  palettes.forEach((color, i) => instances(group, 'EV_GardenLavender_' + i,
    lavenderBush(110 + i, color), foliageMaterial, plants[i]));
  instances(group, 'EV_GardenIvoryFlowers', wildflowerGeometry({petals: 6, color: 0xdfd9bc}), foliageMaterial, accents);
  // Individually jointed edging casts a small, physical shadow onto each bed.
  const kerb = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  instances(group, 'EV_GardenStoneEdging', kerb, stone, edging);
  world.scene.add(group);

  // These are placement sources consumed by heroTrees, not final flat trees.
  // The shared controller replaces them with the scanned species / mesh LODs.
  const trees = [[-96, 931, 1.0], [99, 979, .86], [-91, 1014, .78], [94, 921, .75], [-23, 1009, 1.15], [24, 1002, 1.05], [-25, 952, .9], [25, 944, .82]];
  const treeMatrices = trees.map(([x, z, scale]) => matrix(x, z, rng() * 6.28, scale, .15));
  const treeSource = impostorForest(group, 'broadleaf', treeMatrices, null, 13,
    {blobs: false, castShadow: true});
  if (treeSource) treeSource.userData.evGardenTreeSource = true;
  // Dark earth collars make the trees visibly rooted in the paved esplanade.
  const collarGeometry = new THREE.CylinderGeometry(2.3, 2.5, .18, 20);
  instances(group, 'EV_GardenTreeSoil', collarGeometry, soil,
    trees.map(([x, z, scale]) => matrix(x, z, 0, scale, .08)));

  let triangles = 0;
  group.traverse(o => {
    if (o.isMesh && !o.userData.evGardenTreeSource) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
  });
  group.userData.triangleCount = triangles;
  group.userData.plantCount = plants.reduce((n, p) => n + p.length, 0) + accents.length;
  group.userData.treePlacements = trees.length;
  return group;
}
