import { describe, it, expect } from "vitest";
import {
  streamFixtures,
  getStreamFixture,
  listStreamFixtures,
  simulateStream,
} from "./stream-fixtures";

describe("stream-fixtures", () => {
  it("has all expected fixtures", () => {
    const names = listStreamFixtures();
    expect(names).toContain("malformed");
    expect(names).toContain("splitUtf8");
    expect(names).toContain("abort");
    expect(names).toContain("providerError");
    expect(names).toContain("reconnect");
    expect(names).toContain("empty");
    expect(names).toContain("onlyFinish");
    expect(names).toContain("largeOutput");
  });

  it("getStreamFixture returns fixture by name", () => {
    const f = getStreamFixture("malformed");
    expect(f?.name).toBe("malformed");
    expect(f?.description).toBeDefined();
    expect(f?.chunks).toBeDefined();
  });

  it("getStreamFixture returns undefined for unknown", () => {
    expect(getStreamFixture("nonexistent")).toBeUndefined();
  });

  it("simulateStream yields fixture chunks", async () => {
    const stream = simulateStream(streamFixtures.malformed);
    const values: string[] = [];
    for await (const chunk of stream) {
      values.push(chunk);
    }
    expect(values).toEqual([
      "Valid text before error",
      "{invalid json",
      "not json at all",
      "Valid text after",
      "stop",
    ]);
  });

  it("empty fixture yields nothing", async () => {
    const values: string[] = [];
    for await (const chunk of simulateStream(streamFixtures.empty)) {
      values.push(chunk);
    }
    expect(values).toEqual([]);
  });

  it("largeOutput fixture has 100k chars", () => {
    const fixture = streamFixtures.largeOutput;
    const textChunk = fixture.chunks.find((c) => c.type === "text");
    expect(textChunk?.value.length).toBe(100_000);
  });

  it("abort fixture ends with error chunk", () => {
    const fixture = streamFixtures.abort;
    const last = fixture.chunks[fixture.chunks.length - 1];
    expect(last.type).toBe("error");
    expect(last.value).toContain("ABORTED");
  });
});
