"use client";

import { useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";
import {
  ChatWindow,
  applyFluxyTheme,
  fluxyThemeClassName,
  type FluxyThemeId,
} from "@fluxy-chat/ui";
import { FluxyAgentTurnChrome } from "./fluxy-agent-turn-chrome";

export interface FluxyChatWidgetProps {
  roomId: string;
  client?: FluxyChatClient;
  workerUrl?: string;
  token?: string;
  userId?: string;
  guest?: boolean;
  publishableKey?: string;
  displayName?: string;
  theme?: FluxyThemeId;
  className?: string;
  height?: string | number;
  title?: string;
  agentId?: string;
  /** Show a “Powered by FluxyChat” strip. Default on for guest embeds. */
  poweredBy?: boolean;
  /** Spectator: no composer, no Ask agent. */
  readOnly?: boolean;
}

function WidgetInner({
  roomId,
  title,
  client,
  agentId,
  readOnly = false,
}: {
  roomId: string;
  title?: string;
  client: FluxyChatClient;
  agentId?: string;
  readOnly?: boolean;
}) {
  const {
    messages,
    sendMessage,
    connectionState,
    typingUsers,
    online,
    agentTyping,
    stopAgentStream,
    invokeAgent,
  } = useChat({
    roomId,
    client,
    markReadLatest: true,
  });
  const streaming = messages.some((m) => m.streaming) || agentTyping;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && streaming) stopAgentStream();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streaming, stopAgentStream]);
  const statusText = streaming
    ? `${connectionState.status}, agent thinking`
    : connectionState.status;
  const lastAgent = [...messages].reverse().find((m) => m.userId === agentId || m.streaming);
  const siblingIds =
    lastAgent?.parentId != null
      ? messages
          .filter((m) => m.parentId === lastAgent.parentId && m.id !== lastAgent.id)
          .map((m) => String(m.id))
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col" role="region" aria-label={title || "Chat"}>
      {readOnly ? null : (
        <a
          href="#fluxy-chat-composer"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
          }}
        >
          Skip to message
        </a>
      )}
      <div
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {statusText}
      </div>
      {title && (
        <header className="border-b border-border px-4 py-2 text-sm font-semibold">
          {title}
          <span className="ml-2 font-normal text-muted-foreground" aria-hidden="true">
            {connectionState.status}
            {streaming ? " · agent thinking" : ""}
          </span>
        </header>
      )}
      {readOnly ? null : streaming || agentId ? (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 text-xs">
          {streaming ? (
            <button
              type="button"
              aria-label="Stop agent reply"
              onClick={() => stopAgentStream()}
              onKeyDown={(e) => {
                if (e.key === "Escape") stopAgentStream();
              }}
            >
              Stop
            </button>
          ) : null}
          {agentId ? (
            <button
              type="button"
              disabled={streaming}
              aria-label="Ask the agent to summarize this room"
              onClick={() => void invokeAgent("Summarize this room.", { agentId })}
            >
              Ask agent
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <ChatWindow
          messages={messages}
          online={online}
          typingUsers={typingUsers}
          agentTyping={agentTyping && !messages.some((m) => m.streaming)}
          agentTypingLabel="Agent thinking"
          localUserId={client.userId}
          readOnly={readOnly}
          composerInputId={readOnly ? undefined : "fluxy-chat-composer"}
          onSend={readOnly ? () => {} : (text) => sendMessage(text)}
        />
        <FluxyAgentTurnChrome siblingIds={siblingIds} />
      </div>
    </div>
  );
}

/** Drop-in chat widget — polished UI out of the box. */
export function FluxyChatWidget({
  roomId,
  client: clientProp,
  workerUrl,
  token,
  userId = "user-1",
  guest = false,
  publishableKey,
  displayName,
  theme = "default",
  className,
  height = 480,
  title,
  agentId,
  poweredBy,
  readOnly = false,
}: FluxyChatWidgetProps) {
  const tokenClient = useMemo(() => {
    if (clientProp) return clientProp;
    if (!workerUrl?.trim() || !token?.trim()) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl.trim(),
      userId,
      token: token.trim(),
    });
  }, [clientProp, workerUrl, token, userId]);

  const [guestClient, setGuestClient] = useState<FluxyChatClient | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    applyFluxyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (clientProp || token?.trim() || !guest || !workerUrl?.trim()) {
      setGuestClient(null);
      setGuestError(null);
      return;
    }
    let cancelled = false;
    void FluxyChatClient.joinPublicRoomAsGuest(workerUrl.trim(), roomId, {
      displayName,
      publishableKey,
    })
      .then((session) => {
        if (cancelled) return;
        setGuestClient(
          new FluxyChatClient({
            baseUrl: workerUrl.trim(),
            userId: session.userId,
            token: session.token,
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGuestError(err instanceof Error ? err.message : "Guest join failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientProp, token, guest, workerUrl, roomId, displayName, publishableKey]);

  const client = tokenClient ?? guestClient;

  if (!client) {
    return (
      <div
        className={className}
        style={{ height, padding: 16, border: "1px solid #e4e4e7", borderRadius: 12 }}
      >
        <p style={{ margin: 0, fontSize: 14 }}>
          {guestError ??
            "Set workerUrl plus token, pass guest on a public room, or pass a client."}
        </p>
      </div>
    );
  }

  const h = typeof height === "number" ? `${height}px` : height;
  const showPoweredBy = poweredBy ?? (guest || readOnly);

  return (
    <div
      className={[fluxyThemeClassName(theme), className].filter(Boolean).join(" ")}
      style={{
        position: "relative",
        height: h,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid #e4e4e7",
      }}
      role="complementary"
      aria-label={title ?? "Chat widget"}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <WidgetInner
          roomId={roomId}
          title={title ?? roomId}
          client={client}
          agentId={readOnly ? undefined : agentId}
          readOnly={readOnly}
        />
      </div>
      {showPoweredBy ? (
        <p
          style={{
            margin: 0,
            padding: "6px 12px",
            borderTop: "1px solid #e4e4e7",
            fontSize: 11,
            color: "#71717a",
          }}
        >
          <a
            href="https://github.com/AlessandroFare/fluxychat"
            target="_blank"
            rel="noreferrer"
            style={{ color: "inherit" }}
          >
            Powered by FluxyChat
          </a>
        </p>
      ) : null}
    </div>
  );
}
