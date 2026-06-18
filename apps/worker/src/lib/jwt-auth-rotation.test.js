/**
 * Audit S-31  JWT_SECRET_PREVIOUS_EXPIRES_AT enforcement.
 *
 * Verifies that when rotating jwt_secret in D1 project_secrets, the
 * previous secret (set via env.JWT_SECRET_PREVIOUS) is rejected after
 * its configured wall-clock expiration, even when the token's own `exp`
 * claim is still in the future.
 *
 * Critical security property: the expiry is tied to wall-clock time of
 * the request (Date.now()), NOT to the JWT's iat or exp claim. A user
 * who minted a token at T-1 must NOT be able to use it after the
 * configured retireAt.
 */
import { describe, expect, it } from "vitest";
import { base64urlEncode, verifyJwtAndGetContext } from "./jwt-auth.js";

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

/**
 * Mock the minimum surface of env used by verifyJwtAndGetContext:
 *   - env.DB.prepare(...).bind(...).first()  looks up jwt_secret
 *   - env.JWT_SECRET_PREVIOUS               optional previous secret
 *   - env.JWT_SECRET_PREVIOUS_EXPIRES_AT    optional ISO wall-clock cutoff
 */
function mockEnvWithSecretAndPrev(currentSecret, previousSecret, retireAt) {
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return currentSecret === null
                  ? null
                  : { jwt_secret: currentSecret };
              },
            };
          },
        };
      },
    },
    ...(previousSecret ? { JWT_SECRET_PREVIOUS: previousSecret } : {}),
    ...(retireAt ? { JWT_SECRET_PREVIOUS_EXPIRES_AT: retireAt } : {}),
  };
}

const PROJECT_ID = "proj_rotation";
const USER_ID = "user_rotation";

describe("verifyJwtAndGetContext  JWT_SECRET_PREVIOUS rotation expiry", () => {
  it("rejects a token signed with the previous secret after JWT_SECRET_PREVIOUS_EXPIRES_AT has passed (401)", async () => {
    // Token's own exp is one hour in the future  clearly valid.
    // But the previous secret was retired one minute ago (wall clock).
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const pastIso = new Date(Date.now() - 60_000).toISOString();

    const token = await signHs256Jwt(
      { sub: USER_ID, tid: PROJECT_ID, roles: ["member"], exp: futureExp },
      "old-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(
      verifyJwtAndGetContext(
        request,
        mockEnvWithSecretAndPrev("new-secret", "old-secret", pastIso)
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it("accepts a token signed with the previous secret when JWT_SECRET_PREVIOUS_EXPIRES_AT is still in the future", async () => {
    // retireAt is one hour in the future  previous secret still valid.
    // The token's own exp is also in the future.
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const futureIso = new Date(Date.now() + 3600_000).toISOString();

    const token = await signHs256Jwt(
      { sub: USER_ID, tid: PROJECT_ID, roles: ["member"], exp: futureExp },
      "old-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const auth = await verifyJwtAndGetContext(
      request,
      mockEnvWithSecretAndPrev("new-secret", "old-secret", futureIso)
    );
    expect(auth).toEqual({
      userId: USER_ID,
      projectId: PROJECT_ID,
      roles: ["member"],
    });
  });

  it("accepts a token signed with the current secret regardless of JWT_SECRET_PREVIOUS_EXPIRES_AT", async () => {
    // retireAt is one minute in the past  the previous secret would
    // be rejected if presented, but the current secret must still work.
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const pastIso = new Date(Date.now() - 60_000).toISOString();

    const token = await signHs256Jwt(
      { sub: USER_ID, tid: PROJECT_ID, roles: ["owner"], exp: futureExp },
      "new-secret"
    );
    const request = new Request("https://fluxy.local/ws/room/r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const auth = await verifyJwtAndGetContext(
      request,
      mockEnvWithSecretAndPrev("new-secret", "old-secret", pastIso)
    );
    expect(auth).toEqual({
      userId: USER_ID,
      projectId: PROJECT_ID,
      roles: ["owner"],
    });
  });
});
