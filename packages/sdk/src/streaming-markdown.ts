/**
 * P22-B1: StreamingMarkdownRenderer type definition.
 * Type-only export — runtime implementation lives in worker.
 * Dashboard and SDK consumers use these types for progressive markdown rendering.
 */

export interface StreamingMarkdownRenderer {
  push(chunk: string): void;
  render(): string;
  getCommittableText(): string;
  getText(): string;
  finish(): string;
  reset(): void;
  isAccumulatedInsideFence(): boolean;
}

export interface StreamingMarkdownRendererOptions {
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

/**
 * Check if text is "clean" — remend doesn't add any closing markers.
 * Uses length comparison because remend may trim trailing whitespace
 * from otherwise clean text.
 */
export declare function isClean(text: string): boolean;

/**
 * Returns the longest prefix of text where all inline markers are balanced.
 * Uses the `remend` library for robust marker detection.
 */
export declare function findCleanPrefix(text: string): string;

/** Returns the prefix of text that can be safely rendered, holding back unconfirmed table headers. */
export declare function getCommittablePrefix(text: string): string;

/** Check if the text ends inside an unclosed code fence. */
export declare function isInsideCodeFence(text: string): boolean;

/** Wraps confirmed GFM table blocks in code fences for append-only streaming. */
export declare function wrapTablesForAppend(
  text: string,
  closeFences?: boolean,
): string;
