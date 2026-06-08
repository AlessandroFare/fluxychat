import { describe, it, expect } from "vitest";
import {
  generateVapidKeyPair,
  buildVapidJwt,
  encryptWebPushPayload,
  getVapidPublicKeyRaw,
  classifyPushResponse,
} from "./vapid.js";

describe("vapid", () => {
  it("generates a usable EC P-256 key pair", async () => {
    const { publicKey, privateKey } = await generateVapidKeyPair();
    expect(publicKey.kty).toBe("EC");
    expect(publicKey.crv).toBe("P-256");
    expect(publicKey.x).toBeTruthy();
    expect(publicKey.y).toBeTruthy();
    expect(privateKey.d).toBeTruthy();
    const rawB64 = await getVapidPublicKeyRaw(publicKey);
    expect(typeof rawB64).toBe("string");
    // base64url of 65 bytes (uncompressed point) → 88 chars
    expect(rawB64.length).toBeGreaterThanOrEqual(86);
  });

  it("builds an ES256 VAPID JWT with t= header", async () => {
    const { privateKey } = await generateVapidKeyPair();
    const jwt = await buildVapidJwt(privateKey, "https://push.example.com", "mailto:test@example.com", 60);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    const header = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(parts[0].replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (parts[0].length % 4)) % 4)),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("ES256");
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (parts[1].length % 4)) % 4)),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    expect(payload.aud).toBe("https://push.example.com");
    expect(payload.sub).toBe("mailto:test@example.com");
    expect(typeof payload.exp).toBe("number");
  });

  it("encrypts a web-push payload with RFC 8188 aes128gcm structure", async () => {
    const receiver = await generateVapidKeyPair();
    const p256dhB64 = await getVapidPublicKeyRaw(receiver.publicKey);
    const authB64 = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
    const plaintext = new TextEncoder().encode(JSON.stringify({ title: "hi" }));
    const { ciphertext, salt, rs } = await encryptWebPushPayload(plaintext, p256dhB64, authB64);
    expect(salt.length).toBe(16);
    expect(rs).toBe(4096);
    expect(ciphertext.byteLength).toBeGreaterThan(86); // header(86) + at least some ciphertext
  });

  it("classifies push responses correctly", () => {
    expect(classifyPushResponse(201)).toBe("delivered");
    expect(classifyPushResponse(202)).toBe("delivered");
    expect(classifyPushResponse(404)).toBe("gone");
    expect(classifyPushResponse(410)).toBe("gone");
    expect(classifyPushResponse(429)).toBe("rate_limited");
    expect(classifyPushResponse(401)).toBe("config_error");
    expect(classifyPushResponse(500)).toBe("transient");
  });
});

function base64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
