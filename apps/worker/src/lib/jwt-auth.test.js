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
        jti: "jti_a",
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

describe("previous secret retirement (audit F-03)", () => {
  function envWithPrevious({ prevExpiresAt = null } = {}) {
    return {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return {
                    jwt_secret: "new-secret",
                    jwt_secret_previous: "old-secret",
                    jwt_secret_previous_expires_at: prevExpiresAt,
                  };
                },
              };
            },
          };
        },
      },
    };
  }

  function request(token) {
    return new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  it("rejects an old token signed with the previous secret when no retirement date is stored", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "proj_known",
        roles: ["owner"],
        jti: "jti_old",
        iat: now - 10 * 24 * 3600,
        exp: now + 3600,
      },
      "old-secret"
    );
    await expect(
      verifyJwtAndGetContext(request(token), envWithPrevious())
    ).rejects.toMatchObject({ status: 401 });
  });

  it("accepts a freshly minted previous-secret token within the grace window", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "proj_known",
        roles: ["owner"],
        jti: "jti_new",
        iat: now - 60,
        exp: now + 3600,
      },
      "old-secret"
    );
    const auth = await verifyJwtAndGetContext(request(token), envWithPrevious());
    expect(auth.userId).toBe("user_a");
  });

  it("rejects once the stored retirement date has passed", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256Jwt(
      {
        sub: "user_a",
        tid: "proj_known",
        roles: ["owner"],
        jti: "jti_retired",
        iat: now - 60,
        exp: now + 3600,
      },
      "old-secret"
    );
    const env = envWithPrevious({
      prevExpiresAt: new Date(Date.now() - 3600_000).toISOString(),
    });
    await expect(
      verifyJwtAndGetContext(request(token), env)
    ).rejects.toMatchObject({ status: 401 });
  });
});
