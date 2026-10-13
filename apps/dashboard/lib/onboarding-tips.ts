import { scopedStorageKey } from "./scoped-browser-storage";

export const TIPS_STORAGE_BASE = "fluxychat:tips:v1";

export interface TipsStore {
  dismissed: string[];
}

function emptyStore(): TipsStore {
  return { dismissed: [] };
}

export function tipsStorageKey(userId?: string): string {
  const id = userId?.trim();
  if (!id) return TIPS_STORAGE_BASE;
  return scopedStorageKey(TIPS_STORAGE_BASE, id);
}

export function loadDismissedTips(userId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(tipsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TipsStore;
    return Array.isArray(parsed.dismissed) ? parsed.dismissed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isTipDismissed(id: string, userId?: string): boolean {
  return loadDismissedTips(userId).includes(id);
}

export function dismissTip(id: string, userId?: string): string[] {
  const next = Array.from(new Set([...loadDismissedTips(userId), id]));
  persist({ dismissed: next }, userId);
  return next;
}

export function clearDismissedTips(userId?: string): void {
  persist(emptyStore(), userId);
}

function persist(store: TipsStore, userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tipsStorageKey(userId), JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}
