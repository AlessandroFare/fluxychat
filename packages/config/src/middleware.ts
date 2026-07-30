import type {
  FluxyMiddlewareDefinition,
  FluxyMiddlewareKind,
  FluxyPublishMiddleware,
  FluxyDisconnectMiddleware,
  FluxyMiddlewareResult,
  FluxyRoomCapabilities,
  FluxyAuthzResult,
} from "./types.js";

export function allow(
  capabilities: FluxyRoomCapabilities = { publish: true },
): FluxyAuthzResult {
  return { action: "allow", capabilities };
}

export function block(reason: string): FluxyAuthzResult {
  return { action: "block", reason };
}

export function allowPublish(): FluxyMiddlewareResult {
  return { action: "allow" };
}

export function blockPublish(reason: string): FluxyMiddlewareResult {
  return { action: "block", reason };
}

export function maskContent<T>(content: T): FluxyMiddlewareResult<T> {
  return { action: "mask", content };
}

export function defineMiddleware<T = unknown>(
  kind: "publish",
  handler: FluxyPublishMiddleware<T>,
  name?: string,
): FluxyMiddlewareDefinition<T>;
export function defineMiddleware(
  kind: "disconnect",
  handler: FluxyDisconnectMiddleware,
  name?: string,
): FluxyMiddlewareDefinition;
export function defineMiddleware<T = unknown>(
  kind: FluxyMiddlewareKind,
  handler: FluxyPublishMiddleware<T> | FluxyDisconnectMiddleware,
  name?: string,
): FluxyMiddlewareDefinition<T> {
  return { kind, name, handler: handler as FluxyPublishMiddleware<T> };
}
