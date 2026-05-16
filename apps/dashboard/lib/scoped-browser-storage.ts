/** Build a per-user storage key for hosted Clerk accounts. */
export function scopedStorageKey(baseKey: string, userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  return `${baseKey}:${safe}`;
}

/** Remove legacy unscoped keys that leaked state across accounts. */
export function purgeLegacyUnscopedKeys(legacyKeys: string[]): void {
  if (typeof window === "undefined") return;
  for (const key of legacyKeys) {
    try {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
