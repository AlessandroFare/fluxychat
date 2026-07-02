/**
 * P24-13: Tool Call Annotations — Worker Implementation
 */

/**
 * Create a tool call annotation store.
 */
export function createToolCallAnnotationStore() {
  const annotations = new Map(); // toolCallId -> ToolCallAnnotation[]

  return {
    add(toolCallId, annotation) {
      const existing = annotations.get(toolCallId) || [];
      existing.push({
        ...annotation,
        toolCallId,
        timestamp: Date.now(),
      });
      annotations.set(toolCallId, existing);
    },

    get(toolCallId) {
      return annotations.get(toolCallId) || [];
    },

    getLatest(toolCallId) {
      const list = annotations.get(toolCallId) || [];
      return list.length > 0 ? list[list.length - 1] : null;
    },

    clear(toolCallId) {
      annotations.delete(toolCallId);
    },

    clearAll() {
      annotations.clear();
    },
  };
}

/**
 * Create a status annotation.
 * @param {string} toolCallId
 * @param {string} status
 */
export function createStatusAnnotation(toolCallId, status) {
  return { type: "status", content: status, visible: true, timestamp: Date.now() };
}

/**
 * Create a progress annotation.
 * @param {string} toolCallId
 * @param {number} progress
 * @param {string} [message]
 */
export function createProgressAnnotation(toolCallId, progress, message) {
  return { type: "progress", content: message || `${progress}%`, progress, visible: true, timestamp: Date.now() };
}

/**
 * Create a result annotation.
 * @param {string} toolCallId
 * @param {string} summary
 */
export function createResultAnnotation(toolCallId, summary) {
  return { type: "result", content: summary, visible: true, timestamp: Date.now() };
}

/**
 * Create an error annotation.
 * @param {string} toolCallId
 * @param {string} error
 */
export function createErrorAnnotation(toolCallId, error) {
  return { type: "error", content: error, visible: true, timestamp: Date.now() };
}
