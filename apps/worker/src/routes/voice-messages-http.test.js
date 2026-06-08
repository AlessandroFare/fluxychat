import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchVoiceMessagesRoutes } from "./voice-messages-http.js";

/**
 * Integration tests for `POST /messages/voice`. The route stitches together
 * a multipart upload, JWT auth, room/membership lookup, quota + rate limit,
 * D1 insert, R2 upload, async transcription, and a fanout broadcast. We
 * exercise the happy path, the input-validation paths, and a few error
 * branches. Auth + project + room fixtures are stubbed at the dep level.
 */

function makeJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMockD1() {
  /** @type {Map<number, any>} */
  const messages = new Map();
  let nextId = 1;
  const first = (sql, args) => {
    if (/SELECT type FROM rooms WHERE project_id = \? AND id = \?/.test(sql)) {
      const [projectId, roomId] = args;
      return mockRooms.get(`${projectId}:${roomId}`) ?? null;
    }
    if (/SELECT 1 as ok FROM room_members WHERE room_id = \? AND user_id = \?/.test(sql)) {
      return { ok: 1 };
    }
    if (/SELECT id, type FROM rooms WHERE id = \? AND project_id = \?/.test(sql)) {
      const [roomId, projectId] = args;
      const row = mockRooms.get(`${projectId}:${roomId}`);
      return row ? { id: roomId, type: row.type } : null;
    }
    if (/SELECT id FROM rooms WHERE id = \? AND project_id = \?/.test(sql)) {
      const [roomId, projectId] = args;
      return mockRooms.has(`${projectId}:${roomId}`) ? { id: roomId } : null;
    }
    return null;
  };
  const run = (sql, args) => {
    if (/INSERT INTO messages/.test(sql)) {
      const id = nextId++;
      const [projectId, roomId, userId, content, createdAt, parentId, durationMs, clientMessageId] = args;
      messages.set(id, {
        id,
        project_id: projectId,
        room_id: roomId,
        user_id: userId,
        content: content ?? "",
        created_at: createdAt,
        parent_id: parentId,
        kind: "voice",
        duration_ms: durationMs,
        audio_url: null,
        transcription: null,
        transcription_status: "pending",
        client_message_id: clientMessageId,
      });
      return { meta: { last_row_id: id, changes: 1 } };
    }
    if (/^UPDATE messages SET audio_url = \?/.test(sql)) {
      const [url, id] = args;
      const row = messages.get(Number(id));
      if (!row) return { meta: { changes: 0 } };
      row.audio_url = url;
      return { meta: { changes: 1 } };
    }
    if (/UPDATE messages\s+SET transcription = \?, transcription_status = 'done'/.test(sql)) {
      const [text, id] = args;
      const row = messages.get(Number(id));
      if (!row) return { meta: { changes: 0 } };
      if (row.transcription_status && row.transcription_status !== "pending") {
        return { meta: { changes: 0 } };
      }
      row.transcription = text;
      row.transcription_status = "done";
      return { meta: { changes: 1 } };
    }
    if (/^UPDATE messages SET transcription_status = 'failed'/.test(sql)) {
      const [id] = args;
      const row = messages.get(Number(id));
      if (!row) return { meta: { changes: 0 } };
      row.transcription_status = "failed";
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  };
  return {
    messages,
    nextId,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => first(sql, args),
            run: async () => run(sql, args),
            all: async () => ({ results: [] }),
          };
        },
      };
    },
  };
}

/** @type {Map<string, { type: string }>} */
const mockRooms = new Map();

/** Build a multipart body from a record. */
function buildMultipart(fields) {
  const boundary = "----test-boundary-1234";
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value && typeof value === "object" && "bytes" in value) {
      parts.push(
        `--${boundary}\r\n` +
          `content-disposition: form-data; name="${name}"; filename="${value.filename || name}"\r\n` +
          `content-type: ${value.contentType || "application/octet-stream"}\r\n\r\n`,
      );
      parts.push({ bytes: value.bytes, isBytes: true });
      parts.push(`\r\n`);
    } else {
      parts.push(
        `--${boundary}\r\n` +
          `content-disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`,
      );
    }
  }
  parts.push(`--${boundary}--\r\n`);

  let total = 0;
  for (const p of parts) {
    total += p.isBytes ? p.bytes.byteLength : new TextEncoder().encode(p).byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    const bytes = p.isBytes ? p.bytes : new TextEncoder().encode(p);
    out.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return { body: out, contentType: `multipart/form-data; boundary=${boundary}` };
}

function buildDeps(overrides = {}) {
  const db = overrides.db ?? createMockD1();
  const r2 = overrides.r2 ?? {
    put: vi.fn(async () => {}),
  };
  /** @type {Array<{ type: string, body: any }>} */
  const announcements = [];
  const corsHeaders = { "access-control-allow-origin": "*" };
  const env = {
    DB: db,
    ATTACHMENTS: r2,
    AI_BASE_URL: overrides.aiBaseUrl ?? "https://llm.example.com",
    AI_API_KEY: overrides.aiKey ?? "sk-test",
    AI_TRANSCRIBE_MODEL: overrides.aiModel,
    RATE_LIMIT_VOICE_MESSAGES_PER_MINUTE: overrides.voiceRateLimit ?? 10,
    ROOM: {
      idFromName: () => ({ toString: () => "id" }),
      get: () => ({
        fetch: async (url, init) => {
          // url may be a string ("https://internal/announce") or a Request;
          // init holds { method, body } when the caller used a plain body.
          const path = typeof url === "string" ? new URL(url).pathname : url.url;
          if (String(path).endsWith("/announce")) {
            let body = {};
            try {
              body = JSON.parse(String(init?.body ?? "{}"));
            } catch {}
            announcements.push({ type: "announce", body });
            return new Response(null, { status: 202 });
          }
          return new Response("not found", { status: 404 });
        },
      }),
    },
  };
  const h = {
    env,
    ctx: { waitUntil: async (p) => { await p; } },
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders, ...(init.headers || {}) },
      }),
    corsHeaders,
    requestLogCtx: { traceId: "t" },
    verifyJwtAndGetContext: overrides.verifyJwt ?? (async () => ({ userId: "user_1", projectId: "proj_1" })),
    logError: () => {},
    checkAndConsumeProjectQuota: overrides.quota ?? (async () => ({ allowed: true, used: 0, monthKey: "2026-06" })),
    quotaResetInfo: () => ({ resetsAt: "x", retryAfterSeconds: 60 }),
    checkAndConsumeRateLimit: overrides.rate ?? (async () => ({ allowed: true, retryAfterSeconds: 0 })),
    isValidId: (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s),
  };
  return { env, h, db, r2, announcements };
}

describe("dispatchVoiceMessagesRoutes", () => {
  beforeEach(() => {
    mockRooms.clear();
    mockRooms.set("proj_1:room_1", { type: "channel" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads, inserts, broadcasts, and schedules transcription on the happy path", async () => {
    const { h, env, db, r2, announcements } = buildDeps();
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const { body, contentType } = buildMultipart({
      audio: { bytes: audioBytes, filename: "rec.webm", contentType: "audio/webm" },
      roomId: "room_1",
      durationMs: "3500",
      clientMessageId: "cm-1",
    });
    const request = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });

    // Stub global fetch used by transcribeAudio; we don't care about the
    // result here (the background waitUntil is fire-and-forget in the route).
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ text: "hello" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchSpy;

    const response = await dispatchVoiceMessagesRoutes(
      request,
      new URL(request.url),
      h,
    );
    expect(response).not.toBeNull();
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.kind).toBe("voice");
    expect(json.transcriptionStatus).toBe("pending");
    expect(json.audioUrl).toBe("/attachments/voice/proj_1/room_1/1.webm");
    expect(typeof json.messageId).toBe("number");

    // D1 row was inserted with kind=voice and the audio_url was updated
    const row = db.messages.get(json.messageId);
    expect(row.kind).toBe("voice");
    expect(row.audio_url).toBe(json.audioUrl);
    expect(row.transcription_status).toBe("pending");
    expect(row.duration_ms).toBe(3500);

    // R2 saw exactly one put with the expected key + content type
    expect(r2.put).toHaveBeenCalledTimes(1);
    const [key, body2, opts] = r2.put.mock.calls[0];
    expect(key).toBe("voice/proj_1/room_1/1.webm");
    expect(new Uint8Array(body2)).toEqual(audioBytes);
    expect(opts.httpMetadata.contentType).toBe("audio/webm");

    // Two announcements: initial pending message + transcription_done (from the
    // background waitUntil). The route returns before waitUntil resolves, so
    // we have to give the microtask queue a turn.
    expect(announcements).toHaveLength(1);
    expect(announcements[0].body.kind).toBe("voice");
    expect(announcements[0].body.transcriptionStatus).toBe("pending");

    await new Promise((r) => setTimeout(r, 0));
    // Second announce is the message_updated with transcription='hello'
    expect(announcements).toHaveLength(2);
    expect(announcements[1].body.type).toBe("message_updated");
    expect(announcements[1].body.transcription).toBe("hello");
    expect(announcements[1].body.transcriptionStatus).toBe("done");

    // The transcription provider was called exactly once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when no JWT context is provided", async () => {
    const { h } = buildDeps({ verifyJwt: async () => null });
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.webm", contentType: "audio/webm" },
      roomId: "room_1",
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(401);
  });

  it("returns 400 when the audio field is missing", async () => {
    const { h } = buildDeps();
    const { body, contentType } = buildMultipart({ roomId: "room_1" });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/audio file required/);
  });

  it("returns 400 when the roomId is missing or invalid", async () => {
    const { h } = buildDeps();
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.webm", contentType: "audio/webm" },
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(400);
  });

  it("returns 415 for unsupported mime types", async () => {
    const { h } = buildDeps();
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.mp4", contentType: "video/mp4" },
      roomId: "room_1",
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(415);
  });

  it("returns 404 when the room does not exist", async () => {
    const { h } = buildDeps();
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.webm", contentType: "audio/webm" },
      roomId: "missing",
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(404);
  });

  it("returns 402 when the message quota is exceeded", async () => {
    const { h } = buildDeps({
      quota: async () => ({ allowed: false, used: 999, monthKey: "2026-06" }),
    });
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.webm", contentType: "audio/webm" },
      roomId: "room_1",
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(402);
  });

  it("returns 429 when the voice rate limit is exceeded", async () => {
    const { h } = buildDeps({
      rate: async () => ({ allowed: false, retryAfterSeconds: 42 }),
    });
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.webm", contentType: "audio/webm" },
      roomId: "room_1",
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("returns 503 when R2 is not bound and marks the row as failed", async () => {
    const { h, env, db } = buildDeps();
    // Simulate an operator who forgot to bind the R2 bucket.
    env.ATTACHMENTS = undefined;
    const { body, contentType } = buildMultipart({
      audio: { bytes: new Uint8Array([1]), filename: "a.webm", contentType: "audio/webm" },
      roomId: "room_1",
    });
    const req = new Request("https://fluxy.local/messages/voice", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(503);
    // The row exists with kind=voice and transcription_status='failed' so it
    // doesn't silently stay 'pending' if the upload failed.
    const row = [...db.messages.values()][0];
    expect(row.transcription_status).toBe("failed");
  });

  it("ignores non-POST and non-matching paths", async () => {
    const { h } = buildDeps();
    const req = new Request("https://fluxy.local/other", { method: "POST" });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res).toBeNull();
  });

  it("ignores GET /messages/voice (not a POST)", async () => {
    const { h } = buildDeps();
    const req = new Request("https://fluxy.local/messages/voice", { method: "GET" });
    const res = await dispatchVoiceMessagesRoutes(req, new URL(req.url), h);
    expect(res).toBeNull();
  });
});
