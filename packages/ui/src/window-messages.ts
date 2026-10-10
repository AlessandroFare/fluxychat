/** Ably ChatWindow `windowSize`: render only the latest N rows. */
export function windowMessages<T>(messages: T[], windowSize?: number): T[] {
  if (windowSize == null || windowSize <= 0 || messages.length <= windowSize) return messages;
  return messages.slice(-windowSize);
}
