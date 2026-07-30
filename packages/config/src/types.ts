export interface FluxyClaimMap {
  userId?: string;
  username?: string;
  anon?: string;
}

export interface FluxyAuthConfig {
  issuer?: string;
  jwksUrl?: string;
  claimMap?: FluxyClaimMap;
}

export interface FluxyRoomCapabilities {
  publish?: boolean;
  sendDirect?: boolean;
  invokeAgent?: boolean;
  react?: boolean;
  [key: string]: boolean | undefined;
}

export interface FluxyAuthzContext {
  roomId: string;
  userId: string;
  claims: Record<string, unknown>;
  anonymous: boolean;
}

export type FluxyAuthzResult =
  | { action: "allow"; capabilities: FluxyRoomCapabilities }
  | { action: "block"; reason: string };

export interface FluxyPublishMessage<T = unknown> {
  content: T;
  rawContent: string;
  replyTo?: number | null;
  attachments?: unknown[];
}

export interface FluxyPublishContext<T = unknown> {
  roomId: string;
  userId: string;
  capabilities: FluxyRoomCapabilities;
  message: FluxyPublishMessage<T>;
}

export type FluxyMiddlewareResult<T = unknown> =
  | { action: "allow" }
  | { action: "block"; reason: string }
  | { action: "mask"; content: T };

export type FluxyPublishMiddleware<T = unknown> = (
  ctx: FluxyPublishContext<T>,
) => FluxyMiddlewareResult<T> | Promise<FluxyMiddlewareResult<T>>;

export interface FluxyDisconnectContext {
  roomId: string;
  userId: string;
  reason: string;
}

export type FluxyDisconnectMiddleware = (
  ctx: FluxyDisconnectContext,
) => void | Promise<void>;

export interface FluxyNotifyContext<T = unknown> {
  roomId: string;
  message: FluxyPublishMessage<T>;
  senderId: string;
  mentions?: Array<{ userId: string }>;
}

export interface FluxyNotifyDescriptor {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  to?: string[];
}

export interface FluxyRoomConfig {
  /** Allow anonymous JWT connections (default true). */
  anonymous?: boolean;
  authz?: (ctx: FluxyAuthzContext) => FluxyAuthzResult | Promise<FluxyAuthzResult>;
  onPublish?: FluxyPublishMiddleware[];
  onDisconnect?: FluxyDisconnectMiddleware[];
  notify?: (
    ctx: FluxyNotifyContext,
  ) => FluxyNotifyDescriptor | null | Promise<FluxyNotifyDescriptor | null>;
}

export interface FluxyClientDefaults {
  readOn?: "mount" | "visible" | "manual";
  wsCache?: "on" | "off";
  historyLimit?: number;
  pollIntervalMs?: number;
}

export interface FluxyConfig {
  /** Public worker URL hint for docs / CLI scaffolds. */
  workerUrl?: string;
  auth?: FluxyAuthConfig;
  /** Room keys: exact id or template ending in `*` (Portal-style). */
  rooms?: Record<string, FluxyRoomConfig>;
  /** Defaults surfaced to SDK clients via GET /config/client. */
  client?: FluxyClientDefaults;
}

export type FluxyMiddlewareKind = "publish" | "disconnect";

export interface FluxyMiddlewareDefinition<T = unknown> {
  kind: FluxyMiddlewareKind;
  name?: string;
  handler: FluxyPublishMiddleware<T> | FluxyDisconnectMiddleware;
}
