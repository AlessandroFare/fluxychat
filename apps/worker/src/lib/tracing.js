/**
 * P25-15: Tracing Channel (Worker-compatible)
 * 
 * Provides a structured tracing mechanism for observability and telemetry.
 * Since Cloudflare Workers don't support `node:diagnostics_channel`, we implement
 * a custom Event-based tracing system that mimics the diagnostics channel behavior.
 * 
 * Usage:
 *   import { tracing } from '@fluxy-chat/worker/lib/tracing';
 * 
 *   // Producer
 *   tracing.publish('ai.tool.start', { toolName: 'weather', callId: '123' });
 * 
 *   // Consumer (Telemetry/Logger)
 *   tracing.subscribe('ai.tool.start', (data) => {
 *     console.log(`Tool started: ${data.toolName}`);
 *   });
 */

// =============================================================================
// Tracing Types
// =============================================================================

/**
 * @typedef {string} TraceChannel
 */

/**
 * @typedef {Object} TraceEvent
 * @property {string} channel - The tracing channel name
 * @property {any} data - The event payload
 * @property {number} timestamp - Unix ms timestamp
 * @property {string} [traceId] - Correlation ID for the request
 * @property {string} [spanId] - Span ID for the specific operation
 */

/**
 * @callback TraceHandler
 * @param {TraceEvent} event
 */

// =============================================================================
// Tracing Implementation
// =============================================================================

class TracingChannel {
  constructor() {
    /** @type {Map<string, Set<TraceHandler>>} */
    this.handlers = new Map();
    /** @type {string | null} */
    this.currentTraceId = null;
  }

  /**
   * Set the active trace ID for the current execution context.
   * @param {string} traceId 
   */
  setTraceId(traceId) {
    this.currentTraceId = traceId;
  }

  /**
   * Subscribe to events on a specific channel.
   * @param {TraceChannel} channel 
   * @param {TraceHandler} handler 
   */
  subscribe(channel, handler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel).add(handler);
    
    // Return unsubscribe function
    return () => {
      const set = this.handlers.get(channel);
      if (set) {
        set.delete(handler);
        if (set.size === 0) this.handlers.delete(channel);
      }
    };
  }

  /**
   * Publish an event to a channel.
   * @param {TraceChannel} channel 
   * @param {any} data 
   */
  publish(channel, data) {
    const event = {
      channel,
      data,
      timestamp: Date.now(),
      traceId: this.currentTraceId,
    };

    const handlers = this.handlers.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[Tracing] Error in handler for channel ${channel}:`, err);
        }
      }
    }
  }

  /**
   * Clear all trace IDs and handlers.
   */
  clear() {
    this.currentTraceId = null;
    this.handlers.clear();
  }
}

// Export as a singleton for the worker
export const tracing = new TracingChannel();
