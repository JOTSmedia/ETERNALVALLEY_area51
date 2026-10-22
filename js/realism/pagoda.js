import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Independent five-storey timber pagoda. All dimensions are in world metres.
export function buildPagoda({ stone, timber, roof, bronze }) {
  const group = new THREE.Group();
  group.name = 'FiveTierPagoda';
  const add = (geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  };
  const box = (w, h, d, material, x, y, z) =>
    add(new RoundedBoxGeometry(w, h, d, 1, Math.min(.08, h * .08, w * .08, d * .08)), material, x, y, z);
  for (let i = 0; i < 3; i++) box(58 - i * 3, 1.2, 58 - i * 3, stone, 0, .6 + i * 1.2, 0);
  for (let i = 0; i < 9; i++) box(13, .4, 13 - i * 1.15, stone, 0, .2 + i * .4, 32 - i * .65);

  for (let level = 0; level < 5; level++) {
    const radius = 23 - level * 3.05, y = 4 + level * 19;
    const wall = radius * .70, roofY = y + 12.8;
    box(wall * 2 + 3, .8, wall * 2 + 3, timber, 0, y, 0);
    // Columns, lintels, and open verandas.
    for (let side = 0; side < 4; side++) {
      const angle = side * Math.PI / 2;
      for (let j = -2; j <= 2; j++) {
        if (level === 0 && side === 0 && j === 0) continue; // clear southern entrance
        const along = wall * j / 2, x = along * Math.cos(angle) + wall * Math.sin(angle);
        const z = wall * Math.cos(angle) - along * Math.sin(angle);
        add(new THREE.CylinderGeometry(.48, .58, 12, 20), timber, x, y + 6.2, z);
        box(1.5, .6, 1.5, stone, x, y + .6, z);
        // Bracket sets carry the eaves above each post.
        for (let k = 0; k < 3; k++) {
          const bracket = box(1.6 + k * .5, .42, 2.2 - k * .35, timber, x, y + 11.3 + k * .45, z);
          bracket.rotation.y = angle;
        }
      }
      const beam = box(wall * 2 + 2, .75, .8, timber,
        wall * Math.sin(angle), y + 12.1, wall * Math.cos(angle));
      beam.rotation.y = angle;
      if (level > 0) {
        const rail = box(wall * 2 + 1.5, .24, .28, timber,
          (wall + .6) * Math.sin(angle), y + 2.6, (wall + .6) * Math.cos(angle));
        rail.rotation.y = angle;
        for (let j = -8; j <= 8; j++) {
          const p = wall * j / 8;
          box(.16, 2.2, .16, timber, p * Math.cos(angle) + (wall + .6) * Math.sin(angle),
            y + 1.4, (wall + .6) * Math.cos(angle) - p * Math.sin(angle));
        }
      }
      // Recessed timber lattice, leaving the central door bays open.
      const inner = wall * .7;
      for (let j = -10; j <= 10; j++) {
        if (Math.abs(j) < 3) continue;
        const p = inner * j / 10;
        box(.12, 9.2, .16, timber, p * Math.cos(angle) + inner * Math.sin(angle),
          y + 5.3, inner * Math.cos(angle) - p * Math.sin(angle));
      }
      for (let h = 2; h < 11; h += 2) {
        if (level === 0) {
          for (const sign of [-1, 1]) {
            const length = inner - 4, offset = sign * (4 + length / 2);
            const rail = box(length, .12, .16, timber,
              offset * Math.cos(angle) + inner * Math.sin(angle), y + h,
              inner * Math.cos(angle) - offset * Math.sin(angle));
            rail.rotation.y = angle;
          }
        } else {
          const rail = box(inner * 2, .12, .16, timber, inner * Math.sin(angle), y + h, inner * Math.cos(angle));
          rail.rotation.y = angle;
        }
      }

      // Four continuous, concave tiled roof panels with lifted corners.
      const positions = [], uvs = [], indices = [], nx = 32, ny = 14;
      for (let v = 0; v <= ny; v++) {
        const t = v / ny, r = radius * (.24 + .76 * t);
        for (let u = 0; u <= nx; u++) {
          const q = u / nx * 2 - 1;
          const height = roofY + 7.2 * Math.pow(1 - t, 1.45)
            + 1.25 * Math.pow(t, 8) + 1.7 * Math.pow(Math.abs(q), 6) * t;
          positions.push(q * r * Math.cos(angle) + r * Math.sin(angle), height,
            r * Math.cos(angle) - q * r * Math.sin(angle));
          uvs.push(u / nx * radius * .8, t * radius * .4);
          if (u < nx && v < ny) {
            const a = v * (nx + 1) + u, b = a + nx + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      add(geometry, roof);
      const underside = geometry.clone(); underside.translate(0, -.28, 0); add(underside, timber);
      // Individually visible rafter ends below the eaves.
      for (let j = -12; j <= 12; j++) {
        const q = j / 12, r = radius * .94, lift = 1.7 * Math.pow(Math.abs(q), 6);
        const rafter = box(.24, .32, 3.4, timber,
          q * r * Math.cos(angle) + r * Math.sin(angle), roofY + .5 + lift,
          r * Math.cos(angle) - q * r * Math.sin(angle));
        rafter.rotation.y = angle; rafter.rotation.x = -.08;
      }
    }
  }
  // Traditional central finial, with nine diminishing bronze rings.
  add(new THREE.CylinderGeometry(.2, .55, 24, 24), bronze, 0, 113, 0);
  for (let i = 0; i < 9; i++) {
    const ring = add(new THREE.TorusGeometry(2.6 - i * .18, .14, 8, 40), bronze, 0, 103 + i * 2, 0);
    ring.rotation.x = Math.PI / 2;
  }
  // A sheltered ground-floor shrine, reached through the central door bay.
  box(9, .5, 9, timber, 0, 4.5, 0);
  box(3.8, 1.1, 1.8, timber, 0, 5.3, -2);
  for (const x of [-1.2, 1.2]) add(new THREE.CylinderGeometry(.22, .28, .6, 20), bronze, x, 6.15, -2);
  return group;
}
