// Original 4096px photoscans with GPU compression; one loader for the library.
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { EV_PERF } from '../perf/qualityTier.js?v=73';

let loader;
const queue = [];
const assets = new Map();
const dependents = new WeakMap();

export function initScannedMaterials(renderer) {
  if (loader) return loader;
  loader = new KTX2Loader()
    .setTranscoderPath('libs/three/examples/jsm/libs/basis/')
    .setWorkerLimit(2)
    .detectSupport(renderer);
  queue.splice(0).forEach(start => start());
  return loader;
}

function adopt(target, source) {
  // Dispose the old placeholder allocation before changing its GPU format.
  target.dispose();
  target.source = source.source;
  target.mipmaps = source.mipmaps;
  target.format = source.format;
  target.type = source.type;
  target.isCompressedTexture = source.isCompressedTexture;
  target.flipY = source.isCompressedTexture ? false : true;
  target.generateMipmaps = !source.isCompressedTexture;
  target.minFilter = THREE.LinearMipmapLinearFilter;
  target.magFilter = THREE.LinearFilter;
  target.anisotropy = EV_PERF.tier === 'desktop' ? 8 : 2;
  target.needsUpdate = true;
}

export function cloneScannedTexture(source, repeat) {
  const clone = source.clone();
  if (source.isCompressedTexture) adopt(clone, source);
  clone.repeat.set(repeat, repeat);
  clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
  const listeners = dependents.get(source);
  if (listeners) {
    listeners.add(clone);
    clone.addEventListener('dispose', function cleanup() {
      // An adoption also disposes a placeholder; keep it registered until load.
      if (!source.userData.pendingScan) listeners.delete(clone);
    });
  }
  clone.needsUpdate = true;
  return clone;
}

export function scannedPBR(name) {
  if (assets.has(name)) return assets.get(name);
  const maps = {};
  for (const [property, channel] of [['map', 'diff'], ['normalMap', 'nor'], ['roughnessMap', 'rough']]) {
    const tex = new THREE.Texture();
    tex.colorSpace = channel === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.userData.pendingScan = true;
    dependents.set(tex, new Set());
    maps[property] = tex;
    const tier = EV_PERF.tier === 'desktop' ? '' : '/1k';
    const path = `images/materials-4k${tier}/${name}_${channel}`;
    const start = () => loader.load(path + '.ktx2?v=65', loaded => {
      adopt(tex, loaded);
      for (const clone of dependents.get(tex)) adopt(clone, loaded);
      tex.userData.pendingScan = false;
      dependents.get(tex).clear();
    }, undefined, () => {
      // JPEG fallback preserves access when compressed texture decoding fails.
      new THREE.TextureLoader().load(`images/materials-4k/${name}_${channel}.jpg`, loaded => {
        adopt(tex, loaded);
        for (const clone of dependents.get(tex)) adopt(clone, loaded);
        tex.userData.pendingScan = false;
        dependents.get(tex).clear();
      }, undefined, error => console.warn('[scans] unavailable:', name, channel, error));
    });
    if (loader) start(); else queue.push(start);
  }
  assets.set(name, maps);
  return maps;
}
