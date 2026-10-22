// Photoscanned rock geometry breaks the flat height-field silhouette at cliff
// edges. These are real meshes with shadow-casting depth, not rock decals.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { terrainHeight, distToRoads, getRiverInfo, WORLD, mulberry32 } from '../terrain.js?v=73';
import { scannedPBR } from './scannedMaterials.js?v=73';
import { worldSpaceSurface } from './nearField.js?v=73';
export async function buildGeologicalOutcrops(world) {
 const group=new THREE.Group();group.name='EV_GeologicalOutcrops';
 const random=mulberry32(782733), sets=[[],[]];
 world.tourController?._initTourSpline?.();
 const flight=world.tourController?._tourSpline?.getPoints(512)||[];
 for(let i=0;i<1900;i++) {
  const x=-1600+random()*3300,z=-1700+random()*2000,h=terrainHeight(x,z);
  if(h<95||h>1400||distToRoads(x,z)<20||getRiverInfo(x,z).dist<45)continue;
  if(Math.hypot(x-WORLD.cathedral.x,z-WORLD.cathedral.z)<125)continue;
  if(Math.hypot(x-WORLD.buddhistTemple.x,z-WORLD.buddhistTemple.z)<150)continue;
  if(Math.hypot(x-WORLD.mosque.x,z-WORLD.mosque.z)<150)continue;
  const gx=(terrainHeight(x+4,z)-terrainHeight(x-4,z))/8;
  const gz=(terrainHeight(x,z+4)-terrainHeight(x,z-4))/8;
  const slope=Math.hypot(gx,gz); if(slope<.55||slope>2.8)continue;
  if(flight.some(p=>Math.hypot(p.x-x,p.z-z)<35 && p.y<h+50))continue;
  const width=7+random()*16;
  sets[i%2].push(new THREE.Matrix4().compose(new THREE.Vector3(x,h-width*.2,z),
   new THREE.Quaternion().setFromEuler(new THREE.Euler((random()-.5)*.4,Math.atan2(gx,gz)+random()*.7,(random()-.5)*.3)),
   new THREE.Vector3(width*(.8+random()*.5),width*(.65+random()*.65),width)));
 }
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const paths=['rock_rock_07_lod0.glb','rock_namaqualand_boulder_02_lod0.glb'];
 const scans=await Promise.all(paths.map(p=>loader.loadAsync('images/nearfield/'+p)));
 for(let k=0;k<2;k++) {
  if(!sets[k].length)continue;
  let source;scans[k].scene.traverse(o=>{if(!source&&o.isMesh)source=o;});
  if(!source)throw new Error('Rock scan has no geometry');
  const geometry=source.geometry.clone();geometry.computeBoundingBox();
  const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),diameter=Math.max(size.x,size.z);
  const center=box.getCenter(new THREE.Vector3());geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1/diameter,1/diameter,1/diameter);
  const material=new THREE.MeshStandardMaterial({...scannedPBR('rock'),color:0x7b8284,roughness:.98});
  worldSpaceSurface(material,5,null,true);
  const mesh=new THREE.InstancedMesh(geometry,material,sets[k].length);
  sets[k].forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
 }
 group.userData.instanceCount=sets[0].length+sets[1].length;
 world.scene.add(group);return group;
}
