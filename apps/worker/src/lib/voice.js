/**
 * P23-9: Bidirectional Realtime Voice — Worker Implementation
 * Real-time voice conversations with tool calling.
 */

/**
 * Create a voice manager.
 */
export function createVoiceManager() {
  const sessions = new Map();

  return {
    async createSession(config = {}) {
      const id = crypto.randomUUID();
      const session = {
        id,
        status: "idle",
        config: {
          provider: config.provider || "openai",
          apiKey: config.apiKey,
          model: config.model || "gpt-4o-realtime-preview",
          voiceId: config.voiceId || "alloy",
          language: config.language || "en",
          sampleRate: config.sampleRate || 24000,
          enableToolCalls: config.enableToolCalls ?? true,
          noiseReduction: config.noiseReduction ?? true,
        },
        _callbacks: [],
        _audioQueue: [],
        _transcript: [],

        async start() {
          this.status = "connecting";
          // In production, establish WebSocket connection to voice provider
          // For now, simulate connection
          await new Promise((r) => setTimeout(r, 100));
          this.status = "connected";
        },

        async stop() {
          this.status = "disconnected";
          this._callbacks = [];
          this._audioQueue = [];
        },

        async sendAudio(audio) {
          if (this.status !== "connected" && this.status !== "listening") {
            throw new Error("Session not connected");
          }
          // In production, send audio to STT provider
          // Simulate transcription
          const chunk = {
            type: "transcript",
            transcript: "[audio received]",
          };
          this._callbacks.forEach((cb) => cb(chunk));
        },

        async sendText(text) {
          if (this.status !== "connected") {
            throw new Error("Session not connected");
          }
          const chunk = {
            type: "transcript",
            transcript: text,
          };
          this._callbacks.forEach((cb) => cb(chunk));
        },

        onChunk(callback) {
          this._callbacks.push(callback);
        },

        getStatus() {
          return this.status;
        },
      };

      sessions.set(id, session);
      return session;
    },

    getSession(id) {
      return sessions.get(id) || null;
    },

    listSessions() {
      return [...sessions.values()];
    },

    async stopSession(id) {
      const session = sessions.get(id);
      if (session) {
        await session.stop();
        sessions.delete(id);
      }
    },

    async stopAll() {
      for (const [, session] of sessions) {
        await session.stop();
      }
      sessions.clear();
    },
  };
}

/**
 * Convert audio ArrayBuffer to base64.
 * @param {ArrayBuffer} audio
 */
export function audioToBase64(audio) {
  const bytes = new Uint8Array(audio);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to audio ArrayBuffer.
 * @param {string} base64
 */
export function base64ToAudio(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
