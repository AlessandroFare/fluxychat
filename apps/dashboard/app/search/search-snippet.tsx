"use client";

import { escapeHtml } from "@/lib/escape-html";

/**
 * Render a server FTS snippet containing `[[`/`]]` highlight markers as
 * React text nodes. This avoids `dangerouslySetInnerHTML` while still
 * escaping any HTML metacharacters in the underlying message content.
 */
export function SearchSnippet({ snippet }: { snippet: string }) {
  const safe = escapeHtml(snippet);
  const parts = safe.split(/\[\[|\]\]/);
  return (
    <span className="text-sm text-foreground">
      {parts.map((part, idx) =>
        idx % 2 === 0 ? (
          <span key={idx}>{part}</span>
        ) : (
          <mark
            key={idx}
            className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-700/60"
          >
            {part}
          </mark>
        ),
      )}
    </span>
  );
}
