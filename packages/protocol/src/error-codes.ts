/* Generated from errors/catalog.json — do not edit by hand. */
export const FLUXY_ERROR_HREF_BASE = "https://docs.fluxychat.com/errors" as const;

export const FLUXY_ERROR_CODES = {
  "token_expired": 40100,
  "invalid_token": 40101,
  "invalid_api_key": 40102,
  "anonymous_not_allowed": 40103,
  "auth_refused": 40108,
  "not_member": 40300,
  "banned": 40301,
  "forbidden": 40302,
  "rate_limited": 42900,
  "channel_at_capacity": 44000,
  "send_not_open": 10000,
  "ws_policy": 10008,
  "message_not_found": 40400,
  "feature_not_enabled": 40040,
  "resource_disposed": 40041,
  "discontinuity": 10200,
  "connection_failed": 50000,
} as const;

export type FluxyErrorIdentifier = keyof typeof FLUXY_ERROR_CODES;

export interface FluxyErrorCatalogEntry {
  code: number;
  identifier: FluxyErrorIdentifier;
  title: string;
  httpStatus: number;
  terminal: boolean;
  href: string;
}

export const FLUXY_ERROR_CATALOG: readonly FluxyErrorCatalogEntry[] = [
  {
    code: 40100,
    identifier: "token_expired",
    title: "Session token expired or invalid",
    httpStatus: 401,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/token_expired",
  },
  {
    code: 40101,
    identifier: "invalid_token",
    title: "Session token is not valid",
    httpStatus: 401,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/invalid_token",
  },
  {
    code: 40102,
    identifier: "invalid_api_key",
    title: "API key is not valid",
    httpStatus: 401,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/invalid_api_key",
  },
  {
    code: 40103,
    identifier: "anonymous_not_allowed",
    title: "This room does not allow anonymous access",
    httpStatus: 401,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/anonymous_not_allowed",
  },
  {
    code: 40108,
    identifier: "auth_refused",
    title: "Authentication or room access failed",
    httpStatus: 401,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/auth_refused",
  },
  {
    code: 40300,
    identifier: "not_member",
    title: "You are not a member of this room",
    httpStatus: 403,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/not_member",
  },
  {
    code: 40301,
    identifier: "banned",
    title: "You are banned from this room",
    httpStatus: 403,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/banned",
  },
  {
    code: 40302,
    identifier: "forbidden",
    title: "You are not allowed to join this room",
    httpStatus: 403,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/forbidden",
  },
  {
    code: 42900,
    identifier: "rate_limited",
    title: "Too many requests",
    httpStatus: 429,
    terminal: false,
    href: "https://docs.fluxychat.com/errors/rate_limited",
  },
  {
    code: 44000,
    identifier: "channel_at_capacity",
    title: "This room is at capacity",
    httpStatus: 429,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/channel_at_capacity",
  },
  {
    code: 10000,
    identifier: "send_not_open",
    title: "Cannot send because the socket is not open",
    httpStatus: 0,
    terminal: false,
    href: "https://docs.fluxychat.com/errors/send_not_open",
  },
  {
    code: 10008,
    identifier: "ws_policy",
    title: "WebSocket closed with policy violation",
    httpStatus: 403,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/ws_policy",
  },
  {
    code: 40400,
    identifier: "message_not_found",
    title: "Message not found",
    httpStatus: 404,
    terminal: false,
    href: "https://docs.fluxychat.com/errors/message_not_found",
  },
  {
    code: 40040,
    identifier: "feature_not_enabled",
    title: "This room feature is turned off",
    httpStatus: 400,
    terminal: false,
    href: "https://docs.fluxychat.com/errors/feature_not_enabled",
  },
  {
    code: 40041,
    identifier: "resource_disposed",
    title: "This rooms instance has been disposed",
    httpStatus: 400,
    terminal: true,
    href: "https://docs.fluxychat.com/errors/resource_disposed",
  },
  {
    code: 10200,
    identifier: "discontinuity",
    title: "Realtime history has a gap that could not be filled",
    httpStatus: 0,
    terminal: false,
    href: "https://docs.fluxychat.com/errors/discontinuity",
  },
  {
    code: 50000,
    identifier: "connection_failed",
    title: "WebSocket closed unexpectedly",
    httpStatus: 0,
    terminal: false,
    href: "https://docs.fluxychat.com/errors/connection_failed",
  },
];

const byCode = new Map<number, FluxyErrorCatalogEntry>(
  FLUXY_ERROR_CATALOG.map((entry) => [entry.code, entry]),
);
const byIdentifier = new Map<string, FluxyErrorCatalogEntry>(
  FLUXY_ERROR_CATALOG.map((entry) => [entry.identifier, entry]),
);

export function fluxyErrorByCode(code: number): FluxyErrorCatalogEntry | undefined {
  return byCode.get(code);
}

export function fluxyErrorByIdentifier(
  identifier: string,
): FluxyErrorCatalogEntry | undefined {
  return byIdentifier.get(identifier);
}
