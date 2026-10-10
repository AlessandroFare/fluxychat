/** Restore the viewport after older rows are prepended (Ably ChatMessageList). */
export function restoreScrollAfterPrepend(
  el: HTMLElement | null,
  before: { height: number; top: number } | null,
) {
  if (!el || !before) return;
  el.scrollTop = before.top + (el.scrollHeight - before.height);
}

export function captureScrollPrepend(el: HTMLElement | null): { height: number; top: number } | null {
  if (!el) return null;
  return { height: el.scrollHeight, top: el.scrollTop };
}
