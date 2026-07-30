import { describe, it, expect } from "vitest";
import {
  Card,
  Text,
  Button,
  LinkButton,
  Image,
  Divider,
  Actions,
  Section,
  Field,
  Fields,
  Link,
  Table,
  isCardElement,
  cardToFallbackText,
  cardToMarkdown,
} from "./cards";

describe("card builders", () => {
  it("Card creates a card element", () => {
    const card = Card({ title: "Hello", children: [Text({ content: "World" })] });
    expect(card.type).toBe("card");
    expect(card.title).toBe("Hello");
    expect(card.children).toHaveLength(1);
  });

  it("Text creates a text element", () => {
    const el = Text({ content: "foo", style: "bold" });
    expect(el.type).toBe("text");
    expect(el.content).toBe("foo");
    expect(el.style).toBe("bold");
  });

  it("Button creates a button element", () => {
    const el = Button({ id: "btn1", label: "Click", style: "primary" });
    expect(el.type).toBe("button");
    expect(el.id).toBe("btn1");
    expect(el.label).toBe("Click");
    expect(el.style).toBe("primary");
  });

  it("LinkButton creates a link button", () => {
    const el = LinkButton({ url: "https://example.com", label: "Go" });
    expect(el.type).toBe("link-button");
    expect(el.url).toBe("https://example.com");
  });

  it("Image creates an image element", () => {
    const el = Image({ url: "https://example.com/pic.png", alt: "pic" });
    expect(el.type).toBe("image");
    expect(el.url).toBe("https://example.com/pic.png");
    expect(el.alt).toBe("pic");
  });

  it("Divider creates a divider", () => {
    const el = Divider();
    expect(el.type).toBe("divider");
  });

  it("Actions creates an actions container", () => {
    const el = Actions({ children: [Button({ id: "b", label: "B" })] });
    expect(el.type).toBe("actions");
    expect(el.children).toHaveLength(1);
  });

  it("Section creates a section container", () => {
    const el = Section({ children: [Text({ content: "inner" })] });
    expect(el.type).toBe("section");
    expect(el.children).toHaveLength(1);
  });

  it("Field creates a field", () => {
    const el = Field({ label: "Key", value: "Val" });
    expect(el.type).toBe("field");
    expect(el.label).toBe("Key");
    expect(el.value).toBe("Val");
  });

  it("Fields creates a fields container", () => {
    const el = Fields({ fields: [Field({ label: "K", value: "V" })], alignment: "left" });
    expect(el.type).toBe("fields");
    expect(el.fields).toHaveLength(1);
    expect(el.alignment).toBe("left");
  });

  it("Link creates a link element", () => {
    const el = Link({ url: "https://example.com", text: "site" });
    expect(el.type).toBe("link");
    expect(el.url).toBe("https://example.com");
    expect(el.text).toBe("site");
  });

  it("Table creates a table element", () => {
    const el = Table({ headers: ["A", "B"], rows: [["1", "2"]], alignment: ["left"] });
    expect(el.type).toBe("table");
    expect(el.headers).toEqual(["A", "B"]);
    expect(el.rows).toEqual([["1", "2"]]);
    expect(el.alignment).toEqual(["left"]);
  });
});

describe("isCardElement", () => {
  it("returns true for CardElement", () => {
    expect(isCardElement(Card({ children: [] }))).toBe(true);
  });
  it("returns false for other elements", () => {
    expect(isCardElement(Text({ content: "hi" }))).toBe(false);
    expect(isCardElement(null)).toBe(false);
    expect(isCardElement({})).toBe(false);
  });
});

describe("cardToFallbackText", () => {
  it("renders card with title and text", () => {
    const card = Card({
      title: "Order",
      subtitle: "Summary",
      children: [Text({ content: "Total: $10" })],
    });
    expect(cardToFallbackText(card)).toContain("**Order**");
    expect(cardToFallbackText(card)).toContain("Summary");
    expect(cardToFallbackText(card)).toContain("Total: $10");
  });

  it("renders link element", () => {
    const card = Card({ children: [Link({ url: "https://x.com", text: "X" })] });
    expect(cardToFallbackText(card)).toContain("X (https://x.com)");
  });

  it("renders fields", () => {
    const card = Card({ children: [Fields({ fields: [Field({ label: "K", value: "V" })], alignment: "left" })] });
    expect(cardToFallbackText(card)).toContain("K: V");
  });

  it("renders inline element directly", () => {
    expect(cardToFallbackText(Text({ content: "hello", style: "bold" }))).toBe("**hello**");
  });
});

describe("cardToMarkdown", () => {
  it("renders card as markdown", () => {
    const card = Card({
      title: "Title",
      subtitle: "Sub",
      children: [Text({ content: "Content" })],
    });
    const md = cardToMarkdown(card);
    expect(md).toContain("# Title");
    expect(md).toContain("## Sub");
    expect(md).toContain("Content");
  });

  it("renders inline element directly", () => {
    expect(cardToMarkdown(Text({ content: "hi" }))).toBe("hi");
  });
});
