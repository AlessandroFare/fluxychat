/**
 * P24-2: Multi-step Loop Control — Worker Implementation
 * Configurable stop conditions for agent loops.
 */

/**
 * Create a loop controller with configurable stop conditions.
 * @param {Object} config
 */
export function createLoopController(config = {}) {
  const {
    maxSteps = 10,
    stopWhenStepCount,
    stopWhenToolCalled = [],
    stopWhenAllToolsCalled = [],
    stopWhen,
    maxTotalTokens,
    maxTimeMs,
  } = config;

  let stepCount = 0;

  return {
    shouldContinue(context) {
      const effectiveStep = context.step ?? stepCount;

      // Check max steps
      if (effectiveStep >= maxSteps) return false;

      // Check specific step count
      if (stopWhenStepCount && effectiveStep >= stopWhenStepCount) return false;

      // Check max total tokens
      if (maxTotalTokens && context.totalTokens) {
        const total = context.totalTokens.input + context.totalTokens.output;
        if (total >= maxTotalTokens) return false;
      }

      // Check max time
      if (maxTimeMs && context.startTime) {
        if (Date.now() - context.startTime >= maxTimeMs) return false;
      }

      // Check stop-when tool called
      if (stopWhenToolCalled.length && context.toolCalls?.length) {
        const calledNames = new Set(context.toolCalls.map((tc) => tc.name));
        if (stopWhenToolCalled.some((name) => calledNames.has(name))) return false;
      }

      // Check stop-when all tools called
      if (stopWhenAllToolsCalled.length && context.toolCalls?.length) {
        const calledNames = new Set(context.toolCalls.map((tc) => tc.name));
        if (stopWhenAllToolsCalled.every((name) => calledNames.has(name))) return false;
      }

      // Check custom stop condition
      if (stopWhen) return !stopWhen(context);

      return true;
    },

    getStopReason(context) {
      const effectiveStep = context.step ?? stepCount;

      if (effectiveStep >= maxSteps) return "max_steps_reached";
      if (stopWhenStepCount && effectiveStep >= stopWhenStepCount) return "step_count_reached";
      if (maxTotalTokens && context.totalTokens) {
        const total = context.totalTokens.input + context.totalTokens.output;
        if (total >= maxTotalTokens) return "token_limit_reached";
      }
      if (maxTimeMs && context.startTime) {
        if (Date.now() - context.startTime >= maxTimeMs) return "time_limit_reached";
      }
      if (stopWhenToolCalled.length && context.toolCalls?.length) {
        const calledNames = new Set(context.toolCalls.map((tc) => tc.name));
        const stopped = stopWhenToolCalled.find((name) => calledNames.has(name));
        if (stopped) return `tool_called:${stopped}`;
      }
      if (stopWhenAllToolsCalled.length && context.toolCalls?.length) {
        const calledNames = new Set(context.toolCalls.map((tc) => tc.name));
        if (stopWhenAllToolsCalled.every((name) => calledNames.has(name))) return "all_required_tools_called";
      }
      if (stopWhen && stopWhen(context)) return "custom_condition_met";
      return "unknown";
    },

    getStepCount() {
      return stepCount;
    },

    nextStep() {
      stepCount++;
    },
  };
}

/**
 * Preset loop control configurations.
 */
export const LOOP_PRESETS = {
  singleStep: {
    maxSteps: 1,
  },
  standard: {
    maxSteps: 10,
    stopWhenToolCalled: ["deleteMessage"],
    maxTimeMs: 120_000, // 2 minutes
  },
  deepResearch: {
    maxSteps: 25,
    stopWhenAllToolsCalled: ["fetchMessages", "fetchThread"],
    maxTimeMs: 300_000, // 5 minutes
  },
  autonomous: {
    maxSteps: 50,
    maxTimeMs: 600_000, // 10 minutes
    maxTotalTokens: 100_000,
  },
};
