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

  it("supports interruption with barge-in transport", async () => {
    const interrupt = vi.fn(async () => undefined);
    const transport: VoiceTransport = {
      connect: vi.fn(async (_id, _config, emit) => { emit({ type: "status", status: "connected" }); }),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
      interrupt,
    };
    const manager = createVoiceManager({ transport, createId: () => "voice-int" });
    const session = await manager.createSession({
      interruption: { mode: "barge-in", sensitivity: 0.8 },
    });
    await session.start();
    await session.interrupt("user spoke");
    expect(interrupt).toHaveBeenCalledWith("voice-int", "user spoke");
  });

  it("does not call interrupt when mode is none", async () => {
    const interrupt = vi.fn(async () => undefined);
    const transport: VoiceTransport = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
      interrupt,
    };
    const manager = createVoiceManager({ transport, createId: () => "voice-none" });
    const session = await manager.createSession({ interruption: { mode: "none" } });
    await session.interrupt("test");
    expect(interrupt).not.toHaveBeenCalled();
  });

  it("supports media upload when transport provides it", async () => {
    const sendMedia = vi.fn(async () => undefined);
    const transport: VoiceTransport = {
      connect: vi.fn(async (_id, _config, emit) => { emit({ type: "status", status: "connected" }); }),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
      sendMedia,
    };
    const manager = createVoiceManager({ transport, createId: () => "voice-media" });
    const session = await manager.createSession();
    await session.start();
    const blob = new Blob(["test"], { type: "image/png" });
    await session.sendMedia(blob, { caption: "a diagram" });
    expect(sendMedia).toHaveBeenCalledWith("voice-media", blob, { caption: "a diagram" });
  });

  it("supports media generation when transport provides it", async () => {
    const generateMedia = vi.fn(async () => "https://cdn.example.com/gen.png");
    const transport: VoiceTransport = {
      connect: vi.fn(async (_id, _config, emit) => { emit({ type: "status", status: "connected" }); }),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
      generateMedia,
    };
    const manager = createVoiceManager({ transport, createId: () => "voice-gen" });
    const session = await manager.createSession();
    await session.start();
    const url = await session.generateMedia("a cat", { type: "image" });
    expect(url).toBe("https://cdn.example.com/gen.png");
    expect(generateMedia).toHaveBeenCalledWith("voice-gen", "a cat", { type: "image" });
  });

  it("throws on media upload when transport does not support it", async () => {
    const transport: VoiceTransport = {
      connect: vi.fn(async (_id, _config, emit) => { emit({ type: "status", status: "connected" }); }),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
    };
    const manager = createVoiceManager({ transport, createId: () => "voice-no-media" });
    const session = await manager.createSession();
    await session.start();
    await expect(session.sendMedia(new Blob())).rejects.toThrow("not supported");
  });

  it("interruptAll stops all sessions", async () => {
    let counter = 0;
    const interrupt = vi.fn(async () => undefined);
    const transport: VoiceTransport = {
      connect: vi.fn(async (_id, _config, emit) => { emit({ type: "status", status: "connected" }); }),
      disconnect: vi.fn(async () => undefined),
      sendAudio: vi.fn(async () => undefined),
      sendText: vi.fn(async () => undefined),
      interrupt,
    };
    const manager = createVoiceManager({ transport, createId: () => `voice-all-${counter++}` });
    const s1 = await manager.createSession({ interruption: { mode: "barge-in" } });
    const s2 = await manager.createSession({ interruption: { mode: "barge-in" } });
    await s1.start();
    await s2.start();
    await manager.interruptAll("shutting down");
    expect(interrupt).toHaveBeenCalledTimes(2);
  });

  it("round trips audio base64", () => {
    const audio = new Uint8Array([0, 1, 2, 254, 255]).buffer;
    expect([...new Uint8Array(base64ToAudio(audioToBase64(audio)))]).toEqual([0, 1, 2, 254, 255]);
    expect(() => base64ToAudio("***")).toThrow(TypeError);
  });
});
