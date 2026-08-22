"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AltHeroPreview,
  HERO_PREVIEW_SCENES,
} from "./hero-preview-scenes";

const SNIPPET = `import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";

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
  shellBg: "#12141a",
  shellText: "#e4e4e7",
  headerBorder: "rgba(255, 255, 255, 0.1)",
  liveDot: "#22c55e",
  liveBadgeBg: "rgba(34, 197, 94, 0.15)",
  liveBadgeText: "#86efac",
  avatarInBg: "#3f3f46",
  avatarInText: "#ffffff",
  avatarInRing: "rgba(255, 255, 255, 0.12)",
  avatarOutBg: "#52525b",
  avatarOutText: "#ffffff",
  avatarOutRing: "rgba(255, 255, 255, 0.1)",
  bubbleInBg: "#27272a",
  bubbleInText: "#f4f4f5",
  bubbleInBorder: "rgba(255, 255, 255, 0.08)",
  bubbleOutBg: "#3f3f46",
  bubbleOutText: "#fafafa",
  metaText: "#a1a1aa",
  inputBarBg: "#18181b",
  inputBarBorder: "rgba(255, 255, 255, 0.1)",
  inputFieldBg: "#09090b",
  inputFieldText: "#a1a1aa",
  dotIncoming: "#a1a1aa",
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
  const [sceneIndex, setSceneIndex] = useState(0);
  const [chat, setChat] = useState({
    incomingTyping: false,
    incomingVisible: false,
    outgoingTyping: false,
    outgoingVisible: false,
  });

  const activeScene = HERO_PREVIEW_SCENES[sceneIndex] ?? HERO_PREVIEW_SCENES[0];
  const isChatScene = activeScene.id === "chat";

  const cancelled = useRef(false);
  const chatRef = useRef(resetChatPhases());

  useEffect(() => {
    if (!isChatScene) {
      setCodeLen(SNIPPET.length);
      return;
    }
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
          setSceneIndex((index) => (index + 1) % HERO_PREVIEW_SCENES.length);
        }, PAUSE_END_MS);
        return;
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelled.current = true;
      cancelAnimationFrame(raf);
    };
  }, [isChatScene, sceneIndex]);

  useEffect(() => {
    if (isChatScene) return;
    const id = window.setInterval(() => {
      setSceneIndex((index) => (index + 1) % HERO_PREVIEW_SCENES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [isChatScene]);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="mb-3 flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Your app</p>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap justify-end gap-1" role="tablist" aria-label="Preview modes">
            {HERO_PREVIEW_SCENES.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                role="tab"
                aria-selected={index === sceneIndex}
                onClick={() => setSceneIndex(index)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition",
                  index === sceneIndex
                    ? "bg-[#C2410C] text-white"
                    : "border border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10",
                )}
              >
                {scene.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Live preview</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 md:gap-8">
        <div className={cn("flex min-w-0 flex-col", CARD_H)}>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1117] shadow-inner",
              CARD_H,
            )}
          >
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-auto text-[10px] text-zinc-400">app/chat/page.tsx</span>
            </div>
            <pre className="flex-1 overflow-y-auto overflow-x-auto p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
              <code className="block min-w-0 max-w-full whitespace-pre-wrap break-all">{buildCodeDisplay(codeLen)}</code>
            </pre>
          </div>
        </div>

        <div className={cn("flex min-w-0 flex-col", CARD_H)}>
          {isChatScene ? (
          <div
            className={cn(
              "isolate flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-subtle-3)]",
              CARD_H,
            )}
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
                  {activeScene.room}
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
                <Button size="sm" className="shrink-0 rounded-lg border border-[#C2410C] bg-[#C2410C] text-white hover:bg-[#9a3412]" type="button" tabIndex={-1}>
                  Send
                </Button>
              </div>
            </div>
          </div>
          ) : (
            <div key={activeScene.id} className={cn("flex min-w-0 flex-col animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out", CARD_H)}>
              <AltHeroPreview sceneId={activeScene.id} scene={activeScene} />
            </div>
          )}
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-zinc-400 sm:text-sm">
        Wire the client once. Tabs cycle chat, agents, location, stream, collab, game, IoT, and channel adapters — same SDK, same room.
      </p>
    </div>
  );
}