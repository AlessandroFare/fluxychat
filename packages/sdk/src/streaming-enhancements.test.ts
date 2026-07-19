import { describe, it, expect } from "vitest";
import {
  createStreamChunk, isTextChunk, isToolCallChunk, isToolResultChunk,
  parseStreamChunks, serializeStreamChunks, healMarkdown, bufferTableCells,
} from "./streaming-enhancements";

describe("createStreamChunk", () => {
  it("creates a text chunk", () => {
    const c = createStreamChunk("text", { content: "hello" });
    expect(c.type).toBe("text");
    expect(c.content).toBe("hello");
  });

  it("creates a tool-call chunk", () => {
    const c = createStreamChunk("tool-call", { toolName: "get_weather", toolArgs: "{}" });
    expect(c.type).toBe("tool-call");
    expect(c.toolName).toBe("get_weather");
  });
});

describe("type guards", () => {
  it("isTextChunk", () => {
    expect(isTextChunk(createStreamChunk("text", { content: "a" }))).toBe(true);
    expect(isTextChunk(createStreamChunk("done"))).toBe(false);
  });

  it("isToolCallChunk", () => {
    expect(isToolCallChunk(createStreamChunk("tool-call", { toolName: "x" }))).toBe(true);
    expect(isToolCallChunk(createStreamChunk("text"))).toBe(false);
  });

  it("isToolResultChunk", () => {
    expect(isToolResultChunk(createStreamChunk("tool-result", { toolResult: "ok" }))).toBe(true);
    expect(isToolResultChunk(createStreamChunk("text"))).toBe(false);
  });
});

describe("parseStreamChunks / serializeStreamChunks", () => {
  it("round-trips text chunks", () => {
    const input = "0:hello\n0: world";
    const chunks = parseStreamChunks(input);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("hello");
    const out = serializeStreamChunks(chunks);
    expect(out).toBe(input);
  });

  it("parses tool-call chunks", () => {
    const input = '8:{"toolName":"get_weather","args":{"city":"London"}}';
    const chunks = parseStreamChunks(input);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("tool-call");
    expect(chunks[0].toolName).toBe("get_weather");
  });

  it("parses error chunks", () => {
    const chunks = parseStreamChunks("3:Something broke");
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error).toBe("Something broke");
  });
});

describe("healMarkdown", () => {
  it("closes unclosed code fences", () => {
    const result = healMarkdown("```js\nconsole.log('hi')");
    expect(result).toContain("```");
    expect(result.endsWith("```")).toBe(true);
  });

  it("passes through valid markdown", () => {
    const md = "hello **world**";
    expect(healMarkdown(md)).toBe(md);
  });

  it("passes through text without fences", () => {
    expect(healMarkdown("plain text")).toBe("plain text");
  });

  it("passes through already closed fences", () => {
    const md = "```js\nconsole.log('hi')\n```";
    expect(healMarkdown(md)).toBe(md);
  });
});

describe("bufferTableCells", () => {
  it("adds separator row for pipe tables", () => {
    const input = "| Name | Age |\n| Alice | 30 |";
    const result = bufferTableCells(input);
    expect(result).toContain("---");
    expect(result.split("\n")).toHaveLength(3);
  });

  it("passes through non-table content", () => {
    expect(bufferTableCells("hello")).toBe("hello");
  });
});
