import * as React from "react";

export function renderContentWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} style={{ color: "#2563eb", fontWeight: 500 }}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
