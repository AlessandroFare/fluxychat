export const FLUXY_RELIABILITY_VERSION = "fluxy.reliability.v1" as const;

export type FluxyDeliveryStage = "accepted" | "persisted" | "delivered" | "read";

export interface FluxySequencedEvent<T = unknown> {
  version: typeof FLUXY_RELIABILITY_VERSION;
  roomId: string;
  sequence: number;
  eventId: string;
  occurredAt: string;
  payload: T;
}

export interface FluxySyncCursor {
  version: typeof FLUXY_RELIABILITY_VERSION;
  roomId: string;
  sequence: number;
  snapshotId?: string;
}

export interface FluxyDeliveryReceipt {
  version: typeof FLUXY_RELIABILITY_VERSION;
  roomId: string;
  messageId: string;
  stage: FluxyDeliveryStage;
  actorId?: string;
  occurredAt: string;
}

export type FluxySequenceDecision =
  | { type: "accept"; nextSequence: number }
  | { type: "duplicate"; nextSequence: number }
  | { type: "gap"; expectedSequence: number; receivedSequence: number; nextSequence: number };

/** Pure cursor tracker used by browser, Worker and replay tests. */
export class FluxySequenceTracker {
  private sequence: number;

  constructor(initialSequence = 0) {
    this.sequence = Math.max(0, Math.floor(initialSequence));
  }

  get current(): number {
    return this.sequence;
  }

  inspect(receivedSequence: number): FluxySequenceDecision {
    const received = Math.floor(receivedSequence);
    if (!Number.isSafeInteger(received) || received < 1) throw new TypeError("Sequence must be a positive safe integer.");
    if (received <= this.sequence) return { type: "duplicate", nextSequence: this.sequence };
    if (received > this.sequence + 1) {
      return { type: "gap", expectedSequence: this.sequence + 1, receivedSequence: received, nextSequence: this.sequence };
    }
    this.sequence = received;
    return { type: "accept", nextSequence: this.sequence };
  }

  restore(cursor: FluxySyncCursor): void {
    if (!Number.isSafeInteger(cursor.sequence) || cursor.sequence < 0) throw new TypeError("Cursor sequence is invalid.");
    this.sequence = cursor.sequence;
  }

  cursor(roomId: string, snapshotId?: string): FluxySyncCursor {
    if (!roomId.trim()) throw new TypeError("roomId is required.");
    return {
      version: FLUXY_RELIABILITY_VERSION,
      roomId: roomId.trim(),
      sequence: this.sequence,
      ...(snapshotId ? { snapshotId } : {}),
    };
  }
}

const DELIVERY_ORDER: readonly FluxyDeliveryStage[] = ["accepted", "persisted", "delivered", "read"];

export function compareDeliveryStage(left: FluxyDeliveryStage, right: FluxyDeliveryStage): number {
  return DELIVERY_ORDER.indexOf(left) - DELIVERY_ORDER.indexOf(right);
}

export function advanceDeliveryStage(
  current: FluxyDeliveryStage | undefined,
  incoming: FluxyDeliveryStage,
): FluxyDeliveryStage {
  return current && compareDeliveryStage(current, incoming) >= 0 ? current : incoming;
}
