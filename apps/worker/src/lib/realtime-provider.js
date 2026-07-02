/**
 * P23-9b: Provider-agnostic Realtime
 * Adapted from Vercel Chat SDK's realtime provider abstraction.
 *
 * AI Gateway normalizes OpenAI/Google/xAI realtime APIs.
 *
 * Usage:
 *   const realtime = createRealtimeProvider({
 *     provider: 'openai',
 *     apiKey: process.env.OPENAI_API_KEY,
 *     model: 'gpt-4o-realtime-preview',
 *   });
 *
 *   await realtime.connect();
 *   const response = await realtime.sendAudio(audioChunk);
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {'openai' | 'google' | 'xai'} RealtimeProvider
 */

/**
 * @typedef {Object} RealtimeConfig
 * @property {RealtimeProvider} provider - AI provider
 * @property {string} apiKey - API key
 * @property {string} [model] - Model name
 * @property {string} [baseURL] - Custom base URL
 * @property {Object} [headers] - Additional headers
 * @property {Object} [params] - Additional parameters
 */

/**
 * @typedef {Object} RealtimeSession
 * @property {string} id - Session ID
 * @property {RealtimeProvider} provider
 * @property {string} model
 * @property {'connected' | 'disconnected' | 'error'} status
 */

/**
 * @typedef {Object} RealtimeAudioChunk
 * @property {Uint8Array} data - Audio data
 * @property {string} [format] - Audio format (pcm16, g.711_ulaw, etc.)
 * @property {number} [sampleRate] - Sample rate
 */

/**
 * @typedef {Object} RealtimeTranscript
 * @property {string} text - Transcript text
 * @property {boolean} isFinal - Whether transcript is final
 * @property {string} [speaker] - Speaker identifier
 */

// =============================================================================
// Provider-agnostic Realtime
// =============================================================================

/**
 * Create a provider-agnostic realtime client.
 * @param {RealtimeConfig} config
 */
export function createRealtimeProvider(config) {
  const { provider, apiKey, model, baseURL, headers = {}, params = {} } = config;

  let ws = null;
  let sessionId = null;
  let status = "disconnected";
  /** @type {Map<string, Function>} */
  const eventHandlers = new Map();

  /**
   * Get the WebSocket URL for the provider.
   * @returns {string}
   */
  function getWebSocketUrl() {
    switch (provider) {
      case "openai":
        return baseURL || "wss://api.openai.com/v1/realtime";
      case "google":
        return baseURL || "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
      case "xai":
        return baseURL || "wss://api.x.ai/v1/realtime";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get headers for the provider.
   * @returns {Object}
   */
  function getHeaders() {
    const baseHeaders = {
      ...headers,
    };

    switch (provider) {
      case "openai":
        baseHeaders["Authorization"] = `Bearer ${apiKey}`;
        baseHeaders["OpenAI-Beta"] = "realtime=v1";
        break;
      case "google":
        // Google uses query parameter for API key
        break;
      case "xai":
        baseHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;
    }

    return baseHeaders;
  }

  /**
   * Get query parameters for the provider.
   * @returns {string}
   */
  function getQueryParams() {
    const params = new URLSearchParams();

    switch (provider) {
      case "openai":
        params.set("model", model || "gpt-4o-realtime-preview");
        break;
      case "google":
        params.set("key", apiKey);
        params.set("model", model || "gemini-2.0-flash-live-001");
        break;
      case "xai":
        params.set("model", model || "grok-2-realtime");
        break;
    }

    return params.toString();
  }

  /**
   * Handle incoming WebSocket messages.
   * @param {MessageEvent} event
   */
  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.type || data.event;

      // Emit event to handlers
      const handler = eventHandlers.get(eventType);
      if (handler) {
        handler(data);
      }

      // Emit to wildcard handler
      const wildcardHandler = eventHandlers.get("*");
      if (wildcardHandler) {
        wildcardHandler(data);
      }
    } catch (error) {
      console.error("Failed to parse realtime message:", error);
    }
  }

  /**
   * Handle WebSocket errors.
   * @param {Event} event
   */
  function handleError(event) {
    status = "error";
    const handler = eventHandlers.get("error");
    if (handler) {
      handler({ error: "WebSocket error" });
    }
  }

  /**
   * Handle WebSocket close.
   * @param {CloseEvent} event
   */
  function handleClose(event) {
    status = "disconnected";
    ws = null;
    const handler = eventHandlers.get("disconnect");
    if (handler) {
      handler({ code: event.code, reason: event.reason });
    }
  }

  return {
    /**
     * Connect to the realtime service.
     * @returns {Promise<RealtimeSession>}
     */
    async connect() {
      const url = getWebSocketUrl();
      const queryParams = getQueryParams();
      const fullUrl = queryParams ? `${url}?${queryParams}` : url;

      ws = new WebSocket(fullUrl);

      // Set up event handlers
      ws.onmessage = handleMessage;
      ws.onerror = handleError;
      ws.onclose = handleClose;

      // Wait for connection
      await new Promise((resolve, reject) => {
        if (!ws) {
          reject(new Error("Failed to create WebSocket"));
          return;
        }

        ws.onopen = () => {
          sessionId = crypto.randomUUID();
          status = "connected";

          // Send session configuration
          this.send({
            type: "session.update",
            session: {
              model: model || getDefaultModel(provider),
              ...params,
            },
          });

          resolve();
        };

        ws.onerror = (error) => {
          reject(error);
        };
      });

      return {
        id: sessionId,
        provider,
        model: model || getDefaultModel(provider),
        status,
      };
    },

    /**
     * Disconnect from the realtime service.
     */
    disconnect() {
      if (ws) {
        ws.close();
        ws = null;
      }
      status = "disconnected";
      sessionId = null;
    },

    /**
     * Send data to the realtime service.
     * @param {Object} data
     */
    send(data) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected");
      }
      ws.send(JSON.stringify(data));
    },

    /**
     * Send audio chunk to the realtime service.
     * @param {RealtimeAudioChunk} chunk
     */
    sendAudio(chunk) {
      const audioData = typeof chunk.data === "string" 
        ? btoa(chunk.data)
        : btoa(String.fromCharCode(...chunk.data));

      this.send({
        type: "input_audio_buffer.append",
        audio: audioData,
      });
    },

    /**
     * Send text input to the realtime service.
     * @param {string} text
     */
    sendText(text) {
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });

      this.send({ type: "response.create" });
    },

    /**
     * Create a response (trigger LLM generation).
     * @param {Object} [instructions]
     */
    createResponse(instructions) {
      this.send({
        type: "response.create",
        response: instructions ? { instructions } : undefined,
      });
    },

    /**
     * Cancel current response.
     */
    cancelResponse() {
      this.send({ type: "response.cancel" });
    },

    /**
     * Clear audio input buffer.
     */
    clearAudioBuffer() {
      this.send({ type: "input_audio_buffer.clear" });
    },

    /**
     * Register an event handler.
     * @param {string} event - Event name ('*', 'audio', 'transcript', 'error', etc.)
     * @param {Function} handler
     */
    on(event, handler) {
      eventHandlers.set(event, handler);
    },

    /**
     * Unregister an event handler.
     * @param {string} event
     */
    off(event) {
      eventHandlers.delete(event);
    },

    /**
     * Get current session status.
     * @returns {{ status: string, sessionId: string | null, provider: string, model: string }}
     */
    getStatus() {
      return {
        status,
        sessionId,
        provider,
        model: model || getDefaultModel(provider),
      };
    },

    /**
     * Check if connected.
     * @returns {boolean}
     */
    isConnected() {
      return status === "connected" && ws?.readyState === WebSocket.OPEN;
    },
  };
}

// =============================================================================
// Provider Defaults
// =============================================================================

/**
 * Get default model for a provider.
 * @param {RealtimeProvider} provider
 * @returns {string}
 */
function getDefaultModel(provider) {
  switch (provider) {
    case "openai":
      return "gpt-4o-realtime-preview";
    case "google":
      return "gemini-2.0-flash-live-001";
    case "xai":
      return "grok-2-realtime";
    default:
      return "unknown";
  }
}

/**
 * Get supported audio formats for a provider.
 * @param {RealtimeProvider} provider
 * @returns {string[]}
 */
export function getSupportedAudioFormats(provider) {
  switch (provider) {
    case "openai":
      return ["pcm16", "g.711_ulaw", "g.711_alaw"];
    case "google":
      return ["pcm16"];
    case "xai":
      return ["pcm16", "g.711_ulaw"];
    default:
      return ["pcm16"];
  }
}

/**
 * Check if a provider supports a feature.
 * @param {RealtimeProvider} provider
 * @param {string} feature
 * @returns {boolean}
 */
export function supportsFeature(provider, feature) {
  const features = {
    openai: ["audio", "text", "function_calling", "vad", "transcription"],
    google: ["audio", "text", "function_calling", "vad"],
    xai: ["audio", "text", "function_calling", "vad"],
  };

  return features[provider]?.includes(feature) ?? false;
}
