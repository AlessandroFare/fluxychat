"use client";

/**
 * Optional assistant-ui bridge — install `@assistant-ui/react` to use.
 * Maps FluxyChat WS timeline → assistant-ui ExternalStoreRuntime.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FluxyChatClient, FluxyChatMessage } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";

export interface UseFluxyAssistantRuntimeOptions {
  roomId: string;
  client: FluxyChatClient;
}

/** Message shape for assistant-ui ExternalStoreRuntime (minimal subset). */
export interface FluxyAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: { type: "text"; text: string }[];
}

function toAssistantMessage(m: FluxyChatMessage): FluxyAssistantMessage {
  const role = m.userId?.startsWith("agent") || m.userId === "assistant" ? "assistant" : "user";
  return {
    id: String(m.id),
    role,
    content: [{ type: "text", text: m.content ?? "" }],
  };
}

/**
 * Hook that exposes Fluxy messages in assistant-ui-compatible shape.
 * Wire with `useExternalStoreRuntime` from `@assistant-ui/react` when installed.
 */
export function useFluxyAssistantRuntime({ roomId, client }: UseFluxyAssistantRuntimeOptions) {
  const { messages, sendMessage, connectionState, agentTyping } = useChat({
    roomId,
    client,
  });

  const assistantMessages = useMemo(
    () => messages.map(toAssistantMessage),
    [messages],
  );

  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setIsRunning(agentTyping || connectionState.status === "connecting");
  }, [agentTyping, connectionState.status]);

  const onNew = useCallback(
    async (message: { content: { type: string; text?: string }[] }) => {
      const text = message.content
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n")
        .trim();
      if (!text) return;
      await sendMessage(text);
    },
    [sendMessage],
  );

  return {
    messages: assistantMessages,
    isRunning,
    onNew,
    /** Pass to useExternalStoreRuntime({ messages, isRunning, onNew, ... }) */
    externalStoreProps: {
      messages: assistantMessages,
      isRunning,
      onNew,
    },
  };
}
