/** Ably Chat UI Kit typing copy: 1–2 names, then a count. */
export function formatTypingCaption(names: string[]): string | null {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  if (unique.length === 1) return `${unique[0]} is typing…`;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]} are typing…`;
  return `${unique.length} people are typing…`;
}

export function formatTypingCaptionFromMap(
  typingUsers: Record<string, boolean>,
  options?: {
    excludeUserId?: string | null;
    resolveName?: (userId: string) => string;
  },
): string | null {
  const names: string[] = [];
  for (const [userId, isTyping] of Object.entries(typingUsers)) {
    if (!isTyping) continue;
    if (options?.excludeUserId && userId === options.excludeUserId) continue;
    names.push(options?.resolveName?.(userId) ?? userId);
  }
  return formatTypingCaption(names);
}
