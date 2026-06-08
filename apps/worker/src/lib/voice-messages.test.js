import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistTranscriptionResult,
  transcribeAudio,
  uploadVoiceToR2,
  validateVoiceUpload,
} from "./voice-messages.js";

describe("validateVoiceUpload", () => {
  it("accepts webm with a valid size and ext", () => {
    const res = validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 1024 });
    expect(res).toEqual({ ok: true, ext: "webm" });
  });

  it("normalises mime casing and picks the right ext for every allowed type", () => {
    const samples = [
      ["audio/WEBM", "webm"],
      ["audio/ogg", "ogg"],
      ["audio/mpeg", "mp3"],
      ["audio/mp3", "mp3"],
      ["audio/mp4", "m4a"],
      ["audio/m4a", "m4a"],
      ["audio/wav", "wav"],
      ["audio/x-wav", "wav"],
      ["audio/wave", "wav"],
    ];
    for (const [mime, ext] of samples) {
      const res = validateVoiceUpload({ mimeType: mime, sizeBytes: 100 });
      expect(res).toEqual({ ok: true, ext });
    }
  });

  it("rejects unsupported mime types with 415", () => {
    const res = validateVoiceUpload({ mimeType: "video/mp4", sizeBytes: 100 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
  });

  it("rejects missing or non-string mime", () => {
    expect(validateVoiceUpload({ sizeBytes: 1 }).ok).toBe(false);
    expect(validateVoiceUpload({ mimeType: 123, sizeBytes: 1 }).ok).toBe(false);
  });

  it("rejects zero, negative, or non-numeric size with 400", () => {
    expect(validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 0 }).ok).toBe(false);
    expect(validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: -10 }).ok).toBe(false);
    expect(validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: "big" }).ok).toBe(false);
  });

  it("rejects payloads over 10 MB with 413", () => {
    const res = validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 11 * 1024 * 1024 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(413);
  });

  it("rejects durations over 10 minutes with 413 when provided", () => {
    const res = validateVoiceUpload({
      mimeType: "audio/webm",
      sizeBytes: 1024,
      durationMs: 11 * 60 * 1000,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(413);
  });

  it("accepts when durationMs is omitted", () => {
    const res = validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 1024 });
    expect(res.ok).toBe(true);
  });

  it("rejects invalid durationMs values", () => {
    expect(validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 1, durationMs: 0 }).ok).toBe(false);
    expect(validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 1, durationMs: -1 }).ok).toBe(false);
    expect(validateVoiceUpload({ mimeType: "audio/webm", sizeBytes: 1, durationMs: "long" }).ok).toBe(false);
  });
});

describe("uploadVoiceToR2", () => {
  /** @type {{ putCalls: Array<{ key: string, body: Uint8Array, opts: any }> }} */
  let store;
  beforeEach(() => {
    store = { putCalls: [] };
  });

  it("uploads to R2 with the expected key and returns a public-ish URL", async () => {
    const env = {
      ATTACHMENTS: {
        put: async (key, body, opts) => {
          store.putCalls.push({ key, body, opts });
        },
      },
    };
    const res = await uploadVoiceToR2(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 42,
      audioBytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/webm",
      ext: "webm",
    });
    expect(res.ok).toBe(true);
    expect(res.key).toBe("voice/proj_1/room_1/42.webm");
    expect(res.url).toBe("/attachments/voice/proj_1/room_1/42.webm");
    expect(store.putCalls).toHaveLength(1);
    expect(store.putCalls[0].opts.httpMetadata.contentType).toBe("audio/webm");
    expect(store.putCalls[0].opts.customMetadata.kind).toBe("voice");
  });

  it("accepts ArrayBuffer in addition to Uint8Array", async () => {
    const env = {
      ATTACHMENTS: { put: async (key, body) => { store.putCalls.push({ key, body }); } },
    };
    const buf = new ArrayBuffer(4);
    const res = await uploadVoiceToR2(env, {
      projectId: "p",
      roomId: "r",
      messageId: 1,
      audioBytes: buf,
      mimeType: "audio/wav",
      ext: "wav",
    });
    expect(res.ok).toBe(true);
    expect(store.putCalls[0].body).toBeInstanceOf(Uint8Array);
  });

  it("returns 503 when R2 is not bound", async () => {
    const res = await uploadVoiceToR2({}, {
      projectId: "p",
      roomId: "r",
      messageId: 1,
      audioBytes: new Uint8Array(1),
      mimeType: "audio/webm",
      ext: "webm",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
  });

  it("returns 400 when required identifiers are missing", async () => {
    const env = { ATTACHMENTS: { put: async () => {} } };
    const cases = [
      { projectId: "", roomId: "r", messageId: 1 },
      { projectId: "p", roomId: "", messageId: 1 },
      { projectId: "p", roomId: "r", messageId: NaN },
    ];
    for (const args of cases) {
      const res = await uploadVoiceToR2(env, {
        ...args,
        audioBytes: new Uint8Array(1),
        mimeType: "audio/webm",
        ext: "webm",
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
    }
  });

  it("returns 502 when R2 put throws", async () => {
    const env = { ATTACHMENTS: { put: async () => { throw new Error("r2 down"); } } };
    const res = await uploadVoiceToR2(env, {
      projectId: "p",
      roomId: "r",
      messageId: 1,
      audioBytes: new Uint8Array(1),
      mimeType: "audio/webm",
      ext: "webm",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
  });

  it("URI-encodes projectId and roomId segments with special characters", async () => {
    const env = { ATTACHMENTS: { put: async (key) => { store.putCalls.push({ key }); } } };
    const res = await uploadVoiceToR2(env, {
      projectId: "p/with spaces",
      roomId: "röm#1",
      messageId: 7,
      audioBytes: new Uint8Array(1),
      mimeType: "audio/webm",
      ext: "webm",
    });
    expect(res.ok).toBe(true);
    expect(res.key).toBe("voice/p%2Fwith%20spaces/r%C3%B6m%231/7.webm");
  });
});

describe("transcribeAudio", () => {
  const originalFetch = globalThis.fetch;
  /** @type {Array<{ url: string, init: any }>} */
  let calls;
  /** @type {Array<{ status?: number, body?: any, error?: Error }>} */
  let responses;

  beforeEach(() => {
    calls = [];
    responses = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      if (next?.error) throw next.error;
      return new Response(
        next?.body !== undefined ? JSON.stringify(next.body) : null,
        { status: next?.status ?? 200, headers: { "content-type": "application/json" } },
      );
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs multipart/form-data to {AI_BASE_URL}/v1/audio/transcriptions and returns the text", async () => {
    responses.push({ status: 200, body: { text: "hello world" } });
    const env = { AI_BASE_URL: "https://llm.example.com", AI_API_KEY: "sk-test" };
    const res = await transcribeAudio(env, {
      audioBytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      mimeType: "audio/webm",
    });
    expect(res.ok).toBe(true);
    expect(res.text).toBe("hello world");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://llm.example.com/v1/audio/transcriptions");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers["content-type"]).toMatch(/^multipart\/form-data; boundary=----fluxy-voice-/);
    const authHeader =
      calls[0].init.headers.Authorization ?? calls[0].init.headers.authorization;
    expect(authHeader).toBe("Bearer sk-test");
    const body = calls[0].init.body;
    expect(body).toBeInstanceOf(Uint8Array);
    const decoder = new TextDecoder();
    const text = decoder.decode(body);
    expect(text).toContain('name="model"');
    expect(text).toContain("whisper-1");
    expect(text).toContain('name="response_format"');
    expect(text).toContain('filename="voice.webm"');
    expect(text).toContain("content-type: audio/webm");
  });

  it("uses env.AI_TRANSCRIBE_MODEL when set, defaulting to whisper-1", async () => {
    responses.push({ status: 200, body: { text: "ok" } });
    await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com", AI_TRANSCRIBE_MODEL: "whisper-large-v3" },
      { audioBytes: new Uint8Array([1]), mimeType: "audio/webm" },
    );
    const text = new TextDecoder().decode(calls[0].init.body);
    expect(text).toContain("whisper-large-v3");
  });

  it("respects the language hint and custom filename", async () => {
    responses.push({ status: 200, body: { text: "ciao" } });
    await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com" },
      { audioBytes: new Uint8Array([1]), mimeType: "audio/ogg", language: "it", filename: "rec.ogg" },
    );
    const text = new TextDecoder().decode(calls[0].init.body);
    expect(text).toContain('name="language"');
    expect(text).toContain("it");
    expect(text).toContain('filename="rec.ogg"');
  });

  it("returns 503 when AI is not configured", async () => {
    const res = await transcribeAudio({}, { audioBytes: new Uint8Array([1]), mimeType: "audio/webm" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(res.error).toBe("ai_not_configured");
  });

  it("returns 400 on empty audio", async () => {
    const res = await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com" },
      { audioBytes: new Uint8Array(0), mimeType: "audio/webm" },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it("returns 502 when the provider errors", async () => {
    responses.push({ status: 500, body: { error: "upstream" } });
    const res = await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com" },
      { audioBytes: new Uint8Array([1]), mimeType: "audio/webm" },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
  });

  it("returns 502 when the provider returns empty text", async () => {
    responses.push({ status: 200, body: { text: "   " } });
    const res = await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com" },
      { audioBytes: new Uint8Array([1]), mimeType: "audio/webm" },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
  });

  it("returns 502 when fetch throws", async () => {
    responses.push({ error: new Error("network down") });
    const res = await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com" },
      { audioBytes: new Uint8Array([1]), mimeType: "audio/webm" },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
  });

  it("returns 502 when the response is not valid JSON", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not json", { status: 200 }));
    const res = await transcribeAudio(
      { AI_BASE_URL: "https://llm.example.com" },
      { audioBytes: new Uint8Array([1]), mimeType: "audio/webm" },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
  });
});

describe("persistTranscriptionResult", () => {
  function createMockD1() {
    /** @type {Array<{ sql: string, args: any[] }>} */
    const queries = [];
    /** @type {Map<number, { id: number, transcription: string | null, transcription_status: string | null }>} */
    const messages = new Map();
    return {
      messages,
      queries,
      prepare(sql) {
        return {
          bind(...args) {
            return {
              run: async () => {
                queries.push({ sql, args });
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
                if (/UPDATE messages\s+SET transcription_status = 'failed'/.test(sql)) {
                  const [id] = args;
                  const row = messages.get(Number(id));
                  if (!row) return { meta: { changes: 0 } };
                  if (row.transcription_status && row.transcription_status !== "pending") {
                    return { meta: { changes: 0 } };
                  }
                  row.transcription_status = "failed";
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    };
  }

  it("updates a pending message to done with the transcript", async () => {
    const db = createMockD1();
    db.messages.set(7, { id: 7, transcription: null, transcription_status: "pending" });
    const env = { DB: db };
    const res = await persistTranscriptionResult(env, { messageId: 7, status: "done", text: "hi" });
    expect(res).toEqual({ ok: true, changed: true });
    expect(db.messages.get(7).transcription).toBe("hi");
    expect(db.messages.get(7).transcription_status).toBe("done");
  });

  it("marks a pending message as failed without overwriting transcription", async () => {
    const db = createMockD1();
    db.messages.set(7, { id: 7, transcription: null, transcription_status: "pending" });
    const env = { DB: db };
    const res = await persistTranscriptionResult(env, { messageId: 7, status: "failed" });
    expect(res).toEqual({ ok: true, changed: true });
    expect(db.messages.get(7).transcription_status).toBe("failed");
    expect(db.messages.get(7).transcription).toBeNull();
  });

  it("does not overwrite a row that is already done", async () => {
    const db = createMockD1();
    db.messages.set(7, { id: 7, transcription: "earlier", transcription_status: "done" });
    const env = { DB: db };
    const res = await persistTranscriptionResult(env, { messageId: 7, status: "done", text: "newer" });
    expect(res).toEqual({ ok: true, changed: false });
    expect(db.messages.get(7).transcription).toBe("earlier");
  });

  it("treats unknown status as a no-op without hitting the DB", async () => {
    const db = createMockD1();
    const env = { DB: db };
    const res = await persistTranscriptionResult(env, { messageId: 1, status: "weird" });
    expect(res).toEqual({ ok: true, changed: false });
    expect(db.queries).toHaveLength(0);
  });

  it("ignores non-numeric messageId without hitting the DB", async () => {
    const db = createMockD1();
    const env = { DB: db };
    const res = await persistTranscriptionResult(env, { messageId: NaN, status: "done", text: "x" });
    expect(res).toEqual({ ok: true, changed: false });
    expect(db.queries).toHaveLength(0);
  });
});
