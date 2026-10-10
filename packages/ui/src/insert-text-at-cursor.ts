/** Insert at the caret (Ably MessageInput emoji / mention HOW). */
export function insertTextAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  insert: string,
): { next: string; caret: number } {
  const start = el?.selectionStart ?? current.length;
  const end = el?.selectionEnd ?? start;
  return {
    next: `${current.slice(0, start)}${insert}${current.slice(end)}`,
    caret: start + insert.length,
  };
}

export function applyInsertedText(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  next: string,
  caret: number,
  setValue: (value: string) => void,
) {
  setValue(next);
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(caret, caret);
  });
}
