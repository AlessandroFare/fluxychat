"use client";

import Link from "next/link";
import { Check, Sparkles, ChevronRight, ChevronLeft, Cloud, Info, Server } from "lucide-react";
import { OnboardingAuthStep } from "../components/onboarding-auth-step";
import { RoomPicker } from "../components/room-picker";
import { AgentRoomChat } from "../components/agent-room-chat";
import { AgentFormFields } from "../components/agent-form-fields";
import { Button, Input } from "../components/ui";
import { VoiceRecorder } from "~/components/voice/voice-recorder";
import { VoiceMessageBubble } from "~/components/voice/voice-message-bubble";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";
import type { AgentFormValues } from "@/lib/agent-form";
import { copyToClipboard, ONBOARDING_STEPS } from "./onboarding-shared";
import { finishQuickstartAndOpenConsole } from "./onboarding-finish";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface OnboardingPlaygroundProps {
  wizard: OnboardingWizard;
}

export function OnboardingPlayground({ wizard: w }: OnboardingPlaygroundProps) {
  const canChat = Boolean(w.memberJwt.trim() && w.room?.id);
  const canFinish = Boolean(w.userSentMessage);
  const step = w.activeStep;

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
    temperature: 0.7,
    maxTokens: 1024,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stopSequences: "",
  };

  function onAgentFormChange(patch: Partial<AgentFormValues>) {
    if (patch.name !== undefined) w.setAgentName(patch.name);
    if (patch.provider !== undefined) w.setAgentProvider(patch.provider);
    if (patch.model !== undefined) w.setAgentModel(patch.model);
  }

  function handleOpenConsole() {
    const clerkUserId = w.clerkUser?.id ?? `self-host-${w.userId.trim() || "owner"}`;
    void finishQuickstartAndOpenConsole(w.router, {
      clerkUserId,
      memberJwt: w.memberJwt,
      memberUserId: w.userId.trim() || "alice",
      projectId: w.activeProject?.id ?? "",
      setLastRoom: w.setLastRoom,
    });
  }

  return (
    <div className="space-y-6" data-testid="onboarding-playground">
      <div className="transition-opacity duration-200" key={step}>
        {/* Step 0: Connect account */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Connect your account</h3>
            <p className="text-sm text-muted-foreground">
              Authenticate with Clerk (hosted cloud) or paste your admin JWT if you are self-hosting.
              This gives you access to project management and admin endpoints.
            </p>
            <OnboardingAuthStep
              adminJwt={w.adminJwt}
              onAdminJwtChange={w.setAdminJwt}
              onContinue={w.goNext}
            />
            {w.error && (
              <p className="text-xs text-red-500">{w.error}</p>
            )}
          </div>
        )}

        {/* Step 1: Create project */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Create your project</h3>
            <p className="text-sm text-muted-foreground">
              Your project is your isolated namespace. All traffic, quotas, and keys live here.
            </p>
            {w.project?.id ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  <span className="font-medium">{w.project.name}</span>
                </div>
                <code className="mt-1 block text-xs text-emerald-600">{w.project.id}</code>
                {w.project.apiKey ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-emerald-700">
                      Your API key (copy it now, shown once)
                    </p>
                    <div className="flex gap-2">
                      <pre className="flex-1 overflow-auto rounded-lg border border-emerald-200 bg-[#0d1117] p-2 font-mono text-xs text-[#e6edf3]">
                        {w.project.apiKey}
                      </pre>
                      <Button type="button" size="sm" onClick={() => void copyToClipboard(w.project!.apiKey!)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Mode badge: surface whether the button will provision on
                    hosted cloud (Clerk) or create directly via the Worker
                    admin API. Previously this branch was invisible, so a
                    signed-in Clerk user with a stale session silently got
                    the wrong path. (Audit UX fix.) */}
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {isClerkClientConfigured() && w.clerkSignedIn ? (
                    <>
                      <Cloud className="h-3 w-3" aria-hidden />
                      Hosted cloud — provisions via Clerk
                    </>
                  ) : (
                    <>
                      <Server className="h-3 w-3" aria-hidden />
                      Self-host — creates via Worker admin API
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    data-testid="project-name-input"
                    ref={w.projectNameInputRef}
                    value={w.projectName}
                    onChange={(e) => w.setProjectName(e.target.value)}
                    placeholder="Project name (e.g. Acme Support)"
                    className="sm:flex-1"
                  />
                  <Button
                    variant="primary"
                    data-testid="create-project-btn"
                    onClick={() => {
                      if (isClerkClientConfigured() && w.clerkSignedIn) {
                        void w.provisionHostedProject();
                      } else {
                        void w.createProject();
                      }
                    }}
                    disabled={w.creatingProject || w.provisioningCloud}
                  >
                    {w.creatingProject || w.provisioningCloud ? "Creating..." : "Create project"}
                  </Button>
                </div>
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                  onClick={() => {
                    w.setProjectName("My first project");
                    w.projectNameInputRef.current?.focus();
                  }}
                  disabled={w.projectName === "My first project"}
                >
                  Use default name
                </button>
                {!w.project?.id && (
                  <p className="text-xs text-muted-foreground">Create a project above to continue.</p>
                )}
              </div>
            )}
            {w.error && (
              <p className="text-xs text-red-500">{w.error}</p>
            )}
          </div>
        )}

        {/* Step 2: Mint member JWT */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Mint a member token</h3>
            <p className="text-sm text-muted-foreground">
              A short-lived JWT scoped to a user (e.g. <code>alice</code>). Minted server-side so your
              API key never reaches the browser.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                value={w.userId}
                onChange={(e) => w.setUserId(e.target.value)}
                placeholder="Pick a userId (e.g. alice)"
                disabled={!w.project?.id && w.adminJwt.trim().length < 12}
              />
              <Button
                variant="primary"
                data-testid="mint-jwt-btn"
                onClick={() => void w.mintMemberJwt()}
                disabled={w.mintingJwt || w.adminJwt.trim().length < 12}
              >
                {w.mintingJwt ? "Minting..." : "Mint member token"}
              </Button>
            </div>
            {w.memberJwt ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Token minted
                </div>
                <pre className="mt-2 max-h-24 overflow-auto rounded-lg border border-emerald-200 bg-[#0d1117] p-2 font-mono text-xs text-[#e6edf3]">
                  {w.memberJwt}
                </pre>
              </div>
            ) : null}
            {w.error && (
              <p className="text-xs text-red-500">{w.error}</p>
            )}
          </div>
        )}

        {/* Step 3: Create room */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Create a room</h3>
            <p className="text-sm text-muted-foreground">
              A channel your SDK can join. Choose a new room or reopen an existing one.
            </p>
            <div className="flex flex-wrap gap-2">
              <ModeChip active={w.roomMode === "create"} onClick={() => w.setRoomMode("create")} label="Create new" />
              <ModeChip active={w.roomMode === "existing"} onClick={() => w.setRoomMode("existing")} label="Use existing" />
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
                  placeholder={`room id (e.g. assistant-your-project)`}
                  disabled={!w.memberJwt}
                />
                <Button
                  variant="primary"
                  data-testid="create-room-btn"
                  onClick={() => void w.createRoom()}
                  disabled={w.creatingRoom || !w.memberJwt}
                >
                  {w.creatingRoom ? "Creating..." : "Create room"}
                </Button>
              </div>
            )}
            {w.room?.id && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Room <strong>{w.room.id}</strong> ready
              </div>
            )}
            {w.error && (
              <p className="text-xs text-red-500">{w.error}</p>
            )}
          </div>
        )}

        {/* Step 4: First message */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Send your first message</h3>
            <p className="text-sm text-muted-foreground">
              Connected. Type a message and press Enter — that is your first live WebSocket send.
            </p>

            {w.showCelebration && canFinish ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">You are live!</p>
                  <p className="text-sm text-muted-foreground">
                    First message delivered over WebSocket. The stack is working.
                  </p>
                </div>
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => w.setShowCelebration(false)}
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <label
              className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"
              title="Skip fetching past messages when the WebSocket connects"
            >
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-border"
                checked={w.skipHistoryOnConnect}
                onChange={(e) => w.setSkipHistoryOnConnect(e.target.checked)}
                disabled={!canChat}
              />
              Skip loading past messages on connect
            </label>

            <div
              className="h-[220px] overflow-auto rounded-xl border border-border bg-muted/30 p-3"
              data-testid="message-list"
            >
              {w.messages.length ? (
                w.messages.map((m) => (
                  <div key={m.id} className="py-1.5 text-sm">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {m.userId}
                    </div>
                    {m.kind === "voice" ? (
                      <VoiceMessageBubble message={m} className="mt-1" />
                    ) : (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">
                        {m.content}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm italic text-muted-foreground/60">
                  [FluxyChat] Room created. You are the first one here.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder={canChat ? "Type a message and press Enter" : "Set up the steps above to start chatting"}
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
          </div>
        )}

        {/* Step 5: Try an agent (optional) */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-white/80 p-4">
              <h3 className="text-lg font-semibold text-foreground">Try an agent (optional)</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                If you have an LLM provider key, register a bot and invoke it. You can come back anytime from{" "}
                <Link href="/agents" className="font-medium text-foreground underline underline-offset-2">/agents</Link>.
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
                    {w.creatingAgent ? "Creating..." : "Create agent"}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void w.invokeAgent()}
                    disabled={w.invokingAgent || !w.agent}
                  >
                    {w.invokingAgent ? "Invoking..." : "REST invoke"}
                  </Button>
                </div>
                <Input
                  className="mt-3"
                  value={w.agentPrompt}
                  onChange={(e) => w.setAgentPrompt(e.target.value)}
                  placeholder="e.g. Summarize the last 5 messages"
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
              {w.error && (
                <p className="mt-3 text-xs text-red-500">{w.error}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 z-10 rounded-2xl border border-border border-t border-border bg-background/95 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          {step > 0 && step < 5 ? (
            <Button variant="outline" onClick={() => w.goBack()}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : null}
          <div className="flex items-center gap-2">
            {step >= 0 && step < 4 ? (
              (() => {
                const ready = isStepReady(step, w);
                const hint = ready ? "" : getNextBlockerHint(step, w);
                return (
                  <Button
                    variant="primary"
                    onClick={() => w.goNext()}
                    disabled={!ready}
                    title={hint || undefined}
                    aria-disabled={!ready}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                );
              })()
            ) : null}
            {step === 4 ? (
              <Button
                variant="primary"
                onClick={() => w.goNext()}
                disabled={!canFinish}
                title={!canFinish ? "Send a message first" : undefined}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : null}
            {step === 5 ? (
              <Button variant="primary" onClick={handleOpenConsole}>
                Open console
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : null}
            {step < 5 ? (
              <Link href="/" className="ml-3 text-xs text-muted-foreground underline underline-offset-2">
                Skip to console
              </Link>
            ) : null}
          </div>
          {!isStepReady(step, w) && step < 4 ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Info className="h-3.5 w-3.5 shrink-0" />
              {getNextBlockerHint(step, w)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function isStepReady(step: number, w: OnboardingWizard): boolean {
  if (step === 0) return w.adminJwt.trim().length >= 12;
  if (step === 1) return Boolean(w.project?.id);
  if (step === 2) return Boolean(w.memberJwt.trim());
  if (step === 3) return Boolean(w.room?.id);
  return true;
}

function getNextBlockerHint(step: number, w: OnboardingWizard): string {
  if (step === 0) return "Sign in or paste your admin JWT to continue.";
  if (step === 1) return "Create a project to continue.";
  if (step === 2) return "Mint a member token to continue.";
  if (step === 3) return "Create or select a room to continue.";
  return "";
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
