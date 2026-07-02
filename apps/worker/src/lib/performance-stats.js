/**
 * P23-5b: Per-step Performance Stats
 * Adapted from Vercel Chat SDK's telemetry lifecycle callbacks.
 *
 * Tracks model output timing, streaming speed, and tool execution time per step.
 *
 * Usage:
 *   const stats = createPerformanceStats();
 *   stats.startStep('llm_call');
 *   // ... do work ...
 *   stats.endStep('llm_call');
 *   console.log(stats.getSummary());
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} StepStats
 * @property {string} name - Step name
 * @property {number} startTime - Start time in ms
 * @property {number} [endTime] - End time in ms
 * @property {number} [duration] - Duration in ms
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} PerformanceSummary
 * @property {number} totalDuration - Total duration in ms
 * @property {StepStats[]} steps - All steps
 * @property {Object} byStep - Duration by step name
 * @property {number} tokenCount - Total tokens processed
 * @property {number} [tokensPerSecond] - Tokens per second
 */

// =============================================================================
// Performance Stats
// =============================================================================

/**
 * Create a performance stats tracker.
 * @param {{ includeMetadata?: boolean }} [options]
 */
export function createPerformanceStats(options = {}) {
  const { includeMetadata = true } = options;

  /** @type {StepStats[]} */
  const steps = [];
  /** @type {Map<string, StepStats>} */
  const activeSteps = new Map();
  /** @type {number} */
  const overallStartTime = Date.now();
  /** @type {number} */
  let totalTokens = 0;

  return {
    /**
     * Start tracking a step.
     * @param {string} name - Step name
     * @param {Object} [metadata] - Additional metadata
     */
    startStep(name, metadata) {
      const step = {
        name,
        startTime: Date.now(),
        metadata: includeMetadata ? metadata : undefined,
      };
      activeSteps.set(name, step);
    },

    /**
     * End tracking a step.
     * @param {string} name - Step name
     * @param {Object} [metadata] - Additional metadata to merge
     */
    endStep(name, metadata) {
      const step = activeSteps.get(name);
      if (!step) return;

      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      if (metadata && includeMetadata) {
        step.metadata = { ...step.metadata, ...metadata };
      }

      activeSteps.delete(name);
      steps.push(step);
    },

    /**
     * Record token usage.
     * @param {number} tokens - Number of tokens
     */
    recordTokens(tokens) {
      totalTokens += tokens;
    },

    /**
     * Check if a step is currently active.
     * @param {string} name - Step name
     * @returns {boolean}
     */
    hasActiveStep(name) {
      return activeSteps.has(name);
    },

    /**
     * Get duration of a specific step.
     * @param {string} name - Step name
     * @returns {number | null}
     */
    getStepDuration(name) {
      const step = steps.find((s) => s.name === name);
      return step?.duration ?? null;
    },

    /**
     * Get summary of all performance data.
     * @returns {PerformanceSummary}
     */
    getSummary() {
      const totalDuration = Date.now() - overallStartTime;

      // Group by step name
      const byStep = {};
      for (const step of steps) {
        if (!byStep[step.name]) {
          byStep[step.name] = 0;
        }
        byStep[step.name] += step.duration || 0;
      }

      // Calculate tokens per second
      const llmDuration = byStep["llm_call"] || byStep["streaming"] || 0;
      const tokensPerSecond =
        llmDuration > 0 ? (totalTokens / llmDuration) * 1000 : undefined;

      return {
        totalDuration,
        steps: [...steps],
        byStep,
        tokenCount: totalTokens,
        tokensPerSecond,
      };
    },

    /**
     * Get a formatted string summary.
     * @returns {string}
     */
    toString() {
      const summary = this.getSummary();
      const lines = [
        `Performance Summary:`,
        `  Total: ${summary.totalDuration}ms`,
        `  Tokens: ${summary.tokenCount}${summary.tokensPerSecond ? ` (${summary.tokensPerSecond.toFixed(1)} tok/s)` : ""}`,
        `  Steps:`,
      ];

      for (const [name, duration] of Object.entries(summary.byStep)) {
        lines.push(`    ${name}: ${duration}ms`);
      }

      return lines.join("\n");
    },

    /**
     * Reset all stats.
     */
    reset() {
      steps.length = 0;
      activeSteps.clear();
      totalTokens = 0;
    },
  };
}

// =============================================================================
// LLM-specific Performance Tracking
// =============================================================================

/**
 * Create performance stats specialized for LLM operations.
 */
export function createLlmPerformanceStats() {
  const stats = createPerformanceStats();

  return {
    ...stats,

    /**
     * Track LLM call with token counting.
     * @param {() => Promise<T}} fn - Function to execute
     * @param {string} [model] - Model name
     * @returns {Promise<T>}
     */
    async trackLlmCall(fn, model) {
      stats.startStep("llm_call", { model });
      try {
        const result = await fn();
        stats.endStep("llm_call");
        return result;
      } catch (error) {
        stats.endStep("llm_call", { error: error.message });
        throw error;
      }
    },

    /**
     * Track streaming with token counting.
     * @param {AsyncIterable<any>} stream - Stream to track
     * @returns {AsyncIterable<any>}
     */
    trackStreaming(stream) {
      stats.startStep("streaming");
      let tokenCount = 0;

      return {
        async *[Symbol.asyncIterator]() {
          try {
            for await (const chunk of stream) {
              tokenCount++;
              yield chunk;
            }
          } finally {
            stats.recordTokens(tokenCount);
            stats.endStep("streaming", { tokenCount });
          }
        },
      };
    },

    /**
     * Track tool execution.
     * @param {string} toolName - Tool name
     * @param {() => Promise<T}} fn - Function to execute
     * @returns {Promise<T>}
     */
    async trackToolExecution(toolName, fn) {
      stats.startStep(`tool:${toolName}`);
      try {
        const result = await fn();
        stats.endStep(`tool:${toolName}`);
        return result;
      } catch (error) {
        stats.endStep(`tool:${toolName}`, { error: error.message });
        throw error;
      }
    },
  };
}

// =============================================================================
// Global Performance Collector
// =============================================================================

/**
 * Create a global performance collector for aggregating stats across requests.
 */
export function createPerformanceCollector() {
  /** @type {PerformanceSummary[]} */
  const summaries = [];

  return {
    /**
     * Add a performance summary to the collector.
     * @param {PerformanceSummary} summary
     */
    add(summary) {
      summaries.push(summary);
    },

    /**
     * Get aggregated stats.
     * @returns {{ count: number, avgDuration: number, totalTokens: number, byStep: Record<string, number> }}
     */
    getAggregated() {
      if (summaries.length === 0) {
        return { count: 0, avgDuration: 0, totalTokens: 0, byStep: {} };
      }

      const totalDuration = summaries.reduce((sum, s) => sum + s.totalDuration, 0);
      const totalTokens = summaries.reduce((sum, s) => sum + s.tokenCount, 0);

      const byStep = {};
      for (const summary of summaries) {
        for (const [step, duration] of Object.entries(summary.byStep)) {
          byStep[step] = (byStep[step] || 0) + duration;
        }
      }

      return {
        count: summaries.length,
        avgDuration: totalDuration / summaries.length,
        totalTokens,
        byStep,
      };
    },

    /**
     * Reset the collector.
     */
    reset() {
      summaries.length = 0;
    },
  };
}
