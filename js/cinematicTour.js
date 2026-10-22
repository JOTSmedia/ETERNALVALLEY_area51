import { CINEMATIC_SCENES } from './cinematicCatalog.js?v=73';

// Only rendered video enters this playlist. Photographs are destination views,
// never a substitute for a missing animation.
export function initCinematicTour(UI, stopLegacy = () => {}) {
  const section = document.createElement('section');
  section.id = 'viewCinematicFilm';
  section.className = 'cinema hidden';
  section.setAttribute('aria-label', 'Eternal Valley film tour');
  section.innerHTML = `
    <video class="cinema-screen" playsinline muted preload="auto"></video>
    <video class="cinema-screen" playsinline muted preload="auto"></video>
    <div class="cinema-shade"></div>
    <div class="cinema-title"><span class="photo-eyebrow">A JOURNEY THROUGH ETERNAL VALLEY</span><h1></h1><p class="cinema-description"></p></div>
    <details class="cinema-map"><summary>Your place in the valley</summary><div><img src="images/photoreal/eternal_valley_master_layout_map.jpg" alt="Map of Eternal Valley, with the mountain sanctuary north and Kaya Island southeast"><span class="cinema-map-pin" aria-hidden="true"></span></div></details>
    <div class="cinema-message" role="status" aria-live="polite"></div>
    <div class="cinema-controls">
      <div class="cinema-progress"><span class="cinema-time">0:00</span><input type="range" min="0" max="1" step="0.1" value="0" aria-label="Tour position"><span class="cinema-duration">0:00</span></div>
      <div class="cinema-buttons"><button class="cinema-back" aria-label="Previous film destination">←</button><button class="cinema-play" aria-label="Pause tour">Pause</button><button class="cinema-next" aria-label="Next film destination">→</button>
      <label>Destination<select class="cinema-picker" aria-label="Film destination"></select></label>
      <label>Picture<select class="cinema-quality" aria-label="Video quality"><option value="web">Standard</option><option value="4k" selected>4K</option></select></label>
      <button class="cinema-plots">Stop & view plots ↗</button><button class="cinema-exit">Explore places</button></div>
    </div>`;
  document.getElementById('stage').append(section);
  const $ = s => section.querySelector(s);
  const screens = [...section.querySelectorAll('video')];
  const picker = $('.cinema-picker'), seek = $('input[type=range]');
  let tour, index = 0, active = 0, generation = 0, running = false, loading = false, quality = '4k';
  const clock = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  const scene = () => {
    const clip = tour?.clips[index];
    const stage = Object.entries(clip?.sceneOffsets || {}).sort((a, b) => b[1] - a[1])
      .find(([, offset]) => screens[active].currentTime >= offset);
    return CINEMATIC_SCENES.find(s => s.id === (stage?.[0] || clip?.sceneId));
  };
  const source = clip => quality === '4k' && clip.src4k ? clip.src4k : clip.src;
  const startTime = i => tour.clips.slice(0, i).reduce((t, c) => t + c.duration, 0);
  const say = text => { $('.cinema-message').textContent = text; };
  function controls() {
    const paused = screens[active].paused;
    $('.cinema-play').textContent = paused ? 'Play' : 'Pause';
    $('.cinema-play').setAttribute('aria-label', paused ? 'Play tour' : 'Pause tour');
    $('.cinema-play').disabled = loading;
    $('.cinema-back').disabled = index === 0;
    $('.cinema-next').disabled = !tour || index === tour.clips.length - 1;
  }
  function prefetch() {
    const next = tour?.clips[index + 1], video = screens[1 - active];
    if (next && video.getAttribute('src') !== source(next)) { video.src = source(next); video.load(); }
  }
  function describePlace() {
    const clip = tour.clips[index], place = scene();
    $('h1').textContent = clip.title || place?.name || 'Eternal Valley';
    $('.cinema-description').textContent = clip.description || place?.sub || '';
    picker.value = place?.id || clip.sceneId;
    const pin = $('.cinema-map-pin');
    pin.style.left = `${(place?.mapPosition?.[0] ?? 0.5) * 100}%`;
    pin.style.top = `${(place?.mapPosition?.[1] ?? 0.5) * 100}%`;
  }
  function seekVideo(video, time) {
    const target = Math.min(time, Math.max(0, video.duration - 0.1));
    if (Math.abs(video.currentTime - target) < 0.01) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = error => { clearTimeout(timeout); video.removeEventListener('seeked', done); error ? reject(error) : resolve(); };
      const done = () => finish();
      const timeout = setTimeout(() => finish(new Error('Video seek timed out')), 15000);
      video.addEventListener('seeked', done, { once: true });
      video.currentTime = target;
    });
  }
  function ready(video, ticket) {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = error => { clearTimeout(timeout); video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed); error ? reject(error) : resolve(); };
      const loaded = () => finish();
      const failed = () => finish(new Error('Video unavailable'));
      const timeout = setTimeout(() => finish(new Error('Video loading timed out')), 30000);
      video.addEventListener('loadeddata', loaded, { once: true });
      video.addEventListener('error', failed, { once: true });
      if (ticket !== generation) finish(new Error('Superseded'));
    });
  }
  async function playClip(nextIndex, time = 0, autoplay = true) {
    if (!tour?.clips[nextIndex]) return;
    const ticket = ++generation, clip = tour.clips[nextIndex];
    loading = true;
    const nextActive = 1 - active, video = screens[nextActive];
    screens[active].pause(); controls(); say('Opening this part of the valley…');
    if (video.getAttribute('src') !== source(clip)) { video.src = source(clip); video.load(); }
    try {
      await ready(video, ticket);
      if (ticket !== generation || !running) return;
      await seekVideo(video, time);
      if (ticket !== generation || !running) return;
      screens[active].classList.remove('is-visible');
      active = nextActive; index = nextIndex; video.classList.add('is-visible');
      describePlace();
      say('');
      if (autoplay) { try { await video.play(); } catch { say('Press Play to begin your journey.'); } }
      loading = false; controls(); prefetch();
    } catch { if (ticket === generation) { loading = false; say('This film could not load. Try Play again, choose another destination, or explore its photograph.'); controls(); } }
  }
  for (const video of screens) {
    video.addEventListener('play', controls); video.addEventListener('pause', controls);
    video.addEventListener('timeupdate', () => {
      if (video !== screens[active] || !tour) return;
      const position = startTime(index) + video.currentTime;
      seek.value = String(position); $('.cinema-time').textContent = clock(position);
      if (tour.clips[index].sceneOffsets && picker.value !== scene()?.id) describePlace();
    });
    video.addEventListener('ended', () => {
      if (video !== screens[active] || !running) return;
      if (index + 1 < tour.clips.length) playClip(index + 1);
      else { say('You have reached the deep sanctuary. Revisit a destination or explore its plots.'); controls(); }
    });
  }
  async function loadTour() {
    if (tour) return;
    const response = await fetch('videos/cinematic-v2/tour.json?v=73');
    if (!response.ok) throw new Error('Tour manifest unavailable');
    const data = await response.json();
    if (!data.clips?.length) throw new Error('No rendered clips');
    tour = data;
    for (const s of CINEMATIC_SCENES) {
      const option = new Option(s.name, s.id);
      option.disabled = !tour.clips.some(c => (c.sceneIds || [c.sceneId]).includes(s.id));
      picker.add(option);
    }
    const total = tour.clips.reduce((t, c) => t + c.duration, 0);
    seek.max = String(total); $('.cinema-duration').textContent = clock(Math.round(total));
  }
  UI.stopCinematicTour = () => { running = false; generation++; screens.forEach(v => v.pause()); document.body.classList.remove('is-film'); };
  UI.startFilmTour = async (sceneId = 'valley-overview') => {
    stopLegacy(); UI.closePanel(); UI._setView({ view: 'viewCinematicFilm', btn: 'btnDroneTour' });
    document.body.classList.add('is-film'); running = true;
    try {
      await loadTour();
      const target = typeof sceneId === 'number' ? CINEMATIC_SCENES[sceneId]?.id : sceneId;
      const found = tour.clips.findIndex(c => (c.sceneIds || [c.sceneId]).includes(target));
      if (found < 0) { say('This destination’s film is still being prepared. Explore its photograph and plots now.'); return; }
      await playClip(found, tour.clips[found].sceneOffsets?.[target] || 0);
    } catch { say('The film is unavailable. You can still explore destinations and view their plots.'); }
  };
  $('.cinema-play').onclick = async () => {
    const video = screens[active];
    if (!video.currentSrc || video.error) return playClip(index);
    if (video.paused) { if (video.ended) return playClip(index); try { await video.play(); say(''); } catch { say('Unable to play. Try another destination.'); } }
    else video.pause();
  };
  $('.cinema-back').onclick = () => playClip(index - 1);
  $('.cinema-next').onclick = () => playClip(index + 1);
  picker.onchange = () => { const i = tour.clips.findIndex(c => (c.sceneIds || [c.sceneId]).includes(picker.value)); playClip(i, tour.clips[i]?.sceneOffsets?.[picker.value] || 0); };
  $('.cinema-quality').onchange = e => { const time = screens[active].currentTime, playing = !screens[active].paused; quality = e.target.value; playClip(index, time, playing); };
  seek.onchange = () => { let time = Number(seek.value), i = 0; while (i < tour.clips.length - 1 && time >= tour.clips[i].duration) time -= tour.clips[i++].duration; playClip(i, time, !screens[active].paused); };
  $('.cinema-plots').onclick = () => UI.showPhotographic(scene()?.id, { browse: true });
  $('.cinema-exit').onclick = () => UI.showPhotographic(scene()?.id);
  section.addEventListener('keydown', e => { if (e.key === 'Escape') UI.showPhotographic(scene()?.id); });
}
