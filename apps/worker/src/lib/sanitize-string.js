/**
 * Bound untrusted header/filename strings for public HTTP (upload room id / file name).
 */
export function sanitizeString(value, maxLength = 255) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}
