"use client";

import { useCallback } from "react";
import { Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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

  const handlePromptClick = useCallback(
    (prompt: string) => {
      if (!canChat) return;
      w.sendMessage(prompt);
    },
    [canChat, w],
  );

  return (
    <div className="mx-auto space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Try your first chat</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Type a message or tap a suggestion below. The AI responds with streaming markdown.
        </p>
      </div>

      {/* Celebration banner */}
      {w.showCelebration && w.userSentMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">You're live! 🎉</p>
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
      )}

      {/* Connection status */}
      {!canChat && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Setting up your chat room... This will be ready in a moment.
        </div>
      )}

      {/* Chat */}
      {canChat ? (
        <FluxyChat
          roomId={w.room!.id}
          agentId={agentId}
          agentName={agentName}
          memberJwt={w.memberJwt}
          adminJwt={w.adminJwt}
          memberUserId={w.userId}
          client={w.fluxyClient}
          coPilotConfirm={false}
          onMessageSent={() => {
            // The wizard's sendMessage wrapper already tracks userSentMessage,
            // but FluxyChat manages its own send. We rely on the wizard's
            // connection to the same room to see the message appear.
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
              [FluxyChat] Room ready. You're the first one here.
            </p>
          </div>
        </div>
      )}

      {/* Suggested prompts */}
      {canChat && !w.userSentMessage && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5",
                "text-xs font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/5",
              )}
            >
              <Sparkles className="h-3 w-3 text-primary/60" />
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* First message checklist */}
      {canChat && !w.userSentMessage && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          Send a message to continue
        </div>
      )}
      {w.userSentMessage && (
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <Check className="h-4 w-4" />
          First message sent — you're all connected!
        </div>
      )}

      {w.error && <p className="text-xs text-red-500">{w.error}</p>}
    </div>
  );
}
