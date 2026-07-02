/**
 * P25-14: DirectChatTransport
 * Call Agent directly from UI code, skipping the traditional webhook/polling flow.
 *
 * Provides a high-performance transport layer for direct client-to-agent communication,
 * ideal for "Chat-as-a-Service" where the UI directly drives the agent execution.
 *
 * Usage:
 *   const transport = new DirectChatTransport({
 *     endpoint: 'https://api.fluxychat.com/v1/direct-chat',
 *     authToken: '...',
 *   });
 *
 *   const stream = await transport.send({
 *     threadId: 'thread_123',
 *     message: 'Hello AI!',
 *     context: { user: 'alefare' }
 *   });
 *
 *   for await (const chunk of stream) {
 *     console.log('Received chunk:', chunk);
 *   }
 */

// =============================================================================
// Direct Chat Transport
// =============================================================================

export class DirectChatTransport {
  /**
   * @param {{ endpoint: string, authToken: string, options?: RequestInit }} config
   */
  constructor(config) {
    this.endpoint = config.endpoint;
    this.authToken = config.authToken;
    this.options = config.options || {};
  }

  /**
   * Send a message directly to the agent.
   * @param {Object} payload
   * @param {string} payload.threadId
   * @param {string} payload.message
   * @param {Record<string, any>} [payload.context]
   * @param {Record<string, any>} [payload.metadata]
   * @returns {Promise<AsyncIterable<any>>} Stream of chunks
   */
  async send(payload) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        ...this.options.headers,
      },
      body: JSON.stringify(payload),
      ...this.options,
    });

    if (!response.ok) {
      throw new Error(`DirectChatTransport request failed with status ${response.status}: ${await response.text()}`);
    }

    return this.createStream(response.body);
  }

  /**
   * Convert response body to an async iterable stream.
   * @param {ReadableStream} body
   * @returns {AsyncIterable<any>}
   */
  async *createStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split by double newline (standard for SSE/chunked JSON)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;
          
          // Basic SSE parsing: "data: { ... }"
          const dataMatch = part.match(/^data:\s*([\s\S]*)$/);
          const jsonString = dataMatch ? dataMatch[1] : part;
          
          try {
            yield JSON.parse(jsonString);
          } catch (e) {
            yield { type: 'error', content: 'Failed to parse chunk', raw: jsonString };
          }
        }
      }

      // Handle trailing buffer
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer);
        } catch (e) {
          yield { type: 'error', content: 'Failed to parse final chunk', raw: buffer };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Send a direct heart-beat to keep the connection alive.
   */
  async heartbeat() {
    return fetch(`${this.endpoint}/heartbeat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });
  }
}

/**
 * Create a DirectChatTransport instance.
 * @param {Object} config
 * @returns {DirectChatTransport}
 */
export function createDirectChatTransport(config) {
  return new DirectChatTransport(config);
}
