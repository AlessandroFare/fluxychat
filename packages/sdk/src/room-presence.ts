import type { FluxyChatEvent, FluxyRoomLiveMember } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyPresence } from "./presence-patch";
import { FluxyErrorInfo, FluxyTimeoutError } from "./errors";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";

/** Ably `PresenceEventType` names. */
export type FluxyPresenceEventType = "enter" | "leave" | "update" | "present";

export interface FluxyPresenceMember {
  userId: string;
  userInfo?: Record<string, unknown>;
  data?: FluxyPresence;
}

export interface FluxyPresenceChatEvent {
  type: FluxyPresenceEventType;
  member: FluxyPresenceMember;
}

export type FluxyRoomPresenceEvent = FluxyPresenceChatEvent;

export interface FluxyPresenceGetParams {
  clientId?: string;
  userId?: string;
  /** Ably `RealtimePresenceParams.waitForSync`. Default true. */
  waitForSync?: boolean;
}

const PRESENCE_SYNC_TIMEOUT_MS = 15_000;

export async function waitForPresenceSync(
  connection: Pick<FluxyChatRoomConnection, "connectionStatus" | "onConnectionStatus">,
  timeoutMs = PRESENCE_SYNC_TIMEOUT_MS,
): Promise<void> {
  const status = connection.connectionStatus;
  if (status == null || status === "connected" || status === "idle") return;
  if (status === "failed" || status === "disconnected") {
    throw new FluxyErrorInfo({
      identifier: "send_not_open",
      operation: "get presence",
      reason: "room is not attached",
    });
  }
  if (typeof connection.onConnectionStatus !== "function") return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new FluxyTimeoutError(timeoutMs));
    }, timeoutMs);
    const stop = connection.onConnectionStatus((next) => {
      if (next === "connected") {
        clearTimeout(timer);
        stop();
        resolve();
      }
      if (next === "failed" || next === "disconnected") {
        clearTimeout(timer);
        stop();
        reject(
          new FluxyErrorInfo({
            identifier: "send_not_open",
            operation: "get presence",
            reason: "room is not attached",
          }),
        );
      }
    });
  });
}

export interface FluxyPresenceState {
  present: boolean;
}

export interface FluxyPresenceStateChange {
  previous: FluxyPresenceState;
  current: FluxyPresenceState;
}

export interface FluxyRoomPresence {
  enter(data?: Partial<FluxyPresence>): Promise<void>;
  update(data: Partial<FluxyPresence>): Promise<void>;
  leave(data?: Partial<FluxyPresence>): Promise<void>;
  get(params?: FluxyPresenceGetParams): Promise<FluxyRoomLiveMember[]>;
  getAll(): Promise<FluxyRoomLiveMember[]>;
  getSelf(): Promise<FluxyRoomLiveMember | undefined>;
  getOthers(): Promise<FluxyRoomLiveMember[]>;
  isUserPresent(userId: string): Promise<boolean>;
  onPresenceStateChange(
    handler: (change: FluxyPresenceStateChange) => void,
  ): FluxySubscription;
  subscribe(
    typesOrHandler:
      | FluxyPresenceEventType
      | FluxyPresenceEventType[]
      | ((event: FluxyPresenceChatEvent) => void),
    handler?: (event: FluxyPresenceChatEvent) => void,
  ): FluxySubscription;
}

export function presenceEventsFromWire(event: FluxyChatEvent): FluxyPresenceChatEvent[] {
  if (event.type === "member_joined") {
    return [
      {
        type: "enter",
        member: {
          userId: event.userId,
          ...(event.userInfo ? { userInfo: event.userInfo } : {}),
        },
      },
    ];
  }
  if (event.type === "member_left") {
    return [
      {
        type: "leave",
        member: {
          userId: event.userId,
          ...(event.data ? { data: event.data } : {}),
        },
      },
    ];
  }
  if (event.type === "presence_patch") {
    return [{ type: "update", member: { userId: event.userId, data: event.data } }];
  }
  if (event.type === "subscription_succeeded") {
    return event.members.map((row) => ({
      type: "present" as const,
      member: {
        userId: row.userId,
        ...(row.userInfo ? { userInfo: row.userInfo } : {}),
      },
    }));
  }
  return [];
}

export function bindRoomPresence(connection: FluxyChatRoomConnection): FluxyRoomPresence {
  let present = false;
  const stateListeners = new Set<(change: FluxyPresenceStateChange) => void>();

  function emitPresenceState(next: boolean) {
    if (present === next) return;
    const previous = { present };
    present = next;
    const change = { previous, current: { present } };
    for (const handler of stateListeners) handler(change);
  }

  return {
    enter(data) {
      connection.sendPresencePatch(data ?? { agentStatus: null });
      emitPresenceState(true);
      return Promise.resolve();
    },
    update(data) {
      connection.sendPresencePatch(data);
      return Promise.resolve();
    },
    leave(data) {
      connection.sendPresenceLeave(data);
      emitPresenceState(false);
      return Promise.resolve();
    },
    async get(params) {
      if (params?.waitForSync !== false) {
        await waitForPresenceSync(connection);
      }
      const members = await connection.fetchLiveMembers();
      const id = (params?.clientId ?? params?.userId ?? "").trim();
      if (!id) return members;
      return members.filter((row) => row.userId === id);
    },
    getAll() {
      return connection.fetchLiveMembers();
    },
    async getSelf() {
      const members = await connection.fetchLiveMembers();
      return members.find((row) => row.userId === connection.userId);
    },
    async getOthers() {
      const members = await connection.fetchLiveMembers();
      return members.filter((row) => row.userId !== connection.userId);
    },
    onPresenceStateChange(handler) {
      stateListeners.add(handler);
      return fluxySubscription(() => {
        stateListeners.delete(handler);
      });
    },
    async isUserPresent(userId) {
      const id = userId.trim();
      if (!id) return false;
      const members = await connection.fetchLiveMembers();
      return members.some((row) => row.userId === id);
    },
    subscribe(typesOrHandler, handler) {
      if (connection.presenceEventsEnabled === false) {
        throw new FluxyErrorInfo({
          identifier: "feature_not_enabled",
          operation: "subscribe presence",
          reason: "presence events are disabled for this room",
        });
      }
      const listenerFn =
        typeof typesOrHandler === "function" ? typesOrHandler : handler;
      if (!listenerFn) {
        throw new Error("unable to subscribe presence; listener required");
      }
      const types =
        typeof typesOrHandler === "function"
          ? null
          : new Set(Array.isArray(typesOrHandler) ? typesOrHandler : [typesOrHandler]);
      const listener = (event: FluxyChatEvent) => {
        for (const mapped of presenceEventsFromWire(event)) {
          if (types && !types.has(mapped.type)) continue;
          listenerFn(mapped);
        }
      };
      connection.onAnyEvent(listener);
      return fluxySubscription(() => connection.offAnyEvent(listener));
    },
  };
}
