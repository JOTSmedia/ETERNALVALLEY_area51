// Real Alpine landforms, transformed into the fictional sanctuary.
// Attribution and exact source tiles: images/terrain/alpine/source.json.
let data=null, metadata=null, pending=null;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function installAlpineElevation(values, meta) {
  if(values.length!==meta.width*meta.height) throw new Error('Alpine elevation grid size mismatch');
  data=values;metadata=meta;
}
export function hasAlpineElevation(){return !!data;}
export async function loadAlpineElevation(){
  if(data)return metadata;
  if(!pending)pending=(async()=>{
    const base=new URL('../../images/terrain/alpine/',import.meta.url);
    const [m,r]=await Promise.all([fetch(new URL('source.json',base)),fetch(new URL('mont-blanc.u16',base))]);
    if(!m.ok||!r.ok)throw new Error('Alpine elevation data unavailable');
    const meta=await m.json();installAlpineElevation(new Uint16Array(await r.arrayBuffer()),meta);return meta;
  })();
  return pending;
}
export function alpineWeight(x,z){
  // Keep the inhabited valley, all temple foundations, river and southern sea.
  let weight=smooth(850,1650,Math.hypot(x,z))*(1-smooth(200,1000,z));
  // Fixed foundations and water basins remain intact while real landforms extend
  // into the visible middle distance, replacing the old smooth noise domes.
  for(const [cx,cz,r,blend] of [[0,880,300,150],[700,-860,220,160],[1200,190,145,100],[-850,216,145,100],[885,263,390,100]]) {
    weight*=smooth(r,r+blend,Math.hypot(x-cx,z-cz));
  }
  const canyon=Math.hypot((x+1000)/580,(z+560)/410);
  weight*=smooth(1,1.4,canyon);
  return weight;
}
export function alpineElevation(x,z){
  if(!data)return null;
  const {width:w,height:h,xMin,zMin,metresPerSample:s,quantization:q}=metadata;
  const px=Math.max(0,Math.min(w-1.001,(-x*2-xMin)/s));
  const pz=Math.max(0,Math.min(h-1.001,(-z*2-zMin)/s));
  const ix=Math.floor(px),iz=Math.floor(pz),fx=px-ix,fz=pz-iz,i=iz*w+ix;
  const top=data[i]*(1-fx)+data[i+1]*fx,bottom=data[i+w]*(1-fx)+data[i+w+1]*fx;
  return Math.max(24,((top*(1-fz)+bottom*fz)*q-950)*.62+60);
}
export function blendAlpineTerrain(x,z,base){
  const h=alpineElevation(x,z);if(h===null)return base;
  const w=alpineWeight(x,z);return base+(h-base)*w;
}
