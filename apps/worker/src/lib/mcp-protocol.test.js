import { describe, expect, it } from "vitest";
import {
  MCP_ERROR_HEADER_MISMATCH,
  MCP_ERROR_UNSUPPORTED_PROTOCOL,
  MCP_PROTOCOL_VERSION,
  detectMcpEra,
  isJsonRpcNotification,
  rejectUnknownProtocolVersion,
  validateModernStreamableHeaders,
  decodeMcpHeaderValue,
  negotiateLegacyInitializeVersion,
  mergeMcpInputResponses,
} from "./mcp-protocol.js";

describe("mcp protocol dual-era", () => {
  it("treats initialize as legacy", () => {
    expect(detectMcpEra({ method: "initialize" }, new Headers())).toBe("legacy");
  });

  it("treats server/discover as modern even without headers", () => {
    expect(detectMcpEra({ method: "server/discover", params: {} }, new Headers())).toBe(
      "modern",
    );
  });

  it("treats 2026-07-28 header as modern", () => {
    const headers = new Headers({ "MCP-Protocol-Version": MCP_PROTOCOL_VERSION });
    expect(detectMcpEra({ method: "tools/list", params: {} }, headers)).toBe("modern");
  });

  it("treats JSON-RPC without id as a notification", () => {
    expect(isJsonRpcNotification({ jsonrpc: "2.0", method: "notifications/initialized" })).toBe(
      true,
    );
    expect(isJsonRpcNotification({ jsonrpc: "2.0", method: "ping", id: 1 })).toBe(false);
  });

  it("rejects unknown protocol versions", () => {
    const headers = new Headers({ "MCP-Protocol-Version": "1900-01-01" });
    const err = rejectUnknownProtocolVersion({ id: 1, method: "tools/list" }, headers);
    expect(err.error.code).toBe(MCP_ERROR_UNSUPPORTED_PROTOCOL);
    expect(err.httpStatus).toBe(400);
    expect(err.error.data.supported).toContain(MCP_PROTOCOL_VERSION);
  });

  it("validates Mcp-Method against the body", () => {
    const headers = new Headers({
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": "tools/list",
    });
    const result = validateModernStreamableHeaders(
      { id: 2, method: "tools/call", params: { name: "x" } },
      headers,
    );
    expect(result.ok).toBe(false);
    expect(result.response.error.code).toBe(MCP_ERROR_HEADER_MISMATCH);
  });

  it("requires Mcp-Name on tools/call", () => {
    const headers = new Headers({
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": "tools/call",
      "Mcp-Name": "send_message",
    });
    const ok = validateModernStreamableHeaders(
      { id: 3, method: "tools/call", params: { name: "send_message" } },
      headers,
    );
    expect(ok.ok).toBe(true);

    const mismatch = validateModernStreamableHeaders(
      { id: 4, method: "tools/call", params: { name: "other" } },
      headers,
    );
    expect(mismatch.ok).toBe(false);
  });

  it("decodes Base64 Mcp-Name sentinels", () => {
    expect(decodeMcpHeaderValue(`=?base64?${btoa("file:///a b")}?=`)).toBe("file:///a b");
  });

  it("negotiates legacy initialize versions", () => {
    expect(negotiateLegacyInitializeVersion({}).protocolVersion).toBe("2024-11-05");
    expect(negotiateLegacyInitializeVersion({ protocolVersion: "2025-11-25" }).protocolVersion).toBe(
      "2025-11-25",
    );
    expect(negotiateLegacyInitializeVersion({ protocolVersion: "nope" }).ok).toBe(false);
  });

  it("merges elicitation inputResponses into tool arguments", () => {
    const args = mergeMcpInputResponses({
      arguments: { roomId: "room_1" },
      inputResponses: [{ result: { action: "accept", content: { content: "hi" } } }],
    });
    expect(args.roomId).toBe("room_1");
    expect(args.content).toBe("hi");
  });
});
