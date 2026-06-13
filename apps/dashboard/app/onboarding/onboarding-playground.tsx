"use client";

import Link from "next/link";
import { Button as ShadcnButton } from "~/components/ui/button";
import { OnboardingAuthStep } from "../components/onboarding-auth-step";
import { RoomPicker } from "../components/room-picker";
import { AgentRoomChat } from "../components/agent-room-chat";
import { AgentFormFields } from "../components/agent-form-fields";
import { Button, Input, Section } from "../components/ui";
import { VoiceRecorder } from "~/components/voice/voice-recorder";
import { VoiceMessageBubble } from "~/components/voice/voice-message-bubble";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { ASSISTANT_ROOM_ID } from "@/lib/assistant-room";
import { cn } from "@/lib/utils";
import type { AgentFormValues } from "@/lib/agent-form";
import { copyToClipboard, firstIncompleteOnboardingStep, ONBOARDING_STEPS } from "./onboarding-shared";
import { finishQuickstartAndOpenConsole } from "./onboarding-finish";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface OnboardingPlaygroundProps {
  wizard: OnboardingWizard;
}

export function OnboardingPlayground({ wizard: w }: OnboardingPlaygroundProps) {
  const canChat = Boolean(w.memberJwt.trim() && w.room?.id);
  const canFinish = w.messages.length >= 1;
  const nextIncomplete = firstIncompleteOnboardingStep(w.stepContext);

  const agentFormValues: AgentFormValues = {
    name: w.agentName,
    handle: "assistant",
    provider: w.agentProvider,
    model: w.agentModel,
    capabilities: "chat",
    systemPrompt: "",
    contextFetchUrl: "",
    toolExecuteUrl: "",
    llmBaseUrl: "",
    fallbackProvider: "",
    fallbackModel: "",
  };

  function onAgentFormChange(patch: Partial<AgentFormValues>) {
    if (patch.name !== undefined) w.setAgentName(patch.name);
    if (patch.provider !== undefined) w.setAgentProvider(patch.provider);
    if (patch.model !== undefined) w.setAgentModel(patch.model);
  }

  return (
    <div className="space-y-6" data-testid="onboarding-playground">
      <Section
        title="Setup"
        description="Connect, provision a project, and mint a member JWT. Sections unlock as you complete each requirement."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1. Connect
            </h3>
            <OnboardingAuthStep
              adminJwt={w.adminJwt}
              onAdminJwtChange={w.setAdminJwt}
              onContinue={() => undefined}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2. Project
            </h3>
            {w.project?.id ? (
              <p className="text-sm text-muted-foreground">
                Active: <strong>{w.project.name}</strong> (
                <code className="text-xs">{w.project.id}</code>)
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {isClerkClientConfigured() && w.clerkSignedIn ? (
                  <Button
                    type="button"
                    variant="primary"
                    data-testid="provision-hosted-btn"
                    onClick={() => void w.provisionHostedProject()}
                    disabled={w.provisioningCloud}
                  >
                    {w.provisioningCloud ? "Provisioning…" : "Provision via Clerk"}
                  </Button>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    data-testid="project-name-input"
                    value={w.projectName}
                    onChange={(e) => w.setProjectName(e.target.value)}
                    placeholder="Project name"
                    className="sm:flex-1"
                  />
                  <Button
                    variant="outline"
                    data-testid="create-project-btn"
                    onClick={() => void w.createProject()}
                    disabled={w.creatingProject || w.provisioningCloud}
                  >
                    {w.creatingProject ? "Creating…" : "Create project"}
                  </Button>
                </div>
              </div>
            )}
            {w.project?.apiKey ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <pre className="max-h-24 flex-1 overflow-auto rounded-lg border border-border bg-[#0d1117] p-2 font-mono text-xs text-[#e6edf3]">
                  {w.project.apiKey}
                </pre>
                <Button type="button" size="sm" onClick={() => void copyToClipboard(w.project!.apiKey!)}>
                  Copy API key
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              3. Member JWT
            </h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                value={w.userId}
                onChange={(e) => w.setUserId(e.target.value)}
                placeholder="userId (e.g. alice)"
                disabled={!w.project?.id && w.adminJwt.trim().length < 12}
              />
              <Button
                variant="primary"
                data-testid="mint-jwt-btn"
                onClick={() => void w.mintMemberJwt()}
                disabled={w.mintingJwt || w.adminJwt.trim().length < 12}
              >
                {w.mintingJwt ? "Minting…" : "Mint JWT"}
              </Button>
            </div>
            {w.memberJwt ? (
              <pre className="max-h-24 overflow-auto rounded-lg border border-border bg-[#0d1117] p-2 font-mono text-xs text-[#e6edf3]">
                {w.memberJwt}
              </pre>
            ) : null}
          </div>
        </div>
      </Section>

      <Section
        title="Chat playground"
        description={
          canChat
            ? `Connection: ${w.connectionStatus}. Room: ${w.room?.id}`
            : "Mint a member JWT and create or pick a room to start chatting."
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <ModeChip active={w.roomMode === "create"} onClick={() => w.setRoomMode("create")} label="Create room" />
          <ModeChip
            active={w.roomMode === "existing"}
            onClick={() => w.setRoomMode("existing")}
            label="Existing room"
          />
        </div>
        {w.roomMode === "existing" ? (
          <RoomPicker
            token={w.memberJwt}
            value={w.existingRoomId}
            onChange={w.selectExistingRoom}
            placeholder="Select a room"
          />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              data-testid="room-id-input"
              value={w.roomName}
              onChange={(e) => w.setRoomName(e.target.value)}
              placeholder={`room id (e.g. ${ASSISTANT_ROOM_ID})`}
              disabled={!w.memberJwt}
            />
            <Button
              variant="primary"
              data-testid="create-room-btn"
              onClick={() => void w.createRoom()}
              disabled={w.creatingRoom || !w.memberJwt}
            >
              {w.creatingRoom ? "Creating…" : "Create room"}
            </Button>
          </div>
        )}

        <label className="mb-2 mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={w.skipHistoryOnConnect}
            onChange={(e) => w.setSkipHistoryOnConnect(e.target.checked)}
            disabled={!canChat}
          />
          Skip history on connect
        </label>

        <div
          className="h-[220px] overflow-auto rounded-xl border border-border bg-muted/30 p-3"
          data-testid="message-list"
        >
          {w.messages.length ? (
            w.messages.map((m) => (
              <div key={m.id} className="py-1 text-sm">
                <b>{m.userId}</b>:{" "}
                {m.kind === "voice" ? (
                  <VoiceMessageBubble message={m} className="mt-1 inline-block" />
                ) : (
                  m.content
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No messages yet — send one below.</p>
          )}
        </div>

        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Type and press Enter"
            className="sm:flex-1"
            disabled={!canChat}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const value = (e.target as HTMLInputElement).value.trim();
              if (!value) return;
              w.sendMessage(value);
              (e.target as HTMLInputElement).value = "";
            }}
          />
          <VoiceRecorder
            disabled={!canChat}
            onSend={async (audio, durationMs) => {
              if (!w.fluxyClient || !w.room) return;
              try {
                await w.fluxyClient.sendVoiceMessage(w.room.id, audio, { durationMs });
                void w.loadHistory();
              } catch (err: unknown) {
                console.error("voice send failed", err);
              }
            }}
          />
          <Button
            variant="primary"
            data-testid="send-sample-btn"
            onClick={() => w.sendMessage(`Hello from ${w.userId} @ ${new Date().toISOString()}`)}
            disabled={!canChat}
          >
            Send sample
          </Button>
        </div>
      </Section>

      <details className="rounded-2xl border border-border/70 bg-white/80 p-4">
        <summary className="cursor-pointer font-heading text-lg font-semibold">
          Agent sandbox (optional)
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Register a bot and invoke it in the room above. Skippable — open the console after your first message.
        </p>
        <div className="mt-4">
          <AgentFormFields
            values={agentFormValues}
            onChange={onAgentFormChange}
            llmCatalog={null}
            idPrefix="onboarding-agent"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void w.createAgent()} disabled={w.creatingAgent || !w.adminJwt.trim()}>
              {w.creatingAgent ? "Creating…" : "Create agent"}
            </Button>
            <Button
              variant="primary"
              onClick={() => void w.invokeAgent()}
              disabled={w.invokingAgent || !w.agent}
            >
              {w.invokingAgent ? "Invoking…" : "REST invoke"}
            </Button>
          </div>
          <Input
            className="mt-3"
            value={w.agentPrompt}
            onChange={(e) => w.setAgentPrompt(e.target.value)}
            placeholder="Agent prompt for REST invoke"
          />
          {w.agent && w.room && w.memberJwt.trim() ? (
            <div className="mt-4">
              <AgentRoomChat
                roomId={w.activeRoomId}
                agentId={w.agent.id}
                agentName={w.agent.name}
                agentHandle="assistant"
                adminJwt={w.adminJwt}
              />
            </div>
          ) : null}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
        <p className="flex-1 text-sm text-muted-foreground">
          {canFinish
            ? "First message delivered — you are ready for the console."
            : `Next: ${ONBOARDING_STEPS[nextIncomplete]?.title ?? "finish"}.`}
        </p>
        <Button
          type="button"
          variant="primary"
          disabled={!canFinish || !w.clerkUser?.id}
          onClick={() => {
            if (!w.clerkUser?.id) return;
            void finishQuickstartAndOpenConsole(w.router, {
              clerkUserId: w.clerkUser.id,
              memberJwt: w.memberJwt,
              memberUserId: w.userId.trim() || "alice",
              setLastRoom: w.setLastRoom,
            });
          }}
        >
          Open console
        </Button>
        <ShadcnButton type="button" variant="outline" asChild>
          <Link href="/agents">Try agents</Link>
        </ShadcnButton>
      </div>
    </div>
  );
}

function ModeChip(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        props.active ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground",
      )}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}
