"use client";

import { KeyRound, RefreshCw } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { ConsoleFeedback } from "@/app/components/console-feedback";
import { Button } from "@/app/components/ui";
import { cn } from "@/lib/utils";
import { AgentsConsoleProvider, useAgentsConsole } from "./agents-console-context";
import { AgentsSidebar } from "./agents-sidebar";

function selectedAgentIdFromPath(pathname: string, params: { id?: string }): string | null {
  if (params.id) return params.id;
  const match = pathname.match(/^\/agents\/([^/]+)/);
  return match?.[1] && match[1] !== "new" && match[1] !== "llm-keys" ? match[1] : null;
}

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const selectedId = selectedAgentIdFromPath(pathname, params);
  const isLlmKeys = pathname === "/agents/llm-keys";

  return (
    <AgentsConsoleProvider selectedId={selectedId}>
      <AgentsLayoutInner isLlmKeys={isLlmKeys}>{children}</AgentsLayoutInner>
    </AgentsConsoleProvider>
  );
}

function AgentsLayoutInner({
  children,
  isLlmKeys,
}: {
  children: React.ReactNode;
  isLlmKeys: boolean;
}) {
  const { activeProject, loadingAgents, loadAgents, openLlmKeys, error, notice } = useAgentsConsole();

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Agents"
        description={
          <>
            Bots for project <code className="text-xs">{activeProject?.name || "—"}</code>. Pick one
            from the list, then create, edit profile, test invoke, or chat in the assistant room.
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => openLlmKeys()}>
              <KeyRound className="mr-1.5 h-4 w-4" />
              LLM keys
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void loadAgents()} disabled={loadingAgents}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", loadingAgents && "animate-spin")} />
              Reload
            </Button>
          </div>
        }
      />
      <ConsoleFeedback error={error} notice={notice} className="mb-4 space-y-3" />
      {isLlmKeys ? (
        children
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,300px)_1fr]">
          <AgentsSidebar />
          <main className="min-w-0">{children}</main>
        </div>
      )}
    </ConsoleShell>
  );
}
