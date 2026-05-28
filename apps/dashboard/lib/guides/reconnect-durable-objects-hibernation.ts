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
