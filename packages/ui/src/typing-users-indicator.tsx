import * as React from "react";

export interface TypingUsersIndicatorProps {
  typingUsers: Record<string, boolean>;
}

/** Renders rows like `alice is typing…` from the hook’s typing map. */
export function TypingUsersIndicator({ typingUsers }: TypingUsersIndicatorProps) {
  const ids = Object.entries(typingUsers)
    .filter(([, active]) => active)
    .map(([uid]) => uid);

  if (ids.length === 0) return null;

  return (
    <>
      {ids.map((userId) => (
        <div key={userId} style={{ fontSize: 11, color: "#777" }}>
          {userId} is typing…
        </div>
      ))}
    </>
  );
}
