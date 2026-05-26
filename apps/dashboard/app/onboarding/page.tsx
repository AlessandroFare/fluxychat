"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerkUser } from "@/lib/clerk-user";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useChat } from "@fluxy-chat/sdk";
import { Button as ShadcnButton } from "~/components/ui/button";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { OnboardingAuthStep } from "../components/onboarding-auth-step";
import { ConsolePageHeader } from "../components/console-page-header";
import { RoomPicker } from "../components/room-picker";
import { Banner, Button, Input, Section, Textarea } from "../components/ui";
import { cn } from "@/lib/utils";

import {
  AGENT_PROVIDER_OPTIONS,
  applyModelInput,
  expandModelShortcut,
  modelSuggestionsForProvider,
} from "@/lib/agent-catalog";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import {
  markQuickstartComplete,
  markQuickstartFirstMessage,
} from "@/lib/quickstart-progress";
import { ASSISTANT_ROOM_ID } from "@/lib/assistant-room";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { AgentRoomChat } from "../components/agent-room-chat";
import type { UseChatHistoryReplay } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const WORKER_URL = getPublicWorkerUrl();

interface CreatedProject {
  id: string;
  name: string;
  created_at: string;
  apiKey: string;
}

interface CreatedRoom {
  id: string;
  type: string;
  name: string;
  created_at: string;
}

interface CreatedAgent {
  id: string;
  name: string;
}

const STEPS = [
  {
    title: "Connect account",
    short: "Sign in on hosted cloud, or paste an admin JWT if you self-host.",
  },
  {
    title: "Create project",
    short: "Gets API keys and quotas on your Worker. On hosted cloud this often already exists after sign-in.",
  },
  {
    title: "Mint member JWT",
    short: "Browser token for rooms. Minted server-side so the API key never hits the client.",
  },
  {
    title: "Create room",
    short: "A channel your SDK can join with that member JWT.",
  },
  {
    title: "First message",
    short: "Send one message over WebSocket to confirm delivery works.",
  },
  {
    title: "Try an agent (optional)",
    short: "Register a bot and invoke it once. Custom streaming bots: docs/cookbook/bot-streaming-fluxy-message-stream.md",
  },
] as const;

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function isOnboardingStepComplete(
  step: number,
  args: {
    adminJwt: string;
    activeProject: CreatedProject | null;
    memberJwt: string;
    room: CreatedRoom | null;
    messageCount: number;
  },
): boolean {
  const { adminJwt, activeProject, memberJwt, room, messageCount } = args;
  const hasMember = Boolean(memberJwt.trim());
  if (step === 0) return adminJwt.trim().length >= 12;
  if (step === 1) return Boolean(activeProject?.id);
  if (step === 2) return hasMember;
  if (step >= 3 && !hasMember) return false;
  if (step === 3) return Boolean(room?.id);
  if (step === 4) return messageCount >= 1;
  return true;
}

function firstIncompleteStep(args: {
  adminJwt: string;
  activeProject: CreatedProject | null;
  memberJwt: string;
  room: CreatedRoom | null;
  messageCount: number;
}): number {
  for (let i = 0; i < STEPS.length; i += 1) {
    if (!isOnboardingStepComplete(i, args)) return i;
  }
  return STEPS.length - 1;
}

async function finishQuickstartAndOpenConsole(
  router: ReturnType<typeof useRouter>,
  args: {
    clerkUserId: string;
    memberJwt: string;
    memberUserId: string;
    setLastRoom: (room: CreatedRoom) => void;
  },
) {
  markQuickstartComplete(args.clerkUserId);
  if (args.memberJwt.trim() && args.memberUserId.trim()) {
    try {
      const { room } = await ensureAssistantRoom({
        workerUrl: WORKER_URL,
        memberJwt: args.memberJwt.trim(),
        memberUserId: args.memberUserId.trim(),
      });
      args.setLastRoom({
        id: room.id,
        type: room.type,
        name: room.name,
        created_at: room.created_at,
      });
    } catch {
      // Non-blocking: user may already have a room from step 3.
    }
  }
  router.push("/");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isReviewMode, setIsReviewMode] = useState(false);

  useEffect(() => {
    setIsReviewMode(new URLSearchParams(window.location.search).get("review") === "1");
  }, []);
  const {
    hasHydrated,
    adminJwt,
    setAdminJwt,
    memberJwt,
    setMemberJwt,
    activeProject,
    setActiveProject,
    lastRoom,
    setLastRoom,
  } = useDashboardSession();

  const [projectName, setProjectName] = useState("My first project");
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
  const [agentProvider, setAgentProvider] = useState("zencode");
  const [agentModel, setAgentModel] = useState("minimax-free");
  const [agent, setAgent] = useState<CreatedAgent | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);

  const [agentPrompt, setAgentPrompt] = useState("Summarize the last messages in 3 bullets");
  const [invokingAgent, setInvokingAgent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [stepInitialized, setStepInitialized] = useState(false);
  const { user: clerkUser, isSignedIn: clerkSignedIn } = useClerkUser();

  useEffect(() => {
    if (!isClerkClientConfigured() || !clerkSignedIn || !clerkUser?.id) return;
    setUserId(fluxyUserIdFromClerk(clerkUser.id));
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
    setRoomName(ASSISTANT_ROOM_ID);
  }, [activeStep, roomMode, roomName]);

  const project = activeProject as CreatedProject | null;
  const activeRoomId = room?.id ?? "";

  const [skipHistoryOnConnect, setSkipHistoryOnConnect] = useState(false);
  const onboardingReplay: UseChatHistoryReplay = skipHistoryOnConnect ? "request" : "connect";

  const { messages, sendMessage, connectionStatus, historyLoaded, loadHistory } = useChat({
    roomId: activeRoomId,
    replay: onboardingReplay,
  });

  const furthest = useMemo(
    () =>
      firstIncompleteStep({
        adminJwt,
        activeProject: project,
        memberJwt,
        room,
        messageCount: messages.length,
      }),
    [adminJwt, project, memberJwt, room, messages.length],
  );

  const stepContext = useMemo(
    () => ({
      adminJwt,
      activeProject: project,
      memberJwt,
      room,
      messageCount: messages.length,
    }),
    [adminJwt, project, memberJwt, room, messages.length],
  );

  useEffect(() => {
    if (messages.length < 1 || !clerkUser?.id) return;
    markQuickstartFirstMessage(clerkUser.id);
  }, [messages.length, clerkUser?.id]);

  const autoMintMemberRef = React.useRef(false);
  useEffect(() => {
    if (!isClerkClientConfigured() || !clerkSignedIn) return;
    if (!adminJwt.trim() || !project?.id || memberJwt.trim() || autoMintMemberRef.current) return;
    autoMintMemberRef.current = true;
    void mintMemberJwt();
  }, [clerkSignedIn, adminJwt, project?.id, memberJwt]);

  function goNext() {
    setActiveStep((s) => Math.min(STEPS.length - 1, s + 1));
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
      if (!res.ok) {
        throw new Error(json.error || "Hosted provisioning failed");
      }
      if (json.adminJwt) setAdminJwt(json.adminJwt);
      if (json.memberJwt) setMemberJwt(json.memberJwt);
      if (json.activeProject) setActiveProject(json.activeProject);
      setNotice("Tenant project provisioned via hosted connect.");
    } catch (err: unknown) {
      const message = messageFromUnknown(err, "Hosted provisioning failed");
      setError(
        `${message}. Ensure FLUXY_CONSOLE_API_KEY and FLUXY_PLATFORM_PROJECT_ID in apps/dashboard/.env.local match the same pnpm provision:bootstrap run as apps/worker/.dev.vars.`,
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
      if (message.includes("forbidden")) {
        setError(
          `${message}. On hosted multi-tenant mode, use "Provision via Clerk" (platform bootstrap key) instead of manual create — or set HOSTED_MULTI_TENANT=false in apps/worker/.dev.vars for local-only dev.`,
        );
      } else {
        setError(message);
      }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberUserId: userId.trim() || "alice",
          ttlSeconds: 3600,
          ...(project?.apiKey ? { projectApiKey: project.apiKey } : {}),
        }),
      });
      const json = (await res.json()) as { memberJwt?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to mint JWT");
      setMemberJwt(json.memberJwt || "");
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
        json.room.id === ASSISTANT_ROOM_ID
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
            ...(() => {
              const applied = applyModelInput(
                agentProvider.trim() || "zencode",
                agentModel.trim() || "minimax-free",
              );
              return { provider: applied.provider, model: applied.model };
            })(),
            capabilities: ["chat"],
          }),
        }
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
      const json = await fetchWorkerJson<Record<string, unknown>>(
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
        }
      );
      setNotice("Agent invoke queued.");
      return json;
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

  return (
    <ConsoleShell data-testid="onboarding-page">
      <ConsolePageHeader
        title="Quickstart wizard"
        description={
          <>
            Connect, project, member JWT, room, message. Worker URL:{" "}
            <code className="rounded border border-border bg-muted/50 px-1 font-mono text-xs">{WORKER_URL}</code>
            {" "}
            (yours when self-hosting).
          </>
        }
      />
      <p className="mb-6 text-xs text-muted-foreground">
        Active project:{" "}
        <code className="rounded border border-border bg-muted/50 px-1 py-0.5">{project?.name || "none yet"}</code> ·
        <Link href="/" className="ml-2 font-medium text-foreground underline-offset-4 hover:underline">
          Console home
        </Link>
      </p>

      {error ? <Banner variant="error">Error: {error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}

      <div className="mb-6 space-y-3">
        {isReviewMode ? (
          <Banner variant="info">
            Review mode: you are already set up. Repeat any step, or go back to the{" "}
            <Link href="/" className="font-medium underline underline-offset-2">
              overview
            </Link>
            .
          </Banner>
        ) : null}
        <Banner variant="success">
          Complete each step in order. A green check means that step is done. The agent step is optional. After your first
          message you can open the console, or try an agent (monthly quota applies).
        </Banner>
      </div>

      {/* Step rail */}
      <nav aria-label="Onboarding steps" className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const locked = i > furthest;
          const active = i === activeStep;
          const done = isOnboardingStepComplete(i, stepContext);
          return (
            <button
              key={s.title}
              type="button"
              disabled={locked}
              onClick={() => !locked && setActiveStep(i)}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors",
                locked && "cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground opacity-60",
                !locked && !active && "border-border bg-white/90 text-slate-700 hover:border-black/10",
                active && "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden /> : null}
              <span className="truncate">
                {i + 1}. {s.title}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Active step only */}
      <div className="mb-6 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Step {activeStep + 1} of {STEPS.length}: {STEPS[activeStep].title}
        </p>
        <p className="mt-1">{STEPS[activeStep].short}</p>
      </div>

      {activeStep === 0 ? (
        <Section title="Connect" description="Sign in on hosted cloud, or paste an admin JWT for self-host.">
          <OnboardingAuthStep
            adminJwt={adminJwt}
            onAdminJwtChange={setAdminJwt}
            onContinue={goNext}
          />
        </Section>
      ) : null}

      {activeStep === 1 ? (
        <Section
          title="Create project"
          description={
            project?.id
              ? "Your project was created at sign-in. You cannot add another tenant from here on hosted cloud."
              : "Self-host: creates a tenant with your admin JWT. Copy the API key now; your backend uses it to mint member JWTs."
          }
        >
          {project?.id ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Active project: <strong>{project.name}</strong> (
              <code className="text-xs">{project.id}</code>). Continue to mint a member JWT for the SDK.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {isClerkClientConfigured() && clerkSignedIn ? (
                <div className="rounded-lg border border-brand/25 bg-brand/5 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Hosted cloud (recommended)</p>
                  <p className="mt-1">
                    Creates your tenant project with the bootstrap API key on the Worker — no manual JWT
                    paste required.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    className="mt-3"
                    data-testid="provision-hosted-btn"
                    onClick={() => void provisionHostedProject()}
                    disabled={provisioningCloud}
                  >
                    {provisioningCloud ? "Provisioning…" : "Provision via Clerk"}
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  data-testid="project-name-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="sm:flex-1"
                />
                <Button
                  variant="outline"
                  data-testid="create-project-btn"
                  onClick={() => void createProject()}
                  disabled={creatingProject || provisioningCloud}
                >
                  {creatingProject ? "Creating…" : "Create project (admin JWT)"}
                </Button>
              </div>
            </div>
          )}
          {project?.apiKey ? (
            <div className="mt-3">
              <div className="mb-1 text-xs text-muted-foreground">API key</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <pre className="max-h-32 flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-border bg-[#0d1117] p-3 font-mono text-xs text-[#e6edf3]">
                  {project.apiKey}
                </pre>
                <Button type="button" onClick={() => void copyToClipboard(project.apiKey!)} size="sm">
                  Copy
                </Button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button type="button" variant="primary" data-testid="project-continue" disabled={!project?.id} onClick={goNext}>
              Continue <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </Section>
      ) : null}

      {activeStep === 2 ? (
        <Section
          title="Mint member JWT"
          description="On hosted cloud this is usually minted at sign-in. Pick a user id for SDK calls; minting runs on the dashboard server."
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="userId (e.g. alice)" />
            <Button
              variant="primary"
              data-testid="mint-jwt-btn"
              onClick={() => void mintMemberJwt()}
              disabled={mintingJwt || adminJwt.trim().length < 12}
            >
              {mintingJwt ? "Minting…" : "Mint JWT"}
            </Button>
          </div>
          {memberJwt ? (
            <div className="mt-3">
              <div className="mb-1 text-xs text-muted-foreground">Member JWT</div>
              <pre className="max-h-32 overflow-x-auto overflow-y-auto rounded-lg border border-border bg-[#0d1117] p-3 font-mono text-xs text-[#e6edf3]">
                {memberJwt}
              </pre>
              <Button type="button" onClick={() => void copyToClipboard(memberJwt)} size="sm" className="mt-2">
                Copy
              </Button>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button type="button" variant="primary" data-testid="mint-continue" disabled={!memberJwt.trim()} onClick={goNext}>
              Continue <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </Section>
      ) : null}

      {activeStep === 3 ? (
        <Section
          title="Room"
          description="Create a new channel or pick one you already created in Rooms. We suggest the assistant room for testing AI agents later."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                roomMode === "create"
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground",
              )}
              onClick={() => setRoomMode("create")}
            >
              Create new
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                roomMode === "existing"
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground",
              )}
              onClick={() => setRoomMode("existing")}
            >
              Use existing
            </button>
          </div>
          {roomMode === "existing" ? (
            <RoomPicker
              token={memberJwt}
              value={existingRoomId}
              onChange={selectExistingRoom}
              placeholder="Select a room"
            />
          ) : (
          <div className="flex flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                data-testid="room-id-input"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={`room id (e.g. ${ASSISTANT_ROOM_ID})`}
              />
              <Button
                variant="primary"
                data-testid="create-room-btn"
                onClick={() => void createRoom()}
                disabled={creatingRoom || !memberJwt}
              >
                {creatingRoom ? "Creating…" : "Create room"}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit text-xs"
              onClick={() => setRoomName(ASSISTANT_ROOM_ID)}
            >
              Use suggested assistant room ({ASSISTANT_ROOM_ID})
            </Button>
          </div>
          )}
          {room ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Active room: <code>{room.id}</code>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button type="button" variant="primary" data-testid="room-continue" disabled={!room} onClick={goNext}>
              Continue <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </Section>
      ) : null}

      {activeStep === 4 ? (
        <Section title="First message" description={`Connection: ${connectionStatus}. Send from the input or use the quick-send button.`}>
          <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border-border"
              checked={skipHistoryOnConnect}
              onChange={(e) => setSkipHistoryOnConnect(e.target.checked)}
            />
            Skip history on connect (heavy rooms)
            {skipHistoryOnConnect && !historyLoaded ? (
              <button
                type="button"
                className="text-brand hover:underline"
                onClick={() => void loadHistory()}
              >
                Load history
              </button>
            ) : null}
          </label>
          <div className="h-[220px] overflow-auto rounded-xl border border-border bg-muted/30 p-3" data-testid="message-list">
            {messages.length ? (
              messages.map((m) => (
                <div key={m.id} className="py-1 text-sm">
                  <b>{m.userId}</b>: {m.content}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
          </div>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Type and press Enter"
              className="sm:flex-1"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const value = (e.target as HTMLInputElement).value.trim();
                if (!value) return;
                sendMessage(value);
                (e.target as HTMLInputElement).value = "";
              }}
            />
            <Button
              variant="primary"
              data-testid="send-sample-btn"
              onClick={() => sendMessage(`Hello from ${userId} @ ${new Date().toISOString()}`)}
              disabled={!memberJwt}
            >
              Send sample
            </Button>
          </div>
          {!memberJwt ? <p className="mt-2 text-xs text-muted-foreground">Mint a member JWT in the previous step.</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button type="button" variant="primary" disabled={messages.length < 1} onClick={goNext}>
              Continue <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={messages.length < 1}
              onClick={() => {
                if (!clerkUser?.id) return;
                void finishQuickstartAndOpenConsole(router, {
                  clerkUserId: clerkUser.id,
                  memberJwt,
                  memberUserId: userId.trim() || "alice",
                  setLastRoom,
                });
              }}
            >
              Open console
            </Button>
          </div>
        </Section>
      ) : null}

      {activeStep === 5 ? (
        <Section
          title="Try an agent (optional)"
          description="Create a bot with your admin JWT, then post one invoke into the room above. For a Node bot that streams via FluxyMessageStream, see docs/cookbook/bot-streaming-fluxy-message-stream.md."
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent name" className="sm:flex-1" />
            <Button onClick={() => void createAgent()} disabled={creatingAgent}>
              {creatingAgent ? "Creating…" : "Create agent"}
            </Button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={agentProvider}
              onChange={(e) => {
                const next = e.target.value;
                setAgentProvider(next);
                const suggestions = modelSuggestionsForProvider(next);
                if (suggestions.length) setAgentModel(suggestions[0]);
              }}
            >
              {AGENT_PROVIDER_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Input
              value={agentModel}
              onChange={(e) => {
                const raw = e.target.value;
                setAgentModel(raw);
                const expanded = expandModelShortcut(raw);
                if (raw.includes("/") || expanded !== raw.trim()) {
                  const applied = applyModelInput(agentProvider, raw);
                  setAgentProvider(applied.provider);
                  setAgentModel(applied.model);
                }
              }}
              placeholder="minimax-free or zencode/minimax-m2.5-free"
              list="onboarding-agent-models"
            />
            <datalist id="onboarding-agent-models">
              {modelSuggestionsForProvider(agentProvider).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          {agent ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Active agent: <code>{agent.id}</code>
            </p>
          ) : null}
          {agent && room && memberJwt.trim() ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-foreground">Live agent chat</p>
              <AgentRoomChat
                roomId={activeRoomId}
                agentId={agent.id}
                agentName={agent.name}
                agentHandle="assistant"
                adminJwt={adminJwt}
              />
            </div>
          ) : (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Input
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  placeholder="Agent prompt"
                />
                <Button
                  variant="primary"
                  onClick={() => void invokeAgent()}
                  disabled={invokingAgent || !agent}
                >
                  {invokingAgent ? "Invoking…" : "REST invoke"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Create a room and mint member JWT to use live chat with @mention invoke.
              </p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <ShadcnButton
              type="button"
              variant="default"
              onClick={() => {
                if (!clerkUser?.id) return;
                void finishQuickstartAndOpenConsole(router, {
                  clerkUserId: clerkUser.id,
                  memberJwt,
                  memberUserId: userId.trim() || "alice",
                  setLastRoom,
                });
              }}
            >
              Done — open console
            </ShadcnButton>
          </div>
        </Section>
      ) : null}
    </ConsoleShell>
  );
}
