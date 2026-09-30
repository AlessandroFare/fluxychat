import { FluxyChatClient, type FluxyChatMessage } from "@fluxy-chat/sdk";

export interface FluxyChatSdkAdapterConfig {
  workerUrl: string;
  token: string;
  userId: string;
}

export interface FluxyChatThreadId {
  roomId: string;
}

export function parseFluxyChatThreadId(threadId: string): FluxyChatThreadId {
  const raw = threadId.trim();
  const stripped = raw.startsWith("fluxychat:") ? raw.slice("fluxychat:".length) : raw;
  if (!stripped) throw new Error("fluxychat_thread_id_empty");
  return { roomId: stripped };
}

export function formatFluxyChatThreadId(roomId: string): string {
  return `fluxychat:${roomId.trim()}`;
}

function toRaw(message: FluxyChatMessage, threadId: string) {
  return { id: String(message.id), raw: message, threadId };
}

/**
 * Duck-typed Chat SDK adapter. Does not import `chat` — wire it if you add that peer later.
 */
export function createFluxyChatSdkAdapter(config: FluxyChatSdkAdapterConfig) {
  const client = new FluxyChatClient({
    baseUrl: config.workerUrl,
    token: config.token,
    userId: config.userId,
  });

  return {
    name: "fluxychat",
    displayName: "FluxyChat",
    version: "0.1.0",
    async postMessage(threadId: string, content: string) {
      const { roomId } = parseFluxyChatThreadId(threadId);
      const message = await client.createMessage(roomId, content);
      if (!message) throw new Error("fluxychat_post_failed");
      return toRaw(message, threadId);
    },
    async fetchMessages(threadId: string, limit = 50) {
      const { roomId } = parseFluxyChatThreadId(threadId);
      const rows = await client.fetchMessages(roomId, limit);
      return rows.map((row) => toRaw(row, threadId));
    },
    async listThreads() {
      const rooms = await client.listRooms();
      return rooms.map((room) => ({
        id: formatFluxyChatThreadId(room.id),
        raw: room,
      }));
    },
    async editMessage(threadId: string, messageId: string, content: string) {
      await client.editMessageRest(Number(messageId), content);
      return { id: messageId, raw: { id: messageId, content }, threadId };
    },
    async deleteMessage(_threadId: string, messageId: string) {
      await client.deleteMessageRest(Number(messageId));
    },
  };
}

/** Alias for Chat SDK factory naming (`create${Name}Adapter`). */
export const createFluxyChatAdapter = createFluxyChatSdkAdapter;
