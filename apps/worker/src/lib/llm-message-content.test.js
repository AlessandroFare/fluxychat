import { describe, expect, it } from "vitest";
import {
  openAiMessagesForModel,
  sanitizeOpenAiCompatibleMessages,
  stringifyLlmContent,
} from "./llm-message-content.js";

describe("stringifyLlmContent", () => {
  it("keeps strings", () => {
    expect(stringifyLlmContent("hi")).toBe("hi");
  });

  it("turns null into empty string", () => {
    expect(stringifyLlmContent(null)).toBe("");
  });

  it("flattens vision parts", () => {
    expect(
      stringifyLlmContent([
        { type: "text", text: "look" },
        { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
      ]),
    ).toBe("look\n[image]");
  });
});

describe("sanitizeOpenAiCompatibleMessages", () => {
  it("stringifies array content when vision is off", () => {
    const out = sanitizeOpenAiCompatibleMessages(
      [
        {
          role: "user",
          content: [
            { type: "text", text: "see this" },
            { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
          ],
        },
      ],
      { allowVision: false },
    );
    expect(out[0].content).toBe("see this\n[image]");
  });

  it("keeps vision parts when allowed", () => {
    const parts = [
      { type: "text", text: "see this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
    ];
    const out = sanitizeOpenAiCompatibleMessages([{ role: "user", content: parts }], {
      allowVision: true,
    });
    expect(Array.isArray(out[0].content)).toBe(true);
    expect(out[0].content).toHaveLength(2);
  });

  it("never leaves assistant tool-call content as null", () => {
    const out = sanitizeOpenAiCompatibleMessages([
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "ping", arguments: "{}" } }],
      },
    ]);
    expect(out[0].content).toBe("");
  });
});

describe("openAiMessagesForModel", () => {
  it("flattens vision for gpt-4o-mini", () => {
    const out = openAiMessagesForModel("gpt-4o-mini", [
      {
        role: "user",
        content: [{ type: "text", text: "photo" }, { type: "image_url", image_url: { url: "x" } }],
      },
    ]);
    expect(typeof out[0].content).toBe("string");
  });

  it("keeps vision arrays for gpt-4o", () => {
    const out = openAiMessagesForModel("gpt-4o", [
      {
        role: "user",
        content: [{ type: "text", text: "photo" }, { type: "image_url", image_url: { url: "x" } }],
      },
    ]);
    expect(Array.isArray(out[0].content)).toBe(true);
  });
});
