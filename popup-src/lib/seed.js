// Deterministic hash so the same log entry always gets the same
// "organic" jitter (rotation, marker shape) instead of re-randomizing
// on every re-render, which would look glitchy rather than hand-made.
export function seededRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000; // 0..1
}

export function seededRange(str, min, max) {
  return min + seededRandom(str) * (max - min);
}
