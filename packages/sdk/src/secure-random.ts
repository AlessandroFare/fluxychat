/** Uniform index in [0, maxExclusive) — rejection sampling, no modulo bias (CodeQL js/insecure-randomness). */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;
  const random = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  let value = 0;
  do {
    globalThis.crypto.getRandomValues(random);
    value = random[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

/** Uniform integer in [minInclusive, maxExclusive). */
export function secureRandomIntInRange(minInclusive: number, maxExclusive: number): number {
  if (maxExclusive <= minInclusive) return minInclusive;
  return minInclusive + secureRandomInt(maxExclusive - minInclusive);
}
