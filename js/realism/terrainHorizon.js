// Terrain casts shadows beyond the near-camera shadow cascades. A coarse height
// field ray traces the actual ridges toward the sun; skylight remains untouched.
import * as THREE from 'three';
import { terrainHeight } from '../terrain.js?v=73';
import { config } from './rendererConfig.js?v=73';
let pending;
export function terrainHorizon() {
  return pending ||= bake();
}
async function bake() {
  const size=256, half=7400, step=half*2/(size-1), heights=new Float32Array(size*size);
  const direction=config.sun.direction.clone().normalize();
  const horizontal=Math.hypot(direction.x,direction.z);
  const dx=direction.x/horizontal,dz=direction.z/horizontal, sunSlope=direction.y/horizontal;
  for(let z=0;z<size;z++) {
    for(let x=0;x<size;x++) heights[z*size+x]=terrainHeight(x*step-half,z*step-half);
    if(z%16===0) await new Promise(resolve=>setTimeout(resolve,0));
  }
  const sample=(x,z)=>{
    if(x<0||z<0||x>=size-1||z>=size-1)return -1000;
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,i=iz*size+ix;
    return (heights[i]*(1-fx)+heights[i+1]*fx)*(1-fz)+(heights[i+size]*(1-fx)+heights[i+size+1]*fx)*fz;
  };
  const bytes=new Uint8Array(size*size);
  for(let z=0;z<size;z++) {
    for(let x=0;x<size;x++) {
      const base=heights[z*size+x]+5;let horizon=-10;
      for(let d=step;d<4800;d*=1.12) horizon=Math.max(horizon,(sample(x+dx*d/step,z+dz*d/step)-base)/d);
      const t=THREE.MathUtils.clamp((sunSlope-horizon+.012)/.024,0,1);
      bytes[z*size+x]=Math.round(255*t*t*(3-2*t));
    }
    if(z%16===0) await new Promise(resolve=>setTimeout(resolve,0));
  }
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RedFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return {texture,half,direction};
}
