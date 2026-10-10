import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyMessageReactionType } from "./room-messages";

/** Ably `RoomOptions` slice we actually honor on this kernel. */
export interface FluxyNormalizedRoomOptions {
  typing: { heartbeatThrottleMs: number };
  occupancy: { enableEvents: boolean };
  presence: { enableEvents: boolean };
  messages: {
    rawMessageReactions: boolean;
    defaultMessageReactionType: FluxyMessageReactionType;
  };
  members: { offlineTimeoutMs: number };
}

export function roomOptionsFromConnection(
  connection: FluxyChatRoomConnection,
): FluxyNormalizedRoomOptions {
  return {
    typing: { heartbeatThrottleMs: connection.typingHeartbeatThrottleMs },
    occupancy: { enableEvents: connection.occupancyEventsEnabled },
    presence: { enableEvents: connection.presenceEventsEnabled },
    messages: {
      rawMessageReactions: connection.rawMessageReactionsEnabled,
      defaultMessageReactionType: connection.defaultMessageReactionType,
    },
    members: { offlineTimeoutMs: connection.membersOfflineTimeoutMs },
  };
}
