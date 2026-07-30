"use client";

import { Sparkles, Check } from "lucide-react";
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
  const canChat = Boolean(w.memberJwt.trim() && w.room?.id && w.fluxyClient);
  const agentId = w.agent?.id ?? "";
  const agentName = w.agent?.name ?? "Assistant";

  return (
    <div className="mx-auto space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Try your first chat</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Type a message below and press Enter. Messages to{" "}
          <span className="font-medium text-foreground">@assistant</span> trigger the AI — we add the mention automatically if you skip it.
        </p>
      </div>

      {w.showCelebration && w.userSentMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">You&apos;re live! 🎉</p>
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
          agentId={agentId}
          agentName={agentName}
          agentHandle="assistant"
          memberJwt={w.memberJwt}
          adminJwt={w.adminJwt}
          memberUserId={w.userId}
          client={w.fluxyClient}
          variant="onboarding"
          coPilotConfirm={false}
          suggestedPrompts={[...SUGGESTED_PROMPTS]}
          onMessageSent={() => {
            w.markMessageSent();
          }}
          className="mt-2"
        />
      ) : (
        <div
          className="flex h-[340px] items-center justify-center rounded-2xl border border-border bg-muted/20 p-3 text-center"
          data-testid="message-list"
        >
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">Start the conversation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              [FluxyChat] Room ready. You&apos;re the first one here.
            </p>
          </div>
        </div>
      )}

      {canChat && !w.userSentMessage ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
            Send a message to continue
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => w.goNext()}
          >
            Skip for now
          </button>
        </div>
      ) : null}

      {w.userSentMessage ? (
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <Check className="h-4 w-4" />
          First message sent — you&apos;re all connected!
        </div>
      ) : null}

      {w.error ? <p className="text-xs text-red-500">{w.error}</p> : null}
    </div>
  );
}
