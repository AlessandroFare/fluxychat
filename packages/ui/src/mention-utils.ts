/** True when the active @-query matches insertable mention (prefix on handle or substring on label). */
export function mentionMatchesQuery(
  handle: string,
  label: string | undefined,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  const h = String(handle).toLowerCase();
  if (!q) return true;
  if (h.startsWith(q)) return true;
  return (label ?? "").toLowerCase().includes(q);
}

/**
 * When the caret is immediately after `@` and an optional ASCII handle fragment,
 * returns the lowercased fragment and the index of `@` for replacement on pick.
 */
export function getActiveMentionAtCursor(
  text: string,
  cursorPos: number
): { query: string; start: number } | null {
  if (!text || cursorPos < 1) return null;
  const safePos = Math.min(cursorPos, text.length);
  const upto = text.slice(0, safePos);
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  const afterAt = upto.slice(at + 1);
  if (/[\s\n]/.test(afterAt)) return null;
  if (!/^[\w-]*$/i.test(afterAt)) return null;
  return { query: afterAt.toLowerCase(), start: at };
}
