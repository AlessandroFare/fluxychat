"use client";

import type { UIPart } from "@fluxy-chat/sdk";
import { isTextPart, isToolCallPart, isToolResultPart, parseToolName } from "@fluxy-chat/sdk";
import { cn } from "@/lib/utils";
import { Badge } from "~/components/ui/badge";

interface AgentUiRendererProps {
  parts: UIPart[];
  className?: string;
}

export function AgentUiRenderer({ parts, className }: AgentUiRendererProps) {
  if (!parts.length) return null;

  return (
    <div className={cn("space-y-2 text-sm", className)} data-testid="agent-ui-renderer">
      {parts.map((part, index) => {
        if (isTextPart(part)) {
          return (
            <p key={`text-${index}`} className="whitespace-pre-wrap text-foreground">
              {part.text}
            </p>
          );
        }
        if (isToolCallPart(part)) {
          return (
            <div key={part.toolCallId} className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <Badge variant="outline" className="mb-1">
                {part.toolName}
              </Badge>
              <pre className="max-h-32 overflow-auto text-xs text-muted-foreground">
                {JSON.stringify(part.args, null, 2)}
              </pre>
            </div>
          );
        }
        if (isToolResultPart(part)) {
          const toolName = parseToolName(part.type) ?? part.toolName;
          return (
            <div key={part.toolCallId} className="rounded-md px-3 py-2">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={part.state === "output-error" ? "destructive" : "secondary"}>
                  {toolName}
                </Badge>
                <span className="text-xs text-muted-foreground">{part.state}</span>
              </div>
              {part.state === "output-error" ? (
                <p className="text-xs text-destructive">{part.errorText}</p>
              ) : (
                <pre className="max-h-32 overflow-auto text-xs text-muted-foreground">
                  {JSON.stringify(part.output ?? {}, null, 2)}
                </pre>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
