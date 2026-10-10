/** Ably ChatMessage hover tooltip: display name, clientId, sent time. */
export function formatSenderTooltip(options: {
  displayName: string;
  userId?: string | null;
  createdAt?: string | null;
}): string {
  const name = options.displayName.trim() || "unknown";
  const parts = [name];
  const userId = options.userId?.trim();
  if (userId && userId !== name) parts.push(userId);
  if (options.createdAt) {
    const at = new Date(options.createdAt);
    if (!Number.isNaN(at.getTime())) parts.push(at.toLocaleString());
  }
  return parts.join(" · ");
}
