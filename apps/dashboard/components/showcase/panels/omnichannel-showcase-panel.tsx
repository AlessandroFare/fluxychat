"use client";

import React from "react";
import { ArrowRightLeft, MessageSquare, Smartphone } from "lucide-react";
import { createCrossChannelContinuity } from "@fluxy-chat/sdk";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

const PLATFORMS = [
  { id: "slack", label: "Slack", emoji: "💬" },
  { id: "discord", label: "Discord", emoji: "🎮" },
  { id: "telegram", label: "Telegram", emoji: "✈️" },
  { id: "whatsapp", label: "WhatsApp", emoji: "📱" },
  { id: "teams", label: "Teams", emoji: "🟦" },
  { id: "email", label: "Email", emoji: "📧" },
] as const;

export function OmnichannelShowcasePanel({ session }: { session: ShowcaseSession }) {
  const [ccc] = React.useState(() => createCrossChannelContinuity());
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [active, setActive] = React.useState<string>("web");
  const [log, setLog] = React.useState<string[]>([]);

  function ensureSession() {
    if (sessionId) return sessionId;
    const created = ccc.createSession(session.userId ?? "guest", {
      channel: "web",
      externalId: session.roomId ?? "demo",
      displayName: "In-app",
    });
    setSessionId(created.id);
    return created.id;
  }

  function linkPlatform(platform: (typeof PLATFORMS)[number]) {
    const sid = ensureSession();
    ccc.linkIdentity(sid, {
      channel: platform.id === "email" ? "email" : "bot",
      externalId: `${platform.id}-${session.userId?.slice(-4) ?? "demo"}`,
      displayName: platform.label,
    });
    setLog((prev) => [`Linked ${platform.label}`, ...prev].slice(0, 6));
  }

  function switchTo(platform: string) {
    const sid = sessionId ?? ensureSession();
    ccc.switchChannel(sid, platform === "email" ? "email" : platform === "web" ? "web" : "bot");
    setActive(platform);
    setLog((prev) => [`Active channel → ${platform}`, ...prev].slice(0, 6));
  }

  return (
    <div className="flex h-full min-h-[26rem] flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
          <ArrowRightLeft className="size-5" aria-hidden />
        </span>
        <div>
          <h4 className="font-semibold text-foreground">Bridges</h4>
          <p className="text-xs text-muted-foreground">You create the vendor app. Paste the token in the console.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => (
          <Button
            key={platform.id}
            type="button"
            size="sm"
            variant={active === platform.id ? "default" : "outline"}
            onClick={() => switchTo(platform.id)}
          >
            <span className="mr-1">{platform.emoji}</span>
            {platform.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => linkPlatform(PLATFORMS[0]!)}>
          <MessageSquare className="mr-1 size-3.5" aria-hidden />
          Link Slack
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => linkPlatform(PLATFORMS[3]!)}>
          <Smartphone className="mr-1 size-3.5" aria-hidden />
          Link WhatsApp
        </Button>
      </div>

      <ul className="mt-4 flex-1 space-y-1 rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        {log.length === 0 ? (
          <li>Link a channel to see continuity events.</li>
        ) : (
          log.map((line) => <li key={line}>{line}</li>)
        )}
      </ul>
    </div>
  );
}
