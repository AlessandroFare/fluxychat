import { describe, expect, it } from "vitest";
import { dispatchVoiceAiRoutes } from "./voice-ai-http.js";

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  const announced = [];
  return {
    env: {
      AI: {
        run: async (model, input) => {
          if (String(model).includes("whisper") || input?.audio) {
            return { text: "hello from workers ai" };
          }
          return { audio: "YWFh" };
        },
      },
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ type: "public" }),
            all: async () => ({ results: [] }),
          }),
        }),
      },
      ...overrides.env,
    },
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders, ...(init.headers || {}) },
      }),
    corsHeaders,
    requestLogCtx: { traceId: "t" },
    verifyJwtAndGetContext:
      overrides.verifyJwt ??
      (async () => ({
        userId: "user_1",
        projectId: "proj_1",
        roles: ["member"],
      })),
    logError: () => {},
    checkAndConsumeRateLimit: overrides.checkAndConsumeRateLimit ?? (async () => ({ allowed: true })),
    announced,
  };
}

function post(path, body) {
  return new Request(`http://chat.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("voice-ai member speech", () => {
  it("returns 401 without JWT on transcribe", async () => {
    const deps = buildDeps({ verifyJwt: async () => null });
    const req = post("/voice-ai/transcribe", { audioBase64: "YQ==" });
    const res = await dispatchVoiceAiRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(401);
  });

  it("transcribes via env.AI.run", async () => {
    const deps = buildDeps();
    const req = post("/voice-ai/transcribe", {
      audioBase64: btoa("abc"),
      mimeType: "audio/webm",
    });
    const res = await dispatchVoiceAiRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.text).toBe("hello from workers ai");
    expect(body.engine).toBe("workers-ai");
  });

  it("synthesizes via env.AI.run", async () => {
    const deps = buildDeps();
    const req = post("/voice-ai/speak", { text: "hi" });
    const res = await dispatchVoiceAiRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.audioBase64).toBe("YWFh");
    expect(body.engine).toBe("workers-ai");
  });

  it("returns 503 speak when AI is unbound", async () => {
    const deps = buildDeps({ env: { AI: undefined } });
    const req = post("/voice-ai/speak", { text: "hi" });
    const res = await dispatchVoiceAiRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(503);
  });
});
