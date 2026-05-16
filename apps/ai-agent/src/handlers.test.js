import { describe, expect, it } from "vitest";
import { generateServiceJWT, verifyWebhookSignature } from "./handlers.js";

describe("ai-agent security helpers", () => {
  it("verifies webhook signatures", async () => {
    const body = JSON.stringify({ ok: true });
    const secret = "super-secret";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body)
    );
    const signature = `sha256=${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;

    await expect(verifyWebhookSignature(body, signature, secret)).resolves.toBe(true);
    await expect(verifyWebhookSignature(body, "sha256=deadbeef", secret)).resolves.toBe(
      false
    );
  });

  it("fails closed when the project JWT secret is missing", async () => {
    await expect(generateServiceJWT({}, "proj_1")).rejects.toThrow(
      "Missing JWT secret for project proj_1"
    );
  });
});
