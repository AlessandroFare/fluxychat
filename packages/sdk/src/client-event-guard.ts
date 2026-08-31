const POINTER_NAME =
  /(^|-)(cursor|pointer|mousemove|mouse-move|presence)(-|$)/i;

export function isPointerLikeClientEventName(eventName: string): boolean {
  return POINTER_NAME.test(eventName);
}

/** Dev-only: pointers belong on sendCursor (600/min), not client_event (10/min). */
export function warnIfPointerOnClientEvent(eventName: string): void {
  const isProd =
    typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  if (isProd) return;
  if (!isPointerLikeClientEventName(eventName)) return;
  console.warn(
    `FluxyChat: "${eventName}" looks like a pointer. Use sendCursor (WebSocket type cursor), not sendClientEvent.`,
  );
}
