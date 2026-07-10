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
export function isClean(text: string): boolean {
  throw new Error("isClean not implemented in SDK - use worker runtime");
}

/**
 * Returns the longest prefix of text where all inline markers are balanced.
 * Uses the `remend` library for robust marker detection.
 */
export function findCleanPrefix(text: string): string {
  throw new Error("findCleanPrefix not implemented in SDK - use worker runtime");
}

/** Returns the prefix of text that can be safely rendered, holding back unconfirmed table headers. */
export function getCommittablePrefix(text: string): string {
  throw new Error("getCommittablePrefix not implemented in SDK - use worker runtime");
}

/** Check if the text ends inside an unclosed code fence. */
export function isInsideCodeFence(text: string): boolean {
  throw new Error("isInsideCodeFence not implemented in SDK - use worker runtime");
}

/** Wraps confirmed GFM table blocks in code fences for append-only streaming. */
export function wrapTablesForAppend(
  text: string,
  closeFences?: boolean,
): string {
  throw new Error("wrapTablesForAppend not implemented in SDK - use worker runtime");
}
