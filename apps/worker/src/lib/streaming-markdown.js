/**
 * P22-B1: Streaming Markdown Renderer
 * Adapted from Vercel Chat SDK's StreamingMarkdownRenderer.
 *
 * Uses the `remend` library for closing unclosed inline markdown markers
 * (**, *, ~~, `, [), matching the Vercel implementation exactly.
 *
 * Key features:
 * - Table buffering: holds back trailing pipe-delimited lines until separator confirms
 * - Code fence tracking: O(1) check for unclosed code fences
 * - Inline marker healing: uses `remend` library (robust, well-tested)
 * - Monotonic output: safe for append-only streaming consumers
 */

import remend from "remend";

// =============================================================================
// Constants
// =============================================================================

const TABLE_ROW_RE = /^\|.*\|$/;
const TABLE_SEPARATOR_RE = /^\|[\s:]*-{1,}[\s:]*(\|[\s:]*-{1,}[\s:]*)*\|$/;
const INLINE_MARKER_CHARS = new Set(["*", "~", "`", "["]);

// =============================================================================
// StreamingMarkdownRenderer
// =============================================================================

/**
 * A streaming markdown renderer that buffers potential table headers
 * until confirmed by a separator line, preventing tables from flashing
 * as raw pipe-delimited text during LLM streaming.
 *
 * Outputs markdown (not platform text). Format conversion still happens
 * in the adapter's editMessage → renderPostable → fromAst pipeline.
 */
export class StreamingMarkdownRenderer {
  /** @type {string} */
  accumulated = "";
  /** @type {boolean} */
  dirty = true;
  /** @type {string} */
  cachedRender = "";
  /** @type {boolean} */
  finished = false;
  /** @type {number} Number of code fence toggles (odd = inside) */
  fenceToggles = 0;
  /** @type {string} Incomplete trailing line buffer for incremental fence tracking */
  incompleteLine = "";
  /** @type {boolean} */
  wrapTablesForAppend;

  /**
   * @param {{wrapTablesForAppend?: boolean}} options
   */
  constructor(options = {}) {
    this.wrapTablesForAppend = options.wrapTablesForAppend ?? true;
  }

  /**
   * Append a chunk from the LLM stream.
   * @param {string} chunk - Text chunk
   */
  push(chunk) {
    this.accumulated += chunk;
    this.dirty = true;

    // Incrementally track code fence state from completed lines
    this.incompleteLine += chunk;
    const parts = this.incompleteLine.split("\n");
    this.incompleteLine = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        this.fenceToggles++;
      }
    }
  }

  /**
   * O(1) check if accumulated text is inside an unclosed code fence.
   * @returns {boolean}
   */
  isAccumulatedInsideFence() {
    let inside = this.fenceToggles % 2 === 1;
    const trimmed = this.incompleteLine.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inside = !inside;
    }
    return inside;
  }

  /**
   * Get renderable markdown for an intermediate edit.
   * - Holds back trailing lines that look like a table header
   * - Applies remend() to close incomplete inline markers
   * - Idempotent: returns cached result if no push() since last call
   * @returns {string}
   */
  render() {
    if (!this.dirty) {
      return this.cachedRender;
    }

    this.dirty = false;

    if (this.finished) {
      this.cachedRender = remend(this.accumulated);
      return this.cachedRender;
    }

    // If inside an unclosed code fence, don't buffer (pipes aren't tables)
    if (this.isAccumulatedInsideFence()) {
      this.cachedRender = remend(this.accumulated);
      return this.cachedRender;
    }

    const committable = getCommittablePrefix(this.accumulated);
    this.cachedRender = remend(committable);
    return this.cachedRender;
  }

  /**
   * Get text safe for append-only streaming (e.g. Slack native streaming).
   *
   * - Holds back unconfirmed table headers until separator arrives.
   * - Optionally wraps confirmed tables in code fences for append-only surfaces.
   * - Holds back unclosed inline markers (**, *, ~~, `, [).
   * - The final render replaces everything with properly formatted text.
   *
   * @returns {string}
   */
  getCommittableText() {
    if (this.finished) {
      return this.formatAppendOnlyText(this.accumulated, true);
    }

    // Strip incomplete last line (no trailing newline) to prevent committing
    // content that might change semantics when completed
    let text = this.accumulated;
    if (text.length > 0 && !text.endsWith("\n")) {
      const lastNewline = text.lastIndexOf("\n");
      const withoutIncompleteLine =
        lastNewline >= 0 ? text.slice(0, lastNewline + 1) : "";

      // If stripping puts us inside a code fence, keep the incomplete line
      if (isInsideCodeFence(withoutIncompleteLine)) {
        return this.formatAppendOnlyText(text);
      }

      text = withoutIncompleteLine;
    }

    // Inside a user code fence: skip table holding and inline marker buffering
    if (isInsideCodeFence(text)) {
      return this.formatAppendOnlyText(text);
    }

    const committed = getCommittablePrefix(text);
    const wrapped = this.formatAppendOnlyText(committed);

    // If text ends inside an open table code fence,
    // skip inline marker buffering
    if (isInsideCodeFence(wrapped)) {
      return wrapped;
    }

    return findCleanPrefix(wrapped);
  }

  /**
   * Raw accumulated text (no healing, no buffering). For the final edit.
   * @returns {string}
   */
  getText() {
    return this.accumulated;
  }

  /**
   * Signal stream end. Flushes held-back lines. Returns final render.
   * @returns {string}
   */
  finish() {
    this.finished = true;
    this.dirty = true;
    return this.render();
  }

  /**
   * Reset the renderer state.
   */
  reset() {
    this.accumulated = "";
    this.dirty = true;
    this.cachedRender = "";
    this.finished = false;
    this.fenceToggles = 0;
    this.incompleteLine = "";
  }

  /**
   * Format text for append-only streaming.
   * @param {string} text
   * @param {boolean} closeFences
   * @returns {string}
   */
  formatAppendOnlyText(text, closeFences = false) {
    if (!this.wrapTablesForAppend) {
      return text;
    }
    return wrapTablesForAppend(text, closeFences);
  }
}

// =============================================================================
// Inline Marker Healing (via remend)
// =============================================================================

/**
 * Check if text is "clean" — remend doesn't add any closing markers.
 * Uses length comparison because remend may trim trailing whitespace
 * from otherwise clean text (which is harmless for streaming).
 * @param {string} text
 * @returns {boolean}
 */
function isClean(text) {
  return remend(text).length <= text.length;
}

/**
 * Returns the longest prefix of text where all inline markers are balanced
 * (i.e. remend would not add closing markers). Scans backward from the end
 * for potential opening markers, grouping consecutive same characters to
 * handle multi-char markers like ** and ~~.
 *
 * Typically resolves in 1-3 remend calls since unclosed markers are
 * almost always near the end of the text.
 * @param {string} text
 * @returns {string}
 */
function findCleanPrefix(text) {
  if (text.length === 0 || isClean(text)) {
    return text;
  }

  for (let i = text.length - 1; i >= 0; i--) {
    if (INLINE_MARKER_CHARS.has(text[i])) {
      // Group consecutive same characters (e.g., ** or ~~)
      while (i > 0 && text[i - 1] === text[i]) {
        i--;
      }
      const candidate = text.slice(0, i);
      if (isClean(candidate)) {
        return candidate;
      }
    }
  }

  return "";
}

// =============================================================================
// Table Detection & Buffering
// =============================================================================

/**
 * Returns the prefix of text that can be safely rendered,
 * holding back trailing lines that look like an unconfirmed table.
 * @param {string} text
 * @returns {string}
 */
function getCommittablePrefix(text) {
  const endsWithNewline = text.endsWith("\n");
  const lines = text.split("\n");

  // If the text doesn't end with newline, the last line is still being written
  if (!endsWithNewline && lines.length > 0) {
    lines.pop();
  }

  // Remove trailing empty string from split
  if (endsWithNewline && lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }

  // Walk backward to find consecutive table-like lines at the end
  let heldCount = 0;
  let separatorFound = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();

    // Empty line breaks a table block
    if (trimmed === "") {
      break;
    }

    if (TABLE_SEPARATOR_RE.test(trimmed)) {
      separatorFound = true;
      break;
    }

    if (TABLE_ROW_RE.test(trimmed)) {
      heldCount++;
    } else {
      break;
    }
  }

  if (separatorFound || heldCount === 0) {
    return text;
  }

  // Hold back the trailing table-like lines
  const commitLineCount = lines.length - heldCount;
  const committedLines = lines.slice(0, commitLineCount);

  let result = committedLines.join("\n");
  if (committedLines.length > 0) {
    result += "\n";
  }

  return result;
}

/**
 * Check if text ends inside an unclosed code fence.
 * @param {string} text
 * @returns {boolean}
 */
function isInsideCodeFence(text) {
  let inside = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Wraps confirmed GFM table blocks in code fences for append-only streaming.
 * @param {string} text
 * @param {boolean} closeFences
 * @returns {string}
 */
function wrapTablesForAppend(text, closeFences = false) {
  const hadTrailingNewline = text.endsWith("\n");
  const lines = text.split("\n");

  if (hadTrailingNewline && lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }

  const result = [];
  let inTable = false;
  let inUserCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track existing code fences
    if (!inTable && (trimmed.startsWith("```") || trimmed.startsWith("~~~"))) {
      inUserCodeFence = !inUserCodeFence;
      result.push(lines[i]);
      continue;
    }

    if (inUserCodeFence) {
      result.push(lines[i]);
      continue;
    }

    const isTableLine =
      trimmed !== "" &&
      (TABLE_ROW_RE.test(trimmed) || TABLE_SEPARATOR_RE.test(trimmed));

    if (isTableLine && !inTable) {
      // Only wrap if this block has a separator (confirmed table)
      let hasSeparator = false;
      for (let j = i; j < lines.length; j++) {
        const t = lines[j].trim();
        if (TABLE_SEPARATOR_RE.test(t)) {
          hasSeparator = true;
          break;
        }
        if (t === "" || !TABLE_ROW_RE.test(t)) {
          break;
        }
      }
      if (hasSeparator) {
        result.push("```");
        inTable = true;
      }
    } else if (!isTableLine && inTable) {
      result.push("```");
      inTable = false;
    }

    result.push(lines[i]);
  }

  // Close the fence if requested
  if (inTable && closeFences) {
    result.push("```");
  }

  let output = result.join("\n");
  if (hadTrailingNewline) {
    output += "\n";
  }
  return output;
}

// =============================================================================
// Exports
// =============================================================================

export {
  getCommittablePrefix,
  isInsideCodeFence,
  wrapTablesForAppend,
  findCleanPrefix,
  isClean,
};
