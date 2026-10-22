// [EVR-05 shell-first] Render gate — no 3D frames while nobody can see them.
//
// Pauses the World render loop (WorldCore.setRenderPaused) when:
//   • the tab is hidden (visibilitychange)
//   • a site dialog is open (UI.modal -> body.modal-open / #modalRoot)
//   • the Veo landmark inspection dialog is open (#veoAreaInspectionModal)
//   • the opaque Veo drone-tour video covers the canvas (#veoDroneTourContainer)
// and resumes as soon as the condition clears. Pure DOM observation: no three.js
// import, no change to ui.js / VeoTourController.js, so every site flow is untouched.
// Escape hatch for debugging: ?nogate=1

const WATCHED = [
  ['veo-modal', 'veoAreaInspectionModal'],
  ['veo-video', 'veoDroneTourContainer'],
];

function isShown(el) {
  return !!el && !el.classList.contains('hidden') && el.style.display !== 'none';
}

export function installRenderGate(world) {
  if (!world || typeof world.setRenderPaused !== 'function') return null;
  if (world.__evRenderGate) return world.__evRenderGate;
  try { if (new URLSearchParams(location.search).get('nogate') === '1') return null; } catch (_) {}

  const apply = () => {
    world.setRenderPaused('hidden', document.hidden);
    world.setRenderPaused('modal', document.body.classList.contains('modal-open') ||
      isShown(document.getElementById('modalRoot')));
    for (const [reason, id] of WATCHED) world.setRenderPaused(reason, isShown(document.getElementById(id)));
  };

  document.addEventListener('visibilitychange', apply);
  const mo = new MutationObserver(apply);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  for (const id of ['modalRoot', ...WATCHED.map(w => w[1])]) {
    const el = document.getElementById(id);
    if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  apply();

  const gate = {
    apply,
    get reasons() { return [...(world._pauseReasons || [])]; },
    dispose() { mo.disconnect(); document.removeEventListener('visibilitychange', apply); },
  };
  world.__evRenderGate = gate;
  return gate;
}
