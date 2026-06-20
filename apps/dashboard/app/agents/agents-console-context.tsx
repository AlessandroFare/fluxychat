"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { fetchLlmCatalog, type LlmCatalogResponse } from "@/lib/llm-catalog-client";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";
import {
  agentFormToPayload,
  agentFromApiResponse,
  agentToFormValues,
  emptyAgentForm,
  type AgentFormValues,
  type AgentRecord,
} from "@/lib/agent-form";
import { assistantRoomId } from "@/lib/assistant-room";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";

const WORKER_URL = getPublicWorkerUrl();

export interface AgentRun {
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

interface AgentsConsoleContextValue {
  adminJwt: string;
  memberJwt: string;
  sessionToken: string;
  memberUserId: string;
  activeProject: ReturnType<typeof useDashboardSession>["activeProject"];
  client: FluxyChatClient;
  agents: AgentRecord[];
  visibleAgents: AgentRecord[];
  loadingAgents: boolean;
  loadAgents: () => Promise<void>;
  llmCatalog: LlmCatalogResponse | null;
  loadLiveModels: boolean;
  setLoadLiveModels: (value: boolean) => void;
  reloadLlmCatalog: () => Promise<void>;
  error: string | null;
  notice: string | null;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  clearFeedback: () => void;
  selectedAgent: AgentRecord | null;
  navigateToAgent: (agentId: string) => void;
  openLlmKeys: (opts?: { providerId?: string; returnTo?: string }) => void;
  createForm: AgentFormValues;
  setCreateForm: React.Dispatch<React.SetStateAction<AgentFormValues>>;
  editForm: AgentFormValues;
  setEditForm: React.Dispatch<React.SetStateAction<AgentFormValues>>;
  creating: boolean;
  updatingAgent: boolean;
  createAgent: () => Promise<void>;
  saveAgentEdits: (agentId: string) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  deleting: string | null;
  runs: AgentRun[];
  loadingRuns: boolean;
  loadRuns: (agentId: string) => Promise<void>;
  invokeRoomId: string;
  setInvokeRoomId: (value: string) => void;
  invokeText: string;
  setInvokeText: (value: string) => void;
  invoking: boolean;
  invokeAgent: (agentId: string) => Promise<void>;
  chatRoomId: string;
  setChatRoomId: (value: string) => void;
  preparingChat: boolean;
  openAgentChat: (agentId: string) => Promise<string | null>;
}

const AgentsConsoleContext = createContext<AgentsConsoleContextValue | null>(null);

export function useAgentsConsole(): AgentsConsoleContextValue {
  const ctx = useContext(AgentsConsoleContext);
  if (!ctx) throw new Error("useAgentsConsole must be used within AgentsConsoleProvider");
  return ctx;
}

export function AgentsConsoleProvider({
  children,
  selectedId,
}: {
  children: ReactNode;
  selectedId?: string | null;
}) {
  const router = useRouter();
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const { user: clerkUser } = useClerkUser();
  const sessionToken = (adminJwt || memberJwt).trim();
  const memberUserId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : "dashboard";

  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [createForm, setCreateForm] = useState<AgentFormValues>(emptyAgentForm);
  const [editForm, setEditForm] = useState<AgentFormValues>(emptyAgentForm);
  const [llmCatalog, setLlmCatalog] = useState<LlmCatalogResponse | null>(null);
  const [loadLiveModels, setLoadLiveModels] = useState(false);
  const [invokeRoomId, setInvokeRoomId] = useState("");
  const [invokeText, setInvokeText] = useState("");
  const [chatRoomId, setChatRoomId] = useState("");
  const [preparingChat, setPreparingChat] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingAgent, setUpdatingAgent] = useState(false);
  const [invoking, setInvoking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
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

  const visibleAgents = useMemo(() => agents, [agents]);

  const selectedAgent = useMemo(
    () => visibleAgents.find((a) => a.id === selectedId) ?? null,
    [visibleAgents, selectedId],
  );

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const clearFeedback = useCallback(() => {
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
      setAgents(list as AgentRecord[]);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load agents"));
    } finally {
      setLoadingAgents(false);
    }
  }, [adminJwt, client]);

  const loadRuns = useCallback(
    async (agentId: string) => {
      if (!adminJwt.trim()) return;
      setLoadingRuns(true);
      setError(null);
      try {
        const data = await client.getAgentRuns(agentId, 50);
        setRuns(data as AgentRun[]);
      } catch (err: unknown) {
        setError(messageFromUnknown(err, "Failed to load runs"));
      } finally {
        setLoadingRuns(false);
      }
    },
    [adminJwt, client],
  );

  useEffect(() => {
    if (!adminJwt.trim()) return;
    void loadAgents();
  }, [adminJwt, loadAgents]);

  useEffect(() => {
    if (selectedAgent) setEditForm(agentToFormValues(selectedAgent));
  }, [selectedAgent]);

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

  const navigateToAgent = useCallback(
    (agentId: string) => {
      router.push(`/agents/${agentId}`);
      clearFeedback();
    },
    [router, clearFeedback],
  );

  const openLlmKeys = useCallback(
    (opts?: { providerId?: string; returnTo?: string }) => {
      const params = new URLSearchParams();
      if (opts?.providerId) params.set("provider", opts.providerId);
      if (opts?.returnTo) params.set("return", opts.returnTo);
      const qs = params.toString();
      router.push(qs ? `/agents/llm-keys?${qs}` : "/agents/llm-keys");
      clearFeedback();
    },
    [router, clearFeedback],
  );

  const createAgent = useCallback(async () => {
    if (!createForm.name.trim()) {
      setError("Agent name is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{
        agent?: Partial<AgentRecord> & Pick<AgentRecord, "id" | "name">;
      }>(`${WORKER_URL}/agents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminJwt.trim()}`,
        },
        body: JSON.stringify(agentFormToPayload(createForm)),
      });
      await loadAgents();
      if (json.agent) {
        const agent = agentFromApiResponse(
          json.agent,
          json.agent.projectId ?? activeProject?.id ?? "",
        );
        setNotice(`Created “${json.agent.name}”.`);
        router.push(`/agents/${agent.id}`);
      }
      setCreateForm(emptyAgentForm());
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to create agent"));
    } finally {
      setCreating(false);
    }
  }, [createForm, adminJwt, loadAgents, activeProject?.id, router]);

  const saveAgentEdits = useCallback(
    async (agentId: string) => {
      if (!editForm.name.trim()) return;
      setUpdatingAgent(true);
      setError(null);
      try {
        await client.updateAgent(agentId, agentFormToPayload(editForm));
        await loadAgents();
        setNotice("Agent updated.");
        router.push(`/agents/${agentId}`);
      } catch (err: unknown) {
        setError(messageFromUnknown(err, "Update failed"));
      } finally {
        setUpdatingAgent(false);
      }
    },
    [editForm, client, loadAgents, router],
  );

  const deleteAgent = useCallback(
    async (agentId: string) => {
      setDeleting(agentId);
      setError(null);
      try {
        await client.deleteAgent(agentId);
        await loadAgents();
        setNotice("Agent deleted.");
        router.push("/agents");
      } catch (err: unknown) {
        setError(messageFromUnknown(err, "Failed to delete agent"));
      } finally {
        setDeleting(null);
      }
    },
    [client, loadAgents, router],
  );

  const openAgentChat = useCallback(
    async (agentId: string) => {
      const jwt = memberJwt.trim();
      if (!jwt) {
        setError(
          "Member JWT required for live chat. Complete Quickstart, sign in on hosted cloud, or paste a member JWT in Projects.",
        );
        return null;
      }
      setPreparingChat(true);
      setError(null);
      try {
        const { room } = await ensureAssistantRoom({
          workerUrl: WORKER_URL,
          memberJwt: jwt,
          memberUserId,
          projectId: activeProject?.id ?? "",
        });
        setChatRoomId(room.id);
        setInvokeRoomId(room.id);
        setNotice(`Chat room “${room.id}” is ready.`);
        router.push(`/agents/${agentId}/chat?room=${encodeURIComponent(room.id)}`);
        return room.id;
      } catch (err: unknown) {
        setError(messageFromUnknown(err, "Could not open assistant room"));
        return null;
      } finally {
        setPreparingChat(false);
      }
    },
    [memberJwt, memberUserId, router],
  );

  const invokeAgent = useCallback(
    async (agentId: string) => {
      if (!invokeText.trim() || !invokeRoomId.trim()) {
        setError("Select a room and enter a message.");
        return;
      }
      setInvoking(true);
      setError(null);
      try {
        await client.invokeAgentRest(agentId, invokeRoomId, invokeText.trim());
        setInvokeText("");
        await loadRuns(agentId);
        setNotice("Invoke completed — check run history below.");
      } catch (err: unknown) {
        setError(messageFromUnknown(err, "Invoke failed"));
      } finally {
        setInvoking(false);
      }
    },
    [invokeText, invokeRoomId, client, loadRuns],
  );

  const value: AgentsConsoleContextValue = {
    adminJwt,
    memberJwt,
    sessionToken,
    memberUserId,
    activeProject,
    client,
    agents,
    visibleAgents,
    loadingAgents,
    loadAgents,
    llmCatalog,
    loadLiveModels,
    setLoadLiveModels,
    reloadLlmCatalog,
    error,
    notice,
    setError,
    setNotice,
    clearFeedback,
    selectedAgent,
    navigateToAgent,
    openLlmKeys,
    createForm,
    setCreateForm,
    editForm,
    setEditForm,
    creating,
    updatingAgent,
    createAgent,
    saveAgentEdits,
    deleteAgent,
    deleting,
    runs,
    loadingRuns,
    loadRuns,
    invokeRoomId,
    setInvokeRoomId,
    invokeText,
    setInvokeText,
    invoking,
    invokeAgent,
    chatRoomId,
    setChatRoomId,
    preparingChat,
    openAgentChat,
  };

  return <AgentsConsoleContext.Provider value={value}>{children}</AgentsConsoleContext.Provider>;
}
