import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import {
  occupancyCurrentFn,
  occupancyEventFromData,
  occupancyFromEvent,
  type FluxyOccupancyCurrent,
  type FluxyOccupancyData,
  type FluxyOccupancyEvent,
} from "./occupancy";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";
import { FluxyErrorInfo } from "./errors";
import { bindRoomLocks, type FluxyRoomLocks } from "./room-locks";
import { bindRoomTyping, type FluxyRoomTyping } from "./room-typing";
import { bindRoomReactions, type FluxyRoomReactions } from "./room-reactions";
import { bindRoomPresence, type FluxyRoomPresence } from "./room-presence";
import { bindRoomMembers, type FluxyRoomMembers } from "./room-members";
import { bindRoomLocations, type FluxyRoomLocations } from "./room-locations";
import { bindRoomMessages, type FluxyRoomMessages } from "./room-messages";
import { bindRoomObjects, type FluxyRoomObjects } from "./room-objects";
import { bindRoomCursors, type FluxyRoomCursors } from "./room-cursors";
import {
  attachStatusFromConnection,
  roomStatusFn,
  type FluxyRoomAttachStatus,
  type FluxyRoomStatusHandle,
} from "./room-status";
import {
  roomOptionsFromConnection,
  type FluxyNormalizedRoomOptions,
} from "./room-options";

export interface FluxyRoomOccupancy {
  subscribe(
    handler: (event: FluxyOccupancyEvent) => void,
  ): FluxySubscription;
  current: FluxyOccupancyCurrent;
  get(): Promise<FluxyOccupancyData>;
}

export type { FluxyRoomMessages } from "./room-messages";

export interface FluxyRoomStatusChange {
  current: FluxyRoomAttachStatus;
  previous: FluxyRoomAttachStatus;
  retryIn?: number;
  error?: string;
}

export type FluxyRoomStatus = FluxyRoomStatusHandle<FluxyRoomStatusChange>;

export interface FluxyBoundRoom {
  roomId: string;
  name: string;
  options: FluxyNormalizedRoomOptions;
  connection: FluxyChatRoomConnection;
  locks: FluxyRoomLocks;
  occupancy: FluxyRoomOccupancy;
  typing: FluxyRoomTyping;
  reactions: FluxyRoomReactions;
  presence: FluxyRoomPresence;
  members: FluxyRoomMembers;
  locations: FluxyRoomLocations;
  messages: FluxyRoomMessages;
  objects: FluxyRoomObjects;
  cursors: FluxyRoomCursors;
  status: FluxyRoomStatus;
  error: Error | null;
  attach(): Promise<void>;
  detach(): Promise<void>;
  onStatusChange(handler: (change: FluxyRoomStatusChange) => void): FluxySubscription;
  onOccupancy(
    handler: (event: Extract<FluxyChatEvent, { type: "occupancy" }>) => void,
  ): FluxySubscription;
  onDiscontinuity(
    handler: (reason: FluxyErrorInfo) => void,
  ): FluxySubscription;
}

function waitForMappedStatus(
  connection: FluxyChatRoomConnection,
  targets: FluxyRoomAttachStatus[],
): Promise<FluxyRoomAttachStatus> {
  const now = attachStatusFromConnection(connection.connectionStatus);
  if (targets.includes(now)) return Promise.resolve(now);
  return new Promise((resolve) => {
    const off = connection.onConnectionStatus((status) => {
      const mapped = attachStatusFromConnection(status);
      if (!targets.includes(mapped)) return;
      off();
      resolve(mapped);
    });
  });
}

export function bindFluxyRoom(
  roomId: string,
  connection: FluxyChatRoomConnection,
): FluxyBoundRoom {
  const id = roomId.trim();
  return {
    roomId: id,
    name: id,
    get options() {
      return roomOptionsFromConnection(connection);
    },
    connection,
    locks: bindRoomLocks(connection),
    occupancy: {
      subscribe(handler) {
        if (!connection.occupancyEventsEnabled) {
          throw new FluxyErrorInfo({
            identifier: "feature_not_enabled",
            operation: "subscribe occupancy",
            reason: "occupancy events are disabled for this room",
          });
        }
        return fluxySubscription(
          connection.onOccupancy((event) =>
            handler(occupancyEventFromData(occupancyFromEvent(event))),
          ),
        );
      },
      current: occupancyCurrentFn(() => {
        if (!connection.occupancyEventsEnabled) {
          throw new FluxyErrorInfo({
            identifier: "feature_not_enabled",
            operation: "read occupancy",
            reason: "occupancy events are disabled for this room",
          });
        }
        return connection.occupancyCurrent;
      }),
      get() {
        return connection.fetchOccupancy();
      },
    },
    typing: bindRoomTyping(connection),
    reactions: bindRoomReactions(connection),
    presence: bindRoomPresence(connection),
    members: bindRoomMembers(connection),
    locations: bindRoomLocations(connection),
    messages: bindRoomMessages(connection),
    objects: bindRoomObjects(connection),
    cursors: bindRoomCursors(connection),
    status: roomStatusFn(
      () => attachStatusFromConnection(connection.connectionStatus),
      (handler) => {
        const listener = (event: FluxyChatEvent) => {
          if (event.type !== "state_change") return;
          handler({
            current: attachStatusFromConnection(event.current),
            previous: attachStatusFromConnection(event.previous),
            ...(event.retryIn != null ? { retryIn: event.retryIn } : {}),
            ...(event.error ? { error: event.error } : {}),
          });
        };
        connection.onAnyEvent(listener);
        return fluxySubscription(() => connection.offAnyEvent(listener));
      },
    ),
    get error() {
      return connection.getLastError();
    },
    async attach() {
      if (attachStatusFromConnection(connection.connectionStatus) === "attached") return;
      connection.connect();
      const next = await waitForMappedStatus(connection, ["attached", "failed", "suspended"]);
      if (next === "attached") return;
      throw new FluxyErrorInfo({
        identifier: "connection_failed",
        operation: "attach room",
        reason: next === "suspended" ? "room suspended" : "room failed",
        cause: connection.getLastError() ?? undefined,
      });
    },
    async detach() {
      const now = attachStatusFromConnection(connection.connectionStatus);
      if (now === "detached" || now === "initialized") return;
      connection.close();
      await waitForMappedStatus(connection, ["detached", "initialized"]);
    },
    onStatusChange(handler) {
      return this.status.subscribe(handler);
    },
    onOccupancy(handler) {
      if (!connection.occupancyEventsEnabled) {
        throw new FluxyErrorInfo({
          identifier: "feature_not_enabled",
          operation: "subscribe occupancy",
          reason: "occupancy events are disabled for this room",
        });
      }
      return fluxySubscription(connection.onOccupancy(handler));
    },
    onDiscontinuity(handler) {
      const listener = (event: FluxyChatEvent) => {
        if (event.type !== "discontinuity") return;
        handler(
          new FluxyErrorInfo({
            identifier: "discontinuity",
            operation: "resume room",
            reason: `seq gap expected ${event.expectedSeq} received ${event.receivedSeq}`,
          }),
        );
      };
      connection.onAnyEvent(listener);
      return fluxySubscription(() => connection.offAnyEvent(listener));
    },
  };
}
