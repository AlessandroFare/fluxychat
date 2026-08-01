/** Cryptographic id helper — no Math.random fallback (CodeQL / security). */
export function createFluxyId(prefix?: string): string {
  const suffix = randomHex(8);
  return prefix ? `${prefix}-${suffix}` : suffix;
}

function randomHex(byteLength: number): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === "function") {
    return cryptoObj.randomUUID().replace(/-/g, "").slice(0, byteLength * 2);
  }
  if (!cryptoObj) {
    throw new Error("crypto unavailable — cannot generate secure id");
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
