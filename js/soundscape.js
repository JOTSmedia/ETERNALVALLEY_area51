// v37: Web Audio synthesis only (no audio files). Wind Chimes ambient mode + 528 Hz (and other) solfeggio bells.
// Gentle levels; nothing sounds until the user has interacted with the page (user-gesture gated AudioContext).
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
const PENTA = [528, 594, 660, 792, 880, 1056, 1188]; // C-major pentatonic built on 528 Hz
let ctx = null, master = null, verb = null, chimeTimer = null;

function gestured() {
  try { return !navigator.userActivation || navigator.userActivation.hasBeenActive; } catch (_) { return true; }
}
function ensure() {
  if (!AC || !gestured()) return null;
  try {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = Soundscape.volume; master.connect(ctx.destination);
      // tiny feedback-delay "air" so bells ring in space (no convolver file needed)
      const d = ctx.createDelay(1.0); d.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.32;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      verb = ctx.createGain(); verb.gain.value = 0.35;
      verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch (_) { return null; }
}
// one struck bell/chime: a few inharmonic partials with exponential decay
function strike(freq, gain = 0.08, decay = 3.2, partials = [[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]], pan = 0) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime + 0.01;
  const out = c.createGain(); out.gain.value = 1;
  let node = out;
  if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); node = p; }
  node.connect(master); node.connect(verb);
  for (const [r, a] of partials) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * r;
    const g = c.createGain(); const peak = Math.max(0.0001, gain * a);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / Math.sqrt(r));
    o.connect(g); g.connect(out); o.start(t); o.stop(t + decay + 0.1);
  }
}
function chimeLoop() {
  clearTimeout(chimeTimer); if (Soundscape.mode !== 'chimes') return;
  const n = 1 + (Math.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < n; i++) setTimeout(() => strike(PENTA[(Math.random() * PENTA.length) | 0] * 2, 0.035 + Math.random() * 0.025, 2.6, [[1, 1], [2.32, 0.28], [4.25, 0.1]], Math.random() * 1.2 - 0.6), i * (90 + Math.random() * 220));
  chimeTimer = setTimeout(chimeLoop, 700 + Math.random() * 2300);
}

export const Soundscape = {
  init() { ensure(); },
  play() { if (this.mode === 'silent') this.setMode('chimes'); else this.setMode(this.mode); },
  pause() { this.setMode('silent'); },
  setMode(mode) {
    this.mode = mode || 'silent';
    clearTimeout(chimeTimer);
    // v37 scope: the 'chimes' card is the synthesized ambient mode; other cards keep their v36 (silent) behaviour
    if (this.mode === 'chimes' && ensure()) { this.isPlaying = true; chimeLoop(); } else this.isPlaying = false;
  },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, +v || 0)); if (master && ctx) master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.05); },
  setSolfeggio(k) { if (this.SOLFEGGIO[k]) this.solfeggio = k; },
  setBinaural(k) { if (this.BINAURAL[k]) this.binaural = k; },
  playBowlGong(freq = 216, gain = 0.12) { strike(freq, gain, 6.0, [[1, 1], [2.0, 0.25], [2.98, 0.12], [4.1, 0.05]]); },
  playChime(freq = 528, gain = 0.08) { strike(freq, Math.min(gain, 0.15), 3.0); },
  playSolfeggioBell(freq = 528) { strike(freq, 0.1, 5.0, [[1, 1], [2.0, 0.18], [3.0, 0.06]]); },
  playCandleShimmer() { for (let i = 0; i < 3; i++) setTimeout(() => strike(1584 + i * 264, 0.025, 1.6), i * 120); },
  playHarmonicChord(root = 432) { [1, 1.25, 1.5].forEach((r, i) => setTimeout(() => strike(root * r, 0.05, 4.0), i * 60)); },
  mode: 'silent',
  volume: 0.5,
  solfeggio: '432',
  binaural: 'none',
  isPlaying: false,
  get audioState() { return ctx ? ctx.state : 'none'; },
  SOLFEGGIO: {
    '432': { name: '432Hz (Cosmic Tuning)', freq: 432, label: '432 Hz' },
    '528': { name: '528Hz (DNA Repair)', freq: 528, label: '528 Hz' },
    '963': { name: '963Hz (Divine Light)', freq: 963, label: '963 Hz' }
  },
  BINAURAL: {
    'none': { name: 'None', freq: 0, desc: 'off' },
    'delta': { name: 'Delta (Deep Sleep)', freq: 2, desc: '2 Hz' },
    'theta': { name: 'Theta (Meditation)', freq: 6, desc: '6 Hz' }
  }
};
if (typeof window !== 'undefined') window.Soundscape = Soundscape;
