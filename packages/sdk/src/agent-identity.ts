/**
 * Agent Card identity helpers for Cross-Org rooms (#32) — Ed25519 via Web Crypto.
 */

export interface FluxyAgentCardPayload {
  agent_id: string;
  org_id: string;
  public_key: string;
  capabilities?: string[];
  issued_at: string;
  name?: string;
  description?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function generateAgentIdentityKeyPair(): Promise<{
  publicKeyB64: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return {
    publicKeyB64: bytesToBase64(new Uint8Array(spki)),
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

export async function signAgentCard(
  card: FluxyAgentCardPayload,
  privateKey: CryptoKey,
): Promise<{ card: FluxyAgentCardPayload; signature: string }> {
  const payload = JSON.stringify(card);
  const sig = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(payload),
  );
  return { card, signature: bytesToBase64(new Uint8Array(sig)) };
}

export async function verifyAgentCardSignature(
  card: FluxyAgentCardPayload,
  signatureB64: string,
  publicKeySpkiB64: string,
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      "spki",
      base64ToBytes(publicKeySpkiB64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const payload = JSON.stringify(card);
    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      base64ToBytes(signatureB64),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

export function buildAgentCardPayload(input: {
  agentId: string;
  orgId: string;
  publicKeyB64: string;
  capabilities?: string[];
  name?: string;
  description?: string;
}): FluxyAgentCardPayload {
  return {
    agent_id: input.agentId,
    org_id: input.orgId,
    public_key: input.publicKeyB64,
    capabilities: input.capabilities ?? [],
    issued_at: new Date().toISOString(),
    name: input.name,
    description: input.description,
  };
}
