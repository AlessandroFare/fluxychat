"use client";

import * as React from "react";
import type { AiChatMessage } from "@fluxy-chat/sdk";

export interface AiChatProps {
  messages: AiChatMessage[];
  sending?: boolean;
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
}

export function AiChat({
  messages,
  sending,
  onSend,
  placeholder = "Ask the copilot…",
}: AiChatProps) {
  const [text, setText] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = text.trim();
    if (!next || sending) return;
    setText("");
    await onSend(next);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        minHeight: 240,
      }}
    >
      <div style={{ padding: "8px 12px", background: "#0f172a", color: "#fff", fontSize: 13 }}>
        Copilot (not the room timeline)
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>Keyless mock until you add an LLM. invokeAgent stays on chat.</p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
              padding: "8px 10px",
              borderRadius: 10,
              background: message.role === "user" ? "#2563eb" : "#f1f5f9",
              color: message.role === "user" ? "#fff" : "#0f172a",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={(event) => void submit(event)} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e2e8f0" }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          disabled={sending}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <button type="submit" disabled={sending} style={{ padding: "8px 12px", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff" }}>
          Send
        </button>
      </form>
    </div>
  );
}

export function AiTool({ name, description }: { name: string; description?: string }) {
  return (
    <span style={{ fontSize: 12, color: "#475569" }}>
      {name}
      {description ? ` — ${description}` : ""}
    </span>
  );
}
