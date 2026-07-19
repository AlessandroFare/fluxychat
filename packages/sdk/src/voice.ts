export type VoiceStatus = "idle" | "connecting" | "connected" | "speaking" | "listening" | "disconnected";

export type VoiceInterruptionMode = "none" | "manual" | "semantic" | "barge-in";

export interface VoiceInterruptionConfig {
  mode: VoiceInterruptionMode;
  sensitivity?: number;
  minUtteranceLengthMs?: number;
  debounceMs?: number;
}

export interface VoiceConfig {
  provider?: "openai" | "deepgram" | "elevenlabs" | "google";
  apiKey?: string;
  model?: string;
  voiceId?: string;
  language?: string;
  sampleRate?: number;
  enableToolCalls?: boolean;
  noiseReduction?: boolean;
  interruption?: VoiceInterruptionConfig;
}

export interface VoiceChunk {
  type: "audio" | "transcript" | "tool_call" | "tool_result" | "error" | "interruption" | "media" | "status";
  audio?: ArrayBuffer;
  transcript?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
  mediaUrl?: string;
  mediaType?: string;
  status?: VoiceStatus;
}

export interface VoiceSession {
  id: string;
  status: VoiceStatus;
  config: VoiceConfig;
  start(): Promise<void>;
  stop(): Promise<void>;
  interrupt(reason?: string): Promise<void>;
  sendAudio(audio: ArrayBuffer): Promise<void>;
  sendText(text: string): Promise<void>;
  sendMedia(blob: Blob, options?: { type?: string; caption?: string }): Promise<void>;
  generateMedia(prompt: string, options?: { type?: "image" | "video" | "audio"; size?: string }): Promise<string>;
  onChunk(callback: (chunk: VoiceChunk) => void): void;
  getStatus(): VoiceStatus;
}

export interface VoiceManager {
  createSession(config?: VoiceConfig): Promise<VoiceSession>;
  getSession(id: string): VoiceSession | null;
  listSessions(): VoiceSession[];
  stopSession(id: string): Promise<void>;
  stopAll(): Promise<void>;
  interruptAll(reason?: string): Promise<void>;
}

export interface VoiceTransport {
  connect(sessionId: string, config: VoiceConfig, emit: (chunk: VoiceChunk) => void): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  sendAudio(sessionId: string, audio: ArrayBuffer): Promise<void>;
  sendText(sessionId: string, text: string): Promise<void>;
  interrupt?(sessionId: string, reason?: string): Promise<void>;
  sendMedia?(sessionId: string, blob: Blob, options?: { type?: string; caption?: string }): Promise<void>;
  generateMedia?(sessionId: string, prompt: string, options?: { type?: "image" | "video" | "audio"; size?: string }): Promise<string>;
}

export interface VoiceManagerOptions {
  transport: VoiceTransport;
  createId?: () => string;
}

export function createVoiceManager(options: VoiceManagerOptions): VoiceManager {
  const sessions = new Map<string, VoiceSession>();
  const createId = options.createId ?? (() => globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  function buildInterrupt(sessionId: string, config: VoiceConfig): (reason?: string) => Promise<void> {
    const mode = config.interruption?.mode ?? "none";
    if (mode === "none" || !options.transport.interrupt) {
      return async () => {};
    }
    return async (reason?: string) => {
      await options.transport.interrupt!(sessionId, reason);
    };
  }

  return {
    async createSession(config = {}) {
      const id = createId();
      let status: VoiceStatus = "idle";
      const listeners = new Set<(chunk: VoiceChunk) => void>();
      const emit = (chunk: VoiceChunk) => {
        if (chunk.type === "audio") status = "speaking";
        else if (chunk.type === "transcript") status = "listening";
        else if (chunk.type === "interruption") { status = "listening"; }
        else if (chunk.type === "error") status = "disconnected";
        for (const listener of listeners) listener(chunk);
      };
      const session: VoiceSession = {
        id,
        get status() { return status; },
        config: { sampleRate: 24_000, enableToolCalls: true, noiseReduction: true, ...config },
        async start() {
          if (status !== "idle" && status !== "disconnected") return;
          status = "connecting";
          emit({ type: "status", status });
          try {
            await options.transport.connect(id, session.config, emit);
            status = "connected";
            emit({ type: "status", status });
          } catch (error) {
            status = "disconnected";
            emit({ type: "error", error: error instanceof Error ? error.message : String(error) });
            throw error;
          }
        },
        async stop() {
          if (status === "disconnected") return;
          await options.transport.disconnect(id);
          status = "disconnected";
          emit({ type: "status", status });
        },
        interrupt: buildInterrupt(id, config),
        async sendAudio(audio) {
          if (!["connected", "listening", "speaking"].includes(status)) throw new Error("Voice session is not connected.");
          await options.transport.sendAudio(id, audio);
          status = "listening";
        },
        async sendText(text) {
          if (!text.trim()) throw new TypeError("Voice text cannot be empty.");
          if (!["connected", "listening", "speaking"].includes(status)) throw new Error("Voice session is not connected.");
          await options.transport.sendText(id, text);
        },
        async sendMedia(blob, opts) {
          if (!options.transport.sendMedia) throw new Error("Media upload not supported by transport.");
          await options.transport.sendMedia(id, blob, opts);
        },
        async generateMedia(prompt, opts) {
          if (!options.transport.generateMedia) throw new Error("Media generation not supported by transport.");
          return options.transport.generateMedia(id, prompt, opts);
        },
        onChunk(callback) { listeners.add(callback); },
        getStatus: () => status,
      };
      sessions.set(id, session);
      return session;
    },
    getSession: (id) => sessions.get(id) ?? null,
    listSessions: () => [...sessions.values()],
    async stopSession(id) {
      const session = sessions.get(id);
      if (!session) return;
      await session.stop();
      sessions.delete(id);
    },
    async stopAll() {
      await Promise.all([...sessions.values()].map((session) => session.stop()));
      sessions.clear();
    },
    async interruptAll(reason) {
      await Promise.all([...sessions.values()].map((s) => s.interrupt(reason)));
    },
  };
}

export function audioToBase64(audio: ArrayBuffer): string {
  const bytes = new Uint8Array(audio);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  if (typeof btoa === "function") return btoa(binary);
  const NodeBuffer = (globalThis as { Buffer?: { from(value: Uint8Array): { toString(encoding: string): string } } }).Buffer;
  if (NodeBuffer) return NodeBuffer.from(bytes).toString("base64");
  throw new Error("Base64 encoding is unavailable in this runtime.");
}

export function base64ToAudio(base64: string): ArrayBuffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) throw new TypeError("Invalid base64 audio payload.");
  let bytes: Uint8Array;
  if (typeof atob === "function") {
    const binary = atob(base64);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } else {
    const NodeBuffer = (globalThis as { Buffer?: { from(value: string, encoding: string): Uint8Array } }).Buffer;
    if (!NodeBuffer) throw new Error("Base64 decoding is unavailable in this runtime.");
    bytes = Uint8Array.from(NodeBuffer.from(base64, "base64"));
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
