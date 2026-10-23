"use client";

import * as React from "react";

export interface CustomEmojiEntry {
  name: string;
  imageUrl: string;
}

const TOKEN_SPLIT_RE = /(:[a-z0-9_]{2,32}:)/g;
const TOKEN_MATCH_RE = /^:([a-z0-9_]{2,32}):$/;

/**
 * Renders `:name:` tokens found in plain-text message content as custom emoji
 * images. Unknown tokens and text without a colon render unchanged.
 */
export function CustomEmojiText({
  text,
  emojis,
  className,
}: {
  text: string;
  emojis: readonly CustomEmojiEntry[];
  className?: string;
}) {
  const urls = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of emojis) map.set(entry.name, entry.imageUrl);
    return map;
  }, [emojis]);

  if (!urls.size || !text.includes(":")) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {text.split(TOKEN_SPLIT_RE).map((part, index) => {
        const match = TOKEN_MATCH_RE.exec(part);
        const url = match ? urls.get(match[1]) : undefined;
        if (url) {
          return (
            <img
              key={index}
              src={url}
              alt={part}
              title={part}
              className="mx-0.5 inline-block size-4 align-text-bottom"
            />
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}
