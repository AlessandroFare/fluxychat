import {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_PROTOCOL_VERSION,
  FLUXY_SDK_SYNTHETIC_INBOUND_TYPES,
  FLUXY_TRANSPORT_INBOUND_TYPES,
  type FluxyInboundEventType,
  type FluxyOutboundEventType,
} from "./event-types.js";

export {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_PROTOCOL_VERSION,
  FLUXY_SDK_SYNTHETIC_INBOUND_TYPES,
  FLUXY_TRANSPORT_INBOUND_TYPES,
  type FluxyInboundEventType,
  type FluxyOutboundEventType,
};

export interface FluxyProtocolEventBase {
  type: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFluxyInboundEvent(value: unknown): value is FluxyProtocolEventBase & { type: FluxyInboundEventType } {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  return (FLUXY_INBOUND_EVENT_TYPES as readonly string[]).includes(value.type);
}

export function isFluxyOutboundEvent(value: unknown): value is FluxyProtocolEventBase & { type: FluxyOutboundEventType } {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  return (FLUXY_OUTBOUND_EVENT_TYPES as readonly string[]).includes(value.type);
}

export function assertInboundEventType(type: string): FluxyInboundEventType | null {
  return (FLUXY_INBOUND_EVENT_TYPES as readonly string[]).includes(type)
    ? (type as FluxyInboundEventType)
    : null;
}

export {
  parseInboundWsFrame,
  isKnownOutboundClientEvent,
  type ParsedInboundWsFrame,
  type InboundFrameKind,
} from "./parse-inbound-frame.js";

export {
  dispatchInboundWsFrame,
  type InboundDispatchHandlers,
} from "./dispatch-inbound-frame.js";

export {
  isValidLocationTrackEnded,
  isValidLocationTrackId,
  isValidLocationUpdate,
  type LocationSnapshotInbound,
  type LocationTelemetry,
  type LocationTrack,
  type LocationTrackEndedInbound,
  type LocationTrackEndedOutbound,
  type LocationUpdateInbound,
  type LocationUpdateOutbound,
} from "./location-events.js";
