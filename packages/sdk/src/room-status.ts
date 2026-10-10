import type { FluxyRoomConnectionStatus } from "./room-connection";
import type { FluxySubscription } from "./fluxy-subscription";

export type FluxyRoomAttachStatus =
  | "initialized"
  | "attaching"
  | "attached"
  | "detached"
  | "suspended"
  | "failed";

/**
 * Ably `room.status` is a string getter (`=== "attached"`).
 * We keep `current()` / `subscribe` and also `status()` plus `==` via valueOf.
 */
export type FluxyRoomStatusHandle<TChange> = (() => FluxyRoomAttachStatus) & {
  current(): FluxyRoomAttachStatus;
  subscribe(handler: (change: TChange) => void): FluxySubscription;
};

export function attachStatusFromConnection(
  status: FluxyRoomConnectionStatus,
): FluxyRoomAttachStatus {
  if (status === "idle") return "initialized";
  if (status === "connecting") return "attaching";
  if (status === "connected") return "attached";
  if (status === "reconnecting" || status === "suspended") return "suspended";
  if (status === "failed") return "failed";
  return "detached";
}

export function roomStatusFn<TChange>(
  read: () => FluxyRoomAttachStatus,
  subscribe: (handler: (change: TChange) => void) => FluxySubscription,
): FluxyRoomStatusHandle<TChange> {
  const current = () => read();
  const fn = (() => read()) as FluxyRoomStatusHandle<TChange>;
  fn.current = current;
  fn.subscribe = subscribe;
  return new Proxy(fn, {
    get(target, prop, receiver) {
      if (prop === Symbol.toPrimitive || prop === "valueOf") return () => read();
      if (prop === "toString") return () => read();
      return Reflect.get(target, prop, receiver);
    },
  });
}
