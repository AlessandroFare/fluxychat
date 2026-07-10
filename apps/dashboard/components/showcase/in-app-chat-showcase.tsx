"use client";

import { Loader2 } from "lucide-react";
import { FluxyChat } from "@/components/chat";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
  ShowcaseUnavailable,
  Kw,
  Ident,
  Str,
} from "./feature-code-panel";
import type { ShowcaseSession } from "./use-showcase-session";

/**
 * In-App Chat showcase — embeds the real FluxyChat widget connected to the
 * live Worker demo room over WebSocket. Messages, presence, reactions,
 * read receipts, and streaming replies are all live SDK behavior.
 */
export function InAppChatShowcase({ session }: { session: ShowcaseSession }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel
        title="Ship a chat feature in an afternoon."
        description="The FluxyChat SDK gives you a fully real-time room layer. Messages are delivered instantly to every connected client, with presence tracking, read receipts, threads, and emoji reactions built in."
      >
        <Kw>const</Kw> {"{ messages, sendMessage, reactions } = "}
        <Ident>useChat</Ident>
        {"({\n  roomId: "}
        <Str>{'"chat:room-42"'}</Str>
        {",\n});\n\n"}
        <Ident>sendMessage</Ident>
        {"("}
        <Str>{'"Hello from FluxyChat"'}</Str>
        {");"}
      </FeatureCodePanel>

      <FeaturePreviewFrame label="Live in-app chat preview" className="min-h-[28rem]">
        {session.status === "loading" ? (
          <div className="flex h-full min-h-64 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Connecting to the live demo room</span>
          </div>
        ) : session.status === "unavailable" || !session.client || !session.roomId ? (
          <ShowcaseUnavailable error={session.error} onRetry={session.retry} />
        ) : (
          <div className="p-3">
            <FluxyChat
              roomId={session.roomId}
              agentId=""
              agentName="Agent"
              client={session.client}
              variant="minimal"
            />
          </div>
        )}
      </FeaturePreviewFrame>
    </div>
  );
}
