"use client";

import { Bot } from "lucide-react";
import { Panel } from "@/app/components/ui";

export default function AgentsIndexPage() {
  return (
    <Panel className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center">
      <Bot className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <h2 className="font-heading text-lg font-medium">Select an agent</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Pick an agent from the list, or create one with <strong>New agent</strong>.
      </p>
    </Panel>
  );
}
