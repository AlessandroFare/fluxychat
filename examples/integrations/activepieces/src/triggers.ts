/**
 * FluxyChat Activepieces triggers — webhook payloads from Worker outbound webhooks.
 */
import {
  createTrigger,
  TriggerStrategy,
  Property,
} from "@activepieces/pieces-framework";
import { fluxyChatAuth } from "./auth";

export const newMessageTrigger = createTrigger({
  auth: fluxyChatAuth,
  name: "new_message",
  displayName: "New message",
  description: "Fires when FluxyChat delivers a message.created webhook",
  type: TriggerStrategy.WEBHOOK,
  props: {
    roomId: Property.ShortText({
      displayName: "Room ID filter",
      required: false,
      description: "Optional — only events for this room",
    }),
  },
  async onEnable() {
    // Register webhook URL in FluxyChat console → project webhooks → message.created
  },
  async onDisable() {
    // Remove webhook subscription
  },
  async run(context) {
    const body = context.payload.body as Record<string, unknown>;
    const eventType = String(body.event ?? body.type ?? "");
    if (eventType !== "message.created") {
      return [];
    }
    const roomFilter = context.propsValue.roomId?.trim();
    const roomId = String((body.data as Record<string, unknown>)?.roomId ?? body.roomId ?? "");
    if (roomFilter && roomFilter !== roomId) {
      return [];
    }
    return [body];
  },
  sampleData: {
    event: "message.created",
    data: {
      roomId: "general",
      messageId: 42,
      userId: "user-1",
      content: "Hello from FluxyChat",
    },
  },
});

export const handoffRequestedTrigger = createTrigger({
  auth: fluxyChatAuth,
  name: "handoff_requested",
  displayName: "Agent handoff requested",
  description: "Fires when a room requests human agent handoff",
  type: TriggerStrategy.WEBHOOK,
  props: {},
  async run(context) {
    const body = context.payload.body as Record<string, unknown>;
    const eventType = String(body.event ?? body.type ?? "");
    if (eventType !== "handoff.requested") {
      return [];
    }
    return [body];
  },
  sampleData: {
    event: "handoff.requested",
    data: { roomId: "support-1", reason: "billing" },
  },
});
