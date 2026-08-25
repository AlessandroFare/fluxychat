import { describe, expect, it } from "vitest";
import {
  AGENT_RPC_METHODS,
  ROOM_RPC_METHODS,
  callDurableRpc,
  encodeRpcRequest,
  parseRpcRequest,
} from "./do-rpc.js";
import { callAgentDo, callRoomDo } from "./agent-do-session.js";

describe("do rpc", () => {
  it("allowlists methods", () => {
    expect(parseRpcRequest({ method: "turn", params: { content: "hi" } }, AGENT_RPC_METHODS).ok).toBe(true);
    expect(parseRpcRequest({ method: "explode" }, AGENT_RPC_METHODS).reason).toBe("rpc_method_forbidden");
    expect(parseRpcRequest({ method: "copilot_nudge" }, ROOM_RPC_METHODS).ok).toBe(true);
    expect(parseRpcRequest({ method: "turn" }, ROOM_RPC_METHODS).ok).toBe(false);
  });

  it("encodes versioned envelopes", () => {
    expect(encodeRpcRequest("ping")).toEqual({ v: 1, method: "ping", params: {}, id: null });
  });

  it("calls a stub and surfaces transport misses", async () => {
    const stub = {
      fetch: async (_url, init) => {
        const body = JSON.parse(init.body);
        expect(body.method).toBe("ping");
        return new Response(JSON.stringify({ ok: true, method: "ping" }));
      },
    };
    expect(await callDurableRpc(stub, "ping")).toEqual({ ok: true, method: "ping" });
    expect(await callDurableRpc(null, "ping")).toEqual({ ok: false, reason: "rpc_stub_missing" });
  });

  it("rejects public-looking methods on the wrong isolate", async () => {
    expect(await callAgentDo({}, { projectId: "p", agentId: "a", userId: "u" }, "delete_all")).toEqual({
      ok: false,
      reason: "rpc_method_forbidden",
    });
    expect(await callRoomDo({}, "room-1", "turn")).toEqual({
      ok: false,
      reason: "rpc_method_forbidden",
    });
  });
});
