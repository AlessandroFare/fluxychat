/**
 * Yjs collaboration adapter contract — production whiteboard path per ADL.
 * Runtime Yjs wiring lives in apps/dashboard/components/collab/yjs-provider.tsx
 * and apps/worker/src/lib/yjs-sync.js (DO persistence).
 */

export interface YjsSnapshotPolicy {
  maxOps: number;
  maxAgeMs: number;
}

export const YJS_SNAPSHOT_POLICY: YjsSnapshotPolicy = {
  maxOps: 1000,
  maxAgeMs: 3_600_000,
};

export interface YjsCollabDocumentRef {
  docId: string;
  roomId: string;
}

export interface YjsCollabPort {
  readonly snapshotPolicy: YjsSnapshotPolicy;
  createDocumentRef(roomId: string, docId?: string): YjsCollabDocumentRef;
  shouldSnapshot(opCount: number, lastSnapshotAtMs: number, nowMs?: number): boolean;
}

export function createYjsCollabPort(): YjsCollabPort {
  return {
    snapshotPolicy: YJS_SNAPSHOT_POLICY,
    createDocumentRef(roomId, docId) {
      return { docId: docId ?? `doc_${roomId}`, roomId };
    },
    shouldSnapshot(opCount, lastSnapshotAtMs, nowMs = Date.now()) {
      return opCount >= YJS_SNAPSHOT_POLICY.maxOps
        || nowMs - lastSnapshotAtMs >= YJS_SNAPSHOT_POLICY.maxAgeMs;
    },
  };
}
