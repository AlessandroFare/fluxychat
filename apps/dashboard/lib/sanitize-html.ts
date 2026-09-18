const ALLOWED_TAGS = new Set([
  "B", "I", "U", "S", "STRONG", "EM", "P", "BR", "DIV", "SPAN",
  "UL", "OL", "LI", "H1", "H2", "H3", "BLOCKQUOTE",
]);

function stripNode(node: Node): void {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "IFRAME") {
    el.remove();
    return;
  }
  if (!ALLOWED_TAGS.has(el.tagName)) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    return;
  }
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on") || name === "style" || name === "src" || name === "href") {
      el.removeAttribute(attr.name);
    }
  }
  [...el.childNodes].forEach(stripNode);
}

function stripTagsByIndex(html: string): string {
  let out = html;
  for (let guard = 0; guard < 512; guard += 1) {
    const open = out.indexOf("<");
    if (open === -1) return out;
    const close = out.indexOf(">", open + 1);
    if (close === -1) {
      out = out.slice(0, open) + out.slice(open + 1);
      continue;
    }
    out = out.slice(0, open) + out.slice(close + 1);
  }
  return out;
}

/** Allowlist HTML for collab/contenteditable. Drops scripts, handlers, and unknown tags. */
export function sanitizeHtmlFragment(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return stripTagsByIndex(html);
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return "";
  [...root.childNodes].forEach(stripNode);
  return root.innerHTML;
}
