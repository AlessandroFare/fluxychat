"use client";

import { BotIcon, MessageCircleIcon, SendIcon, SparklesIcon, UserIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How do I mint a JWT?",
  "Show me a useChat example",
  "What is transport fallback?",
];

export function AskAiSidebar() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 501) {
        const body = await res.json();
        setError(body.error || "AI is not configured.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(`Request failed (${res.status}).`);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream.");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let assistantMsg = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMsg += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantMsg };
          return updated;
        });
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() && !loading) send(input.trim());
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border bg-fd-card px-4 py-2.5 text-sm font-medium shadow-lg transition hover:bg-fd-accent/60"
        >
          <SparklesIcon className="size-4 text-fd-primary" />
          Ask AI
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-fd-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Ask AI"
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-fd-primary/10">
              <BotIcon className="size-4 text-fd-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Ask AI</p>
              <p className="text-xs text-fd-muted-foreground">FluxyChat documentation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !error && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <MessageCircleIcon className="size-8 text-fd-muted-foreground/60" />
              <p className="max-w-xs text-sm text-fd-muted-foreground">
                Ask anything about FluxyChat — SDK, Worker API, agents, or deployment.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border px-3 py-1 text-xs text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-fd-destructive/30 bg-fd-destructive/5 px-3 py-2 text-sm text-fd-destructive">
              {error}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}
            >
              <div
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                  msg.role === "user" ? "bg-fd-muted" : "bg-fd-primary/10",
                )}
              >
                {msg.role === "user" ? (
                  <UserIcon className="size-3.5 text-fd-muted-foreground" />
                ) : (
                  <BotIcon className="size-3.5 text-fd-primary" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-fd-primary text-fd-primary-foreground"
                    : "bg-fd-muted/60 text-fd-foreground",
                )}
              >
                {msg.content || (loading && i === messages.length - 1 ? "Thinking…" : "")}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="border-t bg-fd-card/50 p-4">
          <div className="flex items-end gap-2 rounded-xl border bg-fd-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-fd-ring">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder="Ask AI a question…"
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-fd-primary p-2 text-fd-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              <SendIcon className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-fd-muted-foreground">
            Answers are generated from docs context. Verify critical details in the guides.
          </p>
        </form>
      </aside>
    </>
  );
}
