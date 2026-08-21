/**
 * Slim entry for bots / Workers that need the chat client without the main
 * barrel's vertical, markdown, React, or CRDT re-exports.
 *
 * Prefer `@fluxy-chat/sdk/core` from `@fluxy-chat/agent` and server runtimes.
 * Browser apps can keep importing from `@fluxy-chat/sdk` or `@fluxy-chat/react`.
 */

export {
  FluxyChatClient,
  type FluxyChatClientOptions,
  type FluxyChatMessage,
  type FluxyChatAttachment,
  type FluxyChatEvent,
  type FluxyChatRoom,
  type FluxyRoomMember,
  type FluxyInboxSummary,
  type FluxyInAppNotification,
} from "./fluxy-chat-client";

export {
  FluxyChatRoomConnection,
  type FluxyRoomConnectionOptions,
  type FluxyWaitForOptions,
} from "./room-connection";

export { FluxyMessageStream } from "./message-stream";
export { buildAgentOutboundWsPayload } from "./agent-outbound";

export {
  FluxyAuthError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
} from "./errors";

export {
  FluxyClientCredentials,
  type FluxyTokenSource,
} from "./client-credentials";
export { createFluxyWebSocket } from "./websocket-factory";
export { decodeFluxyJwtPayload } from "./jwt-utils";
