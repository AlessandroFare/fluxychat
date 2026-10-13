import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDismissedTips,
  dismissTip,
  isTipDismissed,
  loadDismissedTips,
  TIPS_STORAGE_BASE,
  tipsStorageKey,
} from "./onboarding-tips";

describe("onboarding-tips persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores dismissed ids per user and clears on replay", () => {
    expect(loadDismissedTips("alice")).toEqual([]);
    dismissTip("create-project", "alice");
    expect(isTipDismissed("create-project", "alice")).toBe(true);
    expect(isTipDismissed("create-project", "bob")).toBe(false);
    expect(window.localStorage.getItem(tipsStorageKey("alice"))).toContain("create-project");
    expect(window.localStorage.getItem(TIPS_STORAGE_BASE)).toBeNull();
    clearDismissedTips("alice");
    expect(loadDismissedTips("alice")).toEqual([]);
  });

  it("survives invalid JSON in localStorage", () => {
    window.localStorage.setItem(tipsStorageKey("alice"), "{not-json");
    expect(loadDismissedTips("alice")).toEqual([]);
  });
});
