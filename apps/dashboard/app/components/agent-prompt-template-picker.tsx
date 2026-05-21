"use client";

import { AGENT_PROMPT_TEMPLATES } from "@/lib/agent-prompt-templates";
import { cn } from "@/lib/utils";

export interface AgentPromptTemplateApplyPatch {
  systemPrompt: string;
  handle?: string;
  capabilities?: string;
}

interface AgentPromptTemplatePickerProps {
  onApply: (patch: AgentPromptTemplateApplyPatch) => void;
  className?: string;
}

export function AgentPromptTemplatePicker({
  onApply,
  className,
}: AgentPromptTemplatePickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Starter templates</p>
      <div className="flex flex-wrap gap-2">
        {AGENT_PROMPT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            title={template.description}
            className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-brand/40 hover:bg-brand/5"
            onClick={() =>
              onApply({
                systemPrompt: template.systemPrompt,
                ...(template.suggestedHandle
                  ? { handle: template.suggestedHandle }
                  : {}),
                ...(template.suggestedCapabilities
                  ? { capabilities: template.suggestedCapabilities }
                  : {}),
              })
            }
          >
            {template.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Replaces the system prompt; may also set handle and capabilities when the template
        defines them.
      </p>
    </div>
  );
}
