import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyPresence } from "./presence-patch";
import type { FluxyChatRoomConnection } from "./room-connection";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";
import {
  FLUXY_LEAVER_TTL_MS,
  forgetLeaver,
  pruneLeavers,
  rememberLeaver,
  type FluxyLeaver,
  type FluxyPresenceMember,
} from "./presence-avatars";

export type FluxyMemberEventType = "enter" | "leave" | "update" | "updateProfile" | "remove";

export interface FluxySpaceMember {
  userId: string;
  userInfo?: Record<string, unknown>;
  isConnected: boolean;
  lastEvent: FluxyMemberEventType;
  lastSeenAt?: number;
}

export interface FluxyMemberEvent {
  type: FluxyMemberEventType;
  member: FluxySpaceMember;
}

export interface FluxyRoomMembers {
  updateProfile(data: Partial<FluxyPresence>): void;
  getSelf(): Promise<FluxySpaceMember | undefined>;
  getOthers(): Promise<FluxySpaceMember[]>;
  getAll(): Promise<FluxySpaceMember[]>;
  subscribe(
    eventsOrHandler: FluxyMemberEventType | FluxyMemberEventType[] | ((event: FluxyMemberEvent) => void),
    handler?: (event: FluxyMemberEvent) => void,
  ): FluxySubscription;
}

function asMember(
  row: FluxyPresenceMember,
  lastEvent: FluxyMemberEventType,
  extra?: { isConnected?: boolean; lastSeenAt?: number },
): FluxySpaceMember {
  return {
    userId: row.userId,
    ...(row.userInfo ? { userInfo: row.userInfo } : {}),
    isConnected: extra?.isConnected !== false,
    lastEvent,
    ...(extra?.lastSeenAt != null ? { lastSeenAt: extra.lastSeenAt } : {}),
  };
}

function leaverMember(row: FluxyLeaver): FluxySpaceMember {
  return {
    userId: row.userId,
    ...(row.userInfo ? { userInfo: row.userInfo } : {}),
    isConnected: false,
    lastEvent: "leave",
    lastSeenAt: row.lastSeenAt,
  };
}

function eventTypes(
  eventsOrHandler: FluxyMemberEventType | FluxyMemberEventType[] | ((event: FluxyMemberEvent) => void),
  handler?: (event: FluxyMemberEvent) => void,
): { types: Set<FluxyMemberEventType> | null; handler: (event: FluxyMemberEvent) => void } {
  if (typeof eventsOrHandler === "function") {
    return { types: null, handler: eventsOrHandler };
  }
  const list = Array.isArray(eventsOrHandler) ? eventsOrHandler : [eventsOrHandler];
  return { types: new Set(list), handler: handler ?? (() => {}) };
}

export function bindRoomMembers(connection: FluxyChatRoomConnection): FluxyRoomMembers {
  let leavers: Record<string, FluxyLeaver> = {};
  const listeners = new Set<(event: FluxyMemberEvent) => void>();
  const removeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const ttl =
    typeof connection.membersOfflineTimeoutMs === "number"
      ? connection.membersOfflineTimeoutMs
      : FLUXY_LEAVER_TTL_MS;

  function emit(type: FluxyMemberEventType, member: FluxySpaceMember) {
    const event: FluxyMemberEvent = { type, member: { ...member, lastEvent: type } };
    for (const listener of listeners) listener(event);
  }

  function clearRemoveTimer(userId: string) {
    const timer = removeTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      removeTimers.delete(userId);
    }
  }

  function scheduleRemove(member: FluxySpaceMember) {
    clearRemoveTimer(member.userId);
    removeTimers.set(
      member.userId,
      setTimeout(() => {
        removeTimers.delete(member.userId);
        leavers = forgetLeaver(leavers, member.userId);
        emit("remove", { ...member, isConnected: false, lastEvent: "remove" });
        emit("update", { ...member, isConnected: false, lastEvent: "remove" });
      }, ttl),
    );
  }

  connection.onAnyEvent((event: FluxyChatEvent) => {
    leavers = pruneLeavers(leavers, Date.now(), ttl);
    if (event.type === "member_joined") {
      const member = asMember(
        { userId: event.userId, ...(event.userInfo ? { userInfo: event.userInfo } : {}) },
        "enter",
      );
      leavers = forgetLeaver(leavers, event.userId);
      clearRemoveTimer(event.userId);
      emit("enter", member);
      emit("update", member);
      return;
    }
    if (event.type === "member_left") {
      const member = asMember({ userId: event.userId }, "leave", {
        isConnected: false,
        lastSeenAt: Date.now(),
      });
      leavers = rememberLeaver(leavers, { userId: event.userId }, Date.now());
      emit("leave", member);
      emit("update", member);
      scheduleRemove(member);
      return;
    }
    if (event.type === "presence_patch") {
      const member = asMember(
        { userId: event.userId, userInfo: event.data as Record<string, unknown> },
        "updateProfile",
      );
      emit("updateProfile", member);
      emit("update", member);
    }
  });

  async function roster(): Promise<FluxySpaceMember[]> {
    const live = await connection.fetchLiveMembers();
    const present = new Set(live.map((row) => row.userId));
    const connected = live.map((row) => asMember(row, "enter"));
    const lingering = Object.values(leavers)
      .filter((row) => !present.has(row.userId))
      .map(leaverMember);
    return [...connected, ...lingering];
  }

  return {
    updateProfile(data) {
      connection.sendPresencePatch(data);
    },
    async getSelf() {
      const rows = await roster();
      return rows.find((row) => row.userId === connection.userId);
    },
    async getOthers() {
      const rows = await roster();
      return rows.filter((row) => row.userId !== connection.userId);
    },
    getAll() {
      return roster();
    },
    subscribe(eventsOrHandler, handler) {
      const parsed = eventTypes(eventsOrHandler, handler);
      const listener = (event: FluxyMemberEvent) => {
        if (parsed.types && !parsed.types.has(event.type)) return;
        parsed.handler(event);
      };
      listeners.add(listener);
      return fluxySubscription(() => {
        listeners.delete(listener);
      });
    },
  };
}
