import { describe, expect, it } from "vitest";
import { createScimToken, verifyScimToken } from "./scim.js";

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function mockEnv() {
  const rows = [];
  return {
    rows,
    env: {
      API_KEY_HASH_SALT: "test-salt",
      DB: {
        prepare(sql) {
          const text = String(sql);
          return {
            bind(...args) {
              return {
                async first() {
                  if (text.includes("FROM scim_tokens")) {
                    const [projectId, hash] = args;
                    return (
                      rows.find((r) => r.project_id === projectId && r.token_hash === hash) || null
                    );
                  }
                  return null;
                },
                async run() {
                  if (text.includes("INSERT INTO scim_tokens")) {
                    const [id, projectId, tokenHash, description, scopes, createdAt] = args;
                    rows.push({
                      id,
                      project_id: projectId,
                      token_hash: tokenHash,
                      description,
                      scopes,
                      created_at: createdAt,
                    });
                    return { meta: { changes: 1 } };
                  }
                  if (text.includes("UPDATE scim_tokens SET token_hash")) {
                    const [tokenHash, id] = args;
                    const row = rows.find((r) => r.id === id);
                    if (row) row.token_hash = tokenHash;
                    return { meta: { changes: row ? 1 : 0 } };
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("scim token hashing (#21)", () => {
  it("stores a salted hash instead of bare SHA-256", async () => {
    const { env, rows } = mockEnv();
    const created = await createScimToken(env, "p1", "okta", "users");
    expect(rows[0].token_hash).not.toBe(await sha256Hex(created.token));
    const verified = await verifyScimToken(env, "p1", `Bearer ${created.token}`);
    expect(verified?.id).toBe(created.id);
  });

  it("verifies and re-hashes legacy unsalted rows on use", async () => {
    const { env, rows } = mockEnv();
    const legacy = "legacy-scim-token-abc";
    rows.push({
      id: "tok-legacy",
      project_id: "p1",
      token_hash: await sha256Hex(legacy),
      description: "legacy",
      scopes: "users",
      created_at: new Date().toISOString(),
    });
    const verified = await verifyScimToken(env, "p1", `Bearer ${legacy}`);
    expect(verified?.id).toBe("tok-legacy");
    expect(rows[0].token_hash).not.toBe(await sha256Hex(legacy));
    const again = await verifyScimToken(env, "p1", `Bearer ${legacy}`);
    expect(again?.id).toBe("tok-legacy");
  });

  it("rejects unknown tokens", async () => {
    const { env } = mockEnv();
    expect(await verifyScimToken(env, "p1", "Bearer nope")).toBeNull();
  });
});
