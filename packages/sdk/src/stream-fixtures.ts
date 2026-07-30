export interface StreamFixture {
  name: string;
  description: string;
  chunks: Array<{ type: "text" | "error" | "finish" | "data"; value: string }>;
}

export const streamFixtures: Record<string, StreamFixture> = {
  malformed: {
    name: "malformed",
    description: "Stream with malformed JSON chunks that should be gracefully handled",
    chunks: [
      { type: "text", value: "Valid text before error" },
      { type: "data", value: "{invalid json" },
      { type: "data", value: "not json at all" },
      { type: "text", value: "Valid text after" },
      { type: "finish", value: "stop" },
    ],
  },

  splitUtf8: {
    name: "splitUtf8",
    description: "Stream where a multi-byte UTF-8 character is split across chunks",
    chunks: [
      { type: "text", value: "Hello " },
      { type: "text", value: "\u00e9" },
      { type: "text", value: "\?" },
      { type: "text", value: " world!" },
      { type: "finish", value: "stop" },
    ],
  },

  abort: {
    name: "abort",
    description: "Stream that aborts mid-way with an error",
    chunks: [
      { type: "text", value: "Starting generation..." },
      { type: "text", value: "Processing more..." },
      { type: "error", value: "ABORTED: User cancelled the request" },
    ],
  },

  providerError: {
    name: "providerError",
    description: "Stream that simulates a provider API error after initial success",
    chunks: [
      { type: "text", value: "Partial response" },
      { type: "error", value: "PROVIDER_ERROR: Upstream API returned 502" },
    ],
  },

  reconnect: {
    name: "reconnect",
    description: "Stream that drops and resumes (simulating reconnection)",
    chunks: [
      { type: "text", value: "First segment" },
      { type: "data", value: "RECONNECT" },
      { type: "text", value: "Second segment after reconnect" },
      { type: "finish", value: "stop" },
    ],
  },

  empty: {
    name: "empty",
    description: "Stream with no chunks at all",
    chunks: [],
  },

  onlyFinish: {
    name: "onlyFinish",
    description: "Stream that immediately finishes with no text",
    chunks: [{ type: "finish", value: "stop" }],
  },

  largeOutput: {
    name: "largeOutput",
    description: "Stream with a very large text chunk to test buffer limits",
    chunks: [
      { type: "text", value: "A".repeat(100_000) },
      { type: "finish", value: "stop" },
    ],
  },
};

export function getStreamFixture(name: string): StreamFixture | undefined {
  return streamFixtures[name];
}

export function listStreamFixtures(): string[] {
  return Object.keys(streamFixtures);
}

export function simulateStream(fixture: StreamFixture): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of fixture.chunks) {
        yield chunk.value;
      }
    },
  };
}
