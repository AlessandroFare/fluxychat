/** Plain-text only for Leaflet popups (CVE-2025-69993 — avoid HTML/event handlers in popup content). */
export function sanitizeMapPopupText(value: string | null | undefined): string {
  if (!value) return "";
  let out = String(value).replace(/[\u0000-\u001F\u007F]/g, "");
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/<[^>]*>/g, "");
  }
  return out.slice(0, 200);
}
