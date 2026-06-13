import { describe, expect, it } from "vitest";
import { FLUXY_INBOUND_EVENT_TYPES } from "./index.js";

/**
 * Subset of @fluxy-chat/sdk FluxyChatEvent types that must stay in sync.
 * Expand when the TS SDK union grows.
 */
const SDK_INBOUND_EVENT_TYPES = [
  "message",
  "message_edit",
  "message_delete",
  "message_expired",
  "typing",
  "subscription_succeeded",
  "subscription_count",
  "member_joined",
  "member_left",
  "client_event",
  "agentTyping",
  "tool_call",
  "tool_result",
  "tool_error",
  "agentRun",
  "presence",
  "cache_snapshot",
  "server_event",
  "user_event",
  "user_subscription_succeeded",
  "state_change",
  "stream",
  "error",
] as const;

describe("SDK contract", () => {
  it("includes every SDK inbound event in the protocol registry", () => {
    const protocol = new Set(FLUXY_INBOUND_EVENT_TYPES);
    const missing = SDK_INBOUND_EVENT_TYPES.filter((t) => !protocol.has(t));
    expect(missing).toEqual([]);
  });
});
