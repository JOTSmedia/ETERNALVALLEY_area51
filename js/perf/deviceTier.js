// ============================================================
// EVR-06 hotfix v36.1 (1/6): device-tier detection BEFORE any heavy allocation.
//
// Runs once at boot from main.js (no three.js, ~5-40 ms). Decides the tier that
// every later allocation reads (js/perf/qualityTier.js -> EV_PERF):
//   'desktop' | 'mobile' | 'low'  -> the 3D world is built with that tier's caps
//   'lite'                        -> NO 3D world: drone video + 2D map (all site functions kept)
//
// Signals: ?tier= / localStorage 'ev_tier' override, Save-Data, navigator.deviceMemory,
// WebGL2 availability, failIfMajorPerformanceCaveat (software GL), the unmasked GPU
// renderer string (WEBGL_debug_renderer_info), MAX_TEXTURE_SIZE, and a short GPU probe
// (a few full-screen draws into a 256x256 target, timed with a 1-pixel readPixels sync).
// The probe context is released with WEBGL_lose_context right away, so it never
// coexists with the world's context.
// A previous crash / repeated context loss (sessionStorage 'ev_ctx_lost' >= 2) also forces lite.
// ============================================================
const VALID = ['desktop', 'mobile', 'low', 'lite'];
const SOFTWARE_GPU = /SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic Render|Apple Software Renderer|mesa offscreen|lavapipe/i;
const WEAK_GPU = /mali-[gt]?[0-7]\d\b|adreno \(tm\) [2-5]\d\d|powervr|intel\(r\) (hd|uhd) graphics [2-6]\d{2}\b|gma /i;

function q(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (_) { return null; }
}

function probeGPU() {
  const out = { webgl2: false, caveat: false, renderer: '', vendor: '', maxTex: 0, probeMs: -1 };
  let gl = null;
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  try {
    gl = cv.getContext('webgl2', { failIfMajorPerformanceCaveat: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) {
      // No hardware WebGL2 (software rasteriser / blocklisted GPU / no WebGL2): lite either way. Do NOT create a
      // second (software) context just to probe it: in SwiftShader that alone took ~0.9 s on the box.
      out.caveat = true;
      out.webgl2 = typeof WebGL2RenderingContext !== 'undefined';
      return out;
    }
    out.webgl2 = true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    out.renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    out.vendor = String(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR) || '');
    out.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0;
    // ---- short fill-rate probe (a few ms on real GPUs): 6 full-screen passes of a cheap ALU shader into 256x256 ----
    const vs = '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = '#version 300 es\nprecision highp float;uniform float t;out vec4 o;void main(){vec2 u=gl_FragCoord.xy/256.;float a=0.;for(int i=0;i<24;i++){a+=sin(u.x*float(i)+t)*cos(u.y*float(i)-t);}o=vec4(a,u,1.);}';
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return out;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, 256);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(pr); gl.viewport(0, 0, 256, 256);
    const loc = gl.getUniformLocation(pr, 't'), px = new Uint8Array(4);
    gl.uniform1f(loc, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // warm (compile/link)
    const t0 = performance.now();
    for (let i = 1; i <= 6; i++) { gl.uniform1f(loc, i); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    out.probeMs = +(performance.now() - t0).toFixed(2);
  } catch (e) {
    out.error = String(e && e.message || e);
  } finally {
    try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {}
  }
  return out;
}

export function detectDevice() {
  if (typeof window === 'undefined') return { tier: 'desktop', reasons: ['no-window'] };
  if (window.__EV_DEVICE) return window.__EV_DEVICE;
  const t0 = performance.now();
  const nav = navigator, reasons = [];
  const ua = nav.userAgent || '';
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1); // iPadOS reports Mac
  const smallScreen = Math.min(screen.width || 9999, screen.height || 9999) <= 820 && (nav.maxTouchPoints || 0) > 0;
  const mem = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null; // Chrome/Edge only (capped at 8)
  const cores = nav.hardwareConcurrency || null;
  const saveData = !!(nav.connection && nav.connection.saveData);
  const gpu = probeGPU();
  const info = { mem, cores, mobile: mobileUA || smallScreen, saveData, gpu, dpr: window.devicePixelRatio || 1,
                 css: [window.innerWidth, window.innerHeight], lostBefore: 0 };
  try { info.lostBefore = +(sessionStorage.getItem('ev_ctx_lost') || 0); } catch (_) {}
  // EVR-06 (4/6): crash-loop breaker. main.js sets 'ev_build_inflight' while the world builds and clears
  // it at world-ready. If it is still set at boot, the previous load died mid-build (tab OOM / GPU reset).
  try { info.diedBefore = +(sessionStorage.getItem('ev_build_died') || 0) + (sessionStorage.getItem('ev_build_inflight') ? 1 : 0);
        sessionStorage.removeItem('ev_build_inflight'); sessionStorage.setItem('ev_build_died', String(info.diedBefore)); } catch (_) { info.diedBefore = 0; }

  let tier;
  if (!gpu.webgl2) { tier = 'lite'; reasons.push('no-webgl2'); }
  else if (gpu.caveat || SOFTWARE_GPU.test(gpu.renderer)) { tier = 'lite'; reasons.push(gpu.caveat ? 'no-hardware-webgl2' : 'software-gl'); }
  else if (info.lostBefore >= 2) { tier = 'lite'; reasons.push('repeat-context-loss'); }
  else if (info.diedBefore >= 2) { tier = 'lite'; reasons.push('previous-loads-died-twice'); }
  else if (saveData) { tier = 'lite'; reasons.push('save-data'); }
  else if (info.mobile) { tier = 'lite'; reasons.push('mobile-default-lite'); }
  else if (mem !== null && mem <= 4) { tier = 'lite'; reasons.push('device-memory<=4GB'); }
  else if (gpu.maxTex && gpu.maxTex < 4096) { tier = 'lite'; reasons.push('maxTextureSize<4096'); }
  else if (gpu.probeMs > 30) { tier = 'lite'; reasons.push('gpu-probe-slow'); }
  else if (WEAK_GPU.test(gpu.renderer) || gpu.probeMs > 9 || (cores !== null && cores <= 4)) { tier = 'low'; reasons.push('weak-gpu-or-cpu'); }
  else { tier = 'desktop'; reasons.push('default'); }
  if (info.diedBefore === 1 && tier === 'desktop') { tier = 'low'; reasons.push('previous-load-died:step-down'); }

  // Overrides (QA / support):
  //   ?lite=1              -> lite, always.
  //   ?force3d=1           -> full 3D even on software GL (box QC); combine with ?tier=desktop|mobile|low (default: the
  //                           tier detection would have picked if the GPU were hardware, else 'low').
  //   ?tier=… / localStorage 'ev_tier' -> that tier. On software GL a 3D tier needs ?force3d=1, otherwise it stays lite
  //                           (software WebGL is what crashed the box: the world must never build there by accident).
  const forced = q('tier') || (() => { try { return localStorage.getItem('ev_tier'); } catch (_) { return null; } })();
  const force3d = q('force3d') === '1';
  const softwareGL = !gpu.webgl2 ? false : (gpu.caveat || SOFTWARE_GPU.test(gpu.renderer));
  if (q('lite') === '1') { reasons.unshift('override:lite=1'); tier = 'lite'; }
  else if (forced && VALID.includes(forced)) {
    if (forced !== 'lite' && softwareGL && !force3d) reasons.unshift('override:' + forced + ' ignored (software GL; add force3d=1)');
    else { reasons.unshift('override:' + forced + (force3d ? '+force3d' : '')); tier = forced; }
  } else if (force3d && tier === 'lite' && gpu.webgl2) { reasons.unshift('override:force3d'); tier = 'low'; }

  // Memory class for the texture / render-target budget (Safari has no deviceMemory: assume 8 on desktop).
  info.memClass = mem !== null ? mem : (info.mobile ? 3 : 8);
  const res = Object.freeze({ tier, reasons, ...info, detectMs: +(performance.now() - t0).toFixed(1) });
  window.__EV_DEVICE = res;
  try { document.documentElement.dataset.evTier = tier; } catch (_) {}
  console.info('[EVR-06 tier]', tier, 'reason:', reasons.join(','), '| gpu:', gpu.renderer || '(none)', '| probe', gpu.probeMs, 'ms | detect', res.detectMs, 'ms');
  return res;
}

export const EV_DEVICE = detectDevice();
// Live binding: forceLite() flips it at runtime (repeat WebGL context loss); ui.js/main.js read it per call.
export let IS_LITE = EV_DEVICE.tier === 'lite';
export function forceLite(reason) {
  if (IS_LITE) return;
  IS_LITE = true;
  try { document.documentElement.dataset.evTier = 'lite'; document.body.classList.add('ev-lite'); } catch (_) {}
  console.info('[EVR-06 tier] switched to lite at runtime:', reason);
}
