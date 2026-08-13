/** Inbound WebSocket events broadcast by the worker / Room DO. */
export const FLUXY_INBOUND_EVENT_TYPES = [
  "message",
  /** Worker Room DO broadcast while a message body is updated (streaming deltas + final). */
  "edit",
  /** Alias retained for docs / older clients. */
  "message_edit",
  /** Stable alias for in-place edits (version bump, same logical id). */
  "message_updated",
  "message_delete",
  /** Tombstone alias for soft deletes (deletedAt set, no ghost row). */
  "message_deleted",
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
  "approval_request",
  "approval_decision",
  "agentRun",
  "presence",
  "cache_snapshot",
  "server_event",
  "capability_event",
  "user_event",
  "user_subscription_succeeded",
  "state_change",
  "stream",
  /** Active partial stream when (re)connecting to a room mid-generation. */
  "streamState",
  "location_update",
  "location_snapshot",
  "location_track_ended",
  "pong",
  "error",
] as const;

/** Outbound client → room events (Room DO handlers). */
export const FLUXY_OUTBOUND_EVENT_TYPES = [
  "ping",
  "message",
  "stream",
  "edit",
  "reaction",
  "read",
  "delete",
  "typing",
  "client_event",
  "location_update",
  "location_track_ended",
  "agentTyping",
  /** Reconnect: client sends lastSeq; server replays room_message_events with seq > lastSeq. */
  "resume",
] as const;

/** Worker → client transport frames handled before dispatch. */
export const FLUXY_TRANSPORT_INBOUND_TYPES = ["pong", "replay"] as const;

/** Client-side synthetic events (REST replay / local merge). */
export const FLUXY_SDK_SYNTHETIC_INBOUND_TYPES = ["history"] as const;

export type FluxyInboundEventType = (typeof FLUXY_INBOUND_EVENT_TYPES)[number];
export type FluxyOutboundEventType = (typeof FLUXY_OUTBOUND_EVENT_TYPES)[number];

export const FLUXY_PROTOCOL_VERSION = "1.0.0";
