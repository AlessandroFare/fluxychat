"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerkUser } from "@/lib/clerk-user";
import { createMemberFluxyClient } from "@/lib/fluxy-member-client";
import { useDashboardSession } from "../components/dashboard-session";
import {
  applyModelInput,
  DEFAULT_ONBOARDING_AGENT_MODEL,
  DEFAULT_ONBOARDING_AGENT_PROVIDER,
} from "@/lib/agent-catalog";
import { assistantRoomId, pickDefaultAssistantAgent } from "@/lib/assistant-room";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { loadQuickstartProgress, markQuickstartFirstMessage } from "@/lib/quickstart-progress";
import type { ParsedCliEnv } from "@/lib/parse-cli-env";
import { validateCliEnvImport } from "@/lib/parse-cli-env";
import {
  readFirstMessageSentForUser,
  resolveQuickstartUserKey,
} from "@/lib/onboarding-user-key";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import {
  firstIncompleteOnboardingStep,
  ONBOARDING_STEPS,
  type CreatedAgent,
  type CreatedProject,
  type CreatedRoom,
} from "./onboarding-shared";

const WORKER_URL = getPublicWorkerUrl();

export function useOnboardingWizard() {
  const router = useRouter();
  const [isReviewMode, setIsReviewMode] = useState(false);
  const {
    adminJwt,
    setAdminJwt,
    memberJwt,
    setMemberJwt,
    activeProject,
    setActiveProject,
    lastRoom,
    setLastRoom,
  } = useDashboardSession();

  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [provisioningCloud, setProvisioningCloud] = useState(false);
  const [userId, setUserId] = useState("alice");
  const [mintingJwt, setMintingJwt] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomMode, setRoomMode] = useState<"create" | "existing">("create");
  const [existingRoomId, setExistingRoomId] = useState("");
  const [room, setRoom] = useState<CreatedRoom | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [agentName, setAgentName] = useState("Assistant");
  const [agentProvider, setAgentProvider] = useState(DEFAULT_ONBOARDING_AGENT_PROVIDER);
  const [agentModel, setAgentModel] = useState(DEFAULT_ONBOARDING_AGENT_MODEL);
  const [agent, setAgent] = useState<CreatedAgent | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("Summarize the last messages in 3 bullets");
  const [invokingAgent, setInvokingAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [skipHistoryOnConnect, setSkipHistoryOnConnect] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [cliImportOpen, setCliImportOpen] = useState(false);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const { user: clerkUser, isSignedIn: clerkSignedIn } = useClerkUser();
  const project = activeProject as CreatedProject | null;
  const activeRoomId = room?.id ?? "";

  const chatClient = useMemo(
    () =>
      createMemberFluxyClient({
        memberJwt,
        memberUserId: userId,
        clerkUserId: clerkUser?.id ?? null,
        workerUrl: WORKER_URL,
      }),
    [memberJwt, userId, clerkUser?.id],
  );

  // Track whether the *current user* has sent a message during this onboarding session.
  const [userSentMessage, setUserSentMessage] = useState(false);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const celebratedRef = useRef(false);
  const initStepRef = useRef(false);

  const markMessageSent = useCallback(() => {
    setUserSentMessage(true);
    const key = resolveQuickstartUserKey(clerkUser?.id, userId);
    if (key) markQuickstartFirstMessage(key);
    if (!celebratedRef.current) {
      celebratedRef.current = true;
      setShowCelebration(true);
    }
  }, [clerkUser?.id, userId]);

  // Celebrate when user sends first message.
  useEffect(() => {
    if (!userSentMessage || celebratedRef.current) return;
    celebratedRef.current = true;
    setShowCelebration(true);
    // Stay on the chat step so the user can see the response
  }, [userSentMessage]);

  useEffect(() => {
    setIsReviewMode(new URLSearchParams(window.location.search).get("review") === "1");
    const params = new URLSearchParams(window.location.search);
    if (params.get("cli") === "1" || params.get("from") === "cli") {
      setCliImportOpen(true);
      setActiveStep(1);
    }
  }, []);

  useEffect(() => {
    if (isClerkClientConfigured() && !clerkSignedIn) {
      setProgressHydrated(true);
      return;
    }
    if (isClerkClientConfigured() && clerkSignedIn && !clerkUser?.id) return;

    const sent = readFirstMessageSentForUser(clerkUser?.id, userId);
    if (sent) {
      setUserSentMessage(true);
      celebratedRef.current = true;
    }
    setProgressHydrated(true);
  }, [clerkSignedIn, clerkUser?.id, userId]);

  useEffect(() => {
    if (room?.id || !lastRoom?.id) return;
    if (project?.id && lastRoom.id.startsWith("assistant-") && lastRoom.id !== assistantRoomId(project.id)) {
      setLastRoom(null);
      return;
    }
    setRoom({
      id: lastRoom.id,
      type: lastRoom.type || "group",
      name: lastRoom.name || lastRoom.id,
      created_at: lastRoom.created_at || new Date().toISOString(),
    });
    setExistingRoomId(lastRoom.id);
  }, [lastRoom, room?.id, project?.id, setLastRoom]);

  useEffect(() => {
    if (!isClerkClientConfigured() || !clerkSignedIn || !clerkUser?.id) return;
    setUserId(fluxyUserIdFromClerk(clerkUser.id));
  }, [clerkSignedIn, clerkUser?.id]);

  // Auto-advance to first incomplete step once progress is hydrated from storage.
  useEffect(() => {
    if (!progressHydrated || initStepRef.current) return;
    initStepRef.current = true;
    const fromCli =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("from") === "cli" ||
        new URLSearchParams(window.location.search).get("cli") === "1");
    if (fromCli) return;
    const sent = userSentMessage || readFirstMessageSentForUser(clerkUser?.id, userId);
    const first = firstIncompleteOnboardingStep({
      adminJwt,
      activeProject: project,
      memberJwt,
      room,
      messageCount: sent ? 1 : 0,
      userSentMessage: sent,
    });
    if (first > 1) setActiveStep(first);
  }, [
    progressHydrated,
    userSentMessage,
    adminJwt,
    project,
    memberJwt,
    room,
    clerkUser?.id,
    userId,
  ]);

  // Auto-mint member JWT the first time we have a project + admin JWT.
  const autoMintMemberKeyRef = useRef("");
  useEffect(() => {
    if (!isClerkClientConfigured() || !clerkSignedIn) return;
    if (!adminJwt.trim() || !project?.id || memberJwt.trim()) return;
    const key = `${clerkUser?.id ?? "self-host"}:${project.id}`;
    if (autoMintMemberKeyRef.current === key) return;
    autoMintMemberKeyRef.current = key;
    void mintMemberJwt();
  }, [clerkSignedIn, adminJwt, project?.id, memberJwt, clerkUser?.id]);

  // Auto-open assistant room when project + member JWT are ready
  const autoRoomKeyRef = useRef("");
  useEffect(() => {
    if (!memberJwt.trim() || room?.id || !project?.id) return;
    const key = `${memberJwt.slice(0, 20)}:${project.id}`;
    if (autoRoomKeyRef.current === key) return;
    autoRoomKeyRef.current = key;
    setRoomName(assistantRoomId(project.id));
    void ensureOnboardingAssistantRoom(project.id);
  }, [memberJwt, room?.id, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-create or reuse @assistant agent for First Chat
  const autoAgentKeyRef = useRef("");
  useEffect(() => {
    if (!adminJwt.trim() || agent?.id || creatingAgent) return;
    const key = `${adminJwt.slice(0, 20)}:${project?.id ?? ""}`;
    if (autoAgentKeyRef.current === key) return;

    void (async () => {
      autoAgentKeyRef.current = key;
      const ok = await ensureAssistantAgent();
      if (!ok) autoAgentKeyRef.current = "";
    })();
  }, [adminJwt, agent?.id, creatingAgent, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const furthest = useMemo(
    () =>
      firstIncompleteOnboardingStep({
        adminJwt,
        activeProject: project,
        memberJwt,
        room,
        messageCount: userSentMessage ? 1 : 0,
        userSentMessage,
      }),
    [adminJwt, project, memberJwt, room, userSentMessage],
  );

  const stepContext = useMemo(
    () => ({
      adminJwt,
      activeProject: project,
      memberJwt,
      room,
      messageCount: userSentMessage ? 1 : 0,
      userSentMessage,
    }),
    [adminJwt, project, memberJwt, room, userSentMessage],
  );

  function goNext() {
    setActiveStep((s) => Math.min(ONBOARDING_STEPS.length - 1, s + 1));
  }

  function goBack() {
    setActiveStep((s) => Math.max(0, s - 1));
  }

  async function provisionHostedProject() {
    if (!isClerkClientConfigured() || !clerkSignedIn) {
      setError("Sign in with Clerk first, then use hosted provisioning.");
      return;
    }
    if (project?.id) {
      setNotice("Project already provisioned. Continue to the next step.");
      setError(null);
      return;
    }
    setProvisioningCloud(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/fluxy/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createProject: true,
          projectName: projectName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        adminJwt?: string;
        memberJwt?: string;
        activeProject?: CreatedProject;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Hosted provisioning failed");
      if (json.adminJwt) setAdminJwt(json.adminJwt);
      if (json.memberJwt) setMemberJwt(json.memberJwt);
      if (json.activeProject) setActiveProject(json.activeProject);
      setNotice("Tenant project provisioned via hosted connect.");
    } catch (err: unknown) {
      setError(
        `${messageFromUnknown(err, "Hosted provisioning failed")}. For local dev: use the same FLUXY_CONSOLE_API_KEY in apps/dashboard/.env.local and apps/worker/.dev.vars (the full fc_… key from POST /dev/provision, not the key_prefix). FLUXY_PLATFORM_PROJECT_ID is the project id (dev-local), not the API key.`,
      );
    } finally {
      setProvisioningCloud(false);
    }
  }

  async function createProject() {
    if (project?.id) {
      setNotice("Your cloud project is already provisioned. Continue to the next step.");
      setError(null);
      return;
    }
    if (!adminJwt.trim()) {
      setError("Admin JWT required to create project (/admin/projects).");
      return;
    }
    if (!projectName.trim()) return;
    setCreatingProject(true);
    setError(null);
    setNotice(null);
    try {
      const json = await fetchWorkerJson<{ project: CreatedProject }>(`${WORKER_URL}/admin/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminJwt.trim()}`,
        },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      setActiveProject(json.project);
      setNotice("Project created.");
    } catch (err: unknown) {
      const message = messageFromUnknown(err, "Failed to create project");
      setError(
        message.includes("forbidden")
          ? `${message} (likely HOSTED_MULTI_TENANT=true with FLUXY_PLATFORM_PROJECT_ID not matching this project). On hosted multi-tenant mode, use "Provision via Clerk" instead of manual create, or set HOSTED_MULTI_TENANT=false in apps/worker/.dev.vars for local-only dev.`
          : message,
      );
    } finally {
      setCreatingProject(false);
    }
  }

  async function mintMemberJwt() {
    if (!project?.id && !adminJwt.trim()) {
      setError("Connect your account and provision a project first.");
      return;
    }
    setMintingJwt(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/fluxy/mint-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminJwt.trim() ? { Authorization: `Bearer ${adminJwt.trim()}` } : {}),
        },
        body: JSON.stringify({
          memberUserId: userId.trim() || "alice",
          ttlSeconds: 3600,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { memberJwt?: string } }
        | { ok: false; error?: string };
      if (!res.ok || !json.ok) throw new Error((!json.ok && json.error) || "Failed to mint JWT");
      setMemberJwt(json.data.memberJwt || "");
      setNotice("Member JWT minted server-side (API key not exposed to the browser).");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to mint JWT"));
    } finally {
      setMintingJwt(false);
    }
  }

  function selectExistingRoom(roomId: string) {
    const id = roomId.trim();
    setExistingRoomId(id);
    if (!id) {
      setRoom(null);
      setLastRoom(null);
      return;
    }
    const picked = {
      id,
      type: "group",
      name: id,
      created_at: new Date().toISOString(),
    };
    setRoom(picked);
    setLastRoom(picked);
    setNotice("Using existing room.");
    setError(null);
  }

  async function ensureOnboardingAssistantRoom(projectId: string) {
    if (!memberJwt.trim()) {
      setError("Mint a member JWT first.");
      return;
    }
    setCreatingRoom(true);
    setError(null);
    setNotice(null);
    try {
      const { room: ensured, created } = await ensureAssistantRoom({
        workerUrl: WORKER_URL,
        memberJwt: memberJwt.trim(),
        memberUserId: userId.trim() || (clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : "dashboard"),
        projectId,
        adminJwt: adminJwt.trim() || undefined,
      });
      setRoom(ensured);
      setLastRoom(ensured);
      setNotice(
        created
          ? "Assistant room ready. You can chat with @assistant below."
          : "Assistant room opened.",
      );
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to open assistant room"));
    } finally {
      setCreatingRoom(false);
    }
  }

  async function createRoom(overrideName?: string) {
    if (!memberJwt) {
      setError("Mint a member JWT first.");
      return;
    }
    const name = (overrideName ?? roomName).trim();
    if (!name) {
      setError("Enter a room id.");
      return;
    }
    const targetProjectId = project?.id ?? "";
    if (targetProjectId && name === assistantRoomId(targetProjectId)) {
      await ensureOnboardingAssistantRoom(targetProjectId);
      return;
    }
    setCreatingRoom(true);
    setError(null);
    setNotice(null);
    try {
      const json = await fetchWorkerJson<{ room: CreatedRoom }>(`${WORKER_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberJwt}`,
        },
        body: JSON.stringify({
          id: name,
          type: "group",
          name: name,
          members: [{ userId: userId.trim() || "alice", role: "member" }],
        }),
      });
      setRoom(json.room);
      setLastRoom(json.room);
      setNotice("Room created.");
    } catch (err: unknown) {
      const msg = messageFromUnknown(err, "Failed to create room");
      if (
        targetProjectId &&
        name.startsWith("assistant-") &&
        (msg.includes("already") || msg.includes("exists") || msg.includes("409") || msg.includes("conflict"))
      ) {
        await ensureOnboardingAssistantRoom(targetProjectId);
        return;
      }
      setError(msg);
    } finally {
      setCreatingRoom(false);
    }
  }

  async function ensureAssistantAgent(): Promise<boolean> {
    if (!adminJwt.trim()) return false;
    setCreatingAgent(true);
    setError(null);
    try {
      const listJson = await fetchWorkerJson<{ agents?: Array<{ id: string; name: string; handle?: string | null }> }>(
        `${WORKER_URL}/agents`,
        { headers: { Authorization: `Bearer ${adminJwt.trim()}` } },
      );
      const existing = pickDefaultAssistantAgent(listJson.agents ?? []);
      if (existing) {
        setAgent({ id: existing.id, name: existing.name });
        return true;
      }
      return await createAgent();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to prepare assistant agent"));
      return false;
    } finally {
      setCreatingAgent(false);
    }
  }

  async function createAgent(): Promise<boolean> {
    if (!adminJwt.trim()) {
      setError("Admin JWT required to create agent (/agents).");
      return false;
    }
    setCreatingAgent(true);
    setError(null);
    setNotice(null);
    try {
      const applied = applyModelInput(
        agentProvider.trim() || DEFAULT_ONBOARDING_AGENT_PROVIDER,
        agentModel.trim() || DEFAULT_ONBOARDING_AGENT_MODEL,
      );
      const json = await fetchWorkerJson<{ agent: { id: string; name: string } }>(
        `${WORKER_URL}/agents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminJwt.trim()}`,
          },
          body: JSON.stringify({
            name: agentName.trim() || "Assistant",
            handle: "assistant",
            provider: applied.provider,
            model: applied.model,
            capabilities: ["chat"],
          }),
        },
      );
      setAgent({ id: json.agent.id, name: json.agent.name });
      setNotice("Agent created.");
      return true;
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to create agent"));
      return false;
    } finally {
      setCreatingAgent(false);
    }
  }

  function importCliEnv(parsed: ParsedCliEnv): boolean {
    setError(null);
    setNotice(null);
    const validationError = validateCliEnvImport(parsed);
    if (validationError) {
      setError(validationError);
      return false;
    }
    const normalize = (url: string) => url.replace(/\/$/, "");
    if (
      parsed.workerUrl?.trim() &&
      normalize(parsed.workerUrl) !== normalize(WORKER_URL)
    ) {
      setError(
        `Worker URL in .env (${parsed.workerUrl}) does not match this dashboard (${WORKER_URL}). ` +
          "Set NEXT_PUBLIC_FLUXYCHAT_WORKER_URL to the same worker and reload.",
      );
      return false;
    }

    setMemberJwt(parsed.memberJwt!.trim());
    setActiveProject({
      id: parsed.projectId!.trim(),
      name:
        parsed.projectId === "hosted-demo"
          ? "Hosted demo"
          : parsed.projectId!.trim(),
      created_at: new Date().toISOString(),
    });
    const importedRoom: CreatedRoom = {
      id: parsed.roomId!.trim(),
      type: "public",
      name: parsed.roomId!.trim(),
      created_at: new Date().toISOString(),
    };
    setRoom(importedRoom);
    setLastRoom(importedRoom);
    if (parsed.agentId?.trim()) {
      setAgent({
        id: parsed.agentId.trim(),
        name: parsed.agentHandle?.replace(/^@/, "") ?? "Assistant",
      });
    }
    if (parsed.userId?.trim()) setUserId(parsed.userId.trim());
    setActiveStep(2);
    setNotice("Imported CLI .env — you're on First Chat.");
    return true;
  }

  async function invokeAgent() {
    if (!agent?.id) {
      setError("Create/select an agent first.");
      return;
    }
    if (!adminJwt.trim()) {
      setError("Admin JWT required to invoke agent.");
      return;
    }
    setInvokingAgent(true);
    setError(null);
    setNotice(null);
    try {
      await fetchWorkerJson<Record<string, unknown>>(
        `${WORKER_URL}/agents/${agent.id}/invoke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminJwt.trim()}`,
          },
          body: JSON.stringify({
            roomId: activeRoomId,
            content: agentPrompt.trim(),
          }),
        },
      );
      setNotice("Agent invoke queued.");
    } catch (err: unknown) {
      const msg = messageFromUnknown(err, "Failed to invoke agent");
      setError(
        msg.includes("quota_exceeded") || msg.includes("quota")
          ? `${msg}. Monthly agent invoke limit reached (see Billing).`
          : msg,
      );
    } finally {
      setInvokingAgent(false);
    }
  }

  return {
    router,
    workerUrl: WORKER_URL,
    isReviewMode,
    clerkUser,
    clerkSignedIn,
    fluxyClient: chatClient,
    project,
    adminJwt,
    setAdminJwt,
    memberJwt,
    userId,
    setUserId,
    projectName,
    setProjectName,
    creatingProject,
    provisioningCloud,
    mintingJwt,
    roomName,
    setRoomName,
    roomMode,
    setRoomMode,
    existingRoomId,
    room,
    creatingRoom,
    agentName,
    setAgentName,
    agentProvider,
    setAgentProvider,
    agentModel,
    setAgentModel,
    agent,
    creatingAgent,
    agentPrompt,
    setAgentPrompt,
    invokingAgent,
    error,
    notice,
    activeStep,
    setActiveStep,
    furthest,
    stepContext,
    activeRoomId,
    skipHistoryOnConnect,
    setSkipHistoryOnConnect,
    markMessageSent,
    userSentMessage,
    setLastRoom,
    showCelebration,
    setShowCelebration,
    projectNameInputRef,
    cliImportOpen,
    setCliImportOpen,
    importCliEnv,
    activeProject: project,
    goNext,
    goBack,
    provisionHostedProject,
    createProject,
    mintMemberJwt,
    selectExistingRoom,
    createRoom,
    createAgent,
    invokeAgent,
  };
}

export type OnboardingWizard = ReturnType<typeof useOnboardingWizard>;
