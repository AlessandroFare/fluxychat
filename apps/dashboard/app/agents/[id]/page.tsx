"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ModelCapabilityBadges } from "@/app/components/model-capability-badges";
import { LlmCredentialStatus } from "@/app/components/llm-credential-status";
import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { ConsoleStatRow } from "@/app/components/console-stat-row";
import { Button, Panel } from "@/app/components/ui";
import { formatModelRef } from "@/lib/agent-catalog";
import {
  findCatalogProvider,
  resolveModelCapabilities,
} from "@/lib/llm-registry-ui";
import { useAgentsConsole } from "../agents-console-context";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const {
    selectedAgent,
    llmCatalog,
    openLlmKeys,
    openAgentChat,
    preparingChat,
    deleteAgent,
    deleting,
    loadingAgents,
    loadAgents,
  } = useAgentsConsole();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (!selectedAgent || selectedAgent.id !== agentId) {
    // Distinguish loading from genuine not-found so a slow Worker doesn't
    // show "not found" with no recourse. (Audit P2 fix.)
    if (loadingAgents) {
      return (
        <Panel className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-muted-foreground" />
          Loading agent…
        </Panel>
      );
    }
    return (
      <Panel className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
        <p className="mb-4">Agent not found. It may have been deleted, or the session needs to refresh.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAgents()}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Reload agents
        </Button>
      </Panel>
    );
  }

  return (
    <Panel className="rounded-2xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{selectedAgent.name}</h2>
          {selectedAgent.handle ? (
            <p className="text-sm text-muted-foreground">@{selectedAgent.handle}</p>
          ) : null}
          <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedAgent.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/agents/${agentId}/edit`}
            className="inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted/60"
          >
            <Pencil className="h-4 w-4" />
            Edit profile
          </Link>
          <Button
            variant="neutral"
            size="sm"
            onClick={() => void openAgentChat(agentId)}
            disabled={preparingChat}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            {preparingChat ? "Opening…" : "Chat in room"}
          </Button>
          <Link
            href={`/agents/${agentId}/invoke`}
            className="inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent bg-[var(--am-midnight-ink)] px-2.5 text-xs font-medium text-white"
          >
            <Play className="h-4 w-4" />
            Test invoke
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting === agentId}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {deleting === agentId ? "…" : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Model
          </h3>
          <ConsoleStatRow
            label="Provider / model"
            value={
              selectedAgent.provider && selectedAgent.model ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <code className="text-xs">
                    {formatModelRef(selectedAgent.provider, selectedAgent.model)}
                  </code>
                  {(() => {
                    const caps = resolveModelCapabilities(
                      llmCatalog,
                      selectedAgent.provider || "",
                      selectedAgent.model || "",
                    );
                    return caps ? <ModelCapabilityBadges capabilities={caps} /> : null;
                  })()}
                </span>
              ) : (
                ""
              )
            }
          />
          {selectedAgent.provider ? (
            <ConsoleStatRow
              label="LLM keys"
              value={
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  <LlmCredentialStatus
                    status={
                      findCatalogProvider(llmCatalog, selectedAgent.provider || "")
                        ?.credentialStatus
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      openLlmKeys({
                        providerId: selectedAgent.provider || "",
                        returnTo: `/agents/${agentId}`,
                      })
                    }
                  >
                    Configure keys
                  </Button>
                </span>
              }
            />
          ) : null}
          <ConsoleStatRow
            label="Rate limit"
            value={selectedAgent.rateLimitRpm ? `${selectedAgent.rateLimitRpm}/min` : "default"}
          />
          <ConsoleStatRow
            label="Capabilities"
            value={(selectedAgent.capabilities || ["chat"]).join(", ")}
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Integrations
          </h3>
          <ConsoleStatRow
            label="Context fetch"
            value={
              selectedAgent.contextFetchUrl ? (
                <span className="max-w-[200px] truncate font-mono text-xs">
                  {selectedAgent.contextFetchUrl}
                </span>
              ) : (
                ""
              )
            }
          />
          <ConsoleStatRow
            label="Tool execute"
            value={
              selectedAgent.toolExecuteUrl ? (
                <span className="max-w-[200px] truncate font-mono text-xs">
                  {selectedAgent.toolExecuteUrl}
                </span>
              ) : (
                ""
              )
            }
          />
          <ConsoleStatRow
            label="Tools schema"
            value={
              selectedAgent.toolsSchema?.length
                ? `${selectedAgent.toolsSchema.length} tool(s)`
                : ""
            }
          />
        </div>
      </div>

      {selectedAgent.systemPrompt ? (
        <div className="mt-6 rounded-xl border border-dashed border-border/80 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            System prompt
          </h3>
          <p className="whitespace-pre-wrap text-sm text-foreground">{selectedAgent.systemPrompt}</p>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete this agent?"
        description="Removes the bot from this project. Past invokes may stay in logs for audit."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void deleteAgent(agentId)}
      />
    </Panel>
  );
}
