import { describe, expect, it, vi } from "vitest";
import { audioToBase64, base64ToAudio, createVoiceManager, type VoiceTransport } from "./voice";

describe("voice manager", () => {
  it("manages lifecycle and emitted chunks", async () => {
    let emit: Parameters<VoiceTransport["connect"]>[2] | undefined;
    const transport: VoiceTransport = {
      connect: vi.fn(async (_id, _config, callback) => { emit = callback; }),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
    };
    const manager = createVoiceManager({ transport, createId: () => "voice-1" });
    const session = await manager.createSession();
    const transcripts: string[] = [];
    session.onChunk((chunk) => { if (chunk.transcript) transcripts.push(chunk.transcript); });
    await session.start();
    expect(session.status).toBe("connected");
    emit?.({ type: "transcript", transcript: "hello" });
    expect(session.status).toBe("listening");
    expect(transcripts).toEqual(["hello"]);
    await session.sendAudio(new Uint8Array([1]).buffer);
    await manager.stopSession(session.id);
    expect(manager.listSessions()).toEqual([]);
  });

  it("round trips audio base64", () => {
    const audio = new Uint8Array([0, 1, 2, 254, 255]).buffer;
    expect([...new Uint8Array(base64ToAudio(audioToBase64(audio)))]).toEqual([0, 1, 2, 254, 255]);
    expect(() => base64ToAudio("***")).toThrow(TypeError);
  });
});
