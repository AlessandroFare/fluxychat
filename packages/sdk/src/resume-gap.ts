import {
  FLUXY_RELIABILITY_VERSION,
  FluxySequenceTracker,
} from "@fluxy-chat/protocol";

export interface SequencedFrame<T> {
  seq: number;
  event: T;
}

export type ResumeGapObserve<T> =
  | { kind: "deliver"; events: T[] }
  | { kind: "duplicate" }
  | { kind: "hold" }
  | {
      kind: "gap";
      expectedSeq: number;
      receivedSeq: number;
      resumeFrom: number;
    }
  | {
      kind: "discontinuity";
      expectedSeq: number;
      receivedSeq: number;
      events: T[];
    };

/**
 * Live seq cursor: buffer a gapped frame, apply missed oldest-first, or jump
 * with discontinuity when the hole cannot be filled.
 */
export class FluxyResumeGapWalker<T> {
  readonly tracker: FluxySequenceTracker;
  private readonly roomId: string;
  private readonly buffer = new Map<number, T>();
  private filling = false;
  private gapExpected = 0;
  private gapReceived = 0;

  constructor(roomId: string, initialSeq = 0) {
    this.roomId = roomId;
    this.tracker = new FluxySequenceTracker(initialSeq);
  }

  get currentSeq(): number {
    return this.tracker.current;
  }

  get isFilling(): boolean {
    return this.filling;
  }

  observe(seq: number | undefined, event: T): ResumeGapObserve<T> {
    if (seq == null || !Number.isSafeInteger(seq) || seq < 1) {
      return { kind: "deliver", events: [event] };
    }

    if (this.tracker.current === 0) {
      this.tracker.restore({
        version: FLUXY_RELIABILITY_VERSION,
        roomId: this.roomId,
        sequence: seq,
      });
      return { kind: "deliver", events: [event] };
    }

    if (this.filling) {
      this.buffer.set(seq, event);
      return { kind: "hold" };
    }

    const decision = this.tracker.inspect(seq);
    if (decision.type === "duplicate") return { kind: "duplicate" };
    if (decision.type === "accept") {
      return { kind: "deliver", events: [event, ...this.drainContiguous()] };
    }

    this.filling = true;
    this.gapExpected = decision.expectedSequence;
    this.gapReceived = decision.receivedSequence;
    this.buffer.set(seq, event);
    return {
      kind: "gap",
      expectedSeq: decision.expectedSequence,
      receivedSeq: decision.receivedSequence,
      resumeFrom: this.tracker.current,
    };
  }

  /** Missed log rows (oldest first). Returns events now contiguous. */
  applyMissed(frames: SequencedFrame<T>[]): T[] {
    for (const frame of frames) {
      if (frame.seq < 1) continue;
      this.buffer.set(frame.seq, frame.event);
    }
    const delivered = this.drainContiguous();
    if (this.buffer.size === 0) this.filling = false;
    return delivered;
  }

  /**
   * Hole could not be filled. Jump the cursor to the highest buffered seq
   * and release what we have (oldest first).
   */
  abandonGap(): Extract<ResumeGapObserve<T>, { kind: "discontinuity" }> {
    const expected = this.gapExpected || this.tracker.current + 1;
    const seqs = [...this.buffer.keys()].sort((a, b) => a - b);
    const received = seqs[seqs.length - 1] ?? this.gapReceived;
    const events: T[] = [];
    for (const seq of seqs) {
      const event = this.buffer.get(seq);
      if (event !== undefined) events.push(event);
    }
    this.buffer.clear();
    this.filling = false;
    if (received > this.tracker.current) {
      this.tracker.restore({
        version: FLUXY_RELIABILITY_VERSION,
        roomId: this.roomId,
        sequence: received,
      });
    }
    return {
      kind: "discontinuity",
      expectedSeq: expected,
      receivedSeq: received,
      events,
    };
  }

  private drainContiguous(): T[] {
    const out: T[] = [];
    let seq = this.tracker.current + 1;
    while (this.buffer.has(seq)) {
      const event = this.buffer.get(seq)!;
      this.buffer.delete(seq);
      this.tracker.inspect(seq);
      out.push(event);
      seq += 1;
    }
    return out;
  }
}
