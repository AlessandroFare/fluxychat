import * as React from "react";
import { formatTypingCaptionFromMap } from "./format-typing-caption";

export interface TypingUsersIndicatorProps {
  typingUsers: Record<string, boolean>;
  excludeUserId?: string | null;
  resolveName?: (userId: string) => string;
}

/** One Ably-style line: `Ada is typing…` / `Ada and Bob are typing…` / `N people are typing…`. */
export function TypingUsersIndicator({
  typingUsers,
  excludeUserId,
  resolveName,
}: TypingUsersIndicatorProps) {
  const caption = formatTypingCaptionFromMap(typingUsers, { excludeUserId, resolveName });
  if (!caption) return null;

  return (
    <div data-testid="typing-users" role="status" aria-live="polite" style={{ fontSize: 11, color: "#777" }}>
      {caption}
    </div>
  );
}
