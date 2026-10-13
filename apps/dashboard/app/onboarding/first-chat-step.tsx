"use client";

import { useState } from "react";
import { FluxyChat } from "@/components/chat";
import type { OnboardingWizard } from "./use-onboarding-wizard";

const CHIPS = [
  {
    id: "refund",
    label: "Refund order #1042 (240 €)",
    prompt: "@assistant Please refund order #1042 for 240 EUR.",
  },
  {
    id: "summarize",
    label: "Summarize this room",
    prompt: "@assistant Summarize this room in three bullets.",
  },
  {
    id: "draft",
    label: "Draft a reply to the customer",
    prompt: "@assistant Draft a short reply to the customer about the refund.",
  },
] as const;

interface FirstChatStepProps {
  wizard: OnboardingWizard;
}

export function FirstChatStep({ wizard: w }: FirstChatStepProps) {
  const canChat = Boolean(w.memberJwt.trim() && w.room?.id);
  const agentId = w.agent?.id ?? "";
  const agentName = w.agent?.name ?? "Assistant";
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">See an agent ask for permission</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a chip. The refund prompt is sent to the agent. If it calls refund_order, the
          approval card in this timeline is the live HITL request.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={!canChat}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            onClick={() => setQueuedPrompt(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {!canChat ? (
        <p className="text-sm text-muted-foreground">
          {w.creatingRoom || w.creatingAgent
            ? "Setting up the room…"
            : "Waiting for the room. Create the project on the previous screen if this stays empty."}
        </p>
      ) : (
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
          queuedPrompt={queuedPrompt}
          suggestedPrompts={CHIPS.map((c) => c.prompt)}
          onMessageSent={() => w.markMessageSent()}
        />
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Developer notes</summary>
        <p className="mt-2">
          Worker: <code>{w.workerUrl}</code>. Tool rounds use the agent profile, not this page.
        </p>
      </details>

      {w.error ? <p className="text-xs text-red-500">{w.error}</p> : null}
    </div>
  );
}
