import { describe, expect, it } from "vitest";
import {
  base64urlEncode,
  verifyJwtAndGetContext,
} from "./jwt-auth.js";

async function signHs256Jwt(payload, secret) {
  const headerB64 = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

function mockEnvWithSecret(secretOrNull) {
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                if (secretOrNull === null) return null;
                return { jwt_secret: secretOrNull };
              },
            };
          },
        };
      },
    },
  };
}

describe("verifyJwtAndGetContext", () => {
  it("rejects malformed project id without treating as enumeration success", async () => {
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "not valid id!",
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "real-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(
      verifyJwtAndGetContext(request, mockEnvWithSecret("real-secret"))
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects unknown project with generic Unauthorized (dummy-key verify path)", async () => {
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "proj_unknown",
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "any-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(
      verifyJwtAndGetContext(request, mockEnvWithSecret(null))
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects bad signature for known project with generic Unauthorized", async () => {
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "proj_known",
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "wrong-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(
      verifyJwtAndGetContext(request, mockEnvWithSecret("real-secret"))
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns auth context for valid project JWT", async () => {
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "proj_known",
        roles: ["owner"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "real-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const auth = await verifyJwtAndGetContext(
      request,
      mockEnvWithSecret("real-secret")
    );
    expect(auth).toEqual({
      userId: "user_a",
      projectId: "proj_known",
      roles: ["owner"],
    });
  });
});
