/**
 * P22-E2: Stream Chunk Types
 * Structured streaming content for platform-native rich content.
 *
 * StreamChunk types:
 * - markdown_text: Streamed text content
 * - task_update: Tool/step progress cards (pending → in_progress → complete → error)
 * - plan_update: Plan title updates
 *
 * Adapters that don't support structured chunks extract text from
 * markdown_text chunks and ignore other types gracefully.
 */

// =============================================================================
// Chunk Types
// =============================================================================

/**
 * @typedef {Object} MarkdownTextChunk
 * @property {'markdown_text'} type
 * @property {string} text - Text content
 */

/**
 * @typedef {Object} TaskUpdateChunk
 * @property {'task_update'} type
 * @property {string} id - Task ID
 * @property {string} title - Task title
 * @property {'pending'|'in_progress'|'complete'|'error'} status - Task status
 * @property {string} [details] - Additional details
 * @property {string} [output] - Task output
 */

/**
 * @typedef {Object} PlanUpdateChunk
 * @property {'plan_update'} type
 * @property {string} title - Plan title
 */

/**
 * Union of all stream chunk types.
 * @typedef {MarkdownTextChunk|TaskUpdateChunk|PlanUpdateChunk} StreamChunk
 */

// =============================================================================
// Factories
// =============================================================================

/**
 * Create a markdown text chunk.
 * @param {string} text
 * @returns {MarkdownTextChunk}
 */
export function markdownTextChunk(text) {
  return { type: "markdown_text", text };
}

/**
 * Create a task update chunk.
 * @param {Object} opts
 * @param {string} opts.id - Task ID
 * @param {string} opts.title - Task title
 * @param {'pending'|'in_progress'|'complete'|'error'} opts.status
 * @param {string} [opts.details]
 * @param {string} [opts.output]
 * @returns {TaskUpdateChunk}
 */
export function taskUpdateChunk({ id, title, status, details, output }) {
  return { type: "task_update", id, title, status, details, output };
}

/**
 * Create a plan update chunk.
 * @param {string} title
 * @returns {PlanUpdateChunk}
 */
export function planUpdateChunk(title) {
  return { type: "plan_update", title };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract text content from a stream chunk.
 * @param {string|StreamChunk} chunk
 * @returns {string}
 */
export function streamChunkToText(chunk) {
  if (typeof chunk === "string") return chunk;
  if (chunk.type === "markdown_text") return chunk.text;
  // task_update / plan_update — no text representation in v1
  return "";
}

/**
 * Check if a chunk is a markdown text chunk.
 * @param {StreamChunk} chunk
 * @returns {boolean}
 */
export function isMarkdownTextChunk(chunk) {
  return chunk?.type === "markdown_text";
}

/**
 * Check if a chunk is a task update chunk.
 * @param {StreamChunk} chunk
 * @returns {boolean}
 */
export function isTaskUpdateChunk(chunk) {
  return chunk?.type === "task_update";
}

/**
 * Check if a chunk is a plan update chunk.
 * @param {StreamChunk} chunk
 * @returns {boolean}
 */
export function isPlanUpdateChunk(chunk) {
  return chunk?.type === "plan_update";
}

/**
 * Validate a stream chunk.
 * @param {StreamChunk} chunk
 * @returns {{valid: boolean, error?: string}}
 */
export function validateStreamChunk(chunk) {
  if (!chunk || typeof chunk !== "object") {
    return { valid: false, error: "chunk_must_be_object" };
  }

  if (!chunk.type) {
    return { valid: false, error: "chunk_must_have_type" };
  }

  switch (chunk.type) {
    case "markdown_text":
      if (typeof chunk.text !== "string") {
        return { valid: false, error: "markdown_text_chunk_must_have_text" };
      }
      break;

    case "task_update":
      if (typeof chunk.id !== "string") {
        return { valid: false, error: "task_update_chunk_must_have_id" };
      }
      if (typeof chunk.title !== "string") {
        return { valid: false, error: "task_update_chunk_must_have_title" };
      }
      if (!["pending", "in_progress", "complete", "error"].includes(chunk.status)) {
        return { valid: false, error: "invalid_task_status" };
      }
      break;

    case "plan_update":
      if (typeof chunk.title !== "string") {
        return { valid: false, error: "plan_update_chunk_must_have_title" };
      }
      break;

    default:
      return { valid: false, error: `unknown_chunk_type: ${chunk.type}` };
  }

  return { valid: true };
}
