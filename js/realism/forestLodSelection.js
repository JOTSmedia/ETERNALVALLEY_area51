// Every visible tree gets geometry. Detail budgets only choose mesh complexity.
export function assignForestLods(items, { nearLimit = 6, midLimit = 32, nearDistance = 110, midDistance = 480 } = {}) {
  const ordered = items.slice().sort((a, b) => {
    const priority = item => (item.screenPixels ? 10000/item.screenPixels : item.distance) * (item.previousLod === 'near' ? .82 : item.previousLod === 'mid' ? .9 : 1);
    return priority(a) - priority(b);
  });
  const result = { near: [], mid: [], far: [] };
  for (const item of ordered) {
    const nearRange = nearDistance * (item.previousLod === 'near' ? 1.2 : 1);
    const midRange = midDistance * (item.previousLod === 'mid' ? 1.2 : 1);
    // A large tree must retain leaves and branches even when the preferred detail budget is full.
    const level = (item.distance <= nearRange || item.screenPixels > 180) && result.near.length < nearLimit ? 'near'
      : item.screenPixels > 40 || (item.distance <= midRange && result.mid.length < midLimit) ? 'mid' : 'far';
    result[level].push(item);
    item.previousLod = level;
  }
  return result;
}
