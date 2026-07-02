/**
 * P22-B1: React hook for streaming markdown rendering.
 * Wraps StreamingMarkdownRenderer in a React-compatible interface.
 * Provides progressive markdown rendering for streaming agent responses.
 */

import { useCallback, useRef, useState } from "react";

interface StreamingMarkdownRenderer {
  push(chunk: string): void;
  render(): string;
  getCommittableText(): string;
  getText(): string;
  finish(): string;
  reset(): void;
  isAccumulatedInsideFence(): boolean;
}

export interface UseStreamingMarkdownResult {
  renderedMarkdown: string;
  pushChunk: (chunk: string) => void;
  finish: () => string;
  reset: () => void;
  isInsideCodeFence: boolean;
}

export function useStreamingMarkdown(): UseStreamingMarkdownResult {
  const rendererRef = useRef<StreamingMarkdownRenderer | null>(null);
  const [renderedMarkdown, setRenderedMarkdown] = useState("");

  const getRenderer = useCallback(() => {
    if (!rendererRef.current) {
      rendererRef.current = createStreamingMarkdownRenderer();
    }
    return rendererRef.current;
  }, []);

  const pushChunk = useCallback((chunk: string) => {
    const renderer = getRenderer();
    renderer.push(chunk);
    setRenderedMarkdown(renderer.render());
  }, [getRenderer]);

  const finish = useCallback(() => {
    const renderer = getRenderer();
    const final = renderer.finish();
    setRenderedMarkdown(final);
    return final;
  }, [getRenderer]);

  const reset = useCallback(() => {
    const renderer = getRenderer();
    renderer.reset();
    setRenderedMarkdown("");
  }, [getRenderer]);

  const isInsideCodeFence = rendererRef.current?.isAccumulatedInsideFence() ?? false;

  return {
    renderedMarkdown,
    pushChunk,
    finish,
    reset,
    isInsideCodeFence,
  };
}

/**
 * Creates a simple streaming markdown renderer.
 * This is a lightweight implementation for the dashboard.
 * The full implementation lives in the worker.
 */
function createStreamingMarkdownRenderer(): StreamingMarkdownRenderer {
  let buffer = "";
  let finished = false;

  return {
    push(chunk: string) {
      if (finished) return;
      buffer += chunk;
    },

    render(): string {
      return buffer;
    },

    getCommittableText(): string {
      return buffer;
    },

    getText(): string {
      return buffer;
    },

    finish(): string {
      finished = true;
      return buffer;
    },

    reset() {
      buffer = "";
      finished = false;
    },

    isAccumulatedInsideFence(): boolean {
      const fenceCount = (buffer.match(/```/g) || []).length;
      return fenceCount % 2 === 1;
    },
  };
}
