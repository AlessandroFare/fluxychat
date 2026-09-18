import { describe, expect, it } from "vitest";
import * as ui from "./index";

const exportsMap = ui as Record<string, unknown>;

const README_HIGH_LEVEL = [
  "ChatWindow",
  "MessageList",
  "MessageItem",
  "MessageInput",
  "ChannelList",
  "PresenceList",
  "TypingUsersIndicator",
  "AgentMessage",
  "AgentTypingIndicator",
  "ComposerToolsMenu",
] as const;

const README_PRIMITIVES = [
  "Message",
  "Bubble",
  "Composer",
  "Attachment",
  "MessageScroller",
  "ReactionPicker",
  "TypingIndicator",
  "Marker",
  "Button",
  "cn",
] as const;

const README_THEMES = [
  "applyFluxyTheme",
  "fluxyThemeStyle",
  "getAllFluxyThemesCss",
] as const;

describe("@fluxy-chat/ui README public API", () => {
  it("exports documented chat primitives", () => {
    for (const name of [...README_HIGH_LEVEL, ...README_PRIMITIVES, ...README_THEMES]) {
      expect(exportsMap[name], name).toBeTypeOf("function");
    }
  });
});
