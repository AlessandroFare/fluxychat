export interface SequencedEvent {
  seq: number;
  roomId: string;
  type: string;
  data: string;
  timestamp: string;
}

export interface RoomSequencerApi {
  nextSeq(roomId: string): number;
  getCurrentSeq(roomId: string): number;
  recordEvent(roomId: string, type: string, data: string): SequencedEvent;
  getEventsSince(roomId: string, fromSeq: number): SequencedEvent[];
  getGapRanges(roomId: string): Array<{ from: number; to: number }>;
  detectGaps(roomId: string, knownSeqs: number[]): number[];
  resetRoom(roomId: string): void;
}

export function createRoomSequencer(): RoomSequencerApi {
  const roomSeqs = new Map<string, number>();
  const roomEvents = new Map<string, SequencedEvent[]>();
  return {
    nextSeq(roomId) {
      const seq = (roomSeqs.get(roomId) ?? 0) + 1;
      roomSeqs.set(roomId, seq);
      return seq;
    },
    getCurrentSeq(roomId) { return roomSeqs.get(roomId) ?? 0; },
    recordEvent(roomId, type, data) {
      const seq = this.nextSeq(roomId);
      const event: SequencedEvent = { seq, roomId, type, data, timestamp: new Date().toISOString() };
      const events = roomEvents.get(roomId) ?? [];
      events.push(event);
      roomEvents.set(roomId, events);
      return event;
    },
    getEventsSince(roomId, fromSeq) {
      return (roomEvents.get(roomId) ?? []).filter((e) => e.seq > fromSeq);
    },
    getGapRanges(roomId) {
      const events = roomEvents.get(roomId) ?? [];
      if (events.length === 0) return [];
      const gaps: Array<{ from: number; to: number }> = [];
      for (let i = 1; i < events.length; i++) {
        if (events[i].seq !== events[i - 1].seq + 1) {
          gaps.push({ from: events[i - 1].seq, to: events[i].seq });
        }
      }
      return gaps;
    },
    detectGaps(roomId, knownSeqs) {
      const sorted = [...new Set(knownSeqs)].sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        for (let s = sorted[i - 1] + 1; s < sorted[i]; s++) gaps.push(s);
      }
      return gaps;
    },
    resetRoom(roomId) {
      roomSeqs.delete(roomId);
      roomEvents.delete(roomId);
    },
  };
}
