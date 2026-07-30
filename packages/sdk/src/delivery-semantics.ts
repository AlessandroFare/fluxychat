export type DeliverySemantic = "at-most-once" | "at-least-once" | "exactly-once";

export type DeliveryStage = "accepted" | "persisted" | "delivered" | "read" | "failed";

export interface DeliveryReceipt {
  messageId: string;
  stage: DeliveryStage;
  semantic: DeliverySemantic;
  idempotencyKey: string;
  timestamp: string;
  consumerId: string;
}

export interface DeliveryDedupEntry {
  idempotencyKey: string;
  status: "pending" | "processed" | "failed";
  createdAt: string;
}

export interface DeliverySemanticsApi {
  send(semantic: DeliverySemantic, messageId: string, consumerId: string, payload: string): DeliveryReceipt;
  acknowledge(idempotencyKey: string, stage: DeliveryStage): DeliveryReceipt | null;
  getReceipt(messageId: string): DeliveryReceipt | null;
  isDuplicate(idempotencyKey: string): boolean;
  getDedupStats(): { total: number; duplicates: number };
  reset(): void;
}

export function createDeliverySemantics(): DeliverySemanticsApi {
  const receiptStore = new Map<string, DeliveryReceipt>();
  const msgReceiptIndex = new Map<string, string>();
  const dedupStore = new Map<string, DeliveryDedupEntry>();
  let dupCounter = 0;
  function genKey(): string {
    return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    send(semantic, messageId, consumerId, payload) {
      const key = genKey();
      const receipt: DeliveryReceipt = { messageId, stage: "accepted", semantic, idempotencyKey: key, timestamp: new Date().toISOString(), consumerId };
      if (semantic !== "at-most-once") {
        dedupStore.set(key, { idempotencyKey: key, status: "pending", createdAt: new Date().toISOString() });
      }
      receiptStore.set(key, receipt);
      msgReceiptIndex.set(messageId, key);
      return receipt;
    },

    acknowledge(key, stage) {
      const entry = dedupStore.get(key);
      if (!entry) return null;
      entry.status = stage === "failed" ? "failed" : "processed";
      const receipt = receiptStore.get(key);
      if (receipt) receipt.stage = stage;
      return receipt ?? null;
    },

    getReceipt(messageId) {
      const key = msgReceiptIndex.get(messageId);
      return key ? (receiptStore.get(key) ?? null) : null;
    },

    isDuplicate(key) {
      if (dedupStore.has(key)) { dupCounter++; return true; }
      return false;
    },

    getDedupStats() { return { total: dedupStore.size, duplicates: dupCounter }; },
    reset() { receiptStore.clear(); msgReceiptIndex.clear(); dedupStore.clear(); dupCounter = 0; },
  };
}
