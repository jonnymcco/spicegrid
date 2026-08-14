// Small, dependency-free seeded PRNG so a given seed always produces the
// same puzzle (needed for a future "daily puzzle" feature). Not
// cryptographic — just deterministic and fast.

/** Hashes an arbitrary string/number seed into a 32-bit integer. */
function hashSeed(seed) {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// mulberry32: tiny, fast, decent-quality PRNG.
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a seeded random generator with a few convenience helpers.
 * If `seed` is undefined, falls back to a random (non-deterministic) seed.
 */
export function createRng(seed) {
  const actualSeed = seed === undefined || seed === null ? Math.floor(Math.random() * 2 ** 32) : hashSeed(seed);
  const next = mulberry32(actualSeed);

  return {
    seed: actualSeed,
    /** Float in [0, 1). */
    random: next,
    /** Integer in [0, max). */
    int(max) {
      return Math.floor(next() * max);
    },
    /** Shuffles a copy of `arr` (Fisher-Yates) and returns it. */
    shuffle(arr) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    /** Picks a random element from a non-empty array. */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
  };
}
