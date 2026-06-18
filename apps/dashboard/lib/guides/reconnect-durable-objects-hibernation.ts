import type { GuideContent } from "@/lib/guides/types";
import { CF_DURABLE_OBJECTS_OVERVIEW } from "@/lib/marketing-links";

export const RECONNECT_HIBERNATION_GUIDE: GuideContent = {
  title: "Reconnect, replay, and Durable Object hibernation",
  subtitle:
    "When a Room DO hibernates, WebSockets drop and wake again. FluxyChat’s SDK handles the client experience: backoff, connectionState, and history replay via loadMore.",
  sections: [
    {
      id: "server",
      title: "What happens on the server",
      paragraphs: [
        "Durable Objects can hibernate idle WebSocket connections to save resources. When clients reconnect, the DO accepts a new upgrade and resumes fan-out — but messages sent while a client was offline are not magically replayed over the socket alone.",
        "That is why production chat pairs live WebSocket events with persisted history in D1.",
      ],
      link: CF_DURABLE_OBJECTS_OVERVIEW,
    },
    {
      id: "client",
      title: "What the SDK does for you",
      bullets: [
        "connectionState.status — connected, connecting, reconnecting, disconnected.",
        "connectionState.nextRetryAt — show “Reconnecting in 3s…” in your UI.",
        "connectionState.transport — websocket, sse, or polling when WS is blocked.",
        "loadMore() — paginate older messages after refresh or reconnect.",
        "clientMessageId — idempotent retries for sends that failed mid-flight.",
        "deliveryStatus per message — pending, sent, failed with retryMessage().",
      ],
    },
    {
      id: "jwt-refresh",
      title: "JWT refresh before expiry (partysocket-style)",
      paragraphs: [
        "Long-lived sessions need the JWT refreshed before `exp` to avoid a 1008 close mid-session. The SDK passes the token on the WS URL — re-connecting with a fresh JWT keeps the user online without an explicit reconnect trigger.",
      ],
      bullets: [
        "Use `decodeFluxyJwtPayload(token)` and `jwtRefreshDelayMs(payload)` (from `@fluxy-chat/sdk`) to schedule a refresh ~60s before `exp`.",
        "On `onAuthError` (close 1008), mint a new JWT server-side and call `client.connectRoom(roomId, …)` again with the new token. The previous `FluxyChatRoomConnection` instance is already in the disconnected state, so the new connect is a clean re-handshake.",
        "The room DO does not store the JWT — every connect re-validates the token + room membership, so token rotation is safe.",
      ],
    },
    {
      id: "react",
      title: "React example (useChat)",
      code: `import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({ baseUrl, userId, token });

function Room({ roomId }: { roomId: string }) {
  const { messages, sendMessage, connectionState, loadMore, hasMore, retryMessage } =
    useChat({ roomId, client });

  return (
    <div>
      <p>
        {connectionState.status}
        {connectionState.nextRetryAt
          ? \` · retry \${connectionState.nextRetryAt}\`
          : null}
      </p>
      {hasMore ? (
        <button type="button" onClick={() => void loadMore()}>
          Load older messages
        </button>
      ) : null}
      {messages.map((m) => (
        <div key={m.id}>
          {m.content}
          {m.deliveryStatus === "failed" ? (
            <button type="button" onClick={() => retryMessage(m.clientMessageId!)}>
              Retry
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}`,
    },
    {
      id: "vanilla",
      title: "Vanilla / Vue / Solid (createFluxyRoomSession)",
      code: `import { FluxyChatClient, createFluxyRoomSession } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({ baseUrl, userId, token });
const { store, stop } = createFluxyRoomSession({ roomId: "support-1", client });

store.subscribe((state) => {
  console.log(state.connectionState, state.messages.length);
});

// After reconnect: store.getState().loadMore()
// Cleanup: stop();`,
    },
  ],
  seoTopics: [
    "durable objects websocket hibernation",
    "websocket reconnect cloudflare",
    "chat message replay",
    "loadMore chat history",
  ],
};

