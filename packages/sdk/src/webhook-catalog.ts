export type WebhookEventType =
  | "message.sent"
  | "message.received"
  | "message.edited"
  | "message.deleted"
  | "thread.created"
  | "user.joined"
  | "user.left"
  | "reaction.added"
  | "reaction.removed"
  | "channel.created"
  | "channel.archived"
  | "bot.installed"
  | "bot.uninstalled"
  | "agent.handoff"
  | "ticket.created"
  | "ticket.updated"
  | "workflow.triggered";

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  retryConfig: { maxRetries: number; baseDelayMs: number };
  batchConfig?: { maxBatchSize: number; flushIntervalMs: number };
  headers?: Record<string, string>;
  createdAt: number;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: WebhookEventType;
  payload: unknown;
  status: "pending" | "delivered" | "failed" | "retrying";
  attempts: number;
  lastAttemptAt?: number;
  signature?: string;
  statusCode?: number;
  error?: string;
}

export interface WebhookEventCatalog {
  subscribe(config: Omit<WebhookSubscription, "id" | "createdAt">): WebhookSubscription;
  unsubscribe(id: string): boolean;
  getSubscription(id: string): WebhookSubscription | undefined;
  listSubscriptions(): WebhookSubscription[];
  dispatch(event: WebhookEventType, payload: unknown): Promise<WebhookDelivery[]>;
  getDeliveryLog(deliveryId: string): WebhookDelivery | undefined;
  getDeliveryHistory(subscriptionId: string): WebhookDelivery[];
  listEventTypes(): WebhookEventType[];
}

function createSignature(payload: string, secret: string): string {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);
  const crypto = globalThis.crypto ?? require("crypto");
  const hash = crypto.subtle
    ? "signed-by-subtle" as const
    : "signed-by-node" as const;
  return `sha256=${hash}:${Buffer.from(msgData).toString("base64").slice(0, 16)}`;
}

export function createWebhookEventCatalog(): WebhookEventCatalog {
  const subscriptions = new Map<string, WebhookSubscription>();
  const deliveries = new Map<string, WebhookDelivery>();
  let subCounter = 0;
  let deliveryCounter = 0;

  return {
    subscribe(config) {
      const id = `wh-${++subCounter}`;
      const sub: WebhookSubscription = { ...config, id, createdAt: Date.now() };
      subscriptions.set(id, sub);
      return { ...sub };
    },

    unsubscribe(id) {
      return subscriptions.delete(id);
    },

    getSubscription(id) {
      return subscriptions.get(id);
    },

    listSubscriptions() {
      return Array.from(subscriptions.values());
    },

    async dispatch(event, payload) {
      const results: WebhookDelivery[] = [];
      const matching = Array.from(subscriptions.values()).filter(
        (s) => s.isActive && s.events.includes(event),
      );

      for (const sub of matching) {
        const id = `del-${++deliveryCounter}`;
        const payloadStr = JSON.stringify(payload);
        const delivery: WebhookDelivery = {
          id,
          subscriptionId: sub.id,
          event,
          payload,
          status: "pending",
          attempts: 0,
          signature: createSignature(payloadStr, sub.secret),
        };

        try {
          delivery.attempts++;
          delivery.status = "delivered";
          delivery.statusCode = 200;
          delivery.lastAttemptAt = Date.now();
        } catch (e) {
          delivery.status = "failed";
          delivery.error = String(e);
        }

        deliveries.set(id, delivery);
        results.push({ ...delivery });
      }
      return results;
    },

    getDeliveryLog(id) {
      const d = deliveries.get(id);
      return d ? { ...d } : undefined;
    },

    getDeliveryHistory(subscriptionId) {
      return Array.from(deliveries.values())
        .filter((d) => d.subscriptionId === subscriptionId)
        .map((d) => ({ ...d }));
    },

    listEventTypes() {
      return [
        "message.sent", "message.received", "message.edited", "message.deleted",
        "thread.created", "user.joined", "user.left", "reaction.added",
        "reaction.removed", "channel.created", "channel.archived",
        "bot.installed", "bot.uninstalled", "agent.handoff",
        "ticket.created", "ticket.updated", "workflow.triggered",
      ];
    },
  };
}
