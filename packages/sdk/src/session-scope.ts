/** Default when hooks sit under `FluxyRealtimeProvider` and omit `sessionScope`. */
export const DEFAULT_PROVIDER_SESSION_SCOPE = "app";

/**
 * One JSON WebSocket per room per scope.
 * Same scope: `useChat` + `useLiveCursors` share the connection.
 * Different widgets on one room: pass distinct `sessionScope` values.
 */
export function resolveRoomSessionScope(
  explicit: string | undefined,
  providerScope: string | undefined,
  instanceId: string,
): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  const fromProvider = providerScope?.trim();
  if (fromProvider) return fromProvider;
  return instanceId;
}
