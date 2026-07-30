export interface CrdtOperation {
  id: string;
  userId: string;
  type: "insert" | "delete" | "replace";
  position: number;
  length?: number;
  value?: string;
  timestamp: string;
  siteId: number;
  version: number;
}

export interface CrdtDocument {
  id: string;
  content: string;
  operations: CrdtOperation[];
  version: number;
  lastModified: string;
}

export interface CrdtAwareness {
  userId: string;
  cursorPosition?: number;
  selectionStart?: number;
  selectionEnd?: number;
  lastActive: string;
}

export interface CrdtSnapshot {
  documentId: string;
  content: string;
  version: number;
  timestamp: string;
}

export interface CrdtApi {
  createDocument(id: string, initialContent?: string): CrdtDocument;
  getDocument(id: string): CrdtDocument | null;
  applyOperation(docId: string, op: Omit<CrdtOperation, "id" | "version" | "timestamp">): CrdtOperation;
  getOperationsSince(docId: string, version: number): CrdtOperation[];
  getDocumentAtVersion(docId: string, version: number): string;
  setAwareness(docId: string, awareness: CrdtAwareness): void;
  getAwareness(docId: string): CrdtAwareness[];
  createSnapshot(docId: string): CrdtSnapshot;
  applySnapshot(snapshot: CrdtSnapshot): void;
  merge(docId: string, remoteOps: CrdtOperation[]): CrdtOperation[];
  deleteDocument(docId: string): void;
}

let siteCounter = 0;
let opCounter = 0;
const docs = new Map<string, CrdtDocument>();
const awarenessMap = new Map<string, CrdtAwareness[]>();

function applyInsert(content: string, position: number, value: string): string {
  return content.slice(0, position) + value + content.slice(position);
}

function applyDelete(content: string, position: number, length: number): string {
  return content.slice(0, position) + content.slice(position + length);
}

export function createCrdt(): CrdtApi {
  return {
    createDocument(id, initialContent = "") {
      const doc: CrdtDocument = {
        id, content: initialContent, operations: [], version: 0, lastModified: new Date().toISOString(),
      };
      docs.set(id, doc);
      return doc;
    },

    getDocument(id) {
      return docs.get(id) ?? null;
    },

    applyOperation(docId, op) {
      const doc = docs.get(docId);
      if (!doc) throw new Error(`Document not found: ${docId}`);
      const id = `op_${++opCounter}_${Date.now()}`;
      const fullOp: CrdtOperation = {
        ...op, id, version: doc.version + 1, timestamp: new Date().toISOString(),
        siteId: ++siteCounter,
      };
      if (op.type === "insert" && op.value) {
        doc.content = applyInsert(doc.content, op.position, op.value);
      } else if (op.type === "delete" && op.length) {
        doc.content = applyDelete(doc.content, op.position, op.length);
      } else if (op.type === "replace" && op.value && op.length) {
        doc.content = applyDelete(doc.content, op.position, op.length);
        doc.content = applyInsert(doc.content, op.position, op.value);
      }
      doc.operations.push(fullOp);
      doc.version = fullOp.version;
      doc.lastModified = fullOp.timestamp;
      return fullOp;
    },

    getOperationsSince(docId, version) {
      const doc = docs.get(docId);
      if (!doc) return [];
      return doc.operations.filter((o) => o.version > version);
    },

    getDocumentAtVersion(docId, version) {
      const doc = docs.get(docId);
      if (!doc) return "";
      let content = "";
      for (const op of doc.operations) {
        if (op.version > version) break;
        if (op.type === "insert" && op.value) {
          content = applyInsert(content, op.position, op.value);
        } else if (op.type === "delete" && op.length) {
          content = applyDelete(content, op.position, op.length);
        }
      }
      return content;
    },

    setAwareness(docId, awareness) {
      const list = awarenessMap.get(docId) ?? [];
      const idx = list.findIndex((a) => a.userId === awareness.userId);
      if (idx >= 0) list[idx] = awareness;
      else list.push(awareness);
      awarenessMap.set(docId, list);
    },

    getAwareness(docId) {
      return [...(awarenessMap.get(docId) ?? [])];
    },

    createSnapshot(docId) {
      const doc = docs.get(docId);
      if (!doc) throw new Error(`Document not found: ${docId}`);
      return { documentId: docId, content: doc.content, version: doc.version, timestamp: new Date().toISOString() };
    },

    applySnapshot(snapshot) {
      const existing = docs.get(snapshot.documentId);
      if (existing && existing.version >= snapshot.version) return;
      docs.set(snapshot.documentId, {
        id: snapshot.documentId, content: snapshot.content, operations: [],
        version: snapshot.version, lastModified: snapshot.timestamp,
      });
    },

    merge(docId, remoteOps) {
      const doc = docs.get(docId);
      if (!doc) return [];
      const applied: CrdtOperation[] = [];
      for (const op of remoteOps) {
        if (!doc.operations.some((o) => o.id === op.id)) {
          if (op.type === "insert" && op.value) {
            doc.content = applyInsert(doc.content, op.position, op.value);
          } else if (op.type === "delete" && op.length) {
            doc.content = applyDelete(doc.content, op.position, op.length);
          }
          doc.operations.push(op);
          doc.version = Math.max(doc.version, op.version);
          applied.push(op);
        }
      }
      doc.lastModified = new Date().toISOString();
      return applied;
    },

    deleteDocument(docId) {
      docs.delete(docId);
      awarenessMap.delete(docId);
    },
  };
}
