"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  History,
  KeyRound,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Badge } from "@/components/ui/badge";
import { AgentRoomChat } from "../components/agent-room-chat";
import { AgentRunHistoryRow } from "../components/agent-run-history-row";
import { AgentProfileForm } from "../components/agent-profile-form";
import type { AgentFormValues } from "../components/agent-form-fields";
import { LlmProviderRegistryOverview } from "../components/llm-provider-registry-overview";
import { ModelCapabilityBadges } from "../components/model-capability-badges";
import { LlmCredentialStatus } from "../components/llm-credential-status";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { LlmProviderCredentials } from "../components/llm-provider-credentials";
import { RoomPicker } from "../components/room-picker";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Button, EmptyState, Input, Panel, SkeletonCard } from "../components/ui";
import { ASSISTANT_ROOM_ID } from "@/lib/assistant-room";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { fetchLlmCatalog, type LlmCatalogResponse } from "@/lib/llm-catalog-client";
import { buildAgentLlmConfig, formatModelRef } from "@/lib/agent-catalog";
import {
  findCatalogProvider,
  resolveModelCapabilities,
} from "@/lib/llm-registry-ui";
import { cn } from "@/lib/utils";

import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";

const WORKER_URL = getPublicWorkerUrl();

type AgentsPanel = "none" | "create" | "edit" | "invoke" | "chat" | "llm-keys";

interface Agent {
  id: string;
  projectId: string;
  name: string;
  handle?: string | null;
  provider?: string | null;
  model?: string | null;
  capabilities?: string[];
  systemPrompt?: string | null;
  contextFetchUrl?: string | null;
  toolExecuteUrl?: string | null;
  toolsSchema?: unknown[] | null;
  rateLimitRpm?: number | null;
  config?: Record<string, unknown> | null;
  createdAt?: string;
}

interface AgentRun {
  id: string;
  status: "queued" | "completed" | "failed";
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  error?: string | null;
  room_id?: string | null;
  iterations?: number;
  tool_calls?: unknown[];
  created_at: string;
}

const emptyForm = (): AgentFormValues => ({
  name: "",
  handle: "",
  provider: "openai",
  model: "gpt-4o-mini",
  capabilities: "chat",
  systemPrompt: "",
  contextFetchUrl: "",
  toolExecuteUrl: "",
  llmBaseUrl: "",
  fallbackProvider: "",
  fallbackModel: "",
});

function agentToForm(agent: Agent): AgentFormValues {
  const cfg = agent.config as {
    llm?: { baseUrl?: string; fallbackProvider?: string; fallbackModel?: string };
  } | null | undefined;
  return {
    name: agent.name,
    handle: agent.handle || "",
    provider: agent.provider || "openai",
    model: agent.model || "",
    capabilities: (agent.capabilities || ["chat"]).join(","),
    systemPrompt: agent.systemPrompt || "",
    contextFetchUrl: agent.contextFetchUrl || "",
    toolExecuteUrl: agent.toolExecuteUrl || "",
    llmBaseUrl: cfg?.llm?.baseUrl || "",
    fallbackProvider: cfg?.llm?.fallbackProvider || "",
    fallbackModel: cfg?.llm?.fallbackModel || "",
  };
}

function agentFromApiResponse(
  row: Partial<Agent> & Pick<Agent, "id" | "name">,
  projectId: string
): Agent {
  return {
    projectId: row.projectId ?? projectId,
    id: row.id,
    name: row.name,
    handle: row.handle ?? null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    capabilities: row.capabilities ?? [],
    systemPrompt: row.systemPrompt ?? null,
    contextFetchUrl: row.contextFetchUrl ?? null,
    toolExecuteUrl: row.toolExecuteUrl ?? null,
    toolsSchema: row.toolsSchema ?? null,
    rateLimitRpm: row.rateLimitRpm ?? null,
    config: row.config ?? null,
    createdAt: row.createdAt,
  };
}

function formToPayload(form: AgentFormValues) {
  return {
    name: form.name.trim(),
    handle: form.handle.trim() || undefined,
    provider: form.provider.trim() || undefined,
    model: form.model.trim() || undefined,
    capabilities: form.capabilities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    systemPrompt: form.systemPrompt.trim() || undefined,
    contextFetchUrl: form.contextFetchUrl.trim() || undefined,
    toolExecuteUrl: form.toolExecuteUrl.trim() || undefined,
    config: buildAgentLlmConfig({
      provider: form.provider,
      llmBaseUrl: form.llmBaseUrl,
      fallbackProvider: form.fallbackProvider,
      fallbackModel: form.fallbackModel,
    }),
  };
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function AgentsPage() {
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const { user: clerkUser } = useClerkUser();
  const sessionToken = (adminJwt || memberJwt).trim();
  const memberUserId = clerkUser?.id
    ? fluxyUserIdFromClerk(clerkUser.id)
    : "dashboard";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<AgentsPanel>("none");

  const [createForm, setCreateForm] = useState<AgentFormValues>(emptyForm);
  const [editForm, setEditForm] = useState<AgentFormValues>(emptyForm);

  const [llmCatalog, setLlmCatalog] = useState<LlmCatalogResponse | null>(null);
  const [loadLiveModels, setLoadLiveModels] = useState(false);
  const [llmKeysFocusProvider, setLlmKeysFocusProvider] = useState<string | null>(null);
  const [llmKeysReturnPanel, setLlmKeysReturnPanel] = useState<AgentsPanel | null>(null);

  const [invokeRoomId, setInvokeRoomId] = useState(ASSISTANT_ROOM_ID);
  const [invokeText, setInvokeText] = useState("");
  const [chatRoomId, setChatRoomId] = useState(ASSISTANT_ROOM_ID);
  const [preparingChat, setPreparingChat] = useState(false);

  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingAgent, setUpdatingAgent] = useState(false);
  const [invoking, setInvoking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const client = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard-admin",
        token: adminJwt.trim() || undefined,
      }),
    [adminJwt],
  );

  const visibleAgents = useMemo(() => {
    if (!activeProject?.id) return agents;
    return agents.filter((a) => a.projectId === activeProject.id);
  }, [agents, activeProject?.id]);

  const selectedAgent = visibleAgents.find((a) => a.id === selectedId) ?? null;

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const selectAgent = useCallback((agent: Agent) => {
    setSelectedId(agent.id);
    setEditForm(agentToForm(agent));
    setPanel("none");
    setRuns([]);
    setError(null);
    setNotice(null);
  }, []);

  const loadAgents = useCallback(async () => {
    if (!adminJwt.trim()) {
      setError("Admin JWT required — configure session in Projects or use a valid token.");
      setAgents([]);
      return;
    }
    setLoadingAgents(true);
    setError(null);
    try {
      const list = await client.listAgents();
      setAgents(list);
      const scoped = activeProject?.id
        ? list.filter((a) => a.projectId === activeProject.id)
        : list;
      const sid = selectedIdRef.current;
      if (sid && !scoped.some((a) => a.id === sid)) {
        setSelectedId(null);
      }
      if (!sid && scoped.length === 1) {
        selectAgent(scoped[0]);
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load agents"));
    } finally {
      setLoadingAgents(false);
    }
  }, [adminJwt, activeProject?.id, client, selectAgent]);

  const loadRuns = useCallback(async (agentId: string) => {
    if (!adminJwt.trim()) return;
    setLoadingRuns(true);
    setError(null);
    try {
      const data = await client.getAgentRuns(agentId, 50);
      setRuns(data);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load runs"));
    } finally {
      setLoadingRuns(false);
    }
  }, [adminJwt, client]);

  useEffect(() => {
    if (!adminJwt.trim()) return;
    void loadAgents();
  }, [adminJwt, loadAgents]);

  const reloadLlmCatalog = useCallback(async () => {
    if (!adminJwt.trim()) {
      setLlmCatalog(null);
      return;
    }
    try {
      const c = await fetchLlmCatalog(adminJwt.trim(), { live: loadLiveModels });
      setLlmCatalog(c);
    } catch {
      setLlmCatalog(null);
    }
  }, [adminJwt, loadLiveModels]);

  useEffect(() => {
    void reloadLlmCatalog();
  }, [reloadLlmCatalog]);

  const openLlmKeysForProvider = useCallback(
    (providerId: string, returnPanel?: AgentsPanel) => {
      setLlmKeysFocusProvider(providerId);
      setLlmKeysReturnPanel(returnPanel ?? null);
      setPanel("llm-keys");
      setError(null);
    },
    [],
  );

  const closeLlmKeysPanel = useCallback(() => {
    const back = llmKeysReturnPanel;
    setLlmKeysReturnPanel(null);
    setLlmKeysFocusProvider(null);
    setPanel(back && back !== "llm-keys" ? back : "none");
    void reloadLlmCatalog();
  }, [llmKeysReturnPanel, reloadLlmCatalog]);

  useEffect(() => {
    if (panel === "invoke" && selectedId) {
      void loadRuns(selectedId);
    }
  }, [panel, selectedId, loadRuns]);

  const createAgent = async () => {
    if (!createForm.name.trim()) {
      setError("Agent name is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{
        agent?: Partial<Agent> & Pick<Agent, "id" | "name">;
      }>(
        `${WORKER_URL}/agents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminJwt.trim()}`,
          },
          body: JSON.stringify(formToPayload(createForm)),
        }
      );
      await loadAgents();
      if (json.agent && activeProject?.id) {
        selectAgent(agentFromApiResponse(json.agent, activeProject.id));
        setPanel("none");
        setNotice(`Created “${json.agent.name}”.`);
      }
      setCreateForm(emptyForm());
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to create agent"));
    } finally {
      setCreating(false);
    }
  };

  const saveAgentEdits = async () => {
    if (!selectedId || !editForm.name.trim()) return;
    setUpdatingAgent(true);
    setError(null);
    try {
      await client.updateAgent(selectedId, formToPayload(editForm));
      await loadAgents();
      setPanel("none");
      setNotice("Agent updated.");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Update failed"));
    } finally {
      setUpdatingAgent(false);
    }
  };

  const deleteAgent = async () => {
    if (!selectedId) return;
    setDeleting(selectedId);
    setError(null);
    try {
      await client.deleteAgent(selectedId);
      setSelectedId(null);
      setPanel("none");
      await loadAgents();
      setNotice("Agent deleted.");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to delete agent"));
    } finally {
      setDeleting(null);
    }
  };

  const openAgentChat = async () => {
    if (!selectedAgent) return;
    const jwt = memberJwt.trim();
    if (!jwt) {
      setError(
        "Member JWT required for live chat. Complete Quickstart, sign in on hosted cloud, or paste a member JWT in Projects.",
      );
      return;
    }
    setPreparingChat(true);
    setError(null);
    try {
      const { room } = await ensureAssistantRoom({
        workerUrl: WORKER_URL,
        memberJwt: jwt,
        memberUserId,
      });
      setChatRoomId(room.id);
      setInvokeRoomId(room.id);
      setPanel("chat");
      setNotice(`Chat room “${room.id}” is ready.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Could not open assistant room"));
    } finally {
      setPreparingChat(false);
    }
  };

  const invokeAgent = async () => {
    if (!selectedId || !invokeText.trim() || !invokeRoomId.trim()) {
      setError("Select a room and enter a message.");
      return;
    }
    setInvoking(true);
    setError(null);
    try {
      await client.invokeAgentRest(selectedId, invokeRoomId, invokeText.trim());
      setInvokeText("");
      await loadRuns(selectedId);
      setNotice("Invoke completed — check run history below.");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Invoke failed"));
    } finally {
      setInvoking(false);
    }
  };

  function PanelHeader({
    title,
    description,
    onClose,
  }: {
    title: string;
    description?: string;
    onClose: () => void;
  }) {
    return (
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Agents"
        description={
          <>
            Bots for project{" "}
            <code className="text-xs">{activeProject?.name || "—"}</code>. Pick one from the list, then create,
            edit profile, test invoke, or chat in the assistant room.
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (panel === "llm-keys") {
                  closeLlmKeysPanel();
                  return;
                }
                setLlmKeysReturnPanel(null);
                setLlmKeysFocusProvider(null);
                setPanel("llm-keys");
              }}
            >
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

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 p-3 text-sm text-red-950">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50 p-3 text-sm text-emerald-950">
          {notice}
        </div>
      ) : null}

      {panel === "llm-keys" && adminJwt.trim() ? (
        <div className="mb-6 space-y-6">
          {llmKeysReturnPanel ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
              <span className="text-foreground">
                {llmKeysReturnPanel === "create"
                  ? "Return to new agent profile after saving keys."
                  : "Return to edit agent profile after saving keys."}
              </span>
              <Button variant="neutral" size="sm" onClick={closeLlmKeysPanel}>
                Back to profile
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={loadLiveModels}
                onChange={(e) => setLoadLiveModels(e.target.checked)}
              />
              Load live OpenRouter models in catalog
            </label>
            <Button variant="ghost" size="sm" onClick={closeLlmKeysPanel}>
              Close
            </Button>
          </div>
          <LlmProviderRegistryOverview catalog={llmCatalog} />
          <LlmProviderCredentials
            adminJwt={adminJwt}
            focusProviderId={llmKeysFocusProvider}
            onSaved={() => void reloadLlmCatalog()}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,300px)_1fr]">
        <aside className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agents
          </h2>

          <Button
            variant={panel === "create" ? "neutral" : "outline"}
            className="w-full justify-start"
            onClick={() => {
              setPanel(panel === "create" ? "none" : "create");
              setCreateForm(emptyForm());
              setError(null);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New agent
          </Button>

          {loadingAgents && visibleAgents.length === 0 ? (
            <div className="flex flex-col gap-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : null}

          {visibleAgents.length === 0 && !loadingAgents ? (
            <EmptyState
              icon={Bot}
              title="No agents"
              description={
                activeProject?.id
                  ? "Use New agent to add one."
                  : "Choose a project on Overview first."
              }
            />
          ) : null}

          <ul className="flex flex-col gap-1.5">
            {visibleAgents.map((agent) => {
              const isSelected = selectedId === agent.id;
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => selectAgent(agent)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "border-brand/40 bg-brand/5 ring-1 ring-brand/20"
                        : "border-border/60 bg-white/80 hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <div className="font-medium text-foreground">{agent.name}</div>
                    {agent.handle ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">@{agent.handle}</p>
                    ) : null}
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {agent.provider && agent.model
                        ? formatModelRef(agent.provider, agent.model)
                        : "no model"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="min-w-0">
          {panel === "create" ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <PanelHeader
                title="New agent profile"
                description="Adds a bot to this project. Use @handle in chat for streaming invoke."
                onClose={() => setPanel("none")}
              />
              <AgentProfileForm
                values={createForm}
                onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
                llmCatalog={llmCatalog}
                onConfigureKeys={(providerId) =>
                  openLlmKeysForProvider(providerId, "create")
                }
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  className="bg-brand text-white hover:bg-[#e8614d]"
                  onClick={() => void createAgent()}
                  disabled={creating || !createForm.name.trim()}
                >
                  {creating ? "Creating…" : "Create agent"}
                </Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>
                  Cancel
                </Button>
              </div>
            </Panel>
          ) : null}

          {panel === "edit" && selectedAgent ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <PanelHeader
                title="Edit agent profile"
                description={`Updating ${selectedAgent.name}`}
                onClose={() => setPanel("none")}
              />
              <AgentProfileForm
                values={editForm}
                onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                llmCatalog={llmCatalog}
                onConfigureKeys={(providerId) =>
                  openLlmKeysForProvider(providerId, "edit")
                }
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="neutral" onClick={() => void saveAgentEdits()} disabled={updatingAgent}>
                  {updatingAgent ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>
                  Cancel
                </Button>
              </div>
            </Panel>
          ) : null}

          {panel === "chat" && selectedAgent ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <PanelHeader
                title="Chat with agent"
                description={`Live room chat with ${selectedAgent.name} in ${chatRoomId}. Built-in agents are provisioned when you create a project.`}
                onClose={() => setPanel("none")}
              />
              <AgentRoomChat
                roomId={chatRoomId}
                agentId={selectedAgent.id}
                agentName={selectedAgent.name}
                agentHandle={selectedAgent.handle}
                adminJwt={adminJwt}
              />
            </Panel>
          ) : null}

          {panel === "invoke" && selectedAgent ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <PanelHeader
                title="Test invoke"
                description={`Send a message as ${selectedAgent.name} into a room.`}
                onClose={() => setPanel("none")}
              />
              <p className="mb-4 text-xs text-muted-foreground">
                One-shot REST invoke. For live streaming, tools in-thread, and run feedback use{" "}
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => void openAgentChat()}
                >
                  Chat in room
                </button>
                .
              </p>
              <div className="mb-6 grid gap-2 sm:grid-cols-[minmax(160px,220px)_1fr_auto] sm:items-end">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Room</p>
                  <RoomPicker
                    token={sessionToken}
                    value={invokeRoomId}
                    onChange={setInvokeRoomId}
                    placeholder="Select room"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
                  <Input
                    value={invokeText}
                    onChange={(e) => setInvokeText(e.target.value)}
                    placeholder="Hello from the dashboard…"
                  />
                </div>
                <Button
                  className="bg-brand text-white hover:bg-[#e8614d] sm:mb-0"
                  onClick={() => void invokeAgent()}
                  disabled={invoking || !invokeRoomId.trim() || !invokeText.trim()}
                >
                  {invoking ? "Invoking…" : "Invoke"}
                </Button>
              </div>

              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-4 w-4" />
                Run history
              </h3>
              {loadingRuns ? (
                <SkeletonCard />
              ) : runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet for this agent.</p>
              ) : (
                <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
                  {runs.map((run) => (
                    <AgentRunHistoryRow
                      key={run.id}
                      run={run as unknown as Record<string, unknown>}
                    />
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {panel === "none" && selectedAgent ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-heading text-2xl font-semibold">{selectedAgent.name}</h2>
                  {selectedAgent.handle ? (
                    <p className="text-sm text-muted-foreground">@{selectedAgent.handle}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedAgent.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditForm(agentToForm(selectedAgent));
                      setPanel("edit");
                    }}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit profile
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => void openAgentChat()}
                    disabled={preparingChat}
                  >
                    <MessageSquare className="mr-1.5 h-4 w-4" />
                    {preparingChat ? "Opening…" : "Chat in room"}
                  </Button>
                  <Button variant="neutral" size="sm" onClick={() => setPanel("invoke")}>
                    <Play className="mr-1.5 h-4 w-4" />
                    Test invoke
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={deleting === selectedAgent.id}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {deleting === selectedAgent.id ? "…" : "Delete"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Model
                  </h3>
                  <StatRow
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
                        "—"
                      )
                    }
                  />
                  {selectedAgent.provider ? (
                    <StatRow
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
                              openLlmKeysForProvider(selectedAgent.provider || "", "none")
                            }
                          >
                            Configure keys
                          </Button>
                        </span>
                      }
                    />
                  ) : null}
                  <StatRow
                    label="Rate limit"
                    value={selectedAgent.rateLimitRpm ? `${selectedAgent.rateLimitRpm}/min` : "default"}
                  />
                  <StatRow
                    label="Capabilities"
                    value={(selectedAgent.capabilities || ["chat"]).join(", ")}
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Integrations
                  </h3>
                  <StatRow
                    label="Context fetch"
                    value={
                      selectedAgent.contextFetchUrl ? (
                        <span className="max-w-[200px] truncate font-mono text-xs">
                          {selectedAgent.contextFetchUrl}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <StatRow
                    label="Tool execute"
                    value={
                      selectedAgent.toolExecuteUrl ? (
                        <span className="max-w-[200px] truncate font-mono text-xs">
                          {selectedAgent.toolExecuteUrl}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <StatRow
                    label="Tools schema"
                    value={
                      selectedAgent.toolsSchema?.length
                        ? `${selectedAgent.toolsSchema.length} tool(s)`
                        : "—"
                    }
                  />
                </div>
              </div>

              {selectedAgent.systemPrompt ? (
                <div className="mt-6 rounded-xl border border-dashed border-border/80 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    System prompt
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {selectedAgent.systemPrompt}
                  </p>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {panel === "none" && !selectedAgent ? (
            <Panel className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <Bot className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <h2 className="font-heading text-lg font-medium">Select an agent</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Pick an agent from the list, or create one with <strong>New agent</strong>.
              </p>
            </Panel>
          ) : null}
        </main>
      </div>
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete this agent?"
        description="Removes the bot from this project. Past invokes may stay in logs for audit."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void deleteAgent()}
      />
    </ConsoleShell>
  );
}
