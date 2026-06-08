const E2E_ENVELOPE_PREFIX = '{"e2e":1';

export interface FluxyE2eEnvelope {
  e2e: 1;
  v: 1;
  c: string;
  iv: string;
}

export function isE2eContentEnvelope(content: string | null | undefined): boolean {
  if (!content || typeof content !== "string") return false;
  if (!content.startsWith(E2E_ENVELOPE_PREFIX)) return false;
  try {
    const parsed = JSON.parse(content) as FluxyE2eEnvelope;
    return parsed.e2e === 1 && typeof parsed.c === "string" && typeof parsed.iv === "string";
  } catch {
    return false;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(keyB64.trim());
  if (keyBytes.byteLength !== 32) {
    throw new Error("E2E key must be 32 bytes (base64-encoded)");
  }
  const rawKey = new Uint8Array(keyBytes);
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptE2eContent(
  plaintext: string,
  keyB64: string,
): Promise<string> {
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const envelope: FluxyE2eEnvelope = {
    e2e: 1,
    v: 1,
    c: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
  };
  return JSON.stringify(envelope);
}

export async function decryptE2eContent(
  content: string,
  keyB64: string,
): Promise<string> {
  if (!isE2eContentEnvelope(content)) return content;
  const envelope = JSON.parse(content) as FluxyE2eEnvelope;
  const key = await importAesKey(keyB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToBytes(envelope.iv)) },
    key,
    new Uint8Array(base64ToBytes(envelope.c)),
  );
  return new TextDecoder().decode(pt);
}
