/**
 * Constant-time comparison of two hex or UTF-8 strings via SHA-256 digests (fixed 32 bytes).
 */
export async function timingSafeEqual(a, b) {
  const normalizedA = new TextEncoder().encode(String(a));
  const normalizedB = new TextEncoder().encode(String(b));
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", normalizedA),
    crypto.subtle.digest("SHA-256", normalizedB),
  ]);
  const aBytes = new Uint8Array(hashA);
  const bBytes = new Uint8Array(hashB);
  let result = 0;
  for (let i = 0; i < 32; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}
