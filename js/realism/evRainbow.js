// EVR-07 S1: physically placed spray/mist rainbow for three r186. Drop-in for evWater.js sprayRainbow().
// Primary at 42 deg from the antisolar point (red outside), secondary at 51 deg (red inside, ~40%),
// Alexander's dark band between (darkens what's behind, so it reads darker than the sky outside).
// Visible only where mist density > 0 (soft plume volume + drifting noise), never a solid arc.
// One program, one draw, no textures, no extra passes. Kill: ?fx=0 or tier 'low' -> mist only, no bow.
import * as THREE from 'three';

const VS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW; varying vec3 vL;
void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vL = position;
  gl_Position = projectionMatrix*viewMatrix*w;
  #include <logdepthbuf_vertex>
}`;
// fragment: uSun = unit vector TOWARD the sun (world). Antisolar = -uSun.
const FS = /* glsl */`
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform float uTime, uStrength, uDark; uniform vec3 uHalf, uCenter; // plume half-extents + world centre
varying vec3 vW; varying vec3 vL;
// approximate spectral colour, t: 0 = violet .. 1 = red
vec3 spec(float t){ t = clamp(t,0.,1.);
  return clamp(vec3(smoothstep(.45,.85,t)+ .35*smoothstep(.15,0.,t), smoothstep(.1,.5,t)*smoothstep(1.,.6,t), smoothstep(.55,.1,t)),0.,1.); }
float h31(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){
  #include <logdepthbuf_fragment>
  vec3 V = normalize(vW - cameraPosition);
  float th = degrees(acos(clamp(dot(V, -normalize(uSun)), -1., 1.)));   // angle from antisolar point
  // mist density: soft ellipsoid plume, denser low, drifting noise (no solid arc)
  // density along the view ray: closest approach of the ray to the plume centre (ellipsoid space)
  vec3 oc = (cameraPosition - uCenter)/uHalf, dv = normalize(V/uHalf);
  vec3 cp = oc - dv*dot(oc, dv); vec3 q = cp; vec3 pw = cp*uHalf;
  float body = smoothstep(1.0, 0.35, length(q)) * smoothstep(-1.0,-0.4,q.y);
  float n = vn(pw*0.09 + vec3(0., -uTime*0.6, uTime*0.15))*0.65 + vn(pw*0.23 + vec3(uTime*0.3,-uTime*1.1,0.))*0.35;
  float mist = body * smoothstep(0.30, 0.75, n);
  // primary: 40.6 (violet) .. 42.4 (red); secondary: 50.4 (red) .. 53.6 (violet)
  float p = (th-40.6)/1.8, s = (th-50.4)/3.2;
  float wp = smoothstep(-.1,.35,p)*smoothstep(1.1,.6,p);
  float ws = smoothstep(-.1,.4,s)*smoothstep(1.1,.6,s);
  vec3 col = spec(p)*wp + 0.40*0.75*spec(1.-s)*ws;
  // supernumerary-ish white glow inside primary (brighter inside the bow), none in the band
  col += vec3(0.025)*smoothstep(42.,34.,th);
  float band = smoothstep(42.0,42.8,th)*smoothstep(50.6,49.8,th);   // Alexander's band
  float sunFacing = step(0.0, -dot(normalize(uSun), V));              // never toward the sun
  col *= uStrength*mist*sunFacing;
  float a = uDark*band*mist*sunFacing;                                 // darkens what's behind
  gl_FragColor = vec4(col, a);                                         // premultiplied
  #include <colorspace_fragment>
}`;

export function makeMistRainbow({ center, half = new THREE.Vector3(60, 35, 60), sunDir, strength = 0.28, dark = 0.18, tier = 'desktop' }) {
  const m = new THREE.ShaderMaterial({ name: 'EV_MistRainbow', transparent: true, depthWrite: false, depthTest: true,
    side: THREE.BackSide, premultipliedAlpha: true, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uSun: { value: sunDir.clone().normalize() }, uTime: { value: 0 }, uStrength: { value: tier === 'low' ? 0 : strength },
      uDark: { value: dark }, uHalf: { value: half.clone() }, uCenter: { value: center.clone() } },
    vertexShader: VS, fragmentShader: FS });
  const g = new THREE.SphereGeometry(1, tier === 'mobile' ? 16 : 24, tier === 'mobile' ? 10 : 16); g.scale(half.x, half.y, half.z);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'EV_MistRainbow'; mesh.position.copy(center); mesh.renderOrder = 4; mesh.frustumCulled = true;
  mesh.userData.update = (t, sun) => { m.uniforms.uTime.value = t; if (sun) m.uniforms.uSun.value.copy(sun).normalize(); };
  if (/[?&]fx=0/.test(location.search)) mesh.visible = false;
  return mesh;
}
