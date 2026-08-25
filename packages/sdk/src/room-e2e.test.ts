import { describe, it, expect } from "vitest";
import {
  encryptRoomContent,
  decryptRoomContent,
  isRoomContentEnvelope,
} from "./room-e2e";

describe("room-e2e sdk", () => {
  it("round-trips AES-GCM envelope", async () => {
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const encrypted = await encryptRoomContent("hello secret", key);
    expect(isRoomContentEnvelope(encrypted)).toBe(true);
    const plain = await decryptRoomContent(encrypted, key);
    expect(plain).toBe("hello secret");
  });
});