import { describe, expect, it } from "vitest";
import {
  mergeMessageExtras,
  splitMessageExtras,
  sanitizeMessageHeaders,
  parseOperationDetails,
  parseQuotedMessageId,
} from "./message-extras.js";

describe("message extras", () => {
  it("rejects array metadata and nested header objects", () => {
    expect(mergeMessageExtras(null, [], undefined).error).toBe("invalid_metadata");
    expect(sanitizeMessageHeaders({ a: { b: 1 } }).error).toBe("invalid_headers");
  });

  it("stores headers beside metadata and splits them on read", () => {
    const merged = mergeMessageExtras(null, { color: "red" }, { source: "cli" });
    expect(JSON.parse(merged.json)).toEqual({ color: "red", headers: { source: "cli" } });
    expect(merged.extras).toEqual({
      metadata: { color: "red" },
      headers: { source: "cli" },
    });
    expect(splitMessageExtras(JSON.parse(merged.json))).toEqual(merged.extras);
  });

  it("merges onto existing Art. 50 fields", () => {
    const merged = mergeMessageExtras(
      JSON.stringify({ participantType: "human", headers: { a: "1" } }),
      { edited: true },
      { a: "2", b: "x" },
    );
    expect(merged.extras.metadata).toEqual({ participantType: "human", edited: true });
    expect(merged.extras.headers).toEqual({ a: "2", b: "x" });
  });

  it("parses Ably-style operation details", () => {
    expect(parseOperationDetails({ description: "typo", operationMetadata: { src: "cli" } }).operation).toEqual({
      description: "typo",
      metadata: { src: "cli" },
    });
    expect(parseOperationDetails({ operation: { description: "gone" } }).operation).toEqual({
      description: "gone",
    });
  });

  it("parses Stream quoted_message_id without treating it as a thread parent", () => {
    expect(parseQuotedMessageId({ quotedMessageId: 9 })).toBe(9);
    expect(parseQuotedMessageId({ quoted_message_id: "12" })).toBe(12);
    expect(parseQuotedMessageId({ metadata: { quotedMessageId: 3 } })).toBe(3);
    expect(parseQuotedMessageId({ parentId: 4 })).toBeNull();
  });
});
