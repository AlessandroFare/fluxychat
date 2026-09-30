function hexFromBuffer(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export async function canonicalPayloadHash(value) {
  const canonical = stableStringify(value ?? {});
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return hexFromBuffer(digest);
}
