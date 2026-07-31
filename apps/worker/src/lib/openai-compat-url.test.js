import { describe, expect, it } from "vitest";
import { buildOpenAiChatCompletionsUrl } from "./openai-compat-url.js";

describe("buildOpenAiChatCompletionsUrl", () => {
  it("appends /v1/chat/completions when base has no /v1", () => {
    expect(buildOpenAiChatCompletionsUrl("https://opencode.ai/zen")).toBe(
      "https://opencode.ai/zen/v1/chat/completions",
    );
    expect(buildOpenAiChatCompletionsUrl("https://api.openai.com")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("does not double /v1 when base already ends with /v1", () => {
    expect(buildOpenAiChatCompletionsUrl("https://opencode.ai/zen/v1")).toBe(
      "https://opencode.ai/zen/v1/chat/completions",
    );
    expect(buildOpenAiChatCompletionsUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("prefers explicit override URL", () => {
    expect(
      buildOpenAiChatCompletionsUrl(
        "https://opencode.ai/zen/v1",
        "https://gateway.example/v1/chat/completions",
      ),
    ).toBe("https://gateway.example/v1/chat/completions");
  });
});
