// Scanned forest with true 3D meshes at every viewing distance.
// Whole-tree billboards are hidden only after their mesh replacements are ready.
import * as THREE from 'three';
import { initScannedMaterials } from './scannedMaterials.js?v=73';
import { assignForestLods } from './forestLodSelection.js?v=73';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js?v=36';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js?v=36';

const KIND = /^EV_Impostor_(fir|broadleaf|smallleaf|blossom)(?:_dense)?$/;
const PADDING = { fir:18.939/19.696, broadleaf:5.027/5.229, smallleaf:4.557/4.739, blossom:19.469/25.394 };
const VERSION = '?v=20261022b';

export async function buildHeroTrees(world) {
  if (!world?.scene || !world?.renderer || !world?.camera) return null;
  const mobile = (window.__EV_DEVICE?.tier || 'desktop') !== 'desktop';
  const manifestResponse = await fetch('images/hero-trees/forest-lods.json' + VERSION);
  if (!manifestResponse.ok) throw new Error('3D forest asset manifest unavailable');
  const manifest = await manifestResponse.json();
  const ktx = initScannedMaterials(world.renderer);
  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const textureCache = new Map(), materials = new Set(), templates = new Map();
  const loadTexture = (path, srgb) => {
    if (!path) return Promise.resolve(null);
    const key = path + ':' + srgb;
    if (!textureCache.has(key)) textureCache.set(key, (async () => {
      const loader = path.endsWith('.ktx2') ? ktx : new THREE.TextureLoader();
      const texture = await loader.loadAsync(path + VERSION);
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.flipY = false;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy = Math.min(mobile ? 2 : 8, world.renderer.capabilities.getMaxAnisotropy());
      return texture;
    })());
    return textureCache.get(key);
  };
  const group = new THREE.Group(); group.name = 'EV_VolumetricForest';
  try {
    for (const [kind, species] of Object.entries(manifest.species)) {
      const materialMap = new Map(), farMaterials = new Map();
      for (const [name, recipe] of Object.entries(species.materials)) {
        const [map, normalMap, arm] = await Promise.all([
          loadTexture(recipe.map, true), loadTexture(recipe.normalMap, false), loadTexture(recipe.arm, false),
        ]);
        const material = new THREE.MeshStandardMaterial({
          map, normalMap, roughnessMap:arm, aoMap:arm, color:recipe.color ?? 0xffffff,
          vertexColors:recipe.vertexColors ?? false, roughness:1, metalness:0,
          aoMapIntensity:.65, envMapIntensity:.8, side:THREE.DoubleSide,
          alphaTest:recipe.alphaTest ?? 0,
        });
        material.name = 'Forest_' + kind + '_' + name;
        if (kind === 'blossom' && recipe.foliage) {
          material.onBeforeCompile = shader => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
              float flowerLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.28,.66,.83)*flowerLuma,.82);`);
          };
          material.customProgramCacheKey=()=> 'forest-blossom';
        }
        materials.add(material); materialMap.set(name, material);
        if(recipe.farAlphaTest !== undefined) {
          const far=material.clone();far.alphaTest=recipe.farAlphaTest;
          far.onBeforeCompile=material.onBeforeCompile;
          far.customProgramCacheKey=material.customProgramCacheKey;
          materials.add(far);farMaterials.set(name,far);
        }
      }
      const lods = {};
      for (const level of ['near', 'mid', 'far']) {
        const botanicalFar=level==='far' && species.lods.farBotanical;
        const asset = await gltfLoader.loadAsync((botanicalFar || species.lods[level]).file + VERSION);
        asset.scene.updateMatrixWorld(true);
        const parts = [];
        asset.scene.traverse(object => {
          if (!object.isMesh) return;
          const material = (level==='far' && !botanicalFar && farMaterials.get(object.material.name)) || materialMap.get(object.material.name);
          if (!material) throw new Error('Missing forest material: ' + object.material.name);
          const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
          if (geometry.attributes.uv && !geometry.attributes.uv1) geometry.setAttribute('uv1', geometry.attributes.uv);
          parts.push({geometry, material});
        });
        asset.scene.traverse(object => { if (object.isMesh) {object.geometry.dispose(); object.material.dispose();} });
        if (!parts.length) throw new Error('Empty forest mesh: ' + kind + '/' + level);
        lods[level] = parts;
      }
      templates.set(kind, {height:species.heightMeters, lods});
    }
  } catch (error) {
    templates.forEach(t => Object.values(t.lods).flat().forEach(p => p.geometry.dispose()));
    materials.forEach(m => m.dispose());
    textureCache.forEach(p => p.then(t => t?.dispose()).catch(() => {}));
    throw error;
  }
  world.scene.add(group);
  const sources = new Map(), candidates = [], pools = new Map(), trunkGrid = new Map();
  const gridKey=(x,z)=>Math.floor(x/32)+','+Math.floor(z/32);
  const registerTrunks=()=>{
    trunkGrid.clear();
    for(const item of candidates){const key=gridKey(item.x,item.z);if(!trunkGrid.has(key))trunkGrid.set(key,[]);trunkGrid.get(key).push(item);}
  };
  let lastDiscovery = -Infinity, lastUpdate = -Infinity, disposed = false, visibleCount = 0, scatterClaimed = false;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const cameraPosition = new THREE.Vector3(), frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const clearPool = pool => { for (const mesh of pool.meshes) {mesh.removeFromParent();mesh.dispose();} };
  const ensurePool = (kind, level, size) => {
    const key = kind + '/' + level;
    let pool = pools.get(key);
    if (pool && pool.capacity >= size) return pool;
    if (pool) clearPool(pool);
    const capacity = Math.max(16, Math.ceil(size / 64) * 64);
    const meshes = templates.get(kind).lods[level].map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
      mesh.name = 'EV_Forest_' + kind + '_' + level;
      mesh.count = 0; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = !mobile && level !== 'far'; mesh.receiveShadow = true;
      mesh.userData.evDynamicInstances = true;
      group.add(mesh); return mesh;
    });
    pool = {capacity, meshes}; pools.set(key, pool); return pool;
  };
  const discover = () => {
    world.scene.updateMatrixWorld(true);
    if (!scatterClaimed && world._evScatter?.claimTreePlacements) {
      scatterClaimed=true;
      for (const source of world._evScatter.claimTreePlacements()) {
        const kind=/fir/.test(source.name)?'fir':/cherry/.test(source.name)?'blossom':'broadleaf';
        sources.set(source.group,{visible:source.group.visible,scatter:true});
        for(let i=0;i<source.count;i++) {
          if(!source.keep[i])continue;
          matrix.fromArray(source.matrices,i*16).premultiply(source.group.matrixWorld);
          matrix.decompose(position,rotation,scale);
          const treeHeight=source.height*Math.abs(scale.x);
          scale.setScalar(treeHeight/templates.get(kind).height);
          candidates.push({kind,source:source.group,matrix:new THREE.Matrix4().compose(position,rotation,scale),
            color:new THREE.Color(1,1,1),x:position.x,y:position.y+treeHeight*.5,z:position.z,
            radius:treeHeight*.75,distance:0});
        }
      }
    }
    world.scene.traverse(mesh => {
      const match = mesh.isInstancedMesh && KIND.exec(mesh.name);
      if (!match || sources.has(mesh)) return;
      const sourceKind = match[1];
      const kind = sourceKind === 'fir' ? 'fir' : (sourceKind === 'blossom' || mesh.material?.defines?.NF_BLOSSOM ? 'blossom' : 'broadleaf');
      const template = templates.get(kind);
      if (!template) return;
      sources.set(mesh, {visible:mesh.userData.evVis0 ?? mesh.visible});
      mesh.userData.evReplacedByForest=true;
      mesh.geometry.computeBoundingBox();
      const sourceHeight = mesh.geometry.boundingBox.max.y * PADDING[sourceKind];
      for (let index=0; index<mesh.count; index++) {
        mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
        matrix.decompose(position, rotation, scale);
        if (Math.abs(scale.x) < .0001) continue;
        const treeHeight = sourceHeight * Math.abs(scale.x);
        scale.setScalar(treeHeight / template.height);
        const color = new THREE.Color(1,1,1);
        if (mesh.instanceColor) mesh.getColorAt(index, color);
        candidates.push({kind, source:mesh, matrix:new THREE.Matrix4().compose(position,rotation,scale), color,
          x:position.x, y:position.y + treeHeight*.5, z:position.z, radius:treeHeight*.75, distance:0});
      }
      mesh.visible = false;
    });
    registerTrunks();
  };
  const parentVisible = source => {
    if (!sources.get(source)?.visible) return false;
    for (let p=source.parent; p; p=p.parent) if (!p.visible) return false;
    return !!source.parent;
  };
  const controller = {
    group,
    get activeCount() { return visibleCount; },
    get candidateCount() { return candidates.length; },
    constrainWalk(x,z) {
      for(let pass=0;pass<2;pass++) for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
        for(const tree of trunkGrid.get(gridKey(x+dx*32,z+dz*32))||[]) {
          const radius=Math.max(.45,tree.radius*.024)+.3;
          const vx=x-tree.x,vz=z-tree.z,distance=Math.hypot(vx,vz);
          if(distance<radius){const angle=distance>.0001?Math.atan2(vz,vx):0;x=tree.x+Math.cos(angle)*radius;z=tree.z+Math.sin(angle)*radius;}
        }
      }
      return {x,z};
    },
    get diagnostic() { return {camera:cameraPosition.toArray(), candidates:candidates.length,
      visible:visibleCount, hiddenFlatTrees:sources.size,
      lods:Object.fromEntries([...pools].map(([k,p])=>[k,p.meshes[0]?.count ?? 0]))}; },
    update(force=false) {
      if (disposed) return;
      const now=performance.now();
      if (!force && now-lastUpdate<100) return;
      lastUpdate=now;
      if (now-lastDiscovery>2000) {discover();lastDiscovery=now;}
      world.camera.updateMatrixWorld();
      cameraPosition.setFromMatrixPosition(world.camera.matrixWorld);
      projection.multiplyMatrices(world.camera.projectionMatrix,world.camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      const projectedScale=(world.renderer.domElement.clientHeight || 900)/(2*Math.tan(THREE.MathUtils.degToRad(world.camera.fov*.5)));
      const visible=new Map([...templates.keys()].map(k=>[k,[]]));
      for (const item of candidates) {
        if (!parentVisible(item.source)) continue;
        item.distance=Math.hypot(item.x-cameraPosition.x,item.y-cameraPosition.y,item.z-cameraPosition.z);
        if (item.distance>world.camera.far+item.radius) continue;
        item.screenPixels=(item.radius/0.75)*projectedScale/Math.max(1,item.distance);
        sphere.center.set(item.x,item.y,item.z);sphere.radius=item.radius;
        if (frustum.intersectsSphere(sphere)) visible.get(item.kind).push(item);
      }
      visibleCount=0;
      for (const [kind, items] of visible) {
        const assigned=assignForestLods(items,{nearLimit:mobile?4:12,midLimit:mobile?24:96});
        for (const [level, selected] of Object.entries(assigned)) {
          const pool=ensurePool(kind,level,selected.length);
          for (const mesh of pool.meshes) {
            mesh.count=selected.length;
            selected.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,item.color);});
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
          }
          visibleCount+=selected.length;
        }
      }
      world.renderer.shadowMap.needsUpdate=true;
    },
    dispose() {
      if(disposed)return;disposed=true;
      sources.forEach((state,mesh)=>{mesh.visible=state.visible;delete mesh.userData.evReplacedByForest;});
      if(scatterClaimed)world._evScatter?.restoreTreePlacements();
      pools.forEach(clearPool);group.removeFromParent();
      templates.forEach(t=>Object.values(t.lods).flat().forEach(p=>p.geometry.dispose()));
      materials.forEach(m=>m.dispose());
      textureCache.forEach(p=>p.then(t=>t?.dispose()).catch(()=>{}));
    },
  };
  controller.update(true);
  console.info('[3D forest] ready',JSON.stringify(controller.diagnostic));
  return controller;
}
