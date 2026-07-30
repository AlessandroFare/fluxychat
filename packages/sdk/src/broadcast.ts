export interface BroadcastSegment {
  id: string;
  name: string;
  userIds: string[];
}

export interface BroadcastMessage {
  id: string;
  segmentId: string;
  content: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "failed";
  scheduledAt?: string;
  sentAt?: string;
  totalTargets: number;
  delivered: number;
  failed: number;
}

export interface BroadcastApi {
  createSegment(name: string, userIds: string[]): BroadcastSegment;
  getSegment(id: string): BroadcastSegment | null;
  listSegments(): BroadcastSegment[];
  createBroadcast(segmentId: string, content: string, scheduledAt?: string): BroadcastMessage;
  sendBroadcast(broadcastId: string): void;
  getBroadcast(id: string): BroadcastMessage | null;
  listBroadcasts(): BroadcastMessage[];
  getDeliveryStats(broadcastId: string): { delivered: number; failed: number; total: number };
}

export function createBroadcastApi(): BroadcastApi {
  let segCounter = 0;
  let bcCounter = 0;
  const segments = new Map<string, BroadcastSegment>();
  const broadcasts = new Map<string, BroadcastMessage>();
  return {
    createSegment(name, userIds) {
      const id = `seg_${++segCounter}`;
      const seg: BroadcastSegment = { id, name, userIds };
      segments.set(id, seg);
      return seg;
    },
    getSegment(id) { return segments.get(id) ?? null; },
    listSegments() { return [...segments.values()]; },
    createBroadcast(segmentId, content, scheduledAt) {
      const seg = segments.get(segmentId);
      if (!seg) throw new Error(`Segment not found: ${segmentId}`);
      const id = `bc_${++bcCounter}`;
      const msg: BroadcastMessage = { id, segmentId, content, status: scheduledAt ? "scheduled" : "draft", scheduledAt, totalTargets: seg.userIds.length, delivered: 0, failed: 0 };
      broadcasts.set(id, msg);
      return msg;
    },
    sendBroadcast(broadcastId) {
      const bc = broadcasts.get(broadcastId);
      if (!bc) throw new Error(`Broadcast not found: ${broadcastId}`);
      bc.status = "sending";
      const seg = segments.get(bc.segmentId);
      if (seg) bc.totalTargets = seg.userIds.length;
      bc.delivered = bc.totalTargets;
      bc.status = "completed";
      bc.sentAt = new Date().toISOString();
    },
    getBroadcast(id) { return broadcasts.get(id) ?? null; },
    listBroadcasts() { return [...broadcasts.values()]; },
    getDeliveryStats(broadcastId) {
      const bc = broadcasts.get(broadcastId);
      if (!bc) return { delivered: 0, failed: 0, total: 0 };
      return { delivered: bc.delivered, failed: bc.failed, total: bc.totalTargets };
    },
  };
}
