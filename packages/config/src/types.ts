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

export interface FluxyRoomExtensionSlot {
  id: string;
  /** Hosted slots are declared kinds. Arbitrary JS is self-host `onPublish` only. */
  kind: "kv" | "counter";
}

export interface FluxyHostedRoomOverlay {
  anonymous?: boolean;
  guestCanPublish?: boolean;
  denySubstrings?: string[];
  capabilities?: FluxyRoomCapabilities;
  extensions?: FluxyRoomExtensionSlot[];
  /** Hosted four-eyes flag. Chain steps still live on the room DO. */
  makerChecker?: boolean;
}

export interface FluxyHostedOverlay {
  denySubstrings?: string[];
  guestCanPublish?: boolean;
  iotAutoAgentId?: string | null;
  rooms?: Record<string, FluxyHostedRoomOverlay>;
}

export interface FluxyRoomConfig {
  /** Allow anonymous JWT connections (default true). */
  anonymous?: boolean;
  /** Serializes to hosted overlay. Self-host `authz` still wins on conflict. */
  guestCanPublish?: boolean;
  denySubstrings?: string[];
  capabilities?: FluxyRoomCapabilities;
  /** Max 5 declared slots. Snapshots live on the room Durable Object. */
  extensions?: FluxyRoomExtensionSlot[];
  authz?: (ctx: FluxyAuthzContext) => FluxyAuthzResult | Promise<FluxyAuthzResult>;
  onPublish?: FluxyPublishMiddleware[];
  onDisconnect?: FluxyDisconnectMiddleware[];
  notify?: (
    ctx: FluxyNotifyContext,
  ) => FluxyNotifyDescriptor | null | Promise<FluxyNotifyDescriptor | null>;
  /** Four-eyes: requester cannot approve; agent cannot approve. */
  makerChecker?: boolean;
}

export interface FluxyClientDefaults {
  readOn?: "mount" | "visible" | "manual";
  wsCache?: "on" | "off";
  historyLimit?: number;
  pollIntervalMs?: number;
}

export interface FluxyAgentPolicy {
  mention?: boolean;
  tools?: string[];
  dailyTokenCap?: number;
  /** Tools run as the invoking user, not as the bot row. */
  onBehalfOf?: boolean;
  /**
   * AI SDK 7-style approval. `user-approval` maps to room HITL (quorum / chain).
   * `needsApproval` on tool() stays only for WorkflowAgent.
   */
  toolApproval?: "not-applicable" | "approved" | "denied" | "user-approval";
  /**
   * HTTPS OPA/Rego endpoint. POST body is `buildAgentPolicyOpaInput`.
   * Same expectation as `@ai-sdk/policy-opa`; we do not vendor that package.
   */
  opaUrl?: string;
  /**
   * Visible autonomy for this agent's tools. `act-autonomous` still respects HITL when
   * `toolApproval` is `user-approval` or the room chain is set.
   */
  toolAutonomy?: "assist" | "recommend" | "act-with-approval" | "act-autonomous";
}

export interface FluxyConfig {
  /** Public worker URL hint for docs / CLI scaffolds. */
  workerUrl?: string;
  /** Hosted overlay (PUT /admin/projects/:id/publish-config). Not Worker-bundled callbacks. */
  hostedPublish?: {
    denySubstrings?: string[];
    guestCanPublish?: boolean;
    iotAutoAgentId?: string | null;
  };
  /** Room Decisions: System One / deterministic gates. Not chat generation. */
  decisions?: {
    shouldRespond?: { mode?: "keyword" | "invoke_only" | "calibrated" | "silent"; threshold?: number };
    approveTool?: { mode?: "shadow" | "warn" | "enforce" };
    routeModel?: { mode?: "shadow" | "warn" | "enforce" };
    notifyTriage?: { mode?: "shadow" | "warn" | "enforce" };
    autoSummon?: { mode?: "shadow" | "warn" | "enforce" };
    nlPolicy?: { mode?: "shadow" | "warn" | "enforce" };
  };
  auth?: FluxyAuthConfig;
  /** Room keys: exact id or template ending in `*` (Portal-style). */
  rooms?: Record<string, FluxyRoomConfig>;
  /** Defaults surfaced to SDK clients via GET /config/client. */
  client?: FluxyClientDefaults;
  /**
   * Who may @mention, which tools, daily token cap. Enforced when the Worker
   * loads this file; hosted overlay does not run these callbacks.
   */
  agents?: Record<string, FluxyAgentPolicy>;
  /** Hint for self-host wrangler `limits` / DO jurisdiction. Not applied by hosted SaaS. */
  jurisdiction?: "eu";
}

export type FluxyMiddlewareKind = "publish" | "disconnect";

export interface FluxyMiddlewareDefinition<T = unknown> {
  kind: FluxyMiddlewareKind;
  name?: string;
  handler: FluxyPublishMiddleware<T> | FluxyDisconnectMiddleware;
}
