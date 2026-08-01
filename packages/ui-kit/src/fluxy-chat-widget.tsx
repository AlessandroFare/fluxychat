"use client";

import { useMemo } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";
import {
  ChatWindow,
  applyFluxyTheme,
  fluxyThemeClassName,
} from "@fluxy-chat/ui";
import type { FluxyThemeId } from "@fluxy-chat/ui";
import { useEffect } from "react";

export interface FluxyChatWidgetProps {
  roomId: string;
  /** Pre-built client — preferred when sharing with inbox */
  client?: FluxyChatClient;
  workerUrl?: string;
  token?: string;
  userId?: string;
  theme?: FluxyThemeId;
  className?: string;
  height?: string | number;
  title?: string;
}

function WidgetInner({
  roomId,
  title,
  client,
}: {
  roomId: string;
  title?: string;
  client: FluxyChatClient;
}) {
  const { messages, sendMessage, connectionState, typingUsers, online } = useChat({
    roomId,
    client,
    markReadLatest: true,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {title && (
        <header className="border-b border-border px-4 py-2 text-sm font-semibold">
          {title}
          <span className="ml-2 font-normal text-muted-foreground">
            {connectionState.status}
          </span>
        </header>
      )}
      <div className="min-h-0 flex-1">
        <ChatWindow
          messages={messages}
          online={online}
          typingUsers={typingUsers}
          onSend={(text) => sendMessage(text)}
        />
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
  theme = "default",
  className,
  height = 480,
  title,
}: FluxyChatWidgetProps) {
  const client = useMemo(() => {
    if (clientProp) return clientProp;
    if (!workerUrl?.trim() || !token?.trim()) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl.trim(),
      userId,
      token: token.trim(),
    });
  }, [clientProp, workerUrl, token, userId]);

  useEffect(() => {
    applyFluxyTheme(theme);
  }, [theme]);

  if (!client) {
    return (
      <div
        className={className}
        style={{ height, padding: 16, border: "1px solid #e4e4e7", borderRadius: 12 }}
      >
        <p style={{ margin: 0, fontSize: 14 }}>
          Set <code>workerUrl</code> and <code>token</code>, or pass a <code>client</code>.
        </p>
      </div>
    );
  }

  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={[fluxyThemeClassName(theme), className].filter(Boolean).join(" ")}
      style={{ height: h, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 12, border: "1px solid #e4e4e7" }}
    >
      <WidgetInner roomId={roomId} title={title ?? roomId} client={client} />
    </div>
  );
}
