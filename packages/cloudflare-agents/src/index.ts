import { FluxyChatClient } from "@fluxy-chat/sdk";

export interface JoinRoomFromCloudflareAgentOptions {
  workerUrl: string;
  token: string;
  userId: string;
  roomId: string;
}

/** Open the room socket as this agent identity. Keep AIChatAgent for your loop. */
export function joinRoomFromCloudflareAgent(options: JoinRoomFromCloudflareAgentOptions): FluxyChatClient {
  const client = new FluxyChatClient({
    baseUrl: options.workerUrl,
    userId: options.userId,
    token: options.token,
  });
  client.connect(options.roomId);
  return client;
}
