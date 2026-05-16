"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "@/lib/utils";

const SNIPPET = `import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  baseUrl: "https://your-worker.example.com",
  userId: "alice",
  token: "your_member_jwt",
});

const { messages, sendMessage } = useChat({
  roomId: "support-room",
  client,
});`;

const SNIPPET_LINES = SNIPPET.split("\n");

const INCOMING = "Hey team — is the SDK room scoped per project?";
const OUTGOING = "Yes — pass X-Project-Id from your backend.";
const PLACEHOLDER = "Write a message…";

const C = {
  kw: "#c792ea",
  str: "#c3e88d",
  fn: "#ff9b7a",
  prop: "#82aaff",
  punct: "#89ddff",
  plain: "#cdd6f4",
  comment: "#7a8899",
};

function Tok({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  return <span style={style}>{children}</span>;
}

function TypingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-0.5 py-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="fc-typing-dot inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color, animationDelay: `${i * 0.14}s` }}
        />
      ))}
    </span>
  );
}

function coloredFullLine(line: string, lineIndex: number): React.ReactNode {
  const t = line.trimEnd();
  if (lineIndex === 0 && t.startsWith("import "))
    return (
      <>
        <Tok style={{ color: C.kw }}>import</Tok>{" "}
        <Tok style={{ color: C.fn }}>{`{ FluxyChatClient, useChat }`}</Tok>{" "}
        <Tok style={{ color: C.kw }}>from</Tok>{" "}
        <Tok style={{ color: C.str }}>&quot;@fluxy-chat/sdk&quot;</Tok>
        <Tok style={{ color: C.punct }}>;</Tok>
      </>
    );
  if (lineIndex === 2 && t.startsWith("const client"))
    return (
      <>
        <Tok style={{ color: C.kw }}>const</Tok>{" "}
        <Tok style={{ color: C.plain }}>client</Tok>{" "}
        <Tok style={{ color: C.punct }}>=</Tok>{" "}
        <Tok style={{ color: C.kw }}>new</Tok>{" "}
        <Tok style={{ color: C.fn }}>FluxyChatClient</Tok>
        <Tok style={{ color: C.punct }}>({"{"}</Tok>
      </>
    );
  if (t.startsWith("  baseUrl:"))
    return (
      <>
        {"  "}
        <Tok style={{ color: C.prop }}>baseUrl</Tok>
        <Tok style={{ color: C.punct }}>: </Tok>
        <Tok style={{ color: C.str }}>&quot;https://your-worker.example.com&quot;</Tok>
        <Tok style={{ color: C.punct }}>,</Tok>
      </>
    );
  if (t.startsWith("  userId:"))
    return (
      <>
        {"  "}
        <Tok style={{ color: C.prop }}>userId</Tok>
        <Tok style={{ color: C.punct }}>: </Tok>
        <Tok style={{ color: C.str }}>&quot;alice&quot;</Tok>
        <Tok style={{ color: C.punct }}>,</Tok>
      </>
    );
  if (t.startsWith("  token:"))
    return (
      <>
        {"  "}
        <Tok style={{ color: C.prop }}>token</Tok>
        <Tok style={{ color: C.punct }}>: </Tok>
        <Tok style={{ color: C.str }}>&quot;your_member_jwt&quot;</Tok>
        <Tok style={{ color: C.punct }}>,</Tok>
      </>
    );
  if (t === "});" && lineIndex === 6)
    return <Tok style={{ color: C.punct }}>{"});"}</Tok>;
  if (lineIndex === 8 && t.startsWith("const {"))
    return (
      <>
        <Tok style={{ color: C.kw }}>const</Tok>{" "}
        <Tok style={{ color: C.punct }}>{"{"}</Tok>{" "}
        <Tok style={{ color: C.plain }}>messages</Tok>
        <Tok style={{ color: C.punct }}>, </Tok>
        <Tok style={{ color: C.plain }}>sendMessage</Tok>{" "}
        <Tok style={{ color: C.punct }}>{"}"}</Tok>{" "}
        <Tok style={{ color: C.punct }}>=</Tok>{" "}
        <Tok style={{ color: C.fn }}>useChat</Tok>
        <Tok style={{ color: C.punct }}>({"{"}</Tok>
      </>
    );
  if (t.startsWith("  roomId:"))
    return (
      <>
        {"  "}
        <Tok style={{ color: C.prop }}>roomId</Tok>
        <Tok style={{ color: C.punct }}>: </Tok>
        <Tok style={{ color: C.str }}>&quot;support-room&quot;</Tok>
        <Tok style={{ color: C.punct }}>,</Tok>
      </>
    );
  if (t.startsWith("  client,"))
    return (
      <>
        {"  "}
        <Tok style={{ color: C.prop }}>client</Tok>
        <Tok style={{ color: C.punct }}>,</Tok>
      </>
    );
  if (t === "});" && lineIndex === 11)
    return <Tok style={{ color: C.punct }}>{"});"}</Tok>;
  if (t === "") return "\u00a0";
  return <Tok style={{ color: C.plain }}>{line}</Tok>;
}

function buildCodeDisplay(codeLen: number) {
  const slice = SNIPPET.slice(0, codeLen);
  const parts = slice.split("\n");
  const out: React.ReactNode[] = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    const expected = SNIPPET_LINES[idx] ?? "";
    const isLastPart = idx === parts.length - 1;

    if (!isLastPart) {
      out.push(
        <div key={idx}>{part === expected ? coloredFullLine(expected, idx) : <Tok style={{ color: C.plain }}>{part}</Tok>}</div>,
      );
      continue;
    }

    if (part === expected) {
      const moreInFile = codeLen < SNIPPET.length;
      out.push(
        <div key={idx}>
          {coloredFullLine(expected, idx)}
          {moreInFile ? (
            <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-[#ff9b7a] align-middle" aria-hidden />
          ) : null}
        </div>,
      );
    } else {
      out.push(
        <div key={idx} style={{ color: C.plain }}>
          {part}
          <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-[#ff9b7a] align-middle" aria-hidden />
        </div>,
      );
    }
  }

  return out;
}

const CARD_H = "h-[22rem]";

/** Codice a sinistra — più rapido */
const CODE_MS = 16;
/** Pausa tra un ciclo e l’altro */
const PAUSE_END_MS = 1300;

/** Chat a destra — più lenta (typing → messaggio intero) */
const INCOMING_TYPING_MS = 900;
const OUTGOING_TYPING_MS = 960;
const preview = {
  shellBg: "#ffffff",
  shellText: "#0f172a",
  headerBorder: "rgba(15, 23, 42, 0.08)",
  liveDot: "#22c55e",
  liveBadgeBg: "#d1fae5",
  liveBadgeText: "#047857",
  avatarInBg: "#4f46e5",
  avatarInText: "#ffffff",
  avatarInRing: "rgba(79, 70, 229, 0.25)",
  avatarOutBg: "#334155",
  avatarOutText: "#ffffff",
  avatarOutRing: "rgba(51, 65, 85, 0.2)",
  bubbleInBg: "#f1f5f9",
  bubbleInText: "#0f172a",
  bubbleInBorder: "rgba(148, 163, 184, 0.45)",
  bubbleOutBg: "#ea580c",
  bubbleOutText: "#ffffff",
  metaText: "#64748b",
  inputBarBg: "#f8fafc",
  inputBarBorder: "rgba(148, 163, 184, 0.5)",
  inputFieldBg: "#ffffff",
  inputFieldText: "#475569",
  dotIncoming: "#64748b",
  dotOutgoing: "rgba(255,255,255,0.9)",
} as const;

interface ChatPhaseRef {
  incomingTyping: boolean;
  incomingVisible: boolean;
  outgoingTyping: boolean;
  outgoingVisible: boolean;
  incomingShowAt: number;
  outgoingShowAt: number;
  incomingArmed: boolean;
  outgoingArmed: boolean;
}

function resetChatPhases(): ChatPhaseRef {
  return {
    incomingTyping: false,
    incomingVisible: false,
    outgoingTyping: false,
    outgoingVisible: false,
    incomingShowAt: 0,
    outgoingShowAt: 0,
    incomingArmed: false,
    outgoingArmed: false,
  };
}

export function HeroCodeInboxDemo() {
  const [codeLen, setCodeLen] = useState(0);
  const [chat, setChat] = useState({
    incomingTyping: false,
    incomingVisible: false,
    outgoingTyping: false,
    outgoingVisible: false,
  });

  const cancelled = useRef(false);
  const chatRef = useRef(resetChatPhases());

  useEffect(() => {
    cancelled.current = false;
    chatRef.current = resetChatPhases();
    setChat({
      incomingTyping: false,
      incomingVisible: false,
      outgoingTyping: false,
      outgoingVisible: false,
    });
    const n = SNIPPET.length;
    const startIn = Math.floor(n * 0.34);
    const startOut = Math.floor(n * 0.52);

    let raf = 0;
    const t0 = performance.now();

    function applyChatPatch(p: Partial<ChatPhaseRef>) {
      const r = chatRef.current;
      Object.assign(r, p);
      setChat({
        incomingTyping: r.incomingTyping,
        incomingVisible: r.incomingVisible,
        outgoingTyping: r.outgoingTyping,
        outgoingVisible: r.outgoingVisible,
      });
    }

    function syncChat(now: number, c: number) {
      const r = chatRef.current;

      if (c >= startIn && !r.incomingArmed) {
        r.incomingArmed = true;
        r.incomingTyping = true;
        r.incomingShowAt = now + INCOMING_TYPING_MS;
        applyChatPatch({ incomingTyping: true, incomingShowAt: r.incomingShowAt });
      }
      if (r.incomingArmed && r.incomingTyping && now >= r.incomingShowAt) {
        r.incomingTyping = false;
        r.incomingVisible = true;
        applyChatPatch({ incomingTyping: false, incomingVisible: true });
      }

      if (c >= startOut && r.incomingVisible && !r.outgoingArmed) {
        r.outgoingArmed = true;
        r.outgoingTyping = true;
        r.outgoingShowAt = now + OUTGOING_TYPING_MS;
        applyChatPatch({ outgoingTyping: true, outgoingShowAt: r.outgoingShowAt });
      }
      if (r.outgoingArmed && r.outgoingTyping && now >= r.outgoingShowAt) {
        r.outgoingTyping = false;
        r.outgoingVisible = true;
        applyChatPatch({ outgoingTyping: false, outgoingVisible: true });
      }

    }

    function frame(now: number) {
      if (cancelled.current) return;

      const elapsed = now - t0;
      const c = Math.min(n, Math.floor(elapsed / CODE_MS));
      setCodeLen(c);
      syncChat(now, c);

      const r = chatRef.current;
      const chatDone = r.incomingVisible && r.outgoingVisible && c >= n;

      if (chatDone) {
        window.setTimeout(() => {
          if (cancelled.current) return;
          chatRef.current = resetChatPhases();
          setChat({
            incomingTyping: false,
            incomingVisible: false,
            outgoingTyping: false,
            outgoingVisible: false,
          });
          void restartAfterPause();
        }, PAUSE_END_MS);
        return;
      }

      raf = requestAnimationFrame(frame);
    }

    function restartAfterPause() {
      if (cancelled.current) return;
      chatRef.current = resetChatPhases();
      const t1 = performance.now();
      function frame2(now: number) {
        if (cancelled.current) return;
        const elapsed = now - t1;
        const c = Math.min(n, Math.floor(elapsed / CODE_MS));
        setCodeLen(c);
        syncChat(now, c);
        const r = chatRef.current;
        const chatDone = r.incomingVisible && r.outgoingVisible && c >= n;
        if (chatDone) {
          window.setTimeout(() => {
            if (cancelled.current) return;
            chatRef.current = resetChatPhases();
            setChat({
              incomingTyping: false,
              incomingVisible: false,
              outgoingTyping: false,
              outgoingVisible: false,
            });
            void restartAfterPause();
          }, PAUSE_END_MS);
          return;
        }
        raf = requestAnimationFrame(frame2);
      }
      raf = requestAnimationFrame(frame2);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelled.current = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-col gap-1 border-b border-black/[0.06] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Your app</p>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 sm:text-right">Live preview</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div className={cn("flex flex-col", CARD_H)}>
          <div
            className={cn(
              "flex flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1117] shadow-inner",
              CARD_H,
            )}
          >
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-auto text-[10px] text-zinc-600">app/chat/page.tsx</span>
            </div>
            <pre className="flex-1 overflow-y-auto overflow-x-hidden p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
              <code>{buildCodeDisplay(codeLen)}</code>
            </pre>
          </div>
        </div>

        <div className={cn("flex flex-col", CARD_H)}>
          <div
            className={cn("isolate flex flex-1 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-subtle-3)]", CARD_H)}
            style={{
              backgroundColor: preview.shellBg,
              color: preview.shellText,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: preview.headerBorder,
              boxShadow: "0 0 0 1px rgba(15,23,42,0.04)",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${preview.headerBorder}` }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: preview.liveDot,
                    boxShadow: "0 0 6px rgba(34,197,94,0.55)",
                  }}
                />
                <span className="text-sm font-semibold" style={{ color: preview.shellText }}>
                  support-room
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: preview.liveBadgeBg, color: preview.liveBadgeText }}
              >
                Live
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3 text-sm">
                <div className="flex gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: preview.avatarInBg,
                      color: preview.avatarInText,
                      boxShadow: `0 0 0 2px ${preview.avatarInRing}, 0 1px 2px rgba(15,23,42,0.08)`,
                    }}
                  >
                    PT
                  </div>
                  <div className="min-w-0 flex-1">
                    {(chat.incomingTyping || chat.incomingVisible) && (
                      <div
                        className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm border px-3 py-2 text-sm"
                        style={{
                          backgroundColor: preview.bubbleInBg,
                          color: preview.bubbleInText,
                          borderColor: preview.bubbleInBorder,
                          minHeight: "2.25rem",
                        }}
                      >
                        {chat.incomingTyping && !chat.incomingVisible ? (
                          <TypingDots color={preview.dotIncoming} />
                        ) : (
                          INCOMING
                        )}
                      </div>
                    )}
                    {(chat.incomingTyping || chat.incomingVisible) && (
                      <div className="mt-1 text-xs" style={{ color: preview.metaText }}>
                        09:41
                      </div>
                    )}
                  </div>
                </div>

                {(chat.outgoingTyping || chat.outgoingVisible) && (
                  <div className="flex flex-row-reverse gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        backgroundColor: preview.avatarOutBg,
                        color: preview.avatarOutText,
                        boxShadow: `0 0 0 2px ${preview.avatarOutRing}, 0 1px 2px rgba(15,23,42,0.08)`,
                      }}
                    >
                      NL
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <div
                        className="inline-block max-w-[90%] rounded-2xl rounded-tr-sm px-3 py-2 text-left text-sm font-medium leading-snug shadow-sm"
                        style={{
                          backgroundColor: preview.bubbleOutBg,
                          color: preview.bubbleOutText,
                          minHeight: "2.25rem",
                        }}
                      >
                        {chat.outgoingTyping && !chat.outgoingVisible ? (
                          <TypingDots color={preview.dotOutgoing} />
                        ) : (
                          OUTGOING
                        )}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: preview.metaText }}>
                        09:42 · Read
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 p-3" style={{ borderTop: `1px solid ${preview.headerBorder}` }}>
              <div
                className="flex gap-2 rounded-xl border p-2"
                style={{ backgroundColor: preview.inputBarBg, borderColor: preview.inputBarBorder }}
              >
                <div
                  className="flex min-h-[36px] flex-1 items-center rounded-lg border px-3 py-2 text-left text-xs"
                  style={{
                    backgroundColor: preview.inputFieldBg,
                    color: preview.inputFieldText,
                    borderColor: preview.inputBarBorder,
                  }}
                >
                  {PLACEHOLDER}
                </div>
                <Button size="sm" className="shrink-0 rounded-lg" type="button" tabIndex={-1}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-slate-600 sm:text-sm">
        The same hooks power your production UI: wire the client once, then iterate on layout and copy — the preview
        mirrors the room your users join in your app.
      </p>
    </div>
  );
}
