/**
 * P23-9: Bidirectional Realtime Voice
 * Real-time voice conversations with tool calling.
 */

export type VoiceStatus = "idle" | "connecting" | "connected" | "speaking" | "listening" | "disconnected";

export interface VoiceConfig {
  /** Voice provider */
  provider?: "openai" | "deepgram" | "elevenlabs" | "google";
  /** API key for the voice provider */
  apiKey?: string;
  /** Voice model */
  model?: string;
  /** Voice ID for TTS */
  voiceId?: string;
  /** Language */
  language?: string;
  /** Sample rate (default: 24000) */
  sampleRate?: number;
  /** Enable tool calling during voice conversations */
  enableToolCalls?: boolean;
  /** Noise reduction */
  noiseReduction?: boolean;
}

export interface VoiceChunk {
  type: "audio" | "transcript" | "tool_call" | "tool_result" | "error";
  audio?: ArrayBuffer;
  transcript?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
}

export interface VoiceSession {
  id: string;
  status: VoiceStatus;
  config: VoiceConfig;
  /** Start the voice session */
  start(): Promise<void>;
  /** Stop the voice session */
  stop(): Promise<void>;
  /** Send audio data to the session */
  sendAudio(audio: ArrayBuffer): Promise<void>;
  /** Send a text message during voice session */
  sendText(text: string): Promise<void>;
  /** Subscribe to voice chunks */
  onChunk(callback: (chunk: VoiceChunk) => void): void;
  /** Get session status */
  getStatus(): VoiceStatus;
}

export interface VoiceManager {
  /** Create a voice session */
  createSession(config?: VoiceConfig): Promise<VoiceSession>;
  /** Get an active session */
  getSession(id: string): VoiceSession | null;
  /** List active sessions */
  listSessions(): VoiceSession[];
  /** Stop a session */
  stopSession(id: string): Promise<void>;
  /** Stop all sessions */
  stopAll(): Promise<void>;
}

export interface VoiceTransport {
  connect(sessionId: string, config: VoiceConfig, emit: (chunk: VoiceChunk) => void): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  sendAudio(sessionId: string, audio: ArrayBuffer): Promise<void>;
  sendText(sessionId: string, text: string): Promise<void>;
}

export interface VoiceManagerOptions {
  transport: VoiceTransport;
  createId?: () => string;
}

export function createVoiceManager(options: VoiceManagerOptions): VoiceManager {
  const sessions = new Map<string, VoiceSession>();
  const createId = options.createId ?? (() => globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  return {
    async createSession(config = {}) {
      const id = createId();
      let status: VoiceStatus = "idle";
      const listeners = new Set<(chunk: VoiceChunk) => void>();
      const emit = (chunk: VoiceChunk) => {
        if (chunk.type === "audio") status = "speaking";
        else if (chunk.type === "transcript") status = "listening";
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
          try {
            await options.transport.connect(id, session.config, emit);
            status = "connected";
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
        },
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
  };
}

/**
 * Convert audio ArrayBuffer to base64.
 */
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

/** Convert base64 to audio ArrayBuffer. */
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
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
