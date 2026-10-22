// EVR-04 motion (Eternal Valley Animation): distant bird flocks.
// Self-contained: one InstancedMesh (2 tris/bird, wing flap in vertex shader),
// soft warm-grey silhouettes gliding in lazy loops high over the valley.
// Desktop 18 birds, low/mobile 6, prefers-reduced-motion 0 (hidden, live-updated).
// Cost: 1 draw call, <=36 tris, 18 matrix writes/frame (~0.03 ms).
import * as THREE from 'three';

const RM = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

export class MotionBirds {
  constructor(world, opts = {}) {
    this.world = world;
    const mob = typeof window !== 'undefined' && (/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 768);
    const tier = world._qualityTier;
    this.count = (mob || tier === 'low') ? 6 : 18;
    this.center = opts.center || new THREE.Vector3(0, 0, -150);
    // Two wing triangles sharing the body edge; x = span side, flap uses |x|.
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.35,  -1.1, 0, -0.15,  0, 0, -0.35,
      0, 0, 0.35,   0, 0, -0.35,   1.1, 0, -0.15], 3));
    const phase = new Float32Array(this.count);
    this.birds = [];
    for (let i = 0; i < this.count; i++) {
      phase[i] = Math.random() * 6.283;
      const flock = i % 3;
      this.birds.push({
        r: 120 + flock * 90 + Math.random() * 25,
        h: 95 + flock * 18 + Math.random() * 10,
        a: flock * 2.1 + Math.random() * 0.35,
        w: (0.035 + Math.random() * 0.01) * (flock === 1 ? -1 : 1),
        bob: Math.random() * 6.283,
        s: 0.9 + Math.random() * 0.4,
      });
    }
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a4440, side: THREE.DoubleSide, fog: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uniforms.uTime;
      sh.vertexShader = 'uniform float uTime; attribute float aPhase;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n float f = sin(uTime * 5.0 + aPhase); float glide = step(0.0, sin(uTime*0.4+aPhase));\n transformed.y += abs(position.x) * mix(f * 0.55, 0.08, glide);');
    };
    this.mesh = new THREE.InstancedMesh(g, mat, this.count);
    this.mesh.name = 'EVR04_birds';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._d = new THREE.Object3D();
    world.scene.add(this.mesh);
  }
  update(dt, t) {
    const vis = !RM.matches;
    this.mesh.visible = vis;
    if (!vis) return;
    this.uniforms.uTime.value = t % 6283.1853;
    const d = this._d, c = this.center;
    for (let i = 0; i < this.count; i++) {
      const b = this.birds[i];
      b.a += b.w * dt;
      const x = c.x + Math.cos(b.a) * b.r, z = c.z + Math.sin(b.a) * b.r * 0.7;
      d.position.set(x, c.y + b.h + Math.sin(t * 0.3 + b.bob) * 3, z);
      // heading = tangent of the ellipse
      const tx = -Math.sin(b.a) * b.w, tz = Math.cos(b.a) * b.w * 0.7;
      d.rotation.set(0, Math.atan2(tx, tz), (b.w > 0 ? -1 : 1) * 0.18);
      d.scale.setScalar(b.s);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
