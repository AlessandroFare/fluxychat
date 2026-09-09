export async function hashDeviceSecret(key) {
  const data = new TextEncoder().encode(String(key || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function readDeviceBearer(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  if (match) return match[1].trim();
  return String(request.headers.get("X-Device-Key") || "").trim();
}
