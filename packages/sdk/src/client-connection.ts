import type { FluxyChatRoomConnection, FluxyRoomConnectionStatus } from "./room-connection";

/** Ably `ConnectionStatus` names on `chatClient.connection`. */
export type FluxyClientConnectionStatus =
  | "initialized"
  | "connecting"
  | "connected"
  | "disconnected"
  | "suspended"
  | "failed"
  | "closing"
  | "closed";

export interface FluxyClientConnectionStatusChange {
  current: FluxyClientConnectionStatus;
  previous: FluxyClientConnectionStatus;
  error?: Error;
  retryIn?: number;
}

export type FluxyClientConnectionListener = (change: FluxyClientConnectionStatusChange) => void;

export function mapRoomStatusToClientConnection(
  status: FluxyRoomConnectionStatus,
): FluxyClientConnectionStatus {
  if (status === "idle") return "initialized";
  if (status === "connecting") return "connecting";
  if (status === "connected") return "connected";
  if (status === "reconnecting") return "disconnected";
  if (status === "suspended") return "suspended";
  if (status === "failed") return "failed";
  return "disconnected";
}

export function aggregateClientConnectionStatus(
  rooms: Iterable<FluxyChatRoomConnection>,
  disposed: boolean,
): FluxyClientConnectionStatus {
  if (disposed) return "closed";
  const list = [...rooms].map((room) => mapRoomStatusToClientConnection(room.connectionStatus));
  if (list.length === 0) return "initialized";
  if (list.includes("connected")) return "connected";
  if (list.includes("connecting")) return "connecting";
  if (list.includes("disconnected")) return "disconnected";
  if (list.includes("suspended")) return "suspended";
  if (list.includes("failed")) return "failed";
  return "initialized";
}

export interface FluxyClientConnection {
  readonly status: FluxyClientConnectionStatus;
  readonly error: Error | undefined;
  onStatusChange(listener: FluxyClientConnectionListener): { off: () => void };
  /** Ably `connection.whenState`: resolves immediately if already there. */
  whenState(target: FluxyClientConnectionStatus): Promise<FluxyClientConnectionStatusChange | null>;
  ping(): Promise<number>;
}

export function createClientConnection(options: {
  status: () => FluxyClientConnectionStatus;
  error: () => Error | undefined;
  subscribe: (listener: FluxyClientConnectionListener) => () => void;
  ping: () => Promise<number>;
}): FluxyClientConnection {
  return {
    get status() {
      return options.status();
    },
    get error() {
      return options.error();
    },
    onStatusChange(listener) {
      const off = options.subscribe(listener);
      return { off };
    },
    whenState(target) {
      if (options.status() === target) return Promise.resolve(null);
      return new Promise((resolve) => {
        const off = options.subscribe((change) => {
          if (change.current !== target) return;
          off();
          resolve(change);
        });
      });
    },
    ping() {
      return options.ping();
    },
  };
}
