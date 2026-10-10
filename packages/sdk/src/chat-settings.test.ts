import { describe, expect, it } from "vitest";
import {
  canDeleteChatMessage,
  canReactToChatMessage,
  canUpdateChatMessage,
  getEffectiveChatSettings,
  mergeChatSettings,
} from "./chat-settings";

describe("chat settings (Ably ChatSettingsProvider)", () => {
  it("defaults allow own edit/delete and reactions", () => {
    const settings = mergeChatSettings();
    expect(settings.allowMessageUpdatesOwn).toBe(true);
    expect(settings.allowMessageDeletesOwn).toBe(true);
    expect(settings.allowMessageReactions).toBe(true);
    expect(settings.allowMessageUpdatesAny).toBe(false);
  });

  it("merges room over global", () => {
    const settings = getEffectiveChatSettings(
      "announcements",
      { allowMessageDeletesOwn: true, allowMessageReactions: true },
      { announcements: { allowMessageDeletesOwn: false, allowMessageUpdatesOwn: false } },
    );
    expect(settings.allowMessageDeletesOwn).toBe(false);
    expect(settings.allowMessageUpdatesOwn).toBe(false);
    expect(settings.allowMessageReactions).toBe(true);
  });

  it("gates own vs any like Ably ChatSettings", () => {
    const settings = mergeChatSettings();
    expect(canUpdateChatMessage(settings, true)).toBe(true);
    expect(canUpdateChatMessage(settings, false)).toBe(false);
    expect(canDeleteChatMessage(settings, true)).toBe(true);
    expect(canDeleteChatMessage(settings, false)).toBe(false);
    expect(canReactToChatMessage(settings)).toBe(true);
  });
});
