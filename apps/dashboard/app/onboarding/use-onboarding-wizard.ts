"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerkUser } from "@/lib/clerk-user";
import { useChat, useFluxyChatOptional, type UseChatHistoryReplay } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import {
  applyModelInput,
} from "@/lib/agent-catalog";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { loadQuickstartProgress, markQuickstartFirstMessage } from "@/lib/quickstart-progress";
import { assistantRoomId } from "@/lib/assistant-room";
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

  // Initialize empty so the placeholder ("Project name (e.g. Acme Support)")
  // shows and the "Use default name" helper button has a real effect on first
  // interaction. Previously this defaulted to "My first project", making the
  // button a no-op until the user manually cleared the field. (Audit UX fix.)
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
  const [agentProvider, setAgentProvider] = useState("openai");
  const [agentModel, setAgentModel] = useState("gpt-4o-mini");
  const [agent, setAgent] = useState<CreatedAgent | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("Summarize the last messages in 3 bullets");
  const [invokingAgent, setInvokingAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [skipHistoryOnConnect, setSkipHistoryOnConnect] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const { user: clerkUser, isSignedIn: clerkSignedIn } = useClerkUser();
  const fluxyClient = useFluxyChatOptional()?.client ?? null;
  const project = activeProject as CreatedProject | null;
  const activeRoomId = room?.id ?? "";
  const onboardingReplay: UseChatHistoryReplay = skipHistoryOnConnect ? "request" : "connect";

  const { messages, sendMessage: rawSendMessage, connectionStatus, historyLoaded, loadHistory } = useChat({
    roomId: activeRoomId,
    replay: onboardingReplay,
    markReadLatest: Boolean(activeRoomId),
  });

  // Track whether the *current user* has sent a message during this onboarding
  // session. This is deliberately separate from `messages.length` because
  // history replay and inbound messages from other members would otherwise
  // auto-complete onboarding and re-trigger the celebration banner on every
  // reconnect. Only an actual user-initiated send counts. (Audit fix.)
  const [userSentMessage, setUserSentMessage] = useState(false);
  const handleSendMessage = useCallback(
    (...args: Parameters<typeof rawSendMessage>) => {
      setUserSentMessage(true);
      const key = clerkUser?.id ?? `self-host-${userId.trim() || "owner"}`;
      markQuickstartFirstMessage(key);
      return rawSendMessage(...args);
    },
    [rawSendMessage, clerkUser?.id, userId],
  );

  // Celebrate + advance to step 4 ONLY when the user sends their first message.
  // Previously this reacted to any messages.length change, which fired on
  // history replay and on transient reconnects (length briefly drops to 0 then
  // back up), yanking users back from step 5 and re-showing the banner.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (!userSentMessage || celebratedRef.current) return;
    celebratedRef.current = true;
    setShowCelebration(true);
    setActiveStep(4);
  }, [userSentMessage]);

  useEffect(() => {
    setIsReviewMode(new URLSearchParams(window.location.search).get("review") === "1");
  }, []);

  useEffect(() => {
    if (!isClerkClientConfigured() || !clerkSignedIn || !clerkUser?.id) return;
    setUserId(fluxyUserIdFromClerk(clerkUser?.id));
    const progress = loadQuickstartProgress(clerkUser.id);
    if (progress.firstMessageSent && !userSentMessage) setUserSentMessage(true);
  }, [clerkSignedIn, clerkUser?.id]);

  useEffect(() => {
    if (room?.id || !lastRoom?.id) return;
    setRoom({
      id: lastRoom.id,
      type: lastRoom.type || "group",
      name: lastRoom.name || lastRoom.id,
      created_at: lastRoom.created_at || new Date().toISOString(),
    });
    setExistingRoomId(lastRoom.id);
  }, [lastRoom, room?.id]);

  useEffect(() => {
    if (activeStep !== 3 || roomMode !== "create" || roomName.trim()) return;
    setRoomName(project?.id ? assistantRoomId(project.id) : "assistant-general");
  }, [activeStep, roomMode, roomName]);

  // Auto-advance to first incomplete step on mount.
  useEffect(() => {
    const first = firstIncompleteOnboardingStep({ adminJwt, activeProject: project, memberJwt, room, messageCount: messages.length, userSentMessage });
    if (first > 0) setActiveStep(first);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-mint member JWT the first time we have a project + admin JWT.
  // Reset the latch whenever the project changes so a new project gets
  // its own member token; previously the ref was latched once and
  // never reset, so a second project in the same session would
  // never auto-mint. (Audit fix; root cause was in this hook.)
  const autoMintMemberKeyRef = useRef("");
  useEffect(() => {
    if (!isClerkClientConfigured() || !clerkSignedIn) return;
    if (!adminJwt.trim() || !project?.id || memberJwt.trim()) return;
    const key = `${clerkUser?.id ?? "self-host"}:${project.id}`;
    if (autoMintMemberKeyRef.current === key) return;
    autoMintMemberKeyRef.current = key;
    void mintMemberJwt();
  }, [clerkSignedIn, adminJwt, project?.id, memberJwt, clerkUser?.id]);

  const furthest = useMemo(
    () =>
      firstIncompleteOnboardingStep({
        adminJwt,
        activeProject: project,
        memberJwt,
        room,
        messageCount: messages.length,
        userSentMessage,
      }),
    [adminJwt, project, memberJwt, room, messages.length, userSentMessage],
  );

  const stepContext = useMemo(
    () => ({
      adminJwt,
      activeProject: project,
      memberJwt,
      room,
      messageCount: messages.length,
      userSentMessage,
    }),
    [adminJwt, project, memberJwt, room, messages.length, userSentMessage],
  );

  function goNext() {
    setActiveStep((s) => Math.min(ONBOARDING_STEPS.length - 1, s + 1));
  }

  function goBack() {
    setActiveStep((s) => Math.max(0, s - 1));
  }

  async function provisionHostedProject() {
    if (!isClerkClientConfigured() || !clerkSignedIn) {
      setError("Sign in with Clerk first (step 1), then use hosted provisioning.");
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
      setNotice("Your cloud project is already provisioned. Continue to mint a member JWT.");
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
      setActiveStep(2);
    } catch (err: unknown) {
      const message = messageFromUnknown(err, "Failed to create project");
      setError(
        message.includes("forbidden")
          ? `${message} (likely HOSTED_MULTI_TENANT=true with FLUXY_PLATFORM_PROJECT_ID not matching this project). On hosted multi-tenant mode, use "Provision via Clerk" instead of manual create — or set HOSTED_MULTI_TENANT=false in apps/worker/.dev.vars for local-only dev.`
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
      setNotice("Member JWT minted (server-side — API key not exposed to the browser).");
      setActiveStep(3);
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

  async function createRoom() {
    if (!memberJwt) {
      setError("Mint a member JWT first.");
      return;
    }
    if (!roomName.trim()) {
      setError("Enter a room id.");
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
          id: roomName.trim(),
          type: "group",
          name: roomName.trim(),
          members: [{ userId: userId.trim() || "alice", role: "member" }],
        }),
      });
      setRoom(json.room);
      setLastRoom(json.room);
      setNotice(
        json.room.id === (project?.id ? assistantRoomId(project.id) : "assistant-general")
          ? "Assistant room ready — you can chat with built-in agents from the Agents page."
          : "Room created.",
      );
      setActiveStep(4);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to create room"));
    } finally {
      setCreatingRoom(false);
    }
  }

  async function createAgent() {
    if (!adminJwt.trim()) {
      setError("Admin JWT required to create agent (/agents).");
      return;
    }
    setCreatingAgent(true);
    setError(null);
    setNotice(null);
    try {
      const applied = applyModelInput(
        agentProvider.trim() || "openai",
        agentModel.trim() || "gpt-4o-mini",
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
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to create agent"));
    } finally {
      setCreatingAgent(false);
    }
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
          ? `${msg} — monthly agent invoke limit reached (see Billing).`
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
    fluxyClient,
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
    messages,
    sendMessage: handleSendMessage,
    userSentMessage,
    connectionStatus,
    historyLoaded,
    loadHistory,
    setLastRoom,
    showCelebration,
    setShowCelebration,
    projectNameInputRef,
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

