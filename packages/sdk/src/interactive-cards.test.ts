import { describe, expect, it } from "vitest";
import { Card, Text } from "./cards";
import {
  cardDisplayText,
  isCardMessage,
  parseCardFromContent,
  parseCardFromMessage,
  serializeCardMessage,
} from "./interactive-cards";

describe("interactive-cards", () => {
  it("serializes and parses card from content", () => {
    const card = Card({ title: "Hello", children: [Text({ content: "World" })] });
    const content = serializeCardMessage(card);
    expect(isCardMessage({ content })).toBe(true);
    expect(parseCardFromContent(content)?.title).toBe("Hello");
    expect(cardDisplayText({ content })).toContain("World");
  });

  it("parseCardFromMessage prefers card field", () => {
    const card = Card({ children: [Text({ content: "Inline" })] });
    expect(parseCardFromMessage({ content: "plain", card })?.type).toBe("card");
  });
});
