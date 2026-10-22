// Small, dimensional plants replace the painted, crossed flower billboards.
// Geometry stays sharp at any display resolution and receives the world's light.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function colored(geometry, color) {
  const c = new THREE.Color(color), a = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  geometry.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geometry;
}

function leaf(length, width, bend, color) {
  const g = new THREE.PlaneGeometry(width, length, 2, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / length + .5;
    p.setXYZ(i, p.getX(i) * Math.sin(t * Math.PI), t * length,
      bend * t * t + Math.abs(p.getX(i)) * .2);
  }
  g.computeVertexNormals();
  return colored(g, color);
}

export function wildflowerGeometry({ petals = 6, color = 0xe7d9b9, lavender = false } = {}) {
  const parts = [], height = lavender ? .60 : .46;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(), new THREE.Vector3(.025, height * .5, .01),
    new THREE.Vector3(.045, height, -.015));
  parts.push(colored(new THREE.TubeGeometry(curve, 4, .0045, 4, false), 0x3c5830));
  for (let i = 0; i < 4; i++) {
    const g = leaf(.11 + i * .012, .026, .04, i % 2 ? 0x446839 : 0x36562c);
    g.rotateZ((i % 2 ? -1 : 1) * 1.05); g.rotateY(i * 2.4);
    const p = curve.getPoint(.18 + i * .15); g.translate(p.x, p.y, p.z); parts.push(g);
  }
  const top = curve.getPoint(1);
  if (lavender) {
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.39996;
      const bud = colored(new THREE.SphereGeometry(.011, 5, 3), color);
      bud.scale(1, 1.5, 1); bud.translate(top.x + Math.cos(angle) * .018,
        top.y - .08 + i * .01, top.z + Math.sin(angle) * .018); parts.push(bud);
    }
  } else {
    for (let i = 0; i < petals; i++) {
      const g = leaf(.047, .035, .010, color);
      g.rotateX(-Math.PI * .48); g.rotateY(i * Math.PI * 2 / petals);
      g.translate(top.x, top.y, top.z); parts.push(g);
    }
    const centre = colored(new THREE.SphereGeometry(.012, 8, 4), 0x82723b);
    centre.scale(1, .5, 1); centre.translate(top.x, top.y + .005, top.z); parts.push(centre);
  }
  const result = mergeGeometries(parts, false);
  parts.forEach(g => g.dispose());
  return result;
}

export function wildflowerMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: .85, metalness: 0,
    side: THREE.DoubleSide, envMapIntensity: .8,
  });
}
