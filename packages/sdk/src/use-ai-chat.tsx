"use client";

import React from "react";
import {
  mockCopilotReply,
  type AiChatMessage,
  type AiKnowledgeEntry,
  type AiToolEntry,
} from "./ai-copilot";

interface AiCopilotRegistry {
  knowledge: AiKnowledgeEntry[];
  tools: AiToolEntry[];
  messages: AiChatMessage[];
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
  registerKnowledge: (entry: AiKnowledgeEntry) => () => void;
  registerTool: (entry: AiToolEntry) => () => void;
}

const AiCopilotContext = React.createContext<AiCopilotRegistry | null>(null);

export function FluxyAiCopilotProvider({ children }: { children: React.ReactNode }) {
  const [knowledge, setKnowledge] = React.useState<AiKnowledgeEntry[]>([]);
  const [tools, setTools] = React.useState<AiToolEntry[]>([]);
  const [messages, setMessages] = React.useState<AiChatMessage[]>([]);
  const [sending, setSending] = React.useState(false);

  const registerKnowledge = React.useCallback((entry: AiKnowledgeEntry) => {
    setKnowledge((prev) => [...prev.filter((row) => row.name !== entry.name), entry]);
    return () => setKnowledge((prev) => prev.filter((row) => row.name !== entry.name));
  }, []);

  const registerTool = React.useCallback((entry: AiToolEntry) => {
    setTools((prev) => [...prev.filter((row) => row.name !== entry.name), entry]);
    return () => setTools((prev) => prev.filter((row) => row.name !== entry.name));
  }, []);

  const sendMessage = React.useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: "user", content },
      ]);
      setSending(true);
      try {
        const reply = mockCopilotReply({ userText: content, knowledge, tools });
        setMessages((prev) => [
          ...prev,
          { id: `a_${Date.now()}`, role: "assistant", content: reply },
        ]);
      } finally {
        setSending(false);
      }
    },
    [knowledge, tools],
  );

  const value = React.useMemo(
    () => ({
      knowledge,
      tools,
      messages,
      sending,
      sendMessage,
      registerKnowledge,
      registerTool,
    }),
    [knowledge, messages, registerKnowledge, registerTool, sendMessage, sending, tools],
  );

  return <AiCopilotContext.Provider value={value}>{children}</AiCopilotContext.Provider>;
}

function useCopilotRegistry(): AiCopilotRegistry {
  const ctx = React.useContext(AiCopilotContext);
  if (!ctx) throw new Error("AI copilot hooks need FluxyAiCopilotProvider");
  return ctx;
}

export function RegisterAiKnowledge({
  name,
  description,
  value,
}: AiKnowledgeEntry) {
  const { registerKnowledge } = useCopilotRegistry();
  const serialized = JSON.stringify(value);
  React.useEffect(
    () => registerKnowledge({ name, description, value }),
    [description, name, registerKnowledge, serialized, value],
  );
  return null;
}

export function RegisterAiTool({ name, description }: AiToolEntry) {
  const { registerTool } = useCopilotRegistry();
  React.useEffect(() => registerTool({ name, description }), [description, name, registerTool]);
  return null;
}

export interface UseAiChatResult {
  messages: AiChatMessage[];
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
}

export function useAiChat(): UseAiChatResult {
  const { messages, sending, sendMessage } = useCopilotRegistry();
  return { messages, sending, sendMessage };
}

export function useSendAiMessage() {
  return useCopilotRegistry().sendMessage;
}

export function useAiChatMessages() {
  return useCopilotRegistry().messages;
}
