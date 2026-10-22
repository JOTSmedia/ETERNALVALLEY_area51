// Original architectural model: a load-bearing triumphal arch with a real portal.
// Dimensions are metres; PBR photoscans are the existing Poly Haven CC0 assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { scannedPBR } from './scannedMaterials.js?v=73';
import { worldSpaceSurface } from './nearField.js?v=73';
import { WORLD } from '../terrain.js?v=73';
import font from './triumphalGateFont.js?v=73';

const PI = Math.PI;
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
function masonry(w, h, d, bevel = .065) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w * .1, h * .1, d * .1));
}
function extrude(shape, depth, bevel = .04, curveSegments = 48) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments, bevelEnabled: bevel > 0,
    bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel,
  });
  g.translate(0, 0, -depth / 2); return g;
}
function ringSector(inner, outer, start, end, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
  shape.absarc(0, 0, inner, start, end, false);
  shape.lineTo(Math.cos(end) * outer, Math.sin(end) * outer);
  shape.absarc(0, 0, outer, end, start, true); shape.closePath();
  return extrude(shape, depth, .035, Math.max(4, Math.ceil(Math.abs(end - start) / PI * 48)));
}
function tube(points, radius, segments = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)));
  return new THREE.TubeGeometry(curve, segments, radius, 8, false);
}
function torus(radius, thickness, xScale = 1) {
  const g = new THREE.TorusGeometry(radius, thickness, 10, 56);
  g.scale(xScale, 1, 1); return g;
}
function flutedColumn(height, radius) {
  const radial = 192, vertical = 16, positions = [], uv = [], indices = [];
  for (let j = 0; j <= vertical; j++) {
    const t = j / vertical;
    const entasis = 1 - .13 * t + .045 * Math.sin(t * PI);
    for (let i = 0; i <= radial; i++) {
      const a = i / radial * PI * 2;
      const r = radius * entasis * (1 - .055 * (1 + Math.cos(a * 24)));
      positions.push(Math.cos(a) * r, t * height, Math.sin(a) * r);
      uv.push(i / radial, t);
      if (j < vertical && i < radial) {
        const k = j * (radial + 1) + i;
        indices.push(k, k + radial + 1, k + 1, k + 1, k + radial + 1, k + radial + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}
function acanthus(height = 1, width = .6) {
  const g = new THREE.PlaneGeometry(width, height, 8, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, p.getY(i) / height + .5)), x = p.getX(i) / (width * .5);
    const taper = Math.pow(Math.sin(PI * t), .6);
    const serration = .87 + .13 * Math.cos(t * PI * 12);
    p.setXYZ(i, x * width * .5 * taper * serration,
      t * height, .10 * height * Math.sin(t * PI) + .28 * height * t ** 5 - .06 * Math.abs(x) * height);
  }
  g.computeVertexNormals(); return g;
}
function inscription(text, size, depth) {
  const allShapes = []; let offset = 0;
  for (const char of text) {
    const glyph = font.glyphs[char] || font.glyphs['?'];
    if (!glyph) continue;
    const path = new THREE.ShapePath(), scale = size / font.resolution;
    const tokens = (glyph.o || '').split(' '); let k = 0;
    const x = n => Number(n) * scale + offset, y = n => Number(n) * scale;
    while (k < tokens.length) {
      const op = tokens[k++];
      if (op === 'm') path.moveTo(x(tokens[k++]), y(tokens[k++]));
      else if (op === 'l') path.lineTo(x(tokens[k++]), y(tokens[k++]));
      else if (op === 'q') {
        const ex = x(tokens[k++]), ey = y(tokens[k++]);
        path.quadraticCurveTo(x(tokens[k++]), y(tokens[k++]), ex, ey);
      } else if (op === 'b') {
        const ex = x(tokens[k++]), ey = y(tokens[k++]);
        const c1x = x(tokens[k++]), c1y = y(tokens[k++]);
        path.bezierCurveTo(c1x, c1y, x(tokens[k++]), y(tokens[k++]), ex, ey);
      }
    }
    allShapes.push(...path.toShapes()); offset += glyph.ha * scale;
  }
  const geometry = new THREE.ExtrudeGeometry(allShapes,
    {depth, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: .015, bevelThickness: .015, curveSegments: 8});
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  geometry.translate(-(bounds.max.x + bounds.min.x) / 2, 0, 0);
  return geometry;
}

/** Centre of the curving south approach, in world coordinates. */
export function gateApproachCenter(worldZ) {
  const t = Math.max(0, Math.min(1, (worldZ - WORLD.gate.z - 20) / 145));
  return WORLD.gate.x + 5 * Math.sin(Math.PI * t);
}

/** Builds the entrance and exposes the existing animated hinge contract. */
export function buildTriumphalGate(world) {
  const group = new THREE.Group(); group.name = 'gate';
  group.position.set(WORLD.gate.x, WORLD.gate.y, WORLD.gate.z);
  const materials = {
    stone: new THREE.MeshStandardMaterial({...scannedPBR('stone'), color: 0xd7d1c1, roughness: .84}),
    warmStone: new THREE.MeshStandardMaterial({...scannedPBR('stone'), color: 0xc5bdab, roughness: .88}),
    marble: new THREE.MeshStandardMaterial({...scannedPBR('marble'), color: 0xe1ded2, roughness: .68}),
    gold: new THREE.MeshStandardMaterial({color: 0xbda05b, metalness: .82, roughness: .38}),
    bronze: new THREE.MeshStandardMaterial({color: 0x635035, metalness: .75, roughness: .53}),
    patina: new THREE.MeshStandardMaterial({color: 0x3c483e, metalness: .65, roughness: .61}),
    paving: new THREE.MeshStandardMaterial({...scannedPBR('paving'), color: 0xb4aa94, roughness: .94}),
    lawn: new THREE.MeshStandardMaterial({...scannedPBR('grass'), color: 0x619346, roughness: .98}),
  };
  for (const name of ['stone', 'warmStone', 'marble', 'paving', 'lawn']) worldSpaceSurface(materials[name], name === 'marble' ? 2.6 : name === 'lawn' ? 3.2 : 2.0);
  materials.gold.side = materials.marble.side = THREE.DoubleSide;
  const buckets = new Map();
  const add = (material, geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geometry.scale(sx, sy, sz); geometry.rotateX(rx); geometry.rotateY(ry); geometry.rotateZ(rz);
    geometry.translate(x, y, z);
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material).push(geometry); return geometry;
  };
  const box = (material, w, h, d, x = 0, y = 0, z = 0, bevel = .065) => add(material, masonry(w,h,d,bevel),x,y,z);
  const flush = (target, source = buckets) => {
    for (const [material, parts] of source) {
      if (!parts.length) continue;
      const converted = parts.map(g => g.index ? g.toNonIndexed() : g);
      const geo = mergeGeometries(converted, false);
      if (!geo) throw new Error('Gate geometry could not be merged: ' + material);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, materials[material]);
      mesh.name = 'TriumphalGate_' + material; mesh.castShadow = mesh.receiveShadow = true;
      target.add(mesh);
      for (const g of new Set([...parts,...converted])) g.dispose();
    }
    source.clear();
  };

  // Continuous load-bearing substrate and level access, matching the garden's
  // documented walk surfaces: esplanade top +.2 and central apron top +1.25.
  box('paving', 288, 8, 240, 0, -3.8, 60);
  box('warmStone', 96, 1.6, 210, 0, .45, 60);
  // Lawn caps preserve the existing collision floor while replacing the broad
  // paved plaza with a planted approach. Cap y values avoid coplanar overlap.
  add('lawn', new THREE.PlaneGeometry(288,240),0,.215,60,-PI/2);
  add('lawn', new THREE.PlaneGeometry(96,210),0,1.265,60,-PI/2);
  const pathPos=[], pathUV=[], pathIndices=[], pathSteps=140;
  for(let i=0;i<=pathSteps;i++) {
    const z=-45+i/pathSteps*210;
    const x=gateApproachCenter(WORLD.gate.z+z)-WORLD.gate.x;
    const t=Math.max(0,Math.min(1,z/22)), ease=t*t*(3-2*t);
    const width=z>=0?34-23*ease:34+8*z/45;
    for(const side of [-1,1]) {pathPos.push(x+side*width/2,1.29,z);pathUV.push((x+side*width/2)/2,z/2);}
    if(i<pathSteps){const a=i*2;pathIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
    if(i>28) for(const side of [-1,1]) {
      const nextZ=z+.25,nextX=gateApproachCenter(WORLD.gate.z+nextZ)-WORLD.gate.x;
      add('marble',masonry(.20,.13,1.47,.025),x+side*(width/2+.09),1.29,z,0,Math.atan2(nextX-x,.25));
    }
  }
  const pathGeometry=new THREE.BufferGeometry();
  pathGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pathPos,3));
  pathGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(pathUV,2));
  pathGeometry.setIndex(pathIndices);pathGeometry.computeVertexNormals();
  add('paving',pathGeometry);
  box('marble',35.0,.12,13.5,0,1.30,0,.025);

  // One continuous extruded masonry body, with the arch opening cut all the
  // way through. No detached arch floating above a rectangular lintel.
  const body = new THREE.Shape();
  body.moveTo(-34, 1.25); body.lineTo(-17, 1.25); body.lineTo(-17, 23);
  body.absarc(0, 23, 17, PI, 0, true);
  body.lineTo(17, 1.25); body.lineTo(34, 1.25); body.lineTo(34, 43.4);
  body.lineTo(-34, 43.4); body.closePath();
  add('stone', extrude(body, 12, .08));

  // Rusticated courses: real blocks, recessed joints, subtly varied stone.
  for (const s of [-1,1]) {
    box('warmStone', 18.5, 1.0, 15.2, s * 25.5, 1.8, 0);
    box('marble', 17.8, .75, 14.2, s * 25.5, 2.62, 0);
    for (let course = 0; course < 11; course++) {
      const y = 3.35 + course * 2.85;
      for (let front of [-1,1]) {
        const count = course % 2 ? 3 : 2, width = 16.8 / count;
        for (let i = 0; i < count; i++) box((course + i) % 4 === 0 ? 'warmStone' : 'stone', width - .045, 2.80, .19,
          s * 25.5 - 8.4 + width * (i + .5), y, front * 6.06, .045);
      }
    }
  }
  // Three concentric mouldings / articulated voussoir courses on both facades.
  for (const face of [-1,1]) {
    for (let ring = 0; ring < 3; ring++) {
      const inner = 17.02 + ring * .73, outer = inner + .65;
      for (let i = 0; i < 35; i++) add(i % 7 === 0 ? 'warmStone' : 'marble',
        ringSector(inner, outer, i / 35 * PI + .0017, (i+1) / 35 * PI - .0017, .30 + ring * .12),
        0, 23, face * (6.24 + ring * .10));
      for (const s of [-1,1]) box('marble', .65, 21.6, .30 + ring * .12,
        s * (inner + .325), 12.25, face * (6.24 + ring * .10));
    }
    // A structural keystone anchors the crown, with a projecting carved boss.
    const key = new THREE.Shape(); key.moveTo(-1.5,0); key.lineTo(1.5,0); key.lineTo(2.1,4.2); key.lineTo(-2.1,4.2); key.closePath();
    add('marble', extrude(key, .95), 0, 40.0, face * 6.65);
    add('gold', torus(.65,.09),0,41.1,face*7.2);
  }

  function column(x, z, height, radius, base = 2.9, gilded = true) {
    box('marble', radius*3.5, .55, radius*3.5, x, base+.275, z);
    for (const [dy,r,h] of [[.80,1.45,.42],[1.17,1.27,.24],[1.48,1.18,.35]])
      add('marble',new THREE.CylinderGeometry(radius*r,radius*r,h,64),x,base+dy,z);
    add('marble',flutedColumn(height,radius),x,base+1.65,z);
    const top=base+1.65+height;
    add('marble',new THREE.CylinderGeometry(radius*1.23,radius*.86,1.65,64),x,top+.8,z);
    for (let row=0;row<2;row++) for(let i=0;i<12;i++) {
      const a=i/12*PI*2+row*.26;
      add(gilded?'gold':'marble',acanthus(radius*(row?1.1:1.45),radius*.65),
        x+Math.sin(a)*radius*.95,top-.20+row*.65,z+Math.cos(a)*radius*.95,0,a);
    }
    for(const s of [-1,1]) for(const f of [-1,1]) {
      add(gilded?'gold':'marble',torus(radius*.32,radius*.07),
        x+s*radius*1.04,top+1.36,z+f*radius*.98,0,f<0?PI:0);
    }
    box('marble',radius*3.0,.55,radius*3.0,x,top+1.83,z);
    box(gilded?'gold':'marble',radius*3.25,.20,radius*3.25,x,top+2.20,z,.035);
  }
  // Four engaged Corinthian columns express the weight of the superstructure.
  for(const face of [-1,1]) for(const x of [-29.1,-21.3,21.3,29.1]) column(x,face*7.1,30.05,1.23);

  // A layered classical entablature: architrave, carved frieze, dentils and cornice.
  for(const [w,h,d,y,mat] of [
    [70,1.0,15,37.4,'marble'],[70.5,.44,15.6,38.12,'gold'],
    [69.2,3.1,13.9,40.0,'warmStone'],[71,.55,15.8,41.9,'marble'],
    [72,1.0,16.2,42.67,'marble'],[73.5,.5,17.4,43.42,'marble'],
    [72.8,.40,16.9,43.88,'gold'],[74.5,.7,18.1,44.43,'marble'],
  ]) {
    // Lower horizontal mouldings stop at the arch profile; the full cornice
    // starts above its apex so the portal remains a true round opening.
    if(y < 40.8) for(const s of [-1,1]) box(mat,14,h,d,s*27,y,0);
    else box(mat,w,h,d,0,y,0);
  }
  // Frieze scrollwork remains above the clear arch crown.
  for(const face of [-1,1]) for(let i=-31;i<=31;i+=2.6) {
    box('marble',.63,.8,1.15,i,43.15,face*8.25,.04);
    add('gold',acanthus(1.4,.9),i,40.7,face*7.12,0,face<0?PI:0);
  }

  // Thick, recessed attic with true raised bronze lettering and relief panels.
  box('stone',69.0,9.0,13.6,0,49.3,0);
  box('marble',70.0,.70,14.8,0,45.2,0);
  box('marble',71.2,.65,15.3,0,53.75,0);
  box('marble',72.4,.55,16.2,0,54.35,0);
  box('warmStone',70,.7,14.8,0,54.97,0);
  for(const face of [-1,1]) {
    box('marble',34.5,6.6,.22,0,49.45,face*6.96);
    for(const dy of [46.15,52.75]) box('warmStone',35.1,.23,.34,0,dy,face*7.15,.025);
    for(const x of [-17.45,17.45]) box('warmStone',.23,6.8,.34,x,49.45,face*7.15,.025);
    const text=inscription('ETERNAL VALLEY',2.08,.075);
    add('bronze',text,0,48.55,face*7.15,0,face<0?PI:0);
    for(const s of [-1,1]) {
      box('warmStone',11.5,6.55,.17,s*25.7,49.45,face*6.95);
      for(let i=-2;i<=2;i++) {
        const x=s*25.7+i*1.85;
        add('gold',acanthus(3.0,1.22),x,47.1,face*7.10,0,face<0?PI:0);
        add('gold',torus(.51,.065),x,50.2,face*7.18);
      }
      for(const x of [s*19.4,s*32.2]) {
        box('marble',.9,7.3,.55,x,49.35,face*7.13);
        box('marble',1.35,.4,.85,x,52.82,face*7.2);
      }
    }
  }

  // Foliated finials are turned solids, with no glowing pyramids or cones.
  function finial(x,z,scale=1) {
    const profile=[[0,0],[.9,0],[.9,.28],[.65,.45],[.48,.70],[.43,1.2],[.8,1.65],[.64,2.1],[.34,2.35],[.26,2.75],[.13,3.8],[0,4.5]];
    add('gold',new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r*scale,h*scale)),48),x,55.4,z);
    for(let i=0;i<8;i++) {
      const a=i/8*PI*2;
      add('gold',acanthus(1.2*scale,.48*scale),x+Math.sin(a)*.46*scale,56.25,z+Math.cos(a)*.46*scale,0,a);
    }
  }
  for(const x of [-32,-23,-14,14,23,32]) finial(x,0,x===-32||x===32?1.55:1.2);
  box('marble',12,1.1,8,0,55.75,0);
  box('gold',10,.35,6.8,0,56.47,0);
  // Laurel wreath crown with layered individual leaves and a sculpted urn.
  add('bronze',torus(2.5,.12),0,60.1,0);
  for(let i=0;i<32;i++) {
    const a=i/32*PI*2;
    add('gold',acanthus(.90,.38),Math.cos(a)*2.5,60.1+Math.sin(a)*2.5,.13,0,0,a-PI*.5);
  }
  const urnProfile=[[0,0],[1.2,0],[1.2,.4],[.7,.6],[.65,1.3],[1.4,1.8],[1.7,2.7],[1.5,3.3],[1.8,3.5],[1.8,3.8],[0,3.8]];
  add('gold',new THREE.LatheGeometry(urnProfile.map(p=>new THREE.Vector2(...p)),64),0,56.6,0);
  finial(0,0,1.9);

  // Tall flanking colonnades connect physically to the arch. Recessed rear
  // arcades give genuine parallax and shadowed openings on the oblique tour.
  for(const s of [-1,1]) {
    const start=39, spacing=10.7, count=8, end=start+spacing*(count-1);
    box('stone',end-start+9,1.25,10.5,s*(start+end)/2,1.82,-.5);
    box('marble',end-start+10,.45,11.3,s*(start+end)/2,2.66,-.5);
    for(let i=0;i<count;i++) {
      const x=s*(start+i*spacing);
      column(x,2.6,17.2,1.05,2.9,true);
      column(x,-3.2,17.2,1.05,2.9,false);
      if(i<count-1) {
        const mid=s*(start+(i+.5)*spacing);
        // Thin rear archivolts over each bay leave air and scenery behind them.
        add('stone',ringSector(4.1,4.9,0,PI,1.0),mid,14.4,-4.0);
        for(const sx of [-1,1]) box('stone',.8,11.9,1.0,mid+sx*4.5,8.5,-4.0);
      }
      if(i%2===0) {
        const urn=new THREE.LatheGeometry(urnProfile.map(([r,y])=>new THREE.Vector2(r*.40,y*.40)),32);
        add('marble',urn,x,26.0,0);
      }
    }
    const width=end-start+12, cx=s*(start+end)/2;
    for(const [y,h,d,w,mat] of [[23.35,.8,8.7,width,'marble'],[24.2,.9,8,width-.5,'stone'],[24.9,.4,9,width+1,'gold'],[25.45,.7,9.8,width+2,'marble']])
      box(mat,w,h,d,cx,y,-.5);
    for(let x=start-3;x<end+4;x+=1.8) box('marble',.48,.50,.8,s*x,25.0,4.25,.035);
  }
  flush(group);

  function gateLeaf() {
    // Local x runs hinge->centre; the original animation mirrors the right leaf.
    const leaf=new THREE.Group(); leaf.userData.isDynamic=true;
    const width=16.65, frame=new THREE.Shape();
    frame.moveTo(0,0); frame.lineTo(width,0); frame.lineTo(width,24);
    frame.bezierCurveTo(width-5,25,width-8,29.2,0,31.3); frame.closePath();
    add('bronze',extrude(frame,.36,.07));
    // Deep panel bays and a projecting perimeter lend the doors physical weight.
    for(const x of [.5,width-.5]) box('gold',.55,23.8,.66,x,12.0,.16);
    for(const y of [.6,3.0,21.7]) box('gold',width-1,.48,.64,width/2,y,.16);
    add('gold',tube([[.35,31.15,.15],[4,30.2,.15],[8,28.55,.15],[12,26.3,.15],[width-.2,24.1,.15]],.28,70));
    add('gold',tube([[.7,29.9,.22],[4,29.0,.22],[8,27.35,.22],[12,25.4,.22],[width-.7,23.35,.22]],.13,64));
    for(const z of [-.3,.35]) {
      // Projecting circular frames and individually modelled relief leaves.
      add('gold',torus(4.5,.28,.88),width*.5,13.0,z);
      add('gold',torus(3.6,.12,.88),width*.5,13.0,z);
      add('gold',torus(2.8,.19,.88),width*.5,13.0,z);
      for(let i=0;i<32;i++) {
        const a=i/32*PI*2;
        add('gold',acanthus(.92,.42),width*.5+Math.cos(a)*3.9,13+Math.sin(a)*4.35,z+.08,0,z<0?PI:0,a-PI*.5);
      }
      // Symmetric climbing scrolls fill the surrounding panels.
      for(const sx of [-1,1]) for(let row=0;row<4;row++) {
        const cx=width*.5+sx*5.65,cy=5.1+row*5.1;
        const pts=[];
        for(let i=0;i<=50;i++) {
          const t=i/50, a=t*PI*3.0, r=1.4*(1-t)+.18;
          pts.push([cx+Math.cos(a)*r*sx,cy+Math.sin(a)*r,z]);
        }
        add('gold',tube(pts,.095,50));
        for(let j=0;j<4;j++) add('gold',acanthus(.85,.40),cx+sx*(j%2?.6:-.6),cy-1.45+j*.8,z+.10,0,z<0?PI:0,sx*.5);
      }
      for(let x=1.2;x<width-1;x+=.75) for(const y of [1.65,22.5])
        add('gold',new THREE.SphereGeometry(.11,10,6),x,y,z+.12);
      for(let i=0;i<8;i++) {
        const a=i/8*PI*2;
        add('gold',acanthus(1.5,.45),width*.5,13,z+.15,0,0,a);
      }
      add('gold',new THREE.SphereGeometry(.55,20,12),width*.5,13,z+.15,0,0,0,1,1,.40);
    }
    for(const y of [4.5,13,23]) {
      add('bronze',new THREE.CylinderGeometry(.42,.42,1.25,24),.05,y,0);
      add('gold',new THREE.CylinderGeometry(.46,.46,.16,24),.05,y+.7,0);
    }
    flush(leaf);
    leaf.traverse(o=>{if(o.isMesh){
      o.userData.isDynamic=true;
      // The legacy broad scene optimizer exempts meshes with a phase field.
      // Preserve hinge children until that optimizer observes dynamic ancestors.
      o.userData.phase=0;
    }});
    return leaf;
  }
  const left=gateLeaf(), right=gateLeaf();
  left.name='DynamicGateDoorLeft'; right.name='DynamicGateDoorRight';
  left.position.set(-16.9,1.35,2.8); right.position.set(16.9,1.35,2.8);
  left.rotation.y=-1.85; right.rotation.y=PI+1.85;
  group.add(left,right);
  world.scene.add(group);
  if(world.terrain) {
    world.terrain.leftGateDoor=left; world.terrain.rightGateDoor=right;
    world.terrain.gateOpenAmount=1; world.terrain.gateTargetOpen=1;
  }
  let triangles=0, draws=0;
  group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;draws++;}});
  group.userData.triangleCount=triangles; group.userData.drawCalls=draws;
  group.userData.portal={width:34,springHeight:23,crownHeight:40};
  return {group,leftGateDoor:left,rightGateDoor:right};
}
