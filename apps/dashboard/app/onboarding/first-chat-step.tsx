"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Sparkles, X } from "lucide-react";
import BlurText from "@/components/BlurText";
import ShinyText from "@/components/ShinyText";
import { FluxyChat } from "@/components/chat";
import type { OnboardingWizard } from "./use-onboarding-wizard";

const SUGGESTED_PROMPTS = [
  "Tell me about FluxyChat features",
  "Show me a card example",
  "Search the web for AI chat trends",
  "Generate an image",
] as const;

interface FirstChatStepProps {
  wizard: OnboardingWizard;
}

export function FirstChatStep({ wizard: w }: FirstChatStepProps) {
  const canChat = Boolean(w.memberJwt.trim() && w.room?.id);
  const agentId = w.agent?.id ?? "";
  const agentName = w.agent?.name ?? "Assistant";
  const roomLabel = w.room?.name ?? w.room?.id ?? "your assistant room";

  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    if (w.userSentMessage) setShowWelcome(false);
  }, [w.userSentMessage]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-center">
        <BlurText
          text="Try your first chat"
          className="justify-center text-lg font-semibold text-foreground"
          delay={40}
          animateBy="words"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Type a message in the box below and press{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd>.
          Messages to <span className="font-medium text-foreground">@assistant</span> trigger the AI.
        </p>
      </div>

      {showWelcome && canChat && !w.userSentMessage ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 p-4 shadow-sm"
          role="status"
        >
          <button
            type="button"
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            onClick={() => setShowWelcome(false)}
            aria-label="Dismiss welcome hint"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Welcome to{" "}
                <ShinyText
                  text={roomLabel}
                  speed={2.5}
                  color="hsl(var(--foreground))"
                  shineColor="hsl(var(--primary))"
                  className="font-semibold"
                />
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                This is your live chat room. The message box is right below. Send anything to continue the tour.
                We add <code className="text-[10px]">@assistant</code> automatically when needed.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {w.showCelebration && w.userSentMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in duration-300">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">You&apos;re live!</p>
            <p className="text-sm text-muted-foreground">
              Your message was delivered over WebSocket. The stack is working.
            </p>
          </div>
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => w.setShowCelebration(false)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!canChat ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {w.creatingRoom || w.creatingAgent
            ? "Setting up your chat room and assistant…"
            : "Setting up your chat room… This will be ready in a moment."}
        </div>
      ) : null}

      {canChat ? (
        <FluxyChat
          roomId={w.room!.id}
          projectId={w.project?.id ?? ""}
          agentId={agentId}
          agentName={agentName}
          agentHandle="assistant"
          memberJwt={w.memberJwt}
          adminJwt={w.adminJwt}
          memberUserId={w.userId}
          variant="onboarding"
          coPilotConfirm={false}
          suggestedPrompts={[...SUGGESTED_PROMPTS]}
          onMessageSent={() => {
            w.markMessageSent();
            setShowWelcome(false);
          }}
        />
      ) : (
        <div
          className="flex h-48 items-center justify-center rounded-2xl bg-muted/20 p-3 text-center"
          data-testid="message-list"
        >
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">Preparing your room…</p>
          </div>
        </div>
      )}

      {w.error ? <p className="text-xs text-red-500">{w.error}</p> : null}
    </div>
  );
}
