// ============================================================
// ETERNAL VALLEY: chain CSM.setupMaterial() with an existing onBeforeCompile (patch01-03b)
//
// three r170 CSM.setupMaterial(material) ASSIGNS material.onBeforeCompile,
// which silently discards any shader patch the material already had
// (terrain slope blend, botanical wind/SSS, water caustics...). This helper
// runs the original patch first and CSM's afterwards, and extends the
// program cache key so CSM and non-CSM variants never share a program.
// Idempotent per material (shared wind materials are visited many times).
// ============================================================
export function setupCSMChained(csm, material) {
  if (!csm || !material || material.userData?.__csmChained) return material;
  // Only an OWN onBeforeCompile is a real patch; the inherited one is Material's no-op.
  const prevOBC = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile') ? material.onBeforeCompile : null;
  const prevKey = material.customProgramCacheKey;
  csm.setupMaterial(material);               // sets defines + its own onBeforeCompile
  const csmOBC = material.onBeforeCompile;
  const hadOwn = typeof prevOBC === 'function' && prevOBC !== csmOBC;
  // [EVR-03 fix] WorldLighting.js's CSM.prototype.setupMaterial override ALREADY chains (own patch + CSM).
  // Wrapping again ran the own patch twice -> 'redefinition' shader errors whenever these programs compiled with CSM.
  const alreadyChained = !!material.userData?.csmSetupDone;
  if (hadOwn) {
    if (!alreadyChained) material.onBeforeCompile = function (shader, renderer) {
      prevOBC.call(this, shader, renderer);
      csmOBC.call(this, shader, renderer);
    };
    material.customProgramCacheKey = function () {
      return (prevKey ? prevKey.call(this) : '') + '|csm' + (material.defines?.CSM_CASCADES ?? '');
    };
  }
  material.userData = material.userData || {};
  material.userData.__csmChained = true;
  return material;
}
