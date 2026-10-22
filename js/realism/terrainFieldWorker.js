import { loadAlpineElevation } from './alpineElevation.js?v=73';
// ETERNAL VALLEY: terrain field bake worker (patch02). Pure JS, no three.js.
import { setMaskConfig, bakeFieldArrays } from './terrainMasksCore.js?v=73';
self.onmessage = async (ev) => {
  try {
    await loadAlpineElevation();
    setMaskConfig(ev.data.cfg);
    const d = await bakeFieldArrays(ev.data.tier);
    self.postMessage(d, [d.field.buffer, d.macro.buffer]);
  } catch (e) { self.postMessage({ error: String(e?.stack || e) }); }
};
