"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye, Hand, Users, Video, Loader2, Plus, Radio, Square,
  Gift, Vote, ShoppingBag, Sparkles, BarChart3, Camera,
  Award, MessageSquare, Send, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { cn } from "@/lib/utils";
import { createFluxyStream, type FluxyStreamApi, type StreamViewer, type SentimentBucket, type SentGift, type StreamPoll, type CameraAngle, type LiveProduct, type StreamHighlight, type AIChatMessage } from "@fluxy-chat/sdk";

// ─── Seed data for demo ─────────────────────────────

function createSeededStream(): FluxyStreamApi {
  const stream = createFluxyStream();

  // Seed viewers
  stream.joinViewer("u1", "Alice", "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice");
  stream.joinViewer("u2", "Bob", "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob");
  stream.joinViewer("u3", "Charlie", "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie");
  stream.joinViewer("u4", "Diana", "https://api.dicebear.com/7.x/avataaars/svg?seed=Diana");
  stream.joinViewer("u5", "Eve", "https://api.dicebear.com/7.x/avataaars/svg?seed=Eve");
  stream.promoteViewer("u1", "moderator");

  // Seed angles
  stream.addAngle("Main camera", "https://customer-demo.cloudflarestream.com/main/iframe", true);
  stream.addAngle("Close-up", "https://customer-demo.cloudflarestream.com/closeup/iframe");
  stream.addAngle("Wide shot", "https://customer-demo.cloudflarestream.com/wide/iframe");

  // Seed products
  stream.addProduct("FluxyChat Pro — Annual", "https://checkout.fluxychat.dev/pro-annual", 9900, "usd", "Full platform access, 1 year", "https://placehold.co/100x100/6366f1/fff?text=PRO");
  stream.addProduct("Premium Support Pack", "https://checkout.fluxychat.dev/support", 4900, "usd", "Priority support, 10 tickets", "https://placehold.co/100x100/10b981/fff?text=SUP");
  stream.addProduct("Custom Bot Bundle", "https://checkout.fluxychat.dev/bots", 19900, "usd", "5 custom AI bots", "https://placehold.co/100x100/f59e0b/fff?text=BOT");

  // Seed story branches
  stream.createStoryBranch("path-a", "Deep dive: Architecture", "Explore the technical architecture in detail");
  stream.createStoryBranch("path-b", "Deep dive: Use cases", "Focus on real-world use cases and examples");
  stream.createStoryBranch("path-c", "Q&A session", "Open floor for audience questions");

  // Seed sentiment data
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    const bucket = new Date(now - (10 - i) * 30000).toISOString().slice(0, 19);
    const p = 3 + Math.floor(Math.random() * 5);
    const n = 2 + Math.floor(Math.random() * 3);
    const neg = Math.floor(Math.random() * 2);
    for (let j = 0; j < p; j++) stream.recordSentiment(bucket, "positive");
    for (let j = 0; j < n; j++) stream.recordSentiment(bucket, "neutral");
    for (let j = 0; j < neg; j++) stream.recordSentiment(bucket, "negative");
  }

  // Seed highlights
  stream.suggestHighlight("Opening keynote", 0, 45, "High engagement at stream start");
  stream.suggestHighlight("Demo: AI moderation", 120, 180, "Audience reaction spike");

  // Seed an open poll
  const poll = stream.createPoll("What should we cover next?", ["Architecture deep dive", "Live demo", "Q&A session"], false);
  stream.votePoll(poll.id, poll.options[0].id, "u1");
  stream.votePoll(poll.id, poll.options[0].id, "u2");
  stream.votePoll(poll.id, poll.options[1].id, "u3");
  stream.votePoll(poll.id, poll.options[2].id, "u4");

  // Start the stream
  stream.startStream();

  return stream;
}

// ─── Main page ───────────────────────────────────────

export default function FluxyStreamDemoPage() {
  const [stream, setStream] = useState<FluxyStreamApi | null>(null);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<"viewers" | "chat" | "angles" | "highlights" | "sentiment" | "story" | "gifts" | "commerce" | "polls" | "cohost" | "leaderboard">("viewers");

  useEffect(() => {
    setStream(createSeededStream());
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (!stream) {
    return (
      <ConsoleShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  const stats = stream.getStats();
  const viewerCount = stream.getViewerCount();

  const tabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: "viewers", label: "Viewers", icon: <Users className="size-3.5" /> },
    { id: "chat", label: "Chat + AI Moderation", icon: <MessageSquare className="size-3.5" /> },
    { id: "angles", label: "Multi-Camera", icon: <Camera className="size-3.5" /> },
    { id: "highlights", label: "AI Highlights", icon: <Sparkles className="size-3.5" /> },
    { id: "sentiment", label: "Sentiment", icon: <BarChart3 className="size-3.5" /> },
    { id: "story", label: "Story Voting", icon: <Vote className="size-3.5" /> },
    { id: "gifts", label: "Virtual Gifts", icon: <Gift className="size-3.5" /> },
    { id: "commerce", label: "Live Commerce", icon: <ShoppingBag className="size-3.5" /> },
    { id: "polls", label: "Polls", icon: <Plus className="size-3.5" /> },
    { id: "cohost", label: "AI Co-Host", icon: <Radio className="size-3.5" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Award className="size-3.5" /> },
  ];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="FluxyStream"
        description="Live streaming & broadcast — interactive demo with SDK-powered features"
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
              <span className="size-1.5 rounded-full bg-red-600 animate-pulse" />
              LIVE
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium">
              <Eye className="size-3" /> {viewerCount}
            </span>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-2 border-b border-border px-4 py-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatChip label="Peak" value={stats.peakViewers} icon={<Eye className="size-3" />} />
        <StatChip label="Total viewers" value={stats.totalViewers} icon={<Users className="size-3" />} />
        <StatChip label="Messages" value={stats.totalMessages} icon={<MessageSquare className="size-3" />} />
        <StatChip label="Gifts" value={stats.totalGifts} icon={<Gift className="size-3" />} />
        <StatChip label="Revenue" value={`$${(stats.totalRevenue / 100).toFixed(2)}`} icon={<TrendingUp className="size-3" />} />
        <StatChip label="Sentiment" value={`${(stats.sentimentScore * 100).toFixed(0)}%`} icon={stats.sentimentScore > 0.1 ? <TrendingUp className="size-3 text-green-500" /> : stats.sentimentScore < -0.1 ? <TrendingDown className="size-3 text-red-500" /> : <Minus className="size-3 text-muted-foreground" />} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4" key={tick}>
        {activeTab === "viewers" && <ViewersPanel stream={stream} />}
        {activeTab === "chat" && <ChatPanel stream={stream} />}
        {activeTab === "angles" && <AnglesPanel stream={stream} />}
        {activeTab === "highlights" && <HighlightsPanel stream={stream} />}
        {activeTab === "sentiment" && <SentimentPanel stream={stream} />}
        {activeTab === "story" && <StoryPanel stream={stream} />}
        {activeTab === "gifts" && <GiftsPanel stream={stream} />}
        {activeTab === "commerce" && <CommercePanel stream={stream} />}
        {activeTab === "polls" && <PollsPanel stream={stream} />}
        {activeTab === "cohost" && <CoHostPanel stream={stream} />}
        {activeTab === "leaderboard" && <LeaderboardPanel stream={stream} />}
      </div>
    </ConsoleShell>
  );
}

// ─── Stat chip ────────────────────────────────────────

function StatChip({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// ─── Viewers panel ────────────────────────────────────

function ViewersPanel({ stream }: { stream: FluxyStreamApi }) {
  const [viewers, setViewers] = useState<StreamViewer[]>(stream.getViewers());
  const [newName, setNewName] = useState("");

  const refresh = () => setViewers([...stream.getViewers()]);

  const handleJoin = () => {
    if (!newName.trim()) return;
    const id = `u${Date.now()}`;
    stream.joinViewer(id, newName.trim());
    setNewName("");
    refresh();
  };

  const handColor = (v: StreamViewer) => {
    if (v.isBanned) return "text-red-500";
    if (v.handRaised) return "text-yellow-500";
    return "text-muted-foreground";
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active viewers ({viewers.length})
        </h3>
        <div className="space-y-1.5">
          {viewers.map((v) => (
            <div key={v.userId} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {v.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{v.username}</span>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    v.role === "host" && "bg-red-500/15 text-red-600",
                    v.role === "moderator" && "bg-blue-500/15 text-blue-600",
                    v.role === "vip" && "bg-purple-500/15 text-purple-600",
                    v.role === "subscriber" && "bg-green-500/15 text-green-600",
                    v.role === "viewer" && "bg-muted text-muted-foreground",
                  )}>{v.role}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {v.messageCount} messages · joined {new Date(v.joinedAt).toLocaleTimeString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { stream.raiseHand(v.userId); refresh(); }}
                className={cn("rounded p-1.5 hover:bg-muted", handColor(v))}
                title={v.handRaised ? "Lower hand" : "Raise hand"}
              >
                <Hand className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => { stream.muteViewer(v.userId, !v.isMuted); refresh(); }}
                className={cn("rounded p-1.5 hover:bg-muted", v.isMuted ? "text-red-500" : "text-muted-foreground")}
                title={v.isMuted ? "Unmute" : "Mute"}
              >
                {v.isMuted ? "🔇" : "🔊"}
              </button>
              <button
                type="button"
                onClick={() => { stream.banViewer(v.userId); refresh(); }}
                className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                title="Ban"
              >
                ⛔
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add test viewer
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Username"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleJoin}
            className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Roles
        </h3>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>🔴 Host — full control</p>
          <p>🔵 Moderator — manage chat & viewers</p>
          <p>🟣 VIP — special badge</p>
          <p>🟢 Subscriber — paid supporter</p>
          <p>⚪ Viewer — default</p>
        </div>

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Raise hand queue
        </h3>
        <div className="space-y-1">
          {viewers.filter((v) => v.handRaised).length === 0 ? (
            <p className="text-xs text-muted-foreground">No hands raised</p>
          ) : (
            viewers.filter((v) => v.handRaised).map((v, i) => (
              <div key={v.userId} className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-yellow-600">#{i + 1}</span>
                <span>{v.username}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat + AI moderation panel ───────────────────────

function ChatPanel({ stream }: { stream: FluxyStreamApi }) {
  const [messages, setMessages] = useState<{ userId: string; username: string; content: string; ok: boolean; reason?: string; timestamp: string }[]>([
    { userId: "u1", username: "Alice", content: "Welcome everyone! 🎉", ok: true, timestamp: new Date().toISOString() },
    { userId: "u2", username: "Bob", content: "This is awesome!", ok: true, timestamp: new Date().toISOString() },
    { userId: "u3", username: "Charlie", content: "Can you explain the architecture?", ok: true, timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const [modLog, setModLog] = useState<string[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    const result = stream.sendChatMessage("u1", input.trim());
    const msg = {
      userId: "u1", username: "You", content: input.trim(),
      ok: result.ok, reason: result.reason,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    if (!result.ok) {
      setModLog((prev) => [...prev, `🚫 Blocked: "${input.trim().slice(0, 40)}..." — ${result.reason}`]);
    }
    setInput("");
  };

  const handleAutoMod = () => {
    const testMsgs = [
      "Check out my site: scam-link.example",
      "You're amazing! ❤️",
      "My credit card is 4532-1234-5678-9012",
      "Great stream today!",
    ];
    const random = testMsgs[Math.floor(Math.random() * testMsgs.length)];
    const result = stream.sendChatMessage("u2", random);
    setMessages((prev) => [...prev, {
      userId: "u2", username: "Bot", content: random,
      ok: result.ok, reason: result.reason,
      timestamp: new Date().toISOString(),
    }]);
    if (!result.ok) {
      setModLog((prev) => [...prev, `🚫 Auto-mod blocked: "${random.slice(0, 40)}" — ${result.reason}`]);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stream chat (AI-moderated)
        </h3>
        <div className="h-64 space-y-1.5 overflow-auto rounded-lg border border-border bg-card p-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn("rounded px-2 py-1 text-sm", msg.ok ? "" : "bg-red-500/10 text-red-600 line-through")}>
              <span className="font-semibold">{msg.username}:</span>{" "}
              <span>{msg.content}</span>
              {!msg.ok && <span className="ml-2 text-[10px] italic">({msg.reason})</span>}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Send a message..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            <Send className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleAutoMod}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Test moderation
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Moderation log
        </h3>
        <div className="h-64 space-y-1 overflow-auto rounded-lg border border-border bg-muted/30 p-3">
          {modLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">No blocked messages yet. Click "Test moderation" to try.</p>
          ) : (
            modLog.map((entry, i) => (
              <div key={i} className="text-xs text-muted-foreground">{entry}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Multi-camera angles ──────────────────────────────

function AnglesPanel({ stream }: { stream: FluxyStreamApi }) {
  const [angles, setAngles] = useState<CameraAngle[]>(stream.getAngles());
  const [active, setActive] = useState<CameraAngle | null>(stream.getActiveAngle());

  const refresh = () => {
    setAngles([...stream.getAngles()]);
    setActive(stream.getActiveAngle());
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active camera: {active?.label || "None"}
        </h3>
        <div className="relative aspect-video rounded-xl border border-border bg-black">
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video className="size-12 opacity-30" />
            <span className="text-sm">{active?.label || "No camera selected"}</span>
            <code className="text-[10px] opacity-50">{active?.streamUrl || "—"}</code>
          </div>
          {active && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              <span className="size-1.5 rounded-full bg-white animate-pulse" />
              {active.label}
            </span>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Camera angles
        </h3>
        <div className="space-y-1.5">
          {angles.map((angle) => (
            <button
              key={angle.id}
              type="button"
              onClick={() => { stream.setActiveAngle(angle.id); refresh(); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-colors",
                active?.id === angle.id
                  ? "border-foreground bg-foreground/5"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <Camera className="size-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">{angle.label}</div>
                {angle.isDefault && <span className="text-[10px] text-muted-foreground">Default</span>}
              </div>
              {active?.id === angle.id && <span className="size-2 rounded-full bg-green-500" />}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Viewers can switch between camera angles in real time. The active angle broadcasts to all new viewers.
        </p>
      </div>
    </div>
  );
}

// ─── AI Highlights ────────────────────────────────────

function HighlightsPanel({ stream }: { stream: FluxyStreamApi }) {
  const [highlights, setHighlights] = useState<StreamHighlight[]>(stream.getHighlights());
  const [title, setTitle] = useState("");

  const refresh = () => setHighlights([...stream.getHighlights()]);

  const handleAdd = () => {
    if (!title.trim()) return;
    stream.suggestHighlight(title.trim(), 0, 30, "Manually created");
    setTitle("");
    refresh();
  };

  const handleAuto = () => {
    const sentiment = stream.getSentimentData();
    const gifts = stream.getSentGifts();
    const generated = stream.autoGenerateHighlights(sentiment, gifts, 600);
    refresh();
    return generated.length;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Highlights
        </h3>
        <div className="space-y-2">
          {highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No highlights yet</p>
          ) : (
            highlights.map((hl) => (
              <div key={hl.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">{hl.title}</h4>
                    <p className="text-[11px] text-muted-foreground">{hl.reason}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {hl.startSeconds}s — {hl.endSeconds}s · {hl.status}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    hl.status === "ready" && "bg-green-500/15 text-green-600",
                    hl.status === "suggested" && "bg-amber-500/15 text-amber-600",
                    hl.status === "rendering" && "bg-blue-500/15 text-blue-600",
                    hl.status === "failed" && "bg-red-500/15 text-red-600",
                  )}>{hl.status}</span>
                </div>
                {hl.clipUrl && (
                  <a href={hl.clipUrl} className="mt-1 text-[11px] text-brand underline underline-offset-2">View clip</a>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Create highlight
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Highlight title"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            Add
          </button>
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI auto-generation
        </h3>
        <button
          type="button"
          onClick={handleAuto}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          <Sparkles className="size-3.5" />
          Auto-generate from sentiment + gifts
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The AI engine analyzes sentiment spikes and gift bursts to automatically suggest highlight clips.
        </p>
      </div>
    </div>
  );
}

// ─── Sentiment dashboard ──────────────────────────────

function SentimentPanel({ stream }: { stream: FluxyStreamApi }) {
  const [data, setData] = useState<SentimentBucket[]>(stream.getSentimentData());

  const handleRecord = (label: "positive" | "neutral" | "negative") => {
    const bucket = new Date().toISOString().slice(0, 19);
    stream.recordSentiment(bucket, label);
    setData([...stream.getSentimentData()]);
  };

  const maxScore = Math.max(...data.map((d) => Math.abs(d.score)), 1);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => handleRecord("positive")} className="inline-flex items-center gap-1 rounded-lg bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-500/25">
          <TrendingUp className="size-3.5" /> Positive
        </button>
        <button type="button" onClick={() => handleRecord("neutral")} className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80">
          <Minus className="size-3.5" /> Neutral
        </button>
        <button type="button" onClick={() => handleRecord("negative")} className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/25">
          <TrendingDown className="size-3.5" /> Negative
        </button>
      </div>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Real-time sentiment chart
      </h3>
      <div className="flex h-48 items-end gap-1 rounded-lg border border-border bg-card p-3">
        {data.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">No data yet</p>
        ) : (
          data.map((bucket, i) => {
            const height = Math.abs(bucket.score) * 100;
            const isPositive = bucket.score >= 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" title={`Score: ${bucket.score.toFixed(2)}`}>
                <span className="text-[9px] tabular-nums text-muted-foreground">{(bucket.score * 100).toFixed(0)}</span>
                <div
                  className={cn("w-full rounded-t", isPositive ? "bg-green-500/70" : "bg-red-500/70")}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Positive</div>
          <div className="text-lg font-bold text-green-600">{data.reduce((s, d) => s + d.positive, 0)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Neutral</div>
          <div className="text-lg font-bold text-muted-foreground">{data.reduce((s, d) => s + d.neutral, 0)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Negative</div>
          <div className="text-lg font-bold text-red-600">{data.reduce((s, d) => s + d.negative, 0)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Interactive storytelling ─────────────────────────

function StoryPanel({ stream }: { stream: FluxyStreamApi }) {
  const [branches, setBranches] = useState(stream.getStoryBranches());
  const [voted, setVoted] = useState(false);

  const refresh = () => setBranches([...stream.getStoryBranches()]);

  const totalVotes = branches.reduce((s, b) => s + b.voteCount, 0);

  const handleVote = (branchId: string) => {
    if (voted) return;
    stream.voteStory(branchId, "demo_user");
    setVoted(true);
    refresh();
  };

  const winning = stream.getWinningBranch();

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Interactive storytelling — audience votes change stream direction
      </h3>
      {voted && (
        <p className="mb-2 text-xs text-brand">✓ Vote cast! {winning && `Currently winning: "${winning.label}"`}</p>
      )}
      <div className="space-y-2">
        {branches.map((branch) => {
          const pct = totalVotes > 0 ? (branch.voteCount / totalVotes) * 100 : 0;
          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => handleVote(branch.id)}
              disabled={voted}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                voted
                  ? winning?.id === branch.id
                    ? "border-foreground bg-foreground/5"
                    : "border-border opacity-60"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{branch.label}</div>
                  <div className="text-[11px] text-muted-foreground">{branch.description}</div>
                </div>
                <span className="text-sm font-bold tabular-nums">{branch.voteCount}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
      {voted && (
        <button
          type="button"
          onClick={() => { setVoted(false); refresh(); }}
          className="mt-3 text-xs text-brand underline underline-offset-2"
        >
          Reset vote (for testing)
        </button>
      )}
    </div>
  );
}

// ─── Virtual gifts ────────────────────────────────────

function GiftsPanel({ stream }: { stream: FluxyStreamApi }) {
  const [catalog] = useState(stream.getGiftCatalog());
  const [sent, setSent] = useState<SentGift[]>(stream.getSentGifts());
  const [animating, setAnimating] = useState<SentGift | null>(null);

  const handleSend = (giftType: string) => {
    const gift = stream.sendGift("demo_user", "You", giftType, "Amazing stream! 🔥");
    if (gift) {
      setSent(stream.getSentGifts());
      setAnimating(gift);
      setTimeout(() => setAnimating(null), 3000);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Send a virtual gift
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {catalog.map((gift) => (
            <button
              key={gift.id}
              type="button"
              onClick={() => handleSend(gift.type)}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
              style={{ borderTopColor: gift.color, borderTopWidth: 2 }}
            >
              <span className="text-3xl">{gift.iconEmoji}</span>
              <span className="text-sm font-medium">{gift.label}</span>
              <span className="text-xs text-muted-foreground">${(gift.price / 100).toFixed(2)}</span>
              <span className="text-[9px] uppercase text-muted-foreground">{gift.animation}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gift feed
        </h3>
        <div className="relative h-64 overflow-hidden rounded-lg border border-border bg-black">
          {/* Animation overlay */}
          {animating && (
            <div className="pointer-events-none absolute inset-0 z-10">
              {animating.animation === "fall" && (
                <div className="animate-bounce text-center text-6xl" style={{ marginTop: "30%" }}>
                  {animating.iconEmoji}
                </div>
              )}
              {animating.animation === "burst" && (
                <div className="flex h-full items-center justify-center">
                  <span className="text-7xl" style={{ animation: "ping 1s ease-out" }}>{animating.iconEmoji}</span>
                </div>
              )}
              {animating.animation === "float" && (
                <div className="flex h-full items-end justify-center">
                  <span className="animate-pulse text-6xl" style={{ marginBottom: "20%" }}>{animating.iconEmoji}</span>
                </div>
              )}
              {animating.animation === "rain" && (
                <div className="flex h-full items-center justify-around">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="animate-bounce text-4xl" style={{ animationDelay: `${i * 0.1}s` }}>{animating.iconEmoji}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feed */}
          <div className="h-full space-y-1 overflow-auto p-3">
            {sent.length === 0 ? (
              <p className="m-auto text-sm text-muted-foreground">No gifts sent yet. Send one! 🎁</p>
            ) : (
              sent.map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-sm text-white">
                  <span className="text-xl">{g.iconEmoji}</span>
                  <span className="font-semibold">{g.fromUsername}</span>
                  <span className="text-muted-foreground">sent a gift</span>
                  {g.message && <span className="text-xs italic">— "{g.message}"</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live commerce ────────────────────────────────────

function CommercePanel({ stream }: { stream: FluxyStreamApi }) {
  const [products, setProducts] = useState<LiveProduct[]>(stream.getProducts());
  const [active, setActive] = useState<LiveProduct | null>(stream.getActiveProduct());

  const refresh = () => {
    setProducts([...stream.getProducts()]);
    setActive(stream.getActiveProduct());
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Product catalog
        </h3>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-colors",
              p.active ? "border-foreground bg-foreground/5" : "border-border bg-card",
            )}>
              <div className="flex size-12 items-center justify-center rounded bg-muted text-xs font-bold">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="size-12 rounded object-cover" />
                ) : (
                  p.name.slice(0, 3).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                {p.description && <div className="text-[11px] text-muted-foreground">{p.description}</div>}
                <div className="text-sm font-bold">${(p.priceAmount / 100).toFixed(2)}</div>
              </div>
              <button
                type="button"
                onClick={() => { stream.showProduct(p.id); refresh(); }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium",
                  p.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {p.active ? "Showing" : "Show now"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live "Buy Now" overlay
        </h3>
        <div className="relative aspect-video rounded-xl border border-border bg-black">
          {active ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
              <div className="flex size-16 items-center justify-center rounded bg-muted">
                {active.imageUrl ? (
                  <img src={active.imageUrl} alt={active.name} className="size-16 rounded object-cover" />
                ) : (
                  <ShoppingBag className="size-8 text-muted-foreground" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-white">{active.name}</h4>
              {active.description && <p className="text-center text-[11px] text-white/60">{active.description}</p>}
              <div className="text-lg font-bold text-white">${(active.priceAmount / 100).toFixed(2)}</div>
              <a
                href={active.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-6 py-2 text-xs font-semibold text-white hover:bg-green-700"
              >
                Buy now →
              </a>
              <p className="text-[10px] text-white/40">
                Shown at {active.shownAt ? new Date(active.shownAt).toLocaleTimeString() : "—"}
              </p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ShoppingBag className="mx-auto size-8 opacity-30" />
                <p className="mt-2 text-xs">No product active. Click "Show now" to display.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Polls ────────────────────────────────────────────

function PollsPanel({ stream }: { stream: FluxyStreamApi }) {
  const [polls, setPolls] = useState<StreamPoll[]>(stream.getPolls());
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");

  const refresh = () => setPolls([...stream.getPolls()]);

  const handleCreate = () => {
    if (!question.trim() || !options.trim()) return;
    const opts = options.split(",").map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return;
    stream.createPoll(question.trim(), opts);
    setQuestion("");
    setOptions("");
    refresh();
  };

  const handleVote = (pollId: string, optionId: string) => {
    stream.votePoll(pollId, optionId, "demo_user");
    refresh();
  };

  const handleClose = (pollId: string) => {
    stream.closePoll(pollId);
    refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active & past polls
        </h3>
        <div className="space-y-3">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
            return (
              <div key={poll.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{poll.question}</h4>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    poll.status === "open" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground",
                  )}>{poll.status}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {poll.options.map((opt) => {
                    const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                    return (
                      <div key={opt.id}>
                        <div className="flex items-center justify-between text-xs">
                          <span>{opt.label}</span>
                          <span className="tabular-nums text-muted-foreground">{opt.votes} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                        </div>
                        {poll.status === "open" && (
                          <button
                            type="button"
                            onClick={() => handleVote(poll.id, opt.id)}
                            className="mt-0.5 text-[10px] text-brand underline underline-offset-2"
                          >
                            Vote
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {poll.status === "open" && (
                  <button
                    type="button"
                    onClick={() => handleClose(poll.id)}
                    className="mt-2 text-[10px] text-muted-foreground underline underline-offset-2"
                  >
                    Close poll
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Create new poll
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we ask?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Options (comma-separated)</label>
            <input
              type="text"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Option 1, Option 2, Option 3"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!question.trim() || !options.trim()}
            className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Create poll
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Co-Host ───────────────────────────────────────

function CoHostPanel({ stream }: { stream: FluxyStreamApi }) {
  const [chat, setChat] = useState<AIChatMessage[]>(stream.getChatHistory());
  const [input, setInput] = useState("");

  const refresh = () => setChat([...stream.getChatHistory()]);

  const handleAsk = () => {
    if (!input.trim()) return;
    stream.coHostRespond(input.trim());
    setInput("");
    refresh();
  };

  const handleModerate = () => {
    const testMsgs = [
      "Visit my website for free stuff!",
      "What camera are you using?",
      "My SSN is 123-45-6789",
    ];
    const random = testMsgs[Math.floor(Math.random() * testMsgs.length)];
    const result = stream.coHostModerate(random);
    setChat((prev) => [...prev, {
      id: `mod_${Date.now()}`,
      role: "system",
      content: `Moderation check on "${random}" → action: ${result.action} (${result.reason})`,
      timestamp: new Date().toISOString(),
    }]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI Co-Host chat
        </h3>
        <div className="h-64 space-y-2 overflow-auto rounded-lg border border-border bg-card p-3">
          {chat.length === 0 ? (
            <p className="m-auto text-sm text-muted-foreground">Ask the AI co-host a question!</p>
          ) : (
            chat.map((msg) => (
              <div key={msg.id} className={cn(
                "rounded-lg px-3 py-2 text-sm",
                msg.role === "cohost" && "bg-blue-500/10",
                msg.role === "user" && "bg-muted",
                msg.role === "system" && "bg-amber-500/10 text-xs italic",
              )}>
                {msg.role === "cohost" && <span className="mr-1 text-xs font-semibold text-blue-600">🤖 Co-Host:</span>}
                {msg.role === "system" && <span className="mr-1 text-xs font-semibold text-amber-600">⚙️ System:</span>}
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask the AI co-host..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAsk}
            className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI Co-Host capabilities
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>🤖 <span className="font-medium text-foreground">Auto-respond</span> — Answers viewer questions in real time</p>
          <p>⚙️ <span className="font-medium text-foreground">Moderation</span> — Scans messages for spam, PII, and policy violations</p>
          <p>📝 <span className="font-medium text-foreground">Summaries</span> — Generates stream summaries at key moments</p>
          <p>🎯 <span className="font-medium text-foreground">Highlight detection</span> — Tags moments for clip generation</p>
        </div>
        <button
          type="button"
          onClick={handleModerate}
          className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          Test moderation scan
        </button>
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────

function LeaderboardPanel({ stream }: { stream: FluxyStreamApi }) {
  const [board, setBoard] = useState(stream.getLeaderboard(10));

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Viewer leaderboard — XP & engagement
      </h3>
      <div className="space-y-1.5">
        {board.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet. Viewers earn XP by chatting, voting, and sending gifts.</p>
        ) : (
          board.map((entry, i) => (
            <div key={entry.userId} className={cn(
              "flex items-center gap-3 rounded-lg border p-3",
              i === 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card",
            )}>
              <span className="w-6 text-center text-lg">
                {i < 3 ? medals[i] : <span className="text-sm text-muted-foreground">#{i + 1}</span>}
              </span>
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {entry.username?.slice(0, 2).toUpperCase() || entry.userId.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{entry.username || entry.userId}</div>
                <div className="text-[10px] text-muted-foreground">
                  {entry.badges} badges · rank #{entry.rank}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums">{entry.totalXp}</div>
                <div className="text-[9px] uppercase text-muted-foreground">XP</div>
              </div>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={() => setBoard(stream.getLeaderboard(10))}
        className="mt-3 text-xs text-brand underline underline-offset-2"
      >
        Refresh
      </button>
    </div>
  );
}
