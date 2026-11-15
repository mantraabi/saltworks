// Deterministic randomness: one generator seeded once, so a replay of the same seed fights the
// same fight. Nothing here touches Math.random, so a capture frame is reproducible.
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    // A symmetric jitter in [-amount, amount]; used for spread cones and AI aim error.
    jitter: (amount) => (next() * 2 - 1) * amount,
    pick: (list) => list[Math.floor(next() * list.length) % list.length],
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

// A small hash so a subsystem can own a stream of its own without sharing one cursor.
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
