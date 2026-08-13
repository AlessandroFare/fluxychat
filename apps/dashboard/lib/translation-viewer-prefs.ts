const STORAGE_KEY = "fluxy-translation-viewer-lang";

export function getViewerTranslationLang(): string {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && /^[a-z]{2}$/.test(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

export function setViewerTranslationLang(lang: string): void {
  if (typeof window === "undefined") return;
  const normalized = lang.trim().toLowerCase().split("-")[0];
  if (!/^[a-z]{2}$/.test(normalized)) return;
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

export const VIEWER_LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
] as const;
