const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text for safe insertion into HTML (not for attribute contexts with untrusted quotes). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

/** Highlight FTS snippet markers `[[` / `]]` after HTML-escaping the underlying text. */
export function highlightSearchSnippet(snippet: string): string {
  return escapeHtml(snippet).replace(/\[\[/g, "<mark>").replace(/\]\]/g, "</mark>");
}
