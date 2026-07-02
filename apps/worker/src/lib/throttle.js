/**
 * P25-1: experimental_throttle
 * Adapted from Vercel Chat SDK's experimental_throttle.
 *
 * Configurable UI render throttle for streaming (reduce re-renders).
 *
 * Usage:
 *   const throttledRender = createThrottledRender({
 *     delay: 100,
 *     maxWait: 500,
 *   });
 *
 *   // In streaming loop
 *   for await (const chunk of stream) {
 *     throttledRender(() => updateUI(chunk));
 *   }
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} ThrottleOptions
 * @property {number} [delay] - Minimum time between calls in ms (default: 100)
 * @property {number} [maxWait] - Maximum time to wait before forcing call in ms (default: 500)
 * @property {boolean} [trailing] - Whether to call on trailing edge (default: true)
 * @property {boolean} [leading] - Whether to call on leading edge (default: true)
 */

// =============================================================================
// Throttle Implementation
// =============================================================================

/**
 * Create a throttled function.
 * @template T
 * @param {T} fn - Function to throttle
 * @param {ThrottleOptions} [options] - Throttle options
 * @returns {T & { cancel: () => void, flush: () => void }}
 */
export function throttle(fn, options = {}) {
  const { delay = 100, maxWait = 500, trailing = true, leading = true } = options;

  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let timerId = null;
  let lastArgs = null;
  let lastThis = null;
  let result;

  function invoke(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = lastThis = null;
    lastInvokeTime = time;
    result = fn.apply(thisArg, args);
    return result;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait && timeSinceLastInvoke >= maxWait)
    );
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = delay - timeSinceLastCall;

    return maxWait ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
  }

  function trailingEdge(time) {
    lastArgs = lastThis = null;
    if (!trailing) return;
    return invoke(time);
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;

    if (isInvoking && timerId === null && leading) {
      return invoke(time);
    }

    if (timerId === null && maxWait) {
      timerId = setTimeout(timerExpired, delay);
    }

    if (trailing) {
      return result;
    }
    return invoke(time);
  }

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    lastCallTime = lastInvokeTime = 0;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timerId !== null) {
      debounced.cancel();
      return invoke(Date.now());
    }
    return result;
  };

  return debounced;
}

/**
 * Create a throttled render function for streaming UI.
 * @param {ThrottleOptions} [options] - Throttle options
 * @returns {{ update: (fn: () => void) => void, cancel: () => void, flush: () => void }}
 */
export function createThrottledRender(options = {}) {
  const throttledFn = throttle(() => {}, {
    delay: options.delay ?? 100,
    maxWait: options.maxWait ?? 500,
    trailing: options.trailing ?? true,
    leading: options.leading ?? true,
  });

  let pendingUpdate = null;

  return {
    /**
     * Schedule a UI update.
     * @param {() => void} fn - Update function
     */
    update(fn) {
      pendingUpdate = fn;
      throttledFn(() => {
        if (pendingUpdate) {
          pendingUpdate();
          pendingUpdate = null;
        }
      });
    },

    /**
     * Cancel pending update.
     */
    cancel() {
      pendingUpdate = null;
      throttledFn.cancel();
    },

    /**
     * Flush pending update immediately.
     */
    flush() {
      if (pendingUpdate) {
        pendingUpdate();
        pendingUpdate = null;
      }
      throttledFn.flush();
    },
  };
}

/**
 * Create a frame-rate aware throttled render.
 * @param {number} [targetFps] - Target frames per second (default: 30)
 * @returns {{ update: (fn: () => void) => void, cancel: () => void, flush: () => void }}
 */
export function createFrameThrottledRender(targetFps = 30) {
  const frameInterval = 1000 / targetFps;
  let lastFrameTime = 0;
  let pendingFrame = null;

  return {
    update(fn) {
      const now = performance.now();
      const timeSinceLastFrame = now - lastFrameTime;

      if (timeSinceLastFrame >= frameInterval) {
        lastFrameTime = now;
        fn();
      } else if (pendingFrame === null) {
        pendingFrame = requestAnimationFrame(() => {
          lastFrameTime = performance.now();
          pendingFrame = null;
          fn();
        });
      }
    },

    cancel() {
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
    },

    flush() {
      this.cancel();
      lastFrameTime = performance.now();
    },
  };
}
