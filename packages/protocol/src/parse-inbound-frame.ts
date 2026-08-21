import {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_SDK_SYNTHETIC_INBOUND_TYPES,
} from "./event-types.js";
import { isWsFrameWithinSizeLimit } from "./frame-size.js";
import { isUnknownWsFrame, type UnknownWsFrame } from "./unknown-frame.js";

export type { UnknownWsFrame } from "./unknown-frame.js";

export type InboundFrameKind = "pong" | "replay" | "event" | "unknown";

export interface ParsedInboundWsFrame {
  kind: InboundFrameKind;
  event?: Record<string, unknown>;
  messages?: unknown[];
  /** Present when kind is `unknown` — full frame passthrough (forward-compat). */
  frame?: UnknownWsFrame;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isDeliverableInboundType(type: string): boolean {
  return (
    (FLUXY_INBOUND_EVENT_TYPES as readonly string[]).includes(type) ||
    (FLUXY_SDK_SYNTHETIC_INBOUND_TYPES as readonly string[]).includes(type)
  );
}

export function parseInboundWsFrame(raw: string): ParsedInboundWsFrame | null {
  if (typeof raw === "string" && !isWsFrameWithinSizeLimit(raw)) return null;
  const data = parseJson(raw);
  if (!isRecord(data) || typeof data.type !== "string") return null;

  if (data.type === "pong") return { kind: "pong" };
  if (data.type === "replay") {
    const messages = Array.isArray(data.messages) ? data.messages : [];
    return { kind: "replay", messages };
  }

  if (!isDeliverableInboundType(data.type)) {
    if (isUnknownWsFrame(data)) {
      return { kind: "unknown", frame: data };
    }
    return null;
  }

  return { kind: "event", event: data };
}

export function isKnownOutboundClientEvent(value: unknown): value is Record<string, unknown> & { type: string } {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (!isWsFrameWithinSizeLimit(value)) return false;
  return (FLUXY_OUTBOUND_EVENT_TYPES as readonly string[]).includes(value.type);
}
