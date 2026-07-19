import { describe, it, expect } from "vitest";
import {
  createTextPart,
  createToolCallPart,
  createToolResultPart,
  createComponentRegistry,
  renderParts,
  partTypeFor,
  parseToolName,
  isTextPart,
  isToolPart,
  isToolCallPart,
  isToolResultPart,
} from "./generative-ui";

describe("part builders", () => {
  it("createTextPart creates a text part", () => {
    const p = createTextPart("hello");
    expect(p).toEqual({ type: "text", text: "hello" });
    expect(isTextPart(p)).toBe(true);
  });

  it("createToolCallPart creates a tool-call part", () => {
    const p = createToolCallPart("getWeather", "call-1", { location: "SF" });
    expect(p.type).toBe("tool-getWeather");
    expect(p.state).toBe("call-available");
    expect(p.args.location).toBe("SF");
    expect(isToolCallPart(p)).toBe(true);
  });

  it("createToolResultPart creates an output-available part", () => {
    const p = createToolResultPart("getWeather", "call-1", "output-available", { temp: 72 });
    expect(p.type).toBe("tool-getWeather");
    expect(p.state).toBe("output-available");
    expect(p.output).toEqual({ temp: 72 });
    expect(isToolResultPart(p)).toBe(true);
  });

  it("createToolResultPart creates input-available part", () => {
    const p = createToolResultPart("getWeather", "call-1", "input-available");
    expect(p.state).toBe("input-available");
    expect(isToolResultPart(p)).toBe(true);
  });

  it("createToolResultPart creates error part", () => {
    const p = createToolResultPart("getWeather", "call-1", "output-error", undefined, "API failed");
    expect(p.state).toBe("output-error");
    expect(p.errorText).toBe("API failed");
  });
});

describe("component registry", () => {
  it("registers and retrieves components", () => {
    const r = createComponentRegistry();
    const entry = { component: { render: () => "weather" } };
    r.register("getWeather", entry);
    expect(r.get("getWeather")).toBe(entry);
    expect(r.has("getWeather")).toBe(true);
  });

  it("unregisters components", () => {
    const r = createComponentRegistry();
    r.register("x", { component: { render: () => "" } });
    expect(r.unregister("x")).toBe(true);
    expect(r.has("x")).toBe(false);
    expect(r.unregister("nonexistent")).toBe(false);
  });

  it("clear removes all", () => {
    const r = createComponentRegistry();
    r.register("a", { component: { render: () => "" } });
    r.register("b", { component: { render: () => "" } });
    r.clear();
    expect(r.entries().size).toBe(0);
  });

  it("entries returns the underlying map", () => {
    const r = createComponentRegistry();
    r.register("a", { component: { render: () => "" } });
    expect(r.entries().has("a")).toBe(true);
  });
});

describe("renderParts", () => {
  it("renders text parts directly", () => {
    const r = createComponentRegistry();
    const result = renderParts([createTextPart("hello")], r);
    expect(result).toEqual(["hello"]);
  });

  it("renders tool result via registered component", () => {
    const r = createComponentRegistry();
    r.register("getWeather", { component: { render: (p: any) => `Weather: ${p.temp}°` } });

    const parts = [createToolResultPart("getWeather", "call-1", "output-available", { temp: 72 })];
    const result = renderParts(parts, r);
    expect(result).toEqual(["Weather: 72°"]);
  });

  it("renders loading state for call-available parts", () => {
    const r = createComponentRegistry();
    r.register("getWeather", {
      component: { render: () => "" },
      loadingComponent: { render: () => "Loading..." },
    });

    const parts = [createToolCallPart("getWeather", "call-1", {})];
    const result = renderParts(parts, r);
    expect(result).toEqual(["Loading..."]);
  });

  it("renders loading state for input-available parts", () => {
    const r = createComponentRegistry();
    r.register("getWeather", {
      component: { render: () => "" },
      loadingComponent: { render: () => "Fetching..." },
    });

    const parts = [createToolResultPart("getWeather", "call-1", "input-available")];
    const result = renderParts(parts, r);
    expect(result).toEqual(["Fetching..."]);
  });

  it("renders error state", () => {
    const r = createComponentRegistry();
    r.register("getWeather", {
      component: { render: () => "" },
      errorComponent: { render: (p: any) => `Error: ${p.errorText}` },
    });

    const parts = [createToolResultPart("getWeather", "call-1", "output-error", undefined, "API timeout")];
    const result = renderParts(parts, r);
    expect(result).toEqual(["Error: API timeout"]);
  });

  it("falls back to [toolName] when no component registered", () => {
    const r = createComponentRegistry();
    const parts = [createToolResultPart("unknown", "call-1", "output-available", {})];
    const result = renderParts(parts, r);
    expect(result).toEqual(["[unknown]"]);
  });

  it("uses onLoading callback as fallback", () => {
    const r = createComponentRegistry();
    const parts = [createToolCallPart("getWeather", "call-1", {})];
    const result = renderParts(parts, r, {
      onLoading: (name, id) => `Loading ${name} (${id})...`,
    });
    expect(result).toEqual(["Loading getWeather (call-1)..."]);
  });

  it("uses onError callback as fallback", () => {
    const r = createComponentRegistry();
    const parts = [createToolResultPart("getWeather", "call-1", "output-error", undefined, "Oops")];
    const result = renderParts(parts, r, {
      onError: (name, id, err) => `${name} failed: ${err}`,
    });
    expect(result).toEqual(["getWeather failed: Oops"]);
  });

  it("renders mixed parts in order", () => {
    const r = createComponentRegistry();
    r.register("search", { component: { render: (p: any) => `Results: ${p.count}` } });

    const parts = [
      createTextPart("I found:"),
      createToolResultPart("search", "call-1", "output-available", { count: 5 }),
      createTextPart("items total"),
    ];
    const result = renderParts(parts, r);
    expect(result).toEqual(["I found:", "Results: 5", "items total"]);
  });
});

describe("partTypeFor", () => {
  it("prefixes tool name", () => {
    expect(partTypeFor("getWeather")).toBe("tool-getWeather");
    expect(partTypeFor("search")).toBe("tool-search");
  });
});

describe("parseToolName", () => {
  it("extracts tool name from part type", () => {
    expect(parseToolName("tool-getWeather")).toBe("getWeather");
    expect(parseToolName("tool-search")).toBe("search");
  });

  it("returns null for non-tool types", () => {
    expect(parseToolName("text")).toBeNull();
    expect(parseToolName("")).toBeNull();
  });
});

describe("type guards", () => {
  it("isToolPart detects tool parts", () => {
    expect(isToolPart(createToolCallPart("x", "c1", {}))).toBe(true);
    expect(isToolPart(createToolResultPart("x", "c1", "output-available"))).toBe(true);
    expect(isToolPart(createTextPart("hi"))).toBe(false);
  });

  it("isToolCallPart detects only call-available", () => {
    expect(isToolCallPart(createToolCallPart("x", "c1", {}))).toBe(true);
    expect(isToolCallPart(createToolResultPart("x", "c1", "output-available"))).toBe(false);
    expect(isToolCallPart(createTextPart("hi"))).toBe(false);
  });
});
