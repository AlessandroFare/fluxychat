import { describe, it, expect } from "vitest";
import {
  encryptE2eContent,
  decryptE2eContent,
  isE2eContentEnvelope,
} from "./room-e2e";

describe("room-e2e sdk", () => {
  it("round-trips AES-GCM envelope", async () => {
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const encrypted = await encryptE2eContent("hello secret", key);
    expect(isE2eContentEnvelope(encrypted)).toBe(true);
    const plain = await decryptE2eContent(encrypted, key);
    expect(plain).toBe("hello secret");
  });
});
