import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { createFluxyRoomSession } from "./room-session";
import type { FluxyChatEvent, FluxyChatMessage } from "./index";
import type { FluxyChatRoomConnection } from "./room-connection";

type MessageListener = (event: FluxyChatEvent) => void;

function makeFakeConnection() {
  const listeners: MessageListener[] = [];
  const anyListeners: Array<(event: FluxyChatEvent) => void> = [];
  const connection = {
    listeners,
    anyListeners,
    addEventListener(_type: "message", listener: MessageListener) {
      listeners.push(listener);
    },
    onAnyEvent(listener: (event: FluxyChatEvent) => void) {
      anyListeners.push(listener);
    },
    removeEventListener() {
      /* noop */
    },
    connect: vi.fn(),
    close: vi.fn(),
    sendJson: vi.fn(),
    get reconnectAttempts() {
      return 0;
    },
    getScheduledReconnectDelayMs() {
      return 0;
    },
  } as unknown as FluxyChatRoomConnection & {
    listeners: MessageListener[];
    anyListeners: Array<(event: FluxyChatEvent) => void>;
  };
  return connection;
}

describe("room-session message_updated (P12-B UI)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("patches the matching voice message in the store when message_updated arrives", async () => {
    const baseUrl = "http://127.0.0.1:8787";
    const client = new FluxyChatClient({ baseUrl, userId: "alice", token: "jwt_abc" });
    const fake = makeFakeConnection();
    const connectRoomSpy = vi
      .spyOn(client, "connectRoom")
      .mockReturnValue(fake as unknown as FluxyChatRoomConnection);

    const createdAt = "2026-06-05T10:00:00.000Z";
    const initial: FluxyChatMessage[] = [
      {
        id: 99,
        roomId: "lobby",
        userId: "alice",
        content: "",
        createdAt,
        kind: "voice",
        audioUrl: "/attachments/voice/p/l/99.webm",
        audioMimeType: "audio/webm",
        audioSizeBytes: 1234,
        durationMs: 4200,
        transcription: null,
        transcriptionStatus: "pending",
      },
    ];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: initial }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { store, stop } = createFluxyRoomSession({
      roomId: "lobby",
      client,
      replay: "connect",
    });

    // Wait for the initial REST history to land
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().messages[0]?.transcriptionStatus).toBe("pending");
    expect(store.getState().messages[0]?.transcription).toBeNull();

    // The session should have called connectRoom exactly once
    expect(connectRoomSpy).toHaveBeenCalledTimes(1);

    // Feed the message_updated event through the captured listener
    const event: FluxyChatEvent = {
      type: "message_updated",
      id: 99,
      roomId: "lobby",
      kind: "voice",
      transcription: "hello from the transcription",
      transcriptionStatus: "done",
      transcriptionModel: "whisper-1",
    };
    for (const listener of fake.listeners) listener(event);

    const patched = store.getState().messages[0];
    expect(patched?.transcription).toBe("hello from the transcription");
    expect(patched?.transcriptionStatus).toBe("done");
    expect(patched?.audioUrl).toBe("/attachments/voice/p/l/99.webm");
    expect(patched?.durationMs).toBe(4200);

    stop();
  });

  it("records transcriptionStatus=failed without overwriting other voice fields", async () => {
    const baseUrl = "http://127.0.0.1:8787";
    const client = new FluxyChatClient({ baseUrl, userId: "alice", token: "jwt_abc" });
    const fake = makeFakeConnection();
    vi.spyOn(client, "connectRoom").mockReturnValue(
      fake as unknown as FluxyChatRoomConnection,
    );

    const createdAt = "2026-06-05T10:00:00.000Z";
    const initial: FluxyChatMessage[] = [
      {
        id: 7,
        roomId: "lobby",
        userId: "alice",
        content: "",
        createdAt,
        kind: "voice",
        audioUrl: "/attachments/voice/p/l/7.webm",
        audioMimeType: "audio/webm",
        audioSizeBytes: 500,
        durationMs: 1500,
        transcription: null,
        transcriptionStatus: "pending",
      },
    ];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: initial }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { store, stop } = createFluxyRoomSession({
      roomId: "lobby",
      client,
      replay: "connect",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (const listener of fake.listeners) {
      listener({
        type: "message_updated",
        id: 7,
        roomId: "lobby",
        kind: "voice",
        transcription: null,
        transcriptionStatus: "failed",
      });
    }

    const patched = store.getState().messages[0];
    expect(patched?.transcriptionStatus).toBe("failed");
    expect(patched?.transcription).toBeNull();
    expect(patched?.audioUrl).toBe("/attachments/voice/p/l/7.webm");
    expect(patched?.durationMs).toBe(1500);

    stop();
  });

  it("ignores message_updated for unknown ids (no spurious messages)", async () => {
    const baseUrl = "http://127.0.0.1:8787";
    const client = new FluxyChatClient({ baseUrl, userId: "alice", token: "jwt_abc" });
    const fake = makeFakeConnection();
    vi.spyOn(client, "connectRoom").mockReturnValue(
      fake as unknown as FluxyChatRoomConnection,
    );

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { store, stop } = createFluxyRoomSession({
      roomId: "lobby",
      client,
      replay: "connect",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const before = store.getState().messages.length;
    for (const listener of fake.listeners) {
      listener({
        type: "message_updated",
        id: 9999,
        roomId: "lobby",
        kind: "voice",
        transcription: "spurious",
        transcriptionStatus: "done",
      });
    }
    expect(store.getState().messages.length).toBe(before);

    stop();
  });
});
