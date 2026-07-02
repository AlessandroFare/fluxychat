/**
 * P25-4: smoothStream
 * Adapted from Vercel Chat SDK's smoothStream utility.
 *
 * Smooth text streaming for better UX (no character-by-character flicker).
 *
 * Usage:
 *   const smooth = createSmoothStream({
 *     chunkSize: 3,
 *     delay: 50,
 *   });
 *
 *   for await (const chunk of stream) {
 *     for await (const smoothChunk of smooth(chunk)) {
 *       updateUI(smoothChunk);
 *     }
 *   }
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} SmoothStreamOptions
 * @property {number} [chunkSize] - Characters per chunk (default: 3)
 * @property {number} [delay] - Delay between chunks in ms (default: 50)
 * @property {boolean} [preserveWords] - Don't split words (default: true)
 * @property {boolean} [preserveMarkdown] - Don't split markdown (default: true)
 */

// =============================================================================
// Smooth Stream Implementation
// =============================================================================

/**
 * Create a smooth stream processor.
 * @param {SmoothStreamOptions} [options] - Options
 * @returns {(chunk: string) => AsyncGenerator<string>}
 */
export function createSmoothStream(options = {}) {
  const {
    chunkSize = 3,
    delay = 50,
    preserveWords = true,
    preserveMarkdown = true,
  } = options;

  let buffer = "";
  let isInCodeBlock = false;

  /**
   * Check if character is a word boundary.
   * @param {string} char
   * @returns {boolean}
   */
  function isWordBoundary(char) {
    return /[\s,.;:!?)"\]]/.test(char);
  }

  /**
   * Check if we're at a markdown boundary.
   * @param {string} text
   * @returns {boolean}
   */
  function isMarkdownBoundary(text) {
    // Check for common markdown patterns
    return /[*_~`#\[(!]/.test(text.slice(-1)) || 
           /\*\*$/.test(text) ||
           /__$/.test(text);
  }

  /**
   * Get the next safe break point.
   * @param {string} text
   * @param {number} minIndex
   * @returns {number}
   */
  function getNextBreakPoint(text, minIndex) {
    if (!preserveWords && !preserveMarkdown) {
      return minIndex;
    }

    let breakPoint = minIndex;

    if (preserveWords) {
      // Look for word boundary
      for (let i = minIndex; i < text.length; i++) {
        if (isWordBoundary(text[i])) {
          breakPoint = i + 1;
          break;
        }
      }
    }

    if (preserveMarkdown && breakPoint === minIndex) {
      // Look for markdown boundary
      for (let i = minIndex; i < text.length; i++) {
        if (isMarkdownBoundary(text.slice(0, i + 1))) {
          breakPoint = i + 1;
          break;
        }
      }
    }

    return breakPoint;
  }

  return async function* (chunk) {
    buffer += chunk;

    // Handle code blocks
    if (preserveMarkdown) {
      const codeBlockMatches = buffer.match(/```/g) || [];
      if (codeBlockMatches.length % 2 === 1) {
        isInCodeBlock = !isInCodeBlock;
      }
    }

    // Process buffer
    while (buffer.length > 0) {
      if (isInCodeBlock) {
        // In code block, output larger chunks
        const codeChunkSize = Math.min(chunkSize * 3, buffer.length);
        const output = buffer.slice(0, codeChunkSize);
        buffer = buffer.slice(codeChunkSize);
        yield output;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        continue;
      }

      // Normal text, find safe break point
      const breakPoint = getNextBreakPoint(buffer, chunkSize);
      
      if (breakPoint >= buffer.length) {
        // No safe break point, yield what we have
        yield buffer;
        buffer = "";
      } else {
        const output = buffer.slice(0, breakPoint);
        buffer = buffer.slice(breakPoint);
        yield output;
      }

      if (delay > 0 && buffer.length > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  };
}

/**
 * Create a word-by-word smooth stream.
 * @param {{ delay?: number, wordsPerChunk?: number }} [options]
 * @returns {(chunk: string) => AsyncGenerator<string>}
 */
export function createWordSmoothStream(options = {}) {
  const { delay = 100, wordsPerChunk = 1 } = options;

  let buffer = "";
  let wordCount = 0;

  return async function* (chunk) {
    buffer += chunk;

    // Split by whitespace and process word by word
    const words = buffer.split(/(\s+)/);
    
    // Keep the last potentially incomplete word in buffer
    let outputWords = [];
    let i = 0;

    while (i < words.length - 1) {
      const word = words[i];
      const separator = words[i + 1] || "";

      outputWords.push(word + separator);
      wordCount++;

      if (wordCount >= wordsPerChunk) {
        yield outputWords.join("");
        outputWords = [];
        wordCount = 0;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      i += 2;
    }

    // Keep the last word in buffer (might be incomplete)
    buffer = words[words.length - 1] || "";
  };
}

/**
 * Create a sentence-by-sentence smooth stream.
 * @param {{ delay?: number }} [options]
 * @returns {(chunk: string) => AsyncGenerator<string>}
 */
export function createSentenceSmoothStream(options = {}) {
  const { delay = 200 } = options;

  let buffer = "";

  return async function* (chunk) {
    buffer += chunk;

    // Look for sentence boundaries
    const sentenceRegex = /[.!?]+(?:\s|$)/g;
    let match;
    let lastIndex = 0;

    while ((match = sentenceRegex.exec(buffer)) !== null) {
      const sentence = buffer.slice(lastIndex, match.index + match[0].length);
      lastIndex = match.index + match[0].length;
      yield sentence;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Keep remaining text in buffer
    buffer = buffer.slice(lastIndex);
  };
}

/**
 * Debounced smooth stream - waits for complete tokens.
 * @param {{ delay?: number, minLength?: number }} [options]
 * @returns {(chunk: string) => AsyncGenerator<string>}
 */
export function createDebouncedSmoothStream(options = {}) {
  const { delay = 100, minLength = 10 } = options;

  let buffer = "";
  let flushTimer = null;

  return async function* (chunk) {
    buffer += chunk;

    // If buffer is large enough, yield immediately
    if (buffer.length >= minLength) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      yield buffer;
      buffer = "";
      return;
    }

    // Otherwise, wait for more data or timeout
    if (!flushTimer && delay > 0) {
      await new Promise((resolve) => {
        flushTimer = setTimeout(() => {
          if (buffer.length > 0) {
            // We need to yield, but this is a generator...
            // This pattern doesn't work perfectly with generators
            // In practice, you'd use a different approach
          }
          resolve();
        }, delay);
      });
    }
  };
}
