import { describe, expect, it } from "vitest";
import { generateServiceJWT, lookupAgentConfig, verifyWebhookSignature } from "./handlers.js";

function createMockDb(secret) {
  return {
    prepare() {
      return this;
    },
    bind() {
      return this;
    },
    first() {
      return Promise.resolve(secret === null ? null : { jwt_secret: secret });
    },
  };
}

function decodeJwtPayload(jwt) {
  const payloadB64 = jwt.split(".")[1];
  const payload = JSON.parse(
    atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
  );
  return payload;
}

describe("lookupAgentConfig", () => {
  it("uses a project-scoped dev key for chatgpt", async () => {
    const projectId = "proj_dev_1";
    const env = {
      ENVIRONMENT: "development",
      [`AGENT_${projectId}_chatgpt_API_KEY`]: "proj-scoped-key",
    };
    const config = await lookupAgentConfig(env, projectId, "chatgpt");
    expect(config).not.toBeNull();
    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("proj-scoped-key");
  });

  it("ignores a global OPENAI_API_KEY when no project-scoped key is set", async () => {
    const env = {
      ENVIRONMENT: "development",
      OPENAI_API_KEY: "global-key",
    };
    const config = await lookupAgentConfig(env, "proj_dev_2", "chatgpt");
    expect(config).toBeNull();
  });

  it("ignores global OPENAI_API_KEY outside development", async () => {
    const env = {
      ENVIRONMENT: "production",
      [`AGENT_proj_prod_1_chatgpt_API_KEY`]: "proj-scoped-key",
      OPENAI_API_KEY: "global-key",
    };
    const config = await lookupAgentConfig(env, "proj_prod_1", "chatgpt");
    expect(config).toBeNull();
  });
});

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

  it("fetches the project JWT secret from D1", async () => {
    const env = { DB: createMockDb("d1-secret") };
    const jwt = await generateServiceJWT(env, "proj_1");
    const payload = decodeJwtPayload(jwt);
    expect(payload.tid).toBe("proj_1");
    expect(payload.sub).toBe("service:ai-agent");
  });

  it("falls back to env.JWT_SECRET in development", async () => {
    const env = {
      ENVIRONMENT: "development",
      DB: createMockDb(null),
      JWT_SECRET: "dev-secret",
    };
    const jwt = await generateServiceJWT(env, "proj_2");
    const payload = decodeJwtPayload(jwt);
    expect(payload.tid).toBe("proj_2");
  });

  it("denies env.JWT_SECRET fallback in production", async () => {
    const env = {
      ENVIRONMENT: "production",
      DB: createMockDb(null),
      JWT_SECRET: "prod-env-secret",
    };
    await expect(generateServiceJWT(env, "proj_3")).rejects.toThrow(
      "Missing JWT secret for project proj_3"
    );
  });

  it("fails closed when the project JWT secret is missing", async () => {
    await expect(generateServiceJWT({}, "proj_4")).rejects.toThrow(
      "Missing JWT secret for project proj_4"
    );
  });
});
