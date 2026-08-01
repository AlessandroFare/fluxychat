/**
 * FluxyChat Activepieces actions — call Worker admin REST APIs.
 */
import { createAction, Property } from "@activepieces/pieces-framework";
import { fluxyChatAuth } from "./auth";

export const sendMessageAction = createAction({
  auth: fluxyChatAuth,
  name: "send_message",
  displayName: "Send message",
  description: "Post a message to a FluxyChat room via admin API",
  props: {
    workerUrl: Property.ShortText({
      displayName: "Worker URL",
      required: true,
      description: "https://api.yourdomain.com",
    }),
    adminJwt: Property.ShortText({
      displayName: "Admin JWT",
      required: true,
    }),
    roomId: Property.ShortText({
      displayName: "Room ID",
      required: true,
    }),
    content: Property.LongText({
      displayName: "Message content",
      required: true,
    }),
  },
  async run(context) {
    const { workerUrl, adminJwt, roomId, content } = context.propsValue;
    const base = workerUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }
    return data;
  },
});

export const createRoomAction = createAction({
  auth: fluxyChatAuth,
  name: "create_room",
  displayName: "Create room",
  description: "Create a new chat room in the project",
  props: {
    workerUrl: Property.ShortText({
      displayName: "Worker URL",
      required: true,
    }),
    adminJwt: Property.ShortText({
      displayName: "Admin JWT",
      required: true,
    }),
    name: Property.ShortText({
      displayName: "Room name",
      required: true,
    }),
  },
  async run(context) {
    const { workerUrl, adminJwt, name } = context.propsValue;
    const base = workerUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/admin/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }
    return data;
  },
});
