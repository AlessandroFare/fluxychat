import { describe, expect, it } from "vitest";
import {
  decodeAudioBase64,
  extractTranscriptText,
  extractTtsAudioBase64,
  isWorkersAiBound,
  synthesizeWithWorkersAi,
  transcribeWithWorkersAi,
} from "./workers-ai-speech.js";

describe("workers-ai speech", () => {
  it("extracts whisper-shaped text", () => {
    expect(extractTranscriptText({ text: " hello " })).toBe("hello");
    expect(extractTranscriptText({ segments: [{ text: "a" }, { text: "b" }] })).toBe("a b");
  });

  it("transcribes via env.AI.run", async () => {
    const env = {
      AI: {
        run: async (model, input) => {
          expect(model).toContain("whisper");
          expect(input.audio).toEqual([1, 2, 3]);
          return { text: "room is live" };
        },
      },
    };
    const out = await transcribeWithWorkersAi(env, { audioBytes: new Uint8Array([1, 2, 3]) });
    expect(out.ok).toBe(true);
    expect(out.engine).toBe("workers-ai");
    expect(out.text).toBe("room is live");
  });

  it("synthesizes audio base64", async () => {
    const env = {
      AI: {
        run: async () => ({ audio: "YWFh" }),
      },
    };
    const out = await synthesizeWithWorkersAi(env, { text: "hi" });
    expect(out.ok).toBe(true);
    expect(out.audioBase64).toBe("YWFh");
    expect(isWorkersAiBound(env)).toBe(true);
    expect(extractTtsAudioBase64({ audio: "xx" })).toBe("xx");
  });

  it("fails closed when the AI binding is missing", async () => {
    const out = await transcribeWithWorkersAi({}, { audioBytes: new Uint8Array([1]) });
    expect(out.error).toBe("workers_ai_unbound");
  });

  it("decodes audio base64", () => {
    const out = decodeAudioBase64(btoa("hi"));
    expect(out.ok).toBe(true);
    expect([...out.audioBytes]).toEqual([104, 105]);
    expect(decodeAudioBase64("%%%").error).toBe("invalid_audio_base64");
  });
});
