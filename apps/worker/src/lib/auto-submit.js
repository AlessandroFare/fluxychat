/**
 * P25-10: sendAutomaticallyWhen
 * Adapted from Vercel Chat SDK's sendAutomaticallyWhen.
 *
 * Auto-submit when all tool results available.
 *
 * Usage:
 *   const autoSubmit = createAutoSubmit({
 *     condition: (state) => state.toolResults.length >= state.requiredTools.length,
 *     delay: 1000,
 *   });
 *
 *   // In message handler
 *   autoSubmit.check(state, () => submitMessage(state));
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} AutoSubmitState
 * @property {any[]} toolResults - Available tool results
 * @property {string[]} requiredTools - Required tool names
 * @property {boolean} userInteracting - Whether user is currently interacting
 * @property {number} lastUpdateTime - Last update timestamp
 */

/**
 * @typedef {Object} AutoSubmitConfig
 * @property {(state: AutoSubmitState) => boolean} condition - When to auto-submit
 * @property {number} [delay] - Delay before auto-submit in ms (default: 500)
 * @property {number} [maxWait] - Maximum time to wait in ms (default: 10000)
 * @property {boolean} [enabled] - Whether auto-submit is enabled (default: true)
 */

// =============================================================================
// Auto-Submit Implementation
// =============================================================================

/**
 * Create an auto-submit controller.
 * @param {AutoSubmitConfig} config
 */
export function createAutoSubmit(config) {
  const {
    condition,
    delay = 500,
    maxWait = 10000,
    enabled = true,
  } = config;

  let timer = null;
  let startTime = 0;

  return {
    /**
     * Check if auto-submit should trigger.
     * @param {AutoSubmitState} state
     * @param {() => void} onSubmit - Callback to submit
     * @returns {boolean} Whether auto-submit was triggered
     */
    check(state, onSubmit) {
      if (!enabled) return false;

      // Clear existing timer
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      // Check if condition is met
      if (!condition(state)) {
        startTime = Date.now();
        return false;
      }

      // Check max wait time
      if (startTime > 0 && Date.now() - startTime > maxWait) {
        return false;
      }

      // Schedule auto-submit
      timer = setTimeout(() => {
        onSubmit();
        timer = null;
      }, delay);

      return true;
    },

    /**
     * Cancel pending auto-submit.
     */
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },

    /**
     * Check if auto-submit is pending.
     * @returns {boolean}
     */
    isPending() {
      return timer !== null;
    },

    /**
     * Enable or disable auto-submit.
     * @param {boolean} value
     */
    setEnabled(value) {
      if (!value) {
        this.cancel();
      }
    },
  };
}

/**
 * Create a condition that triggers when all required tools have results.
 * @param {string[]} toolNames - Required tool names
 * @returns {(state: AutoSubmitState) => boolean}
 */
export function whenAllToolsComplete(toolNames) {
  return (state) => {
    return toolNames.every((name) =>
      state.toolResults.some((r) => r.toolName === name)
    );
  };
}

/**
 * Create a condition that triggers when any tool has a result.
 * @param {string[]} toolNames - Tool names to check
 * @returns {(state: AutoSubmitState) => boolean}
 */
export function whenAnyToolComplete(toolNames) {
  return (state) => {
    return toolNames.some((name) =>
      state.toolResults.some((r) => r.toolName === name)
    );
  };
}

/**
 * Create a condition that triggers after a timeout.
 * @param {number} timeoutMs - Timeout in ms
 * @returns {(state: AutoSubmitState) => boolean}
 */
export function whenTimeout(timeoutMs) {
  let startTime = Date.now();

  return (state) => {
    if (state.lastUpdateTime > startTime) {
      startTime = state.lastUpdateTime;
    }
    return Date.now() - startTime >= timeoutMs;
  };
}

/**
 * Create a condition that triggers when user is not interacting.
 * @returns {(state: AutoSubmitState) => boolean}
 */
export function whenUserIdle() {
  return (state) => !state.userInteracting;
}

/**
 * Combine multiple conditions with AND logic.
 * @param {Array<(state: AutoSubmitState) => boolean>} conditions
 * @returns {(state: AutoSubmitState) => boolean}
 */
export function andConditions(...conditions) {
  return (state) => conditions.every((c) => c(state));
}

/**
 * Combine multiple conditions with OR logic.
 * @param {Array<(state: AutoSubmitState) => boolean>} conditions
 * @returns {(state: AutoSubmitState) => boolean}
 */
export function orConditions(...conditions) {
  return (state) => conditions.some((c) => c(state));
}
