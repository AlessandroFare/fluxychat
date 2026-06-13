/** SHA-256 hex digest for API keys (matches worker hashApiKey). */
export async function hashApiKey(apiKey) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
