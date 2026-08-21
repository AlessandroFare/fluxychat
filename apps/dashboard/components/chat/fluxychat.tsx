"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookOpen,
  BrainCircuit,
  BarChart3,
  Clock,
  FileImage,
  Gavel,
  Globe,
  Loader2,
  Paperclip,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Copy,
  Pencil,
  RotateCw,
  Pin,
  Flag,
  Languages,
  X,
} from "lucide-react";
import { useChat, useFluxyChatOptional } from "@fluxy-chat/react";
import { SearchSnippet } from "@/app/search/search-snippet";
import {
  buildDeepResearchPrompt,
  buildImageGenerationCaption,
  buildWebSearchPrompt,
  buildAgentWorkspaceSteps,
  isAgentWorkspaceLive,
  isDebateSessionLive,
  createHuddle,
  getConnectionStatusLabel,
  isDegradedConnectionStatus,
  type Huddle,
} from "@fluxy-chat/sdk";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { mentionPrefixForAgent, normalizeAgentHandle, projectIdFromAssistantRoomId } from "@/lib/assistant-room";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { createMemberFluxyClient } from "@/lib/fluxy-member-client";
import {
  normalizeAgentRun,
  type AgentRunDisplay,
  type AgentToolCallDisplay,
} from "@/lib/agent-run-display";
import { toolCallsToThreadEvents, toolThreadEventsToUiParts } from "@/lib/agent-tool-thread";
import type { UseChatHistoryReplay, FluxyChatAttachment } from "@fluxy-chat/sdk";
import { parseCardFromMessage, cardDisplayText } from "@fluxy-chat/sdk";
import { InteractiveCardRenderer } from "@/components/chat/interactive-card-renderer";
import { AgentToolThreadCard } from "@/app/components/agent-tool-thread-card";
import { AgentUiRenderer } from "~/components/chat/agent-ui-renderer";
import { ToolApprovalPanel } from "@/components/chat/tool-approval-panel";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";
import {
  DEMO_SEND_COOLDOWN_MS,
  evaluateDemoMessage,
  shouldHideDemoMessage,
} from "@/lib/demo-message-moderation";
import {
  AgentRoomTemplatePicker,
  type AgentRoomTemplateSelection,
} from "@/app/components/agent-room-template-picker";
import { AgentRunStatus } from "@/app/components/agent-run-status";
import { AgentWorkspacePanel } from "@/components/chat/agent-workspace-panel";
import { DebateThreadPanel } from "@/components/chat/debate-thread-panel";
import { VoiceStagePanel } from "@/components/voice/voice-stage-panel";
import { useVoiceStageVad } from "@/lib/use-voice-stage-vad";
import { findStageParticipant } from "@fluxy-chat/sdk";
import { RoomOfflineNotifySettings } from "@/app/components/room-offline-notify-settings";
import { ChatCatchUpBanner } from "@/app/components/chat-catch-up-banner";
import { EuConsentBanner } from "@/app/components/eu-consent-banner";
import { MergeConflictPanel } from "@/app/components/merge-conflict-panel";
import { ChatPresenceStrip } from "@/app/components/chat-presence-strip";
import { AgentCopilotConfirm } from "@/app/components/agent-copilot-confirm";
import { ThreadSummary } from "@/app/components/thread-summary";
import { useRoomDraftSync } from "@/lib/use-room-draft-sync";
import type { FluxySendMessageOptions, FluxyChatClient } from "@fluxy-chat/sdk";
import { Button, Input } from "@/app/components/ui";
import { VoiceRecorder } from "~/components/voice/voice-recorder";
import { ReplySuggestions } from "@/app/components/reply-suggestions";
import { AgentHandoffBanner } from "@/app/components/agent-handoff-banner";
import { LinkPreviewCard } from "~/components/ui/link-preview";
import { PinnedMessagesBar } from "~/components/ui/pinned-messages";
import { PollView, PollCreate } from "~/components/ui/poll";
import {
  MessageTranslationBlock,
  type MessageTranslationEntry,
} from "~/components/chat/message-translation-block";
import { getViewerTranslationLang } from "@/lib/translation-viewer-prefs";
import { DecisionView, DecisionCreate, type DecisionData } from "~/components/ui/decision";
import { ScheduleSend } from "~/components/ui/schedule-send";
import {
  CounterfactualCompare,
  counterfactualRunFromPayload,
} from "~/components/ui/counterfactual-compare";
import { CounterfactualReplayPanel } from "~/components/ui/counterfactual-replay-panel";
import { isSideEffectToolName } from "@/lib/counterfactual-utils";
import { BreakoutPanel, useBreakouts } from "~/components/ui/breakout-panel";
import { SlashCommandMenu } from "~/components/ui/slash-commands";
import {
  MentionMenu,
  detectMentionQuery,
  insertMentionAtCursor,
  type MentionSuggestion,
} from "~/components/ui/mention-menu";
import { listSlashCommands, type RoomCommand } from "@/lib/slash-commands-client";
import { fetchMentionSuggestions, localMentionSuggestions } from "@/lib/mentions-client";
import { RoomInfoPanel, RoomInfoToggle } from "~/components/chat/room-info-panel";
import { cn } from "@/lib/utils";

// shadcn UI primitives
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
  MessageTimestamp,
  MessageActions,
  MessageHoverToolbar,
  MessageAction,
  messageToolbarButtonClass,
  messageToolbarIconButtonClass,
} from "@/components/ui/message";
import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from "@/components/ui/bubble";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  MessageScrollerDate,
} from "@/components/ui/message-scroller";
import { Marker, MarkerIcon, MarkerContent } from "@/components/ui/marker";
import {
  Composer,
  ComposerTextarea,
  ComposerToolbar,
  ComposerToolbarLeft,
  ComposerToolbarRight,
  ComposerSubmitButton,
} from "@/components/ui/composer";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ReactionPicker } from "@/components/ui/reaction-picker";
import { VoiceMessageBubble } from "~/components/voice/voice-message-bubble";
import { MarkdownBody } from "@fluxy-chat/ui";
import {
  canBranchFromMessage,
  detectToolFromMessageContent,
  findPriorUserMessage,
  messageAuthorIsAgent,
  messageContentUsesMarkdown,
  stripComposerToolTags,
} from "@/lib/chat-message-actions";

const WORKER_URL = getPublicWorkerUrl();
const RUN_POLL_MS = 2000;
const RUN_POLL_TIMEOUT_MS = 60_000;
const SKIP_HISTORY_STORAGE_KEY = "fluxychat.agentChat.skipHistory";

// ─── Helper functions ───

function displayUserId(message: { userId?: string | null }): string {
  return message.userId?.trim() || "unknown";
}

function stringToColor(str: string): string {
  const palette = [
    "#F97316", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B",
    "#EF4444", "#3B82F6", "#EC4899", "#14B8A6", "#6366F1",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return palette[Math.abs(hash) % palette.length];
}

const UserPlaceholder = ({ bg }: { bg: string }) => (
  <div
    className="flex size-full items-center justify-center overflow-hidden rounded-full"
    style={{ backgroundColor: bg }}
  >
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="size-full">
      <rect width="24" height="24" fill={bg} />
      <circle cx="12" cy="8" r="3.5" fill="white" opacity="0.85" />
      <path d="M4 20 C4 15 8 13 12 13 C16 13 20 15 20 20" fill="white" opacity="0.75" />
    </svg>
  </div>
);

const AgentAvatar = () => (
  <div
    className="flex size-full items-center justify-center rounded-full"
    style={{ backgroundColor: "#C2410C" }}
  >
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5">
      <line x1="12" y1="2" x2="12" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="1.5" r="1" fill="white" />
      <rect x="5" y="5" width="14" height="10" rx="2" fill="white" opacity="0.95" />
      <circle cx="9" cy="10" r="1.5" fill="#C2410C" />
      <circle cx="15" cy="10" r="1.5" fill="#C2410C" />
      <rect x="9" y="12.5" width="6" height="1" rx="0.5" fill="#C2410C" />
      <rect x="8" y="16" width="8" height="5" rx="1.5" fill="white" opacity="0.85" />
      <rect x="3" y="16.5" width="4" height="2.5" rx="1" fill="white" opacity="0.75" />
      <rect x="17" y="16.5" width="4" height="2.5" rx="1" fill="white" opacity="0.75" />
      <rect x="3.5" y="8" width="1.5" height="4" rx="0.75" fill="white" opacity="0.7" />
      <rect x="19" y="8" width="1.5" height="4" rx="0.75" fill="white" opacity="0.7" />
    </svg>
  </div>
);

function messageVisibilityBadge(
  message: { visibility?: string; userId?: string | null },
  agentId: string,
): { label: string; scoped: boolean } | null {
  const visibility = message.visibility?.trim().toLowerCase();
  if (visibility === "whisper") return { label: "whisper", scoped: true };
  if (visibility?.startsWith("role:")) return { label: visibility, scoped: true };
  const author = message.userId?.trim() || "";
  if (author === agentId) return { label: "room", scoped: false };
  return null;
}

function ChatAvatar({
  isAgent,
  isSelf,
  displayName,
  clerkImageUrl,
  userId,
}: {
  isAgent: boolean;
  isSelf: boolean;
  displayName: string;
  clerkImageUrl?: string | null;
  userId?: string | null;
}) {
  if (isAgent) return <AgentAvatar />;
  if (isSelf && clerkImageUrl) {
    return (
      <img
        src={clerkImageUrl}
        alt={displayName}
        className="size-full rounded-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  if (isSelf) return <UserPlaceholder bg="#D1D5DB" />;
  const seed = userId || displayName || "?";
  return <UserPlaceholder bg={stringToColor(seed)} />;
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Types ───

export type FluxyChatVariant = "full" | "demo" | "onboarding" | "minimal";

export interface FluxyChatProps {
  roomId: string;
  agentId?: string;
  agentName?: string;
  agentHandle?: string | null;
  /** When set with an assistant room id, auto-provisions the room before connecting. */
  projectId?: string;
  adminJwt?: string;
  memberJwt?: string;
  memberUserId?: string;
  /** Override the FluxyChatClient (e.g. demo guest session). When omitted, uses FluxyRealtimeProvider context. */
  client?: FluxyChatClient | null;
  coPilotConfirm?: boolean;
  deepLinkHistoryLimit?: number;
  scrollToMessageId?: number;
  /** Called after a message is successfully sent (for onboarding tracking, etc.). */
  onMessageSent?: () => void;
  /** Isolate WS session from other FluxyChat widgets on the same page. */
  sessionScope?: string;
  /** Skip auto-provision; parent already created/joined the assistant room. */
  bootstrapAssistantRoom?: boolean;
  className?: string;
  /** Page-specific variant. Controls which UI elements are shown. */
  variant?: FluxyChatVariant;
  /** Suggested prompts shown above the composer when there are no messages or draft. */
  suggestedPrompts?: string[];
}

type PendingTool =
  | null
  | { type: "image" }
  | { type: "deep-research" }
  | { type: "web-search" };

interface PendingComposePayload {
  templateSend: AgentRoomTemplateSelection | null;
  text: string;
  parentId: number | null;
  attachments: FluxyChatAttachment[];
  tool: PendingTool;
}

// ─── Bubble styling constants ───
// Rounding, background, and text color come from the Bubble `sent` / `received`
// variants (driven by the --fluxy-bubble-* design tokens in globals.css).
// These classes only handle alignment and width.

const sentBubbleClass = "ml-auto max-w-[72%]";
const receivedBubbleClass = "mr-auto max-w-[72%]";
const bubbleContentPadding = "px-3.5 py-2.5";

// ─── Component ───

export function FluxyChat({
  roomId,
  agentId = "",
  agentName = "Agent",
  agentHandle,
  adminJwt = "",
  memberJwt = "",
  memberUserId,
  client: clientProp,
  coPilotConfirm: coPilotConfirmDefault = true,
  deepLinkHistoryLimit: deepLinkHistoryLimitProp,
  scrollToMessageId: scrollToMessageIdProp,
  onMessageSent,
  sessionScope,
  bootstrapAssistantRoom = true,
  className,
  variant = "full",
  suggestedPrompts,
  projectId = "",
}: FluxyChatProps) {
  // Variant-based feature flags
  const showPlusMenu = variant === "full" || variant === "demo" || variant === "onboarding";
  const showVoiceRecorder = variant === "full" || variant === "demo" || variant === "onboarding";
  const showTemplates = variant === "full";
  const showCopilotConfirm = variant === "full";
  const showPresenceStrip = variant === "full";
  const showHandoffBanner = variant === "full";
  const showCatchUpBanner = variant === "full";
  const showReplySuggestions = variant === "full";
  const showOfflineNotify = variant === "full";
  const showDeepResearch = variant === "full" || variant === "demo" || variant === "onboarding";
  const showWebSearch = variant === "full" || variant === "demo" || variant === "onboarding";
  const showImageGen = variant === "full" || variant === "demo" || variant === "onboarding";
  const showPollCreate = variant === "full" || variant === "demo" || variant === "onboarding";
  const showDecisionCreate = variant === "full" || variant === "demo" || variant === "onboarding";
  const showScheduleSend = variant === "full" || variant === "demo" || variant === "onboarding";
  const showRoomDraftSync = variant === "full";
  const showSuggestedPrompts = (variant === "demo" || variant === "onboarding") && suggestedPrompts && suggestedPrompts.length > 0;
  const showRoomInfo = variant === "full";
  const showBreakouts = variant === "full";
  const showHitlApprovals = variant === "full";
  const showPinnedBar = variant === "full";
  const showMessageSearch = variant === "full";
  const showDemoStatusBar = variant === "demo";
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkHistoryLimit =
    deepLinkHistoryLimitProp ??
    (Number(searchParams.get("replayLimit")) || undefined);
  const scrollToMessageId =
    scrollToMessageIdProp ?? (Number(searchParams.get("messageId")) || undefined);
  const [confirmBeforeSend, setConfirmBeforeSend] = useState(showCopilotConfirm ? coPilotConfirmDefault : false);
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [ephemeralTtlSeconds, setEphemeralTtlSeconds] = useState(0);
  const [whisperMode, setWhisperMode] = useState(false);
  const [whisperTo, setWhisperTo] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ attachment: FluxyChatAttachment; uploading: boolean; error?: string }>
  >([]);
  const [pendingTool, setPendingTool] = useState<PendingTool>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCompose, setPendingCompose] = useState<{
    previewText: string;
    modeLabel: string;
    payload: PendingComposePayload;
  } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<AgentRunDisplay | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);
  const [skipHistoryOnConnect, setSkipHistoryOnConnect] = useState(false);
  const [templateSelection, setTemplateSelection] =
    useState<AgentRoomTemplateSelection | null>(null);
  // Image generation dialog
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  // + menu open state
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [pollCreateOpen, setPollCreateOpen] = useState(false);
  const [decisionCreateOpen, setDecisionCreateOpen] = useState(false);
  const [scheduleSendOpen, setScheduleSendOpen] = useState(false);
  const [counterfactualTarget, setCounterfactualTarget] = useState<{
    runId: string;
    toolCall: AgentToolCallDisplay;
  } | null>(null);
  const [counterfactualCompare, setCounterfactualCompare] = useState<{
    original: AgentRunDisplay;
    alternative: AgentRunDisplay;
    toolCallId: string;
  } | null>(null);
  const [decisionOverrides, setDecisionOverrides] = useState<Record<number, DecisionData>>({});
  const [reportedMessageIds, setReportedMessageIds] = useState<Set<number>>(() => new Set());
  const demoLastSendAtRef = useRef(0);
  const showDemoModeration = variant === "demo";
  const [pins, setPins] = useState<Array<Record<string, unknown>>>([]);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, MessageTranslationEntry>>({});
  const [showOriginalByMessageId, setShowOriginalByMessageId] = useState<Record<string, boolean>>({});
  const [viewerTranslationLang, setViewerTranslationLang] = useState("en");
  const [pollOverrides, setPollOverrides] = useState<
    Record<number, NonNullable<import("@fluxy-chat/sdk").FluxyChatMessage["poll"]>>
  >({});
  const plusMenuRef = useRef<HTMLDivElement>(null);
  // Reaction picker state
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<number | null>(null);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState<DOMRect | null>(null);
  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [branchFromMessageId, setBranchFromMessageId] = useState<number | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "hybrid">("hybrid");
  const [semanticSearchAvailable, setSemanticSearchAvailable] = useState<boolean | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{
    id: number; content: string; userId: string; createdAt: string; snippet: string; score?: number;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  useEffect(() => {
    const token = adminJwt.trim();
    if (!token || variant !== "full") return;
    const baseUrl = getPublicWorkerUrl();
    void fetch(`${baseUrl}/search/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { settings?: { available?: boolean; defaultMode?: string } } | null) => {
        if (!json?.settings) {
          setSemanticSearchAvailable(false);
          setSearchMode("keyword");
          return;
        }
        setSemanticSearchAvailable(json.settings.available ?? false);
        if (json.settings.defaultMode === "keyword") setSearchMode("keyword");
      })
      .catch(() => {
        setSemanticSearchAvailable(false);
        setSearchMode("keyword");
      });
  }, [adminJwt, variant]);

  useEffect(() => {
    const token = adminJwt.trim() || memberJwt.trim();
    if (!token) return;
    void listSlashCommands(token)
      .then((res) => setSlashCommands(res.commands ?? []))
      .catch(() => {});
  }, [adminJwt, memberJwt]);

  const pollSinceRef = useRef<string | null>(null);
  const runFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [slashCommands, setSlashCommands] = useState<RoomCommand[]>([]);
  const chatToken = adminJwt.trim() || memberJwt.trim();
  const { user: clerkUser } = useClerkUser();
  const realtime = useFluxyChatOptional();

  const memberClient = useMemo(
    () =>
      createMemberFluxyClient({
        memberJwt,
        memberUserId,
        clerkUserId: clerkUser?.id ?? null,
        workerUrl: WORKER_URL,
      }),
    [memberJwt, memberUserId, clerkUser?.id],
  );

  /** Prefer JWT-bound client (matches WS `sub`); explicit `client` wins for guest/demo. */
  const fluxyClient = clientProp ?? memberClient ?? realtime?.client ?? null;
  /** Prefer member JWT for room APIs; fall back to explicit/guest SDK client token. */
  const roomAccessToken =
    memberJwt.trim() || adminJwt.trim() || fluxyClient?.token?.trim() || "";

  const localUserId = clerkUser?.id
    ? fluxyUserIdFromClerk(clerkUser.id)
    : undefined;

  const chatUserId =
    memberUserId?.trim() ||
    fluxyClient?.userId?.trim() ||
    localUserId?.trim() ||
    undefined;

  const trimmedRoomId = roomId.trim();
  const assistantProjectId = projectId.trim() || projectIdFromAssistantRoomId(trimmedRoomId) || "";
  const shouldBootstrapAssistant =
    bootstrapAssistantRoom &&
    trimmedRoomId.startsWith("assistant-") &&
    Boolean(assistantProjectId) &&
    Boolean(memberJwt.trim());
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(trimmedRoomId || null);
  const [roomBootstrapError, setRoomBootstrapError] = useState<string | null>(null);
  const activeRoomId = resolvedRoomId || trimmedRoomId;

  useEffect(() => {
    setResolvedRoomId(trimmedRoomId || null);
  }, [trimmedRoomId]);

  useEffect(() => {
    if (!shouldBootstrapAssistant) return;

    let cancelled = false;
    setRoomBootstrapError(null);

    void ensureAssistantRoom({
      workerUrl: WORKER_URL,
      memberJwt: memberJwt.trim(),
      memberUserId: memberUserId?.trim() || chatUserId || "dashboard",
      projectId: assistantProjectId,
      adminJwt: adminJwt.trim() || undefined,
    })
      .then(({ room }) => {
        if (!cancelled) setResolvedRoomId(room.id);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRoomBootstrapError(messageFromUnknown(err, "Could not open assistant room"));
          setResolvedRoomId(trimmedRoomId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldBootstrapAssistant, trimmedRoomId, memberJwt, assistantProjectId, adminJwt, memberUserId, chatUserId]);

  // ─── Huddle state ───
  const [huddleActive, setHuddleActive] = useState(false);
  const [huddleAudioOn, setHuddleAudioOn] = useState(false);
  const [huddleVideoOn, setHuddleVideoOn] = useState(false);
  const [huddleScreenOn, setHuddleScreenOn] = useState(false);
  const huddleRef = useRef<Huddle | null>(null);
  const huddleVideoRef = useRef<HTMLVideoElement | null>(null);

  const toggleHuddle = useCallback(async () => {
    if (!trimmedRoomId || !fluxyClient || !localUserId) return;
    if (huddleActive) {
      await huddleRef.current?.leave();
      huddleRef.current = null;
      setHuddleActive(false);
      setHuddleAudioOn(false);
      setHuddleVideoOn(false);
      setHuddleScreenOn(false);
      return;
    }
    const h = createHuddle({ roomId: trimmedRoomId, audioEnabled: true, videoEnabled: false, screenShareEnabled: false, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    h.onEvent((ev) => {
      if (ev.type === "screen_share_started") setHuddleScreenOn(true);
      else if (ev.type === "screen_share_stopped") setHuddleScreenOn(false);
      else if (ev.type === "connection_state_change") setHuddleActive(h.getStatus() === "connected");
      else if (ev.type === "error") console.error("Huddle error:", ev.data);
    });
    huddleRef.current = h;
    await h.join();
    setHuddleAudioOn(true);
  }, [trimmedRoomId, fluxyClient, localUserId, huddleActive]);

  const toggleHuddleMic = useCallback(() => {
    const h = huddleRef.current;
    if (!h) return;
    if (huddleAudioOn) h.mute();
    else h.unmute();
    setHuddleAudioOn(!huddleAudioOn);
  }, [huddleAudioOn]);

  const toggleHuddleCam = useCallback(() => {
    const h = huddleRef.current;
    if (!h) return;
    if (huddleVideoOn) h.disableVideo();
    else h.enableVideo();
    setHuddleVideoOn(!huddleVideoOn);
  }, [huddleVideoOn]);

  const toggleScreenShare = useCallback(async () => {
    const h = huddleRef.current;
    if (!h) return;
    if ((h as any).isScreenSharing()) await h.stopScreenShare();
    else await h.startScreenShare();
  }, []);

  // Pipe local stream to video element
  useEffect(() => {
    const h = huddleRef.current;
    const el = huddleVideoRef.current;
    if (!h || !el) return;
    const stream = h.getLocalStream();
    if (stream) el.srcObject = stream;
    else el.srcObject = null;
  }, [huddleActive, huddleVideoOn]);
  const { breakouts, fetchBreakouts } = useBreakouts(
    showBreakouts ? fluxyClient : null,
    showBreakouts ? activeRoomId || null : null,
  );
  const mentionHandle = normalizeAgentHandle(agentHandle);
  const usesMentionInvoke = Boolean(mentionHandle);

  function textNeedsMentionPrefix(text: string): boolean {
    if (!usesMentionInvoke) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    const handle = mentionHandle.toLowerCase();
    return !trimmed.toLowerCase().startsWith(`@${handle}`);
  }

  useEffect(() => {
    try {
      setSkipHistoryOnConnect(localStorage.getItem(SKIP_HISTORY_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Deep-link replay and default connect behavior are identical ("connect");
  // the only meaningful switch is the user's "skip history" preference.
  const replay: UseChatHistoryReplay = skipHistoryOnConnect ? "request" : "connect";

  const presenceInfo = useMemo(
    () => (chatUserId ? { name: chatUserId } : undefined),
    [chatUserId],
  );

  useEffect(() => {
    setViewerTranslationLang(getViewerTranslationLang());
  }, []);

  const handleAutoTranslated = useCallback(
    (ev: { name: string; data: Record<string, unknown> }) => {
      if (ev.name !== "message.auto_translated") return;
      const messageId = ev.data.messageId;
      const translatedText = ev.data.translatedText;
      const targetLang = ev.data.targetLang;
      if (messageId == null || typeof translatedText !== "string" || !translatedText.trim()) return;
      setTranslatedMessages((prev) => ({
        ...prev,
        [String(messageId)]: {
          translatedText,
          targetLang: typeof targetLang === "string" ? targetLang : viewerTranslationLang,
          sourceLang: typeof ev.data.sourceLang === "string" ? ev.data.sourceLang : null,
          cached: ev.data.cached === true,
        },
      }));
      setShowOriginalByMessageId((prev) => ({ ...prev, [String(messageId)]: false }));
    },
    [viewerTranslationLang],
  );

  const {
    messages,
    sendMessage,
    invokeAgent,
    connectionStatus,
    connectionState,
    connectionErrorInfo,
    connectionBlocked,
    agentTyping,
    typingUsers,
    typingIntents,
    connected,
    syncStatus,
    pendingOutboxCount,
    toolThreadEvents,
    clearToolThread,
    lastAgentRun,
    debateSteps,
    debateSessionId,
    voiceStage,
    joinVoiceStage,
    leaveVoiceStage,
    promoteVoiceStageListener,
    sendVoiceStageVad,
    historyLoaded,
    seenBy,
    loadHistory,
    loadMore,
    hasMore,
    isLoadingMore,
    sendReadReceipt,
    retryMessage,
    editMessage,
    branchRoomFromMessage,
    presenceMembers,
    subscriptionCount,
    reactions,
    sendReaction,
    setTyping,
  } = useChat({
    roomId: activeRoomId,
    agentId,
    client: fluxyClient ?? undefined,
    sessionScope,
    replay,
    replayLimit: deepLinkHistoryLimit,
    historyLimit: deepLinkHistoryLimit ?? 50,
    markReadLatest: false,
    presenceInfo,
    onServerEvent: handleAutoTranslated,
    onAnyEvent: (ev) => {
      if (ev.type === "decision_updated" && ev.messageId != null && ev.decision) {
        setDecisionOverrides((prev) => ({
          ...prev,
          [Number(ev.messageId)]: ev.decision as DecisionData,
        }));
      }
      if (ev.type === "poll_updated" && ev.messageId != null && ev.poll) {
        setPollOverrides((prev) => ({
          ...prev,
          [Number(ev.messageId)]: ev.poll as NonNullable<
            import("@fluxy-chat/sdk").FluxyChatMessage["poll"]
          >,
        }));
      }
    },
  });

  /** Guest JWT / API key can send over REST while WS is still connecting or on HTTP fallback. */
  const canSendMessages =
    connected ||
    connectionStatus === "connected" ||
    Boolean(fluxyClient?.isAuthenticated());

  useEffect(() => {
    if (!canSendMessages || !trimmedRoomId) return;
    const text = draft.trim();
    if (!text) {
      setTyping(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setTyping(true, "composing", text);
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [canSendMessages, draft, setTyping, trimmedRoomId]);

  const [reconnectTick, setReconnectTick] = useState(0);
  useEffect(() => {
    if (connectionState.status !== "reconnecting" || !connectionState.nextRetryAt) return;
    const id = window.setInterval(() => setReconnectTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [connectionState.status, connectionState.nextRetryAt]);

  const connectionLabelStatus = useMemo(() => {
    if (connectionState.status === "degraded-http") {
      if (connectionState.transport === "sse") return "sse" as const;
      if (connectionState.transport === "polling") return "polling" as const;
    }
    return connectionState.status;
  }, [connectionState.status, connectionState.transport]);

  const connectionLabel = useMemo(
    () =>
      getConnectionStatusLabel(connectionLabelStatus, {
        includeTransport: true,
        nextRetryAt: connectionState.nextRetryAt,
      }),
    [connectionLabelStatus, connectionState.nextRetryAt, reconnectTick],
  );

  const showConnectionBanner =
    !showDemoStatusBar &&
    (connectionBlocked ||
      isDegradedConnectionStatus(connectionState.status) ||
      connectionState.status === "reconnecting" ||
      (connectionState.status === "disconnected" && !connected));

  useEffect(() => {
    if (!scrollToMessageId || !historyLoaded) return;
    const el = listRef.current?.querySelector(
      `[data-message-id="${scrollToMessageId}"]`,
    );
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scrollToMessageId, historyLoaded, messages.length]);

  // Fetch pinned messages when room changes
  useEffect(() => {
    if (!fluxyClient || !trimmedRoomId || !fluxyClient.isAuthenticated()) {
      setPins([]);
      return;
    }
    fluxyClient.listRoomPins(trimmedRoomId).then((res) => {
      setPins(res.pins ?? []);
    }).catch(() => setPins([]));
  }, [fluxyClient, trimmedRoomId]);

  useRoomDraftSync({
    client: fluxyClient,
    roomId: trimmedRoomId,
    content: draft,
    replyToId: replyToId,
    enabled: showRoomDraftSync && Boolean(fluxyClient?.isAuthenticated()),
    onRestore: ({ content, replyToId: restoredReply }) => {
      setDraft((prev) => (prev.trim() ? prev : content));
      if (restoredReply != null) setReplyToId(restoredReply);
    },
  });

  useEffect(() => {
    if (!showMentionMenu || !activeRoomId) {
      setMentionSuggestions([]);
      return;
    }
    const input = textareaRef.current;
    const cursor = input?.selectionStart ?? draft.length;
    const query = detectMentionQuery(draft, cursor) ?? "";
    const local = localMentionSuggestions(query, mentionHandle);
    if (!roomAccessToken) {
      setMentionSuggestions(local);
      return;
    }
    let cancelled = false;
    void fetchMentionSuggestions(roomAccessToken, activeRoomId, query)
      .then((suggestions) => {
        if (!cancelled) setMentionSuggestions(suggestions.length ? suggestions : local);
      })
      .catch(() => {
        if (!cancelled) setMentionSuggestions(local);
      });
    return () => {
      cancelled = true;
    };
  }, [showMentionMenu, draft, roomAccessToken, activeRoomId, mentionHandle]);

  const streamingCount = useMemo(
    () => messages.filter((m) => m.streaming).length,
    [messages],
  );

  const messagesById = useMemo(() => {
    const map = new Map<number, (typeof messages)[number]>();
    for (const m of messages) {
      if (m.id != null) map.set(m.id, m);
    }
    return map;
  }, [messages]);

  const replyCountByParent = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of messages) {
      if (m.parentId != null) {
        counts.set(m.parentId, (counts.get(m.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [messages]);

  const { visibleMessages, demoHiddenCount } = useMemo(() => {
    if (!showDemoModeration) {
      return { visibleMessages: messages, demoHiddenCount: 0 };
    }
    let hidden = 0;
    const visible = messages.filter((m) => {
      if (m.userId === agentId || m.streaming) return true;
      const verdict = shouldHideDemoMessage({
        content: m.content ?? "",
        userId: m.userId ?? "",
        messageId: m.id,
        localUserId: chatUserId ?? null,
        reportedIds: reportedMessageIds,
      });
      if (verdict.hidden) {
        hidden += 1;
        return false;
      }
      return true;
    });
    return { visibleMessages: visible, demoHiddenCount: hidden };
  }, [messages, showDemoModeration, agentId, chatUserId, reportedMessageIds]);

  const replyTarget = replyToId != null ? messagesById.get(replyToId) : null;
  const branchTarget =
    branchFromMessageId != null ? messagesById.get(branchFromMessageId) : null;

  function scrollToMessage(messageId: number) {
    const el = listRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function toggleReaction(messageId: number, emoji: string) {
    // Check if user already reacted with this emoji
    const currentReactions = reactions[messageId];
    const hasReaction = currentReactions && currentReactions[emoji] > 0;
    sendReaction(messageId, emoji, hasReaction ? "remove" : "add");
  }

  function openReactionPicker(e: React.MouseEvent, messageId: number) {
    const target = e.currentTarget as HTMLElement;
    setReactionPickerAnchor(target.getBoundingClientRect());
    setReactionPickerMessageId(messageId);
  }

  const truncateFromMessage = useCallback(
    async (fromMessageId: number) => {
      const policy = canBranchFromMessage(visibleMessages, fromMessageId, chatUserId, agentId);
      if (!policy.allowed) {
        if (policy.reason === "blocked_by_other_users") {
          setBranchError("Can't edit or retry: someone else replied after this message.");
        } else {
          setBranchError("Can't edit or retry this message.");
        }
        return false;
      }
      setBranchError(null);
      try {
        await branchRoomFromMessage(fromMessageId);
        return true;
      } catch {
        setBranchError("Failed to update conversation. Try again.");
        return false;
      }
    },
    [visibleMessages, chatUserId, agentId, branchRoomFromMessage],
  );

  async function copyMessageContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      /* clipboard unavailable */
    }
  }

  function beginEditMessage(message: (typeof messages)[number]) {
    if (message.id == null) return;
    const policy = canBranchFromMessage(visibleMessages, message.id, chatUserId, agentId);
    if (!policy.allowed) {
      setBranchError(
        policy.reason === "blocked_by_other_users"
          ? "Can't edit: someone else replied after this message."
          : "Can't edit this message.",
      );
      return;
    }
    setBranchError(null);
    setBranchFromMessageId(message.id);
    setDraft(stripComposerToolTags(message.content || ""));
    setReplyToId(null);
    const toolTag = detectToolFromMessageContent(message.content || "");
    setPendingTool(toolTag ? { type: toolTag } : null);
  }

  async function retrySentMessage(message: (typeof messages)[number]) {
    if (message.id == null || !message.content?.trim()) return;
    const toolTag = detectToolFromMessageContent(message.content);
    const text = stripComposerToolTags(message.content);
    const ok = await truncateFromMessage(message.id);
    if (!ok) return;
    await executeSend({
      templateSend: null,
      text,
      parentId: message.parentId ?? null,
      attachments: [],
      tool: toolTag ? { type: toolTag } : null,
    });
  }

  async function retryAgentMessage(message: (typeof messages)[number]) {
    if (message.id == null) return;
    const idx = visibleMessages.findIndex((m) => m.id === message.id);
    const priorUser = findPriorUserMessage(visibleMessages, idx, agentId);
    const ok = await truncateFromMessage(message.id);
    if (!ok) return;
    if (!priorUser?.content?.trim()) return;
    const toolTag = detectToolFromMessageContent(priorUser.content);
    await executeSend({
      templateSend: null,
      text: stripComposerToolTags(priorUser.content),
      parentId: priorUser.parentId ?? null,
      attachments: [],
      tool: toolTag ? { type: toolTag } : null,
    });
  }

  const displayToolEvents = useMemo(() => {
    if (toolThreadEvents.length > 0) return toolThreadEvents;
    if (latestRun?.tool_calls?.length) {
      return toolCallsToThreadEvents(latestRun.id, latestRun.tool_calls);
    }
    return [];
  }, [toolThreadEvents, latestRun]);

  const displayToolUiParts = useMemo(
    () => toolThreadEventsToUiParts(displayToolEvents),
    [displayToolEvents],
  );

  const isAgentBusy = agentTyping || streamingCount > 0 || runPending;

  const workspaceSteps = useMemo(
    () =>
      buildAgentWorkspaceSteps(displayToolEvents, {
        agentTyping,
        runPending,
        runStatus: latestRun?.status ?? null,
        pendingToolType: pendingTool?.type ?? null,
        agentName,
      }),
    [displayToolEvents, agentTyping, runPending, latestRun?.status, pendingTool?.type, agentName],
  );

  const workspaceLive = useMemo(
    () => isAgentWorkspaceLive(workspaceSteps, { agentTyping, runPending }),
    [workspaceSteps, agentTyping, runPending],
  );

  const showAgentWorkspace =
    variant === "full" && (workspaceLive || workspaceSteps.length > 0);

  const showDebateThread =
    variant === "full" &&
    (debateSteps.length > 0 || isDebateSessionLive(debateSteps));

  const showVoiceStage =
    variant === "full" && voiceStage != null && voiceStage.participants.length > 0;

  const stageSelf = findStageParticipant(voiceStage, chatUserId ?? "");

  useVoiceStageVad({
    enabled: Boolean(stageSelf?.role === "speaker" && connected),
    onScore: sendVoiceStageVad,
  });

  useEffect(() => {
    if (isAgentBusy) setWorkspaceOpen(true);
  }, [isAgentBusy]);

  // ─── Run feedback ───

  function showRunFeedback(run: AgentRunDisplay) {
    const parts: string[] = [];
    if (run.id) parts.push(`run ${run.id.slice(0, 8)}…`);
    if (run.latency_ms != null) parts.push(`${run.latency_ms}ms`);
    if (run.input_tokens != null || run.output_tokens != null) {
      parts.push(`tokens ${run.input_tokens ?? 0}/${run.output_tokens ?? 0}`);
    }
    if (run.status === "failed" && run.error) parts.push(run.error);
    else if (run.status === "completed") parts.push("completed");
    setRunFeedback(parts.join(" · "));
    if (runFeedbackTimerRef.current) clearTimeout(runFeedbackTimerRef.current);
    runFeedbackTimerRef.current = setTimeout(() => setRunFeedback(null), 8_000);
  }

  const fetchLatestRunForRoom = useCallback(async (): Promise<AgentRunDisplay | null> => {
    const token = adminJwt.trim();
    if (!token || !agentId) return null;
    try {
      const json = await fetchWorkerJson<{ runs?: Record<string, unknown>[] }>(
        `${WORKER_URL}/agents/${encodeURIComponent(agentId)}/runs?limit=8`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const since = pollSinceRef.current;
      const sinceWithBuffer = since
        ? new Date(new Date(since).getTime() - 60_000).toISOString()
        : null;
      for (const row of json.runs ?? []) {
        const run = normalizeAgentRun(row);
        if (run.room_id && run.room_id !== activeRoomId) continue;
        if (sinceWithBuffer && run.created_at && run.created_at < sinceWithBuffer) continue;
        if (run.status === "completed" || run.status === "failed") return run;
      }
      return null;
    } catch {
      return null;
    }
  }, [adminJwt, agentId, activeRoomId]);

  const showCounterfactualReplay =
    variant === "full" && Boolean(agentId) && Boolean(fluxyClient?.isAuthenticated());

  const handleCounterfactualReplay = useCallback(
    async (modifiedParams: Record<string, unknown>, dryRun: boolean) => {
      if (!fluxyClient || !trimmedRoomId || !counterfactualTarget) return;
      const result = await fluxyClient.replayCounterfactual(trimmedRoomId, {
        originalRunId: counterfactualTarget.runId,
        toolCallId: counterfactualTarget.toolCall.id,
        modifiedParams,
        dryRun,
        agentId,
      });
      setCounterfactualCompare({
        original: counterfactualRunFromPayload(result.original),
        alternative: counterfactualRunFromPayload(result.run),
        toolCallId: counterfactualTarget.toolCall.id,
      });
      setCounterfactualTarget(null);
      if (result.costWarning) {
        setRunFeedback(result.costWarning);
      } else {
        showRunFeedback(counterfactualRunFromPayload(result.run));
      }
    },
    [fluxyClient, trimmedRoomId, counterfactualTarget, agentId],
  );

  useEffect(() => {
    if (!runPending || !adminJwt.trim()) return;
    let cancelled = false;

    const tick = async () => {
      const run = await fetchLatestRunForRoom();
      if (cancelled || !run) return;
      setLatestRun(run);
      setRunPending(false);
      if (run.status === "failed") {
        setInvokeError(run.error || "Agent run failed");
      }
      showRunFeedback(run);
    };

    void tick();
    const intervalId = window.setInterval(() => void tick(), RUN_POLL_MS);
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setRunPending(false);
        setInvokeError(
          (prev) =>
            prev ||
            "Assistant did not finish in time. Verify worker LLM settings (AI_BASE_URL / AI_API_KEY) and redeploy.",
        );
      }
    }, RUN_POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [runPending, adminJwt, fetchLatestRunForRoom]);

  useEffect(() => {
    if (!runPending || agentTyping) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      void fetchLatestRunForRoom().then((run) => {
        if (cancelled) return;
        if (run) {
          setLatestRun(run);
          if (run.status === "failed") {
            setInvokeError(run.error || "Agent run failed");
          }
          showRunFeedback(run);
        }
        setRunPending(false);
      });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [runPending, agentTyping, fetchLatestRunForRoom]);

  useEffect(() => {
    if (!lastAgentRun) return;
    if (lastAgentRun.room_id && lastAgentRun.room_id !== activeRoomId) return;
    const run = normalizeAgentRun(lastAgentRun as unknown as Record<string, unknown>);
    setLatestRun(run);
    setRunPending(false);
    if (run.status === "failed") {
      setInvokeError(run.error || "Agent run failed");
    }
    showRunFeedback(run);
  }, [lastAgentRun, activeRoomId]);

  useEffect(
    () => () => {
      if (runFeedbackTimerRef.current) clearTimeout(runFeedbackTimerRef.current);
    },
    [],
  );

  // ─── + menu close on outside click ───

  useEffect(() => {
    if (!plusMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [plusMenuOpen]);

  // ─── Send logic ───

  function sendResearchPrompt(mode: "deep-research" | "web-search") {
    if (!trimmedRoomId || isAgentBusy) return;
    setInputError(null);
    setPendingTool({ type: mode });
    setPlusMenuOpen(false);
  }

  function prepareImageGeneration() {
    if (!trimmedRoomId || isAgentBusy) return;
    setInputError(null);
    setImageDialogOpen(true);
    setPlusMenuOpen(false);
  }

  function beginRunTracking() {
    pollSinceRef.current = new Date().toISOString();
    setLatestRun(null);
    setInvokeError(null);
    clearToolThread();
    if (usesMentionInvoke && adminJwt.trim()) {
      setRunPending(true);
    }
  }

  function applyInvokeResult(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const row = payload as Record<string, unknown>;
    const runRaw = row.run ?? row;
    if (runRaw && typeof runRaw === "object") {
      setLatestRun(normalizeAgentRun(runRaw as Record<string, unknown>));
      const status = String((runRaw as Record<string, unknown>).status ?? "");
      if (status === "failed") {
        const err = (runRaw as Record<string, unknown>).error;
        setInvokeError(err != null ? String(err) : "Agent run failed");
      }
      showRunFeedback(normalizeAgentRun(runRaw as Record<string, unknown>));
    }
  }

  function messageSendOptions(
    templateSend: AgentRoomTemplateSelection | null,
  ): FluxySendMessageOptions | undefined {
    const base: FluxySendMessageOptions = {};
    if (templateSend) {
      base.templateId = templateSend.templateId;
      base.templateVars = templateSend.vars;
    }
    if (ephemeralTtlSeconds > 0) {
      base.expiresInSeconds = ephemeralTtlSeconds;
    }
    if (whisperMode && whisperTo.trim()) {
      base.visibility = "whisper";
      base.visibleTo = [whisperTo.trim()];
    }
    return Object.keys(base).length ? base : undefined;
  }

  async function executeSend(payload: PendingComposePayload) {
    const { templateSend, text, parentId, attachments, tool } = payload;
    if (!trimmedRoomId) return;
    if (!canSendMessages) {
      setInputError("Connecting to room… try again in a moment.");
      setRunPending(false);
      return;
    }
    if (showDemoModeration && !tool) {
      const now = Date.now();
      const elapsed = now - demoLastSendAtRef.current;
      if (elapsed < DEMO_SEND_COOLDOWN_MS) {
        setInputError(`Slow down. Wait ${Math.ceil((DEMO_SEND_COOLDOWN_MS - elapsed) / 1000)}s before sending again.`);
        setRunPending(false);
        return;
      }
      const preview = templateSend?.renderedPreview ?? text;
      const verdict = evaluateDemoMessage(preview);
      if (verdict.hidden) {
        setInputError("Message blocked by demo moderation filters.");
        setRunPending(false);
        return;
      }
      demoLastSendAtRef.current = now;
    }
    setInputError(null);
    beginRunTracking();
    const sendOpts = messageSendOptions(templateSend);

    if (branchFromMessageId != null) {
      const branched = await truncateFromMessage(branchFromMessageId);
      if (!branched) {
        setRunPending(false);
        return;
      }
      setBranchFromMessageId(null);
    }

    function clearComposer() {
      setTyping(false);
      setDraft("");
      setPendingAttachments([]);
      setPendingTool(null);
      setTemplateSelection(null);
      setReplyToId(null);
      try {
        void fluxyClient?.putRoomDraft(trimmedRoomId, { content: "", replyToId: null });
      } catch {
        /* draft sync is best-effort */
      }
    }

    try {
      if (tool?.type === "image") {
        if (!fluxyClient) return;
        if (!text) {
          setInputError("Enter an image description before sending.");
          setRunPending(false);
          return;
        }
        setImageGenerating(true);
        try {
          const result = await fluxyClient.generateAiImage(trimmedRoomId, text);
          if (!result.ok || !result.attachment) {
            if (result.error === "image_generation_disabled") {
              setInputError(
                "Image generation is disabled on this deployment. Set AI_IMAGE_GENERATION_ENABLED and AI_BASE_URL on the Worker.",
              );
            } else {
              setInputError(result.error || result.details || "Image generation failed");
            }
            setRunPending(false);
            return;
          }
          await sendMessage(
            buildImageGenerationCaption(text),
            parentId,
            [result.attachment],
            sendOpts,
          );
          clearComposer();
          onMessageSent?.();
        } catch (err: unknown) {
          setInputError(messageFromUnknown(err, "Image generation failed"));
          setRunPending(false);
        } finally {
          setImageGenerating(false);
        }
        return;
      }

      const resolvedText =
        tool?.type === "deep-research"
          ? buildDeepResearchPrompt({ topic: text, agentHandle: mentionHandle })
          : tool?.type === "web-search"
            ? buildWebSearchPrompt({ topic: text, agentHandle: mentionHandle })
            : text;

      const shouldMention = textNeedsMentionPrefix(text);

      if (shouldMention) {
        const mentionPayload = templateSend
          ? `${mentionPrefixForAgent(agentHandle)}${templateSend.renderedPreview}`.trim()
          : `${mentionPrefixForAgent(agentHandle)}${resolvedText}`.trim();
        await sendMessage(
          mentionPayload,
          parentId,
          attachments.length ? attachments : undefined,
          sendOpts,
        );
        clearComposer();
        onMessageSent?.();
        if (!adminJwt.trim()) {
          setInvokeError(
            "Admin JWT required to show run status after @mention. Paste one in Projects or use REST invoke.",
          );
        }
        return;
      }

      if (templateSend) {
        const rendered = templateSend.renderedPreview.trim();
        await sendMessage(rendered, parentId, attachments.length ? attachments : undefined, sendOpts);
      } else {
        await sendMessage(
          resolvedText,
          parentId,
          attachments.length ? attachments : undefined,
          sendOpts,
        );
      }
      clearComposer();
      onMessageSent?.();

      if (!templateSend && !usesMentionInvoke && agentId) {
        try {
          const result = await invokeAgent(resolvedText, { replyTo: parentId });
          applyInvokeResult(result);
        } catch (err: unknown) {
          const msg = messageFromUnknown(err, "Agent invoke failed");
          if (msg.includes("not started")) {
            setInputError("Connecting to room… try again in a moment.");
          } else {
            setInvokeError(msg);
          }
        }
      }
    } catch (err: unknown) {
      setRunPending(false);
      setInputError(messageFromUnknown(err, "Failed to send message"));
    }
  }

  function requestSend() {
    const templateSend = templateSelection;
    const text = templateSend ? templateSend.renderedPreview.trim() : draft.trim();
    const readyAttachments = pendingAttachments
      .filter((p) => !p.uploading && !p.error)
      .map((p) => p.attachment);
    if ((!text && readyAttachments.length === 0 && !pendingTool) || !trimmedRoomId) return;

    if (!templateSend && !pendingTool && text.startsWith("/clear")) {
      setDraft("");
      setShowSlashMenu(false);
      setReplyToId(null);
      return;
    }

    const resolvedText =
      pendingTool?.type === "deep-research"
        ? buildDeepResearchPrompt({ topic: text, agentHandle: mentionHandle })
        : pendingTool?.type === "web-search"
          ? buildWebSearchPrompt({ topic: text, agentHandle: mentionHandle })
          : text;

    const previewText =
      pendingTool?.type === "image"
        ? `Create image: ${text}`
        : usesMentionInvoke
          ? templateSend
            ? `${mentionPrefixForAgent(agentHandle)}${templateSend.renderedPreview}`.trim()
            : `${mentionPrefixForAgent(agentHandle)}${resolvedText}`.trim()
          : resolvedText;

    const modeLabel = pendingTool
      ? pendingTool.type === "image"
        ? "Create image"
        : pendingTool.type === "deep-research"
          ? "Deep research"
          : "Web search"
      : usesMentionInvoke
        ? `@${mentionHandle} mention`
        : "REST invoke";

    const payload: PendingComposePayload = {
      templateSend,
      text,
      parentId: replyToId,
      attachments: readyAttachments,
      tool: pendingTool,
    };

    if (confirmBeforeSend) {
      setPendingCompose({
        previewText,
        modeLabel,
        payload,
      });
      return;
    }

    void executeSend(payload);
  }

  function sendSuggestedPrompt(prompt: string) {
    if (!trimmedRoomId || isAgentBusy || pendingCompose) return;
    if (!canSendMessages) {
      setInputError("Connecting to room… try again in a moment.");
      return;
    }
    void executeSend({
      templateSend: null,
      text: prompt,
      parentId: null,
      attachments: [],
      tool: null,
    });
  }

  async function uploadPendingFile(file: File) {
    if (!fluxyClient || !trimmedRoomId) return;
    setUploadError(null);
    const localId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kindHint: FluxyChatAttachment["kind"] = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
        ? "audio"
        : "file";
    const placeholder = {
      attachment: {
        kind: kindHint,
        url: localId,
        name: file.name,
        sizeBytes: file.size,
      } as FluxyChatAttachment,
      uploading: true,
    };
    setPendingAttachments((prev) => [...prev, placeholder]);
    try {
      const attachment = await fluxyClient.uploadFile(trimmedRoomId, file);
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.attachment.url === localId ? { attachment, uploading: false } : p,
        ),
      );
    } catch (err: unknown) {
      const msg = messageFromUnknown(err, "Upload failed");
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.attachment.url === localId
            ? { ...p, uploading: false, error: msg }
            : p,
        ),
      );
    }
  }

  // ─── Derived state ───

  const hasUploading = pendingAttachments.some((p) => p.uploading);
  const hasReadyAttachments = pendingAttachments.some((p) => !p.uploading && !p.error);
  const canSend = Boolean(
    trimmedRoomId &&
      !isAgentBusy &&
      !pendingCompose &&
      !hasUploading &&
      !imageGenerating &&
      (templateSelection?.renderedPreview.trim() ||
        draft.trim() ||
        hasReadyAttachments) &&
      (!pendingTool || draft.trim()),
  );

  const reconnectHint =
    connectionBlocked && connectionErrorInfo
      ? `Blocked · ${connectionErrorInfo.message}`
      : connectionLabel;

  const agentAuthorContext = useMemo(
    () => ({ agentId, presenceMembers }),
    [agentId, presenceMembers],
  );

  /** Single source of truth for author display names (message header + reply quotes). */
  function resolveDisplayName(uid: string | null | undefined, maxLen = 12): string {
    const id = uid?.trim() || "";
    if (id && messageAuthorIsAgent(id, agentAuthorContext)) return agentName;
    if (chatUserId && id === chatUserId) {
      if (variant === "demo") return "You";
      return (
        clerkUser?.fullName ||
        clerkUser?.username ||
        clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "You"
      );
    }
    if (!id) return "unknown";
    return id.length > maxLen ? id.slice(0, maxLen) + "…" : id;
  }

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim() || !trimmedRoomId) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const token = adminJwt.trim();
      const baseUrl = getPublicWorkerUrl();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const useSemantic = searchMode === "hybrid" && semanticSearchAvailable !== false;

      if (useSemantic) {
        const semRes = await fetch(`${baseUrl}/search/messages/semantic`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q.trim(),
            roomId: trimmedRoomId,
            limit: 20,
            mode: "hybrid",
          }),
        });
        if (semRes.ok) {
          const json = await semRes.json();
          setSearchResults(json.results ?? []);
          return;
        }
        if (semRes.status !== 404) throw new Error(`search failed: ${semRes.status}`);
      }

      const res = await fetch(`${baseUrl}/search/messages?q=${encodeURIComponent(q)}&roomId=${encodeURIComponent(trimmedRoomId)}&limit=20`, {
        headers,
      });
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      const json = await res.json();
      setSearchResults(json.results ?? []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [trimmedRoomId, adminJwt, searchMode, semanticSearchAvailable]);

  // ─── Render ───

  const isOnboarding = variant === "onboarding";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3",
        isOnboarding && "max-h-[min(520px,72vh)]",
        className,
      )}
    >
      {showConnectionBanner ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            connectionBlocked
              ? "border-red-200 bg-red-50 text-red-900"
              : isDegradedConnectionStatus(connectionState.status)
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-slate-50 text-slate-800",
          )}
        >
          <span className="font-medium">{reconnectHint}</span>
          {connectionState.status === "degraded-http" && connectionState.canPublishViaHttp ? (
            <span className="ml-2 opacity-80">· Messages still send via HTTP</span>
          ) : null}
        </div>
      ) : null}
      {shouldBootstrapAssistant && !activeRoomId ? (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Opening assistant room…
          </span>
        </div>
      ) : null}
      {roomBootstrapError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
        >
          {roomBootstrapError}
        </div>
      ) : null}
      {syncStatus === "pending" || syncStatus === "offline" ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {syncStatus === "offline" ? "Offline" : "Syncing"}
          {pendingOutboxCount > 0
            ? ` · ${pendingOutboxCount} message${pendingOutboxCount === 1 ? "" : "s"} queued`
            : " · changes will sync when reconnected"}
        </div>
      ) : null}
      {/* Status bar */}
      {showDemoStatusBar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2">
              <span className={cn("relative inline-flex size-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
            </span>
            <span className="font-medium text-foreground">
              {connected ? "Connected" : connectionLabel}
            </span>
            <span className="text-muted-foreground">· public demo room</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            Be respectful · rate-limited guest session
            {demoHiddenCount > 0 ? ` · ${demoHiddenCount} filtered` : ""}
          </span>
        </div>
      ) : (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted/60"
            onClick={() => setSearchOpen(!searchOpen)}
            title="Search messages"
          >
            <Search className="size-3" aria-hidden />
            {searchOpen ? "Close" : "Search"}
          </button>
          {activeRoomId && roomAccessToken && showRoomInfo ? (
            <>
              <span className="mx-1.5 text-muted-foreground/40">|</span>
              <RoomInfoToggle onClick={() => setRoomInfoOpen((open) => !open)} />
            </>
          ) : null}
          <span className="mx-1.5 text-muted-foreground/40">|</span>
          Room <code className="font-mono">{activeRoomId || trimmedRoomId || ""}</code>
          {usesMentionInvoke ? (
            <span className="ml-2 text-brand">· @{mentionHandle} mention invoke</span>
          ) : (
            <span className="ml-2">· REST invoke</span>
          )}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[10px]">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={skipHistoryOnConnect}
            onChange={(e) => {
              const next = e.target.checked;
              setSkipHistoryOnConnect(next);
              try {
                localStorage.setItem(SKIP_HISTORY_STORAGE_KEY, next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          />
          Skip history on connect
        </label>
        <span>
          {reconnectHint}
          {connected ? " · live" : ""}
          {Object.entries(typingUsers)
            .filter(([, v]) => v)
            .map(([uid]) => {
              const intent = typingIntents[uid] ?? "composing";
              return (
                <span key={uid} className="ml-2 text-brand">
                  · {uid} ({intent})
                </span>
              );
            })}
          {skipHistoryOnConnect && !historyLoaded ? (
            <button
              type="button"
              className="ml-2 text-brand underline underline-offset-2"
              onClick={() => void loadHistory()}
            >
              Load history
            </button>
          ) : null}
          {isAgentBusy ? (
            <span className="ml-2 inline-flex items-center gap-1 text-brand">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {agentName}
              {streamingCount > 0
                ? " streaming…"
                : runPending
                  ? " running…"
                  : " thinking…"}
            </span>
          ) : null}
        </span>
      </div>
      )}

      {/* Search panel */}
      {showMessageSearch && searchOpen ? (
        <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                searchTimeoutRef.current = setTimeout(() => void handleSearch(e.target.value), 300);
              }}
              placeholder="Search messages..."
              className="w-full rounded-md border border-border bg-muted/30 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          {semanticSearchAvailable ? (
            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
              <label className="inline-flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="room-search-mode"
                  checked={searchMode === "hybrid"}
                  onChange={() => setSearchMode("hybrid")}
                />
                Hybrid semantic
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="room-search-mode"
                  checked={searchMode === "keyword"}
                  onChange={() => setSearchMode("keyword")}
                />
                Keyword
              </label>
            </div>
          ) : null}
          {searching ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted/60"
                  onClick={() => {
                    const el = document.getElementById(`msg-${r.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    setSearchOpen(false);
                  }}
                >
                  <span className="font-medium text-foreground">{r.userId}</span>{" "}
                  <span className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  <div className="mt-0.5 leading-relaxed text-muted-foreground">
                    {r.snippet ? (
                      <SearchSnippet snippet={r.snippet} />
                    ) : (
                      r.content
                    )}
                    {typeof r.score === "number" ? (
                      <span className="ml-1 text-brand">· {(r.score * 100).toFixed(0)}% match</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery && !searching ? (
            <div className="mt-2 text-xs text-muted-foreground">No results found.</div>
          ) : null}
        </div>
      ) : null}

      {runFeedback ? (
        <div
          className="rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-xs text-foreground"
          role="status"
          data-testid="agent-run-feedback"
        >
          {runFeedback}
        </div>
      ) : null}

      <AgentRunStatus
        run={latestRun}
        pending={runPending}
        compact={showAgentWorkspace && workspaceSteps.length > 0}
        onTryAlternative={
          showCounterfactualReplay && latestRun?.tool_calls?.length
            ? (toolCall) => {
                if (!latestRun?.id) return;
                setCounterfactualCompare(null);
                setCounterfactualTarget({ runId: latestRun.id, toolCall });
              }
            : undefined
        }
      />

      {counterfactualTarget ? (
        <CounterfactualReplayPanel
          runId={counterfactualTarget.runId}
          toolCall={counterfactualTarget.toolCall}
          sideEffectHint={isSideEffectToolName(counterfactualTarget.toolCall.name)}
          onCancel={() => setCounterfactualTarget(null)}
          onReplay={handleCounterfactualReplay}
        />
      ) : null}

      {counterfactualCompare ? (
        <CounterfactualCompare
          original={counterfactualCompare.original}
          alternative={counterfactualCompare.alternative}
          toolCallId={counterfactualCompare.toolCallId}
          className="mb-2"
        />
      ) : null}

      {showVoiceStage && voiceStage && chatUserId ? (
        <VoiceStagePanel
          stage={voiceStage}
          currentUserId={chatUserId}
          className="mb-1"
          onJoin={(role) => joinVoiceStage(role, chatUserId)}
          onLeave={leaveVoiceStage}
          onPromote={promoteVoiceStageListener}
        />
      ) : null}

      {showDebateThread ? (
        <DebateThreadPanel
          steps={debateSteps}
          sessionId={debateSessionId}
          className="mb-1"
        />
      ) : null}

      {showAgentWorkspace ? (
        <AgentWorkspacePanel
          steps={workspaceSteps}
          run={latestRun}
          isLive={workspaceLive}
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
          className="mb-1"
        />
      ) : null}

      {showHandoffBanner ? (
        <AgentHandoffBanner
          roomId={trimmedRoomId}
          agentId={agentId}
          agentName={agentName}
          operatorJwt={adminJwt}
        />
      ) : null}

      {showPresenceStrip ? (
        <ChatPresenceStrip
          members={presenceMembers}
          subscriptionCount={subscriptionCount}
        />
      ) : null}

      {showCatchUpBanner ? (
        <ChatCatchUpBanner
          client={fluxyClient}
          roomId={trimmedRoomId}
          messages={messages}
          listRef={listRef}
          loadMore={loadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onMarkRead={sendReadReceipt}
        />
      ) : null}

      {variant === "full" && (adminJwt.trim() || memberJwt.trim()) && trimmedRoomId ? (
        <EuConsentBanner token={adminJwt.trim() || memberJwt.trim()} roomId={trimmedRoomId} />
      ) : null}

      {variant === "full" && adminJwt.trim() && trimmedRoomId ? (
        <MergeConflictPanel
          token={adminJwt.trim()}
          roomId={trimmedRoomId}
          onResolved={() => void loadHistory()}
        />
      ) : null}

      {/* Pinned messages */}
      {showPinnedBar ? (
      <PinnedMessagesBar
        pins={pins as Array<{
          id: string;
          messageId: number;
          pinnedBy: string;
          category: string;
          sortOrder: number;
          createdAt: string;
          message: { content: string; userId: string; createdAt: string };
        }>}
        onUnpin={async (messageId) => {
          if (!fluxyClient || !trimmedRoomId) return;
          await fluxyClient.unpinRoomMessage(trimmedRoomId, messageId);
          setPins((prev) => prev.filter((p: any) => p.messageId !== messageId));
        }}
        onJumpToMessage={(messageId) => {
          const el = listRef.current?.querySelector(`[data-message-id="${messageId}"]`);
          if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
        canManage={!!localUserId}
      />
      ) : null}

      {/* Breakout rooms */}
      {showBreakouts ? (
      <BreakoutPanel
        breakouts={breakouts}
        onCreate={async (name) => {
          if (!fluxyClient || !trimmedRoomId) return;
          await fluxyClient.createBreakout(trimmedRoomId, name);
          await fetchBreakouts();
        }}
        onClose={async (breakoutId) => {
          if (!fluxyClient || !trimmedRoomId) return;
          await fluxyClient.closeBreakout(trimmedRoomId, breakoutId);
          await fetchBreakouts();
        }}
        canManage={!!localUserId}
      />
      ) : null}

      {/* ─── Message scroller ─── */}
      <MessageScrollerProvider autoScroll scrollPreviousItemPeek={64}>
        <MessageScroller
          className={cn(
            "h-[min(420px,50vh)] scroll-fade-b rounded-xl border border-border bg-muted/30",
            variant === "demo" && "h-[min(480px,58vh)] border-border/80 bg-[#F4F4F5]",
            isOnboarding && "h-[min(200px,26vh)] shrink-0 border-border/80 bg-muted/20",
          )}
          data-testid="fluxychat-message-list"
        >
          <MessageScrollerViewport className="overflow-x-visible p-3 scroll-fade" ref={listRef}>
            <MessageScrollerContent className="gap-2">
              {visibleMessages.length ? (
                visibleMessages.map((m, idx) => {
                  const isLastMessage = idx === visibleMessages.length - 1;
                  const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                  const mTime = (m as { createdAt?: string }).createdAt;
                  const prevTime = prev ? (prev as { createdAt?: string }).createdAt : undefined;
                  const showDate = !prevTime || !mTime || !isSameDay(prevTime, mTime);

                  const author = m.userId?.trim() || "unknown";
                  const isAgent = messageAuthorIsAgent(author, agentAuthorContext);
                  const isSelf = Boolean(chatUserId && m.userId === chatUserId);
                  const isStreaming = Boolean(m.streaming);
                  const isVoice = m.kind === "voice";
                  const parentId = m.parentId ?? null;

                  // Display name: Clerk user for self, truncated ID for others, agentName for agent
                  const displayName = resolveDisplayName(author, 10);
                  const align: "start" | "end" = isSelf ? "end" : "start";
                  const bubbleVariant = isSelf ? ("sent" as const) : ("received" as const);
                  const parentMessage = m.parentId != null ? messagesById.get(m.parentId) ?? null : null;
                  const showHeader = !prev || prev.userId !== m.userId || showDate;
                  const visibilityBadge = messageVisibilityBadge(m, agentId);
                  const hasReactions = m.id != null && reactions[m.id] && Object.keys(reactions[m.id]).length > 0;
                  const branchPolicy =
                    m.id != null
                      ? canBranchFromMessage(visibleMessages, m.id, chatUserId, agentId)
                      : { allowed: false as const };

                  const floatingToolbar = m.id != null && !isStreaming ? (
                    <MessageHoverToolbar align={isSelf ? "end" : "start"} side="below">
                      <MessageAction
                        label="Copy"
                        onClick={() => void copyMessageContent(m.content || "")}
                      >
                        <Copy className="size-3.5" />
                      </MessageAction>
                      {isSelf && branchPolicy.allowed ? (
                        <>
                          <MessageAction
                            label="Edit"
                            onClick={() => beginEditMessage(m)}
                          >
                            <Pencil className="size-3.5" />
                          </MessageAction>
                          <MessageAction
                            label="Retry"
                            onClick={() => void retrySentMessage(m)}
                          >
                            <RotateCw className="size-3.5" />
                          </MessageAction>
                        </>
                      ) : isAgent && branchPolicy.allowed ? (
                        <MessageAction
                          label="Retry"
                          onClick={() => void retryAgentMessage(m)}
                        >
                          <RotateCw className="size-3.5" />
                        </MessageAction>
                      ) : null}
                      {showPinnedBar && fluxyClient && trimmedRoomId ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (m.id == null) return;
                            try {
                              await fluxyClient.pinRoomMessage(trimmedRoomId, m.id);
                              const res = await fluxyClient.listRoomPins(trimmedRoomId);
                              setPins(res.pins ?? []);
                            } catch {
                              /* ignore */
                            }
                          }}
                          className={messageToolbarButtonClass}
                          title="Pin message"
                        >
                          <Pin className="size-3" />
                          Pin
                        </button>
                      ) : null}
                      {fluxyClient ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (m.id == null) return;
                            try {
                              const res = await fluxyClient.translateMessage(
                                m.id,
                                viewerTranslationLang,
                              );
                              const tr = res.translation;
                              if (tr?.translatedText) {
                                setTranslatedMessages((p) => ({
                                  ...p,
                                  [String(m.id)]: {
                                    translatedText: tr.translatedText,
                                    targetLang: tr.targetLang ?? viewerTranslationLang,
                                    sourceLang: tr.sourceLang ?? null,
                                    cached: res.cached,
                                  },
                                }));
                                setShowOriginalByMessageId((p) => ({
                                  ...p,
                                  [String(m.id)]: false,
                                }));
                              }
                            } catch {
                              /* ignore */
                            }
                          }}
                          className={messageToolbarButtonClass}
                          title={`Translate to ${viewerTranslationLang.toUpperCase()}`}
                        >
                          <Languages className="size-3" />
                          Translate
                        </button>
                      ) : null}
                      {fluxyClient && trimmedRoomId ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (m.id == null) return;
                            try {
                              await fluxyClient.reportMessage(trimmedRoomId, m.id);
                              setReportedMessageIds((prev) => {
                                const next = new Set(prev);
                                next.add(m.id!);
                                return next;
                              });
                            } catch {
                              /* ignore */
                            }
                          }}
                          className={messageToolbarButtonClass}
                          title="Report message"
                        >
                          <Flag className="size-3" />
                          Report
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => openReactionPicker(e, m.id!)}
                        className={messageToolbarIconButtonClass}
                        aria-label="Add reaction"
                      >
                        <Smile className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyToId(m.id!)}
                        className={messageToolbarButtonClass}
                      >
                        <Reply className="size-3" />
                        Reply
                      </button>
                    </MessageHoverToolbar>
                  ) : null;

                  return (
                    <React.Fragment key={m.id}>
                      {showDate && mTime ? (
                        <MessageScrollerItem>
                          <Marker variant="separator">
                            <MarkerContent>{formatDateLabel(mTime)}</MarkerContent>
                          </Marker>
                        </MessageScrollerItem>
                      ) : null}
                      <MessageScrollerItem
                        messageId={String(m.id)}
                        scrollAnchor={isLastMessage}
                        className={isStreaming ? "animate-in fade-in-0 duration-300" : undefined}
                      >
                        <div
                          id={m.id != null ? `msg-${m.id}` : undefined}
                          data-testid={isStreaming ? "agent-message-streaming" : "agent-message"}
                          data-streaming={isStreaming ? "true" : undefined}
                          data-message-id={m.id != null ? String(m.id) : undefined}
                        >
                          <Message align={align} className="gap-2">
                            {/* Avatar — top-aligned, beside bubble, clickable for non-agent */}
                            <MessageAvatar
                              status={isAgent ? "online" : null}
                              className={cn(
                                "size-8 shrink-0 self-start overflow-hidden rounded-full",
                                !isAgent && "cursor-pointer",
                              )}
                              {...(!isAgent && m.userId ? { onClick: () => router.push(`/users/${encodeURIComponent(m.userId!)}`) } : {})}
                            >
                              <ChatAvatar
                                isAgent={isAgent}
                                isSelf={isSelf}
                                displayName={displayName}
                                clerkImageUrl={isSelf ? clerkUser?.imageUrl : null}
                                userId={m.userId}
                              />
                            </MessageAvatar>

                            <MessageContent>
                              {/* Header — hidden for consecutive messages from same user */}
                              {showHeader ? (
                              <MessageHeader
                                className={cn("px-0 mb-1", isSelf && "justify-end")}
                              >
                                <span className="text-sm font-semibold text-foreground">
                                  {displayName}
                                </span>
                                {isAgent ? (
                                  <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand ring-1 ring-brand/20">
                                    agent
                                  </span>
                                ) : null}
                                {visibilityBadge ? (
                                  <span
                                    className={cn(
                                      "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1",
                                      visibilityBadge.scoped
                                        ? "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-200"
                                        : "bg-muted text-muted-foreground ring-border",
                                    )}
                                  >
                                    {visibilityBadge.label}
                                  </span>
                                ) : null}
                                {isStreaming ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                                    </span>
                                    streaming
                                  </span>
                                ) : null}
                              </MessageHeader>
                              ) : null}

                              <Bubble
                                variant={bubbleVariant}
                                align={align}
                                className={cn(isSelf ? sentBubbleClass : receivedBubbleClass, hasReactions && "mb-5")}
                              >
                                {floatingToolbar}
                                <BubbleContent className={bubbleContentPadding}>
                                  {/* Reply quote — inside bubble, before message text */}
                                  {parentMessage ? (
                                    <button
                                      type="button"
                                      onClick={() => parentMessage.id != null && scrollToMessage(parentMessage.id)}
                                      className={cn(
                                        "mb-2 block w-full overflow-hidden rounded-md border-l-[3px] px-2.5 py-1.5 text-left text-xs",
                                        isSelf
                                          ? "border-white/60 bg-black/15 text-white/85"
                                          : "border-border bg-foreground/5 text-foreground/80",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "mb-0.5 block text-[11px] font-semibold",
                                          isSelf ? "text-white/95" : "text-foreground",
                                        )}
                                      >
                                        {resolveDisplayName(parentMessage.userId)}
                                      </span>
                                      <span className="line-clamp-2">{parentMessage.content || ""}</span>
                                    </button>
                                  ) : null}

                                    {/* Tool badge — derived from the message content itself, not the
                                        live composer state (the old check made badges on historical
                                        messages appear/disappear as the composer tool changed) */}
                                    {m.content?.includes("[deep-research]") ? (
                                      <span
                                        className={cn(
                                          "mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                          isSelf ? "bg-white/15 text-white" : "bg-[var(--fluxy-mention-bg)] text-[var(--fluxy-mention-text)]",
                                        )}
                                      >
                                        <BrainCircuit className="size-3" /> Deep Research
                                      </span>
                                    ) : null}
                                    {m.content?.includes("[web-search]") ? (
                                      <span
                                        className={cn(
                                          "mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                          isSelf ? "bg-white/15 text-white" : "bg-[var(--fluxy-mention-bg)] text-[var(--fluxy-mention-text)]",
                                        )}
                                      >
                                        <Globe className="size-3" /> Web Search
                                      </span>
                                    ) : null}

                                    {/* Voice message */}
                                    {isVoice ? (
                                      <VoiceMessageBubble
                                        message={m}
                                        className={isSelf ? "items-end" : "items-start"}
                                        inheritColor={isSelf}
                                        authToken={adminJwt.trim() || memberJwt.trim() || null}
                                      />
                                    ) : (
                                      <>
                                        {(() => {
                                          const card = parseCardFromMessage(m);
                                          if (card) {
                                            return (
                                              <InteractiveCardRenderer
                                                card={card}
                                                className={isSelf ? "border-white/20 bg-white/10" : undefined}
                                              />
                                            );
                                          }
                                          const bodyText = cardDisplayText(m);
                                          const useMarkdown =
                                            isAgent ||
                                            (!isSelf && messageContentUsesMarkdown(bodyText));
                                          return useMarkdown ? (
                                            <MarkdownBody
                                              content={bodyText}
                                              invert={isSelf}
                                            />
                                          ) : m.id != null && translatedMessages[String(m.id)] ? (
                                            <MessageTranslationBlock
                                              originalText={cardDisplayText(m)}
                                              translation={translatedMessages[String(m.id)]}
                                              showOriginal={showOriginalByMessageId[String(m.id)] ?? false}
                                              onToggle={() =>
                                                setShowOriginalByMessageId((prev) => ({
                                                  ...prev,
                                                  [String(m.id)]: !(prev[String(m.id)] ?? false),
                                                }))
                                              }
                                              isSelf={isSelf}
                                            />
                                          ) : (
                                            <p className="whitespace-pre-wrap break-words">
                                              {cardDisplayText(m)}
                                              {!m.content && isStreaming ? "…" : null}
                                            </p>
                                          );
                                        })()}
                                        {isStreaming ? (
                                          <span
                                            className={cn(
                                              "ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle",
                                              isSelf ? "bg-white/70" : "bg-foreground/50",
                                            )}
                                            aria-hidden
                                          />
                                        ) : null}
                                      </>
                                    )}

                                    {/* Link preview */}
                                    {m.preview?.url ? (
                                      <LinkPreviewCard
                                        url={m.preview.url}
                                        title={m.preview.title}
                                        description={m.preview.description}
                                        image={m.preview.imageUrl}
                                        aiSummary={m.preview.aiSummary}
                                      />
                                    ) : null}

                                    {/* Poll */}
                                    {(() => {
                                      const pollData =
                                        (m.id != null ? pollOverrides[m.id as number] : undefined) ?? m.poll;
                                      if (!pollData) return null;
                                      return (
                                        <PollView
                                          poll={{
                                            id: String(m.id),
                                            question: pollData.question,
                                            options: pollData.options.map((o) => ({
                                              id: String(o.index),
                                              text: o.text,
                                              votes: o.votes,
                                            })),
                                            totalVotes: pollData.totalVoters,
                                            userVote:
                                              pollData.userVote != null
                                                ? String(pollData.userVote)
                                                : null,
                                            closed: pollData.closed,
                                            type: pollData.allowMultiple ? "multi" : "single",
                                          }}
                                          onVote={async (optionId) => {
                                            if (m.id == null || !fluxyClient) return;
                                            const res = await fluxyClient.votePoll(
                                              m.id as number,
                                              Number(optionId),
                                            );
                                            if (res.poll) {
                                              setPollOverrides((prev) => ({
                                                ...prev,
                                                [m.id as number]: res.poll as NonNullable<
                                                  import("@fluxy-chat/sdk").FluxyChatMessage["poll"]
                                                >,
                                              }));
                                            }
                                          }}
                                          onClose={
                                            localUserId === m.userId
                                              ? async () => {
                                                  if (m.id == null || !fluxyClient) return;
                                                  const res = await fluxyClient.closePoll(m.id as number);
                                                  if (res.poll) {
                                                    setPollOverrides((prev) => ({
                                                      ...prev,
                                                      [m.id as number]: res.poll as NonNullable<
                                                        import("@fluxy-chat/sdk").FluxyChatMessage["poll"]
                                                      >,
                                                    }));
                                                  }
                                                }
                                              : undefined
                                          }
                                          canManage={localUserId === m.userId}
                                        />
                                      );
                                    })()}

                                    {/* Decision quorum */}
                                    {(() => {
                                      const d =
                                        (m.id != null ? decisionOverrides[m.id as number] : undefined) ??
                                        m.decision;
                                      if (!d) return null;
                                      return (
                                        <DecisionView
                                          decision={d as DecisionData}
                                          currentUserId={localUserId}
                                          onAck={async () => {
                                            if (!fluxyClient || m.id == null) return;
                                            const res = await fluxyClient.ackDecision(m.id as number);
                                            if (res.decision) {
                                              setDecisionOverrides((prev) => ({
                                                ...prev,
                                                [m.id as number]: res.decision as unknown as DecisionData,
                                              }));
                                            }
                                          }}
                                        />
                                      );
                                    })()}

                                    {/* Delivery status */}
                                    {m.deliveryStatus === "pending" ? (
                                      <div className={cn("mt-1 text-[10px]", isSelf ? "text-white/70" : "text-muted-foreground")}>
                                        Sending…
                                      </div>
                                    ) : null}
                                    {m.deliveryConflict ? (
                                      <div className={cn("mt-1 text-[10px] font-medium", isSelf ? "text-amber-200" : "text-amber-700")}>
                                        Server version differs from your draft (conflict resolved)
                                      </div>
                                    ) : null}
                                    {m.deliveryStatus === "failed" ? (
                                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-destructive">
                                        Failed to send
                                        {m.clientMessageId ? (
                                          <button
                                            type="button"
                                            className="ml-0.5 rounded px-1 text-[10px] text-destructive hover:bg-destructive/10"
                                            onClick={() => retryMessage(m.clientMessageId!)}
                                          >
                                            Retry
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {/* Edited */}
                                    {m.editedAt && !isStreaming ? (
                                      <div className={cn("mt-1 text-[10px]", isSelf ? "text-white/60" : "text-muted-foreground")}>
                                        edited
                                      </div>
                                    ) : null}

                                    {/* Timestamp + read receipt — inside bubble, WhatsApp style */}
                                    <div className="mt-1 flex items-center justify-end gap-1">
                                      {mTime ? (
                                        <time
                                          dateTime={mTime}
                                          className={cn(
                                            "select-none text-[10px] leading-none tabular-nums",
                                            isSelf ? "text-white/65" : "text-muted-foreground",
                                          )}
                                        >
                                          {new Date(mTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                                        </time>
                                      ) : null}
                                      {isSelf ? (
                                        <span
                                          className={cn(
                                            "text-[10px] leading-none -tracking-[1px]",
                                            m.deliveryStatus === "pending" ? "text-white/35" : "text-white/65",
                                          )}
                                          aria-label={m.deliveryStatus === "pending" ? "Sending" : "Sent"}
                                        >
                                          {m.deliveryStatus === "pending" ? "○" : "✓"}
                                        </span>
                                      ) : null}
                                    </div>
                                  </BubbleContent>

                                  {/* Reactions — using shadcn BubbleReactions */}
                                  {m.id != null && reactions[m.id] && Object.keys(reactions[m.id]).length > 0 ? (
                                    <BubbleReactions
                                      side="bottom"
                                      align={isSelf ? "end" : "start"}
                                    >
                                      {Object.entries(reactions[m.id]).map(([emoji, count]) => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => m.id != null && toggleReaction(m.id, emoji)}
                                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-100"
                                        >
                                          <span>{emoji}</span>
                                          <span className="text-slate-500">{count}</span>
                                        </button>
                                      ))}
                                    </BubbleReactions>
                                  ) : null}
                              </Bubble>

                              {/* Attachments */}
                              {m.attachments && m.attachments.length > 0 ? (
                                <div className="mt-1 flex flex-col gap-2">
                                  {m.attachments.map((a) => (
                                    <FluxyAttachment
                                      key={a.url}
                                      attachment={a}
                                      mediaBaseUrl={WORKER_URL}
                                      authToken={adminJwt.trim() || memberJwt.trim() || null}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              {/* Thread summary */}
                              {trimmedRoomId && m.id && !parentId && !isStreaming ? (
                                <ThreadSummary
                                  roomId={trimmedRoomId}
                                  messageId={m.id}
                                  replyCount={m.id != null ? replyCountByParent.get(m.id) ?? 0 : 0}
                                  className="mt-2"
                                />
                              ) : null}
                            </MessageContent>
                          </Message>
                        </div>
                      </MessageScrollerItem>
                    </React.Fragment>
                  );
                })
              ) : isOnboarding ? (
                <MessageScrollerItem>
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="size-5" aria-hidden />
                    </div>
                    <p className="text-sm font-medium text-foreground">Your room is ready</p>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                      Type in the box below and press Enter. Mention{" "}
                      <span className="font-medium text-foreground">@{agentHandle ?? "assistant"}</span>{" "}
                      to talk to the AI.
                    </p>
                  </div>
                </MessageScrollerItem>
              ) : (
                <MessageScrollerItem>
                  <Marker>
                    <MarkerIcon>
                      <Loader2 className="size-3 animate-spin" />
                    </MarkerIcon>
                    <MarkerContent>
                      Ask {agentName}. Replies stream over WebSocket; tool calls appear inline when
                      the agent uses tools.
                    </MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              )}

              {/* Tool approvals (HITL) */}
              {showHitlApprovals && trimmedRoomId ? (
                <ToolApprovalPanel roomId={trimmedRoomId} enabled={showHitlApprovals} />
              ) : null}

              {/* Tool events — AG-UI renderer (roadmap #5) */}
              {displayToolUiParts.length > 0 ? (
                <MessageScrollerItem>
                  <div className="mx-6 rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Agent tools
                    </p>
                    <AgentUiRenderer parts={displayToolUiParts} />
                  </div>
                </MessageScrollerItem>
              ) : displayToolEvents.map((ev) => (
                <MessageScrollerItem key={ev.key}>
                  <AgentToolThreadCard event={ev} />
                </MessageScrollerItem>
              ))}

              {/* Streaming status markers */}
              {runPending && displayToolEvents.length === 0 ? (
                <MessageScrollerItem>
                  <Marker role="status">
                    <MarkerIcon>
                      <Loader2 className="size-3 animate-spin" />
                    </MarkerIcon>
                    <MarkerContent className="shimmer">Waiting for agent tool rounds…</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}

              {pendingTool?.type === "deep-research" && isAgentBusy ? (
                <MessageScrollerItem>
                  <Marker role="status">
                    <MarkerIcon>
                      <BrainCircuit className="size-3 text-[var(--fluxy-cta-color)]" />
                    </MarkerIcon>
                    <MarkerContent className="shimmer">Researching…</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}

              {pendingTool?.type === "web-search" && isAgentBusy ? (
                <MessageScrollerItem>
                  <Marker role="status">
                    <MarkerIcon>
                      <Globe className="size-3 text-[var(--fluxy-cta-color)]" />
                    </MarkerIcon>
                    <MarkerContent className="shimmer">Searching…</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}

              {/* Typing indicator */}
              <MessageScrollerItem>
                <TypingIndicator
                  visible={Boolean(agentTyping && !isAgentBusy)}
                  name={agentName}
                  avatar={
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {agentName.charAt(0).toUpperCase()}
                    </div>
                  }
                />
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <MessageScrollerButton />
          </div>
        </MessageScroller>
      </MessageScrollerProvider>

      {/* ─── Branch edit banner ─── */}
      {branchFromMessageId != null ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
          data-testid="branch-edit-compose-banner"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium text-amber-700 dark:text-amber-400">Editing message</span>{" "}
            <span className="text-muted-foreground">
              {branchTarget
                ? `${displayUserId(branchTarget)}: ${(branchTarget.content || "").slice(0, 80)}`
                : `#${branchFromMessageId}`}
              {" — "}
              sending will replace this message and everything after it
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => setBranchFromMessageId(null)}
            aria-label="Cancel edit"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ─── Reply banner ─── */}
      {replyToId != null ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs"
          data-testid="reply-compose-banner"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium text-brand">Replying to</span>{" "}
            <span className="text-muted-foreground">
              {replyTarget
                ? `${displayUserId(replyTarget)}: ${(replyTarget.content || "").slice(0, 80)}`
                : `#${replyToId}`}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => setReplyToId(null)}
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {branchError ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          data-testid="branch-error-banner"
        >
          <span className="min-w-0 flex-1">{branchError}</span>
          <button
            type="button"
            className="shrink-0 rounded p-1 hover:bg-destructive/10"
            onClick={() => setBranchError(null)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ─── Template picker ─── */}
      {showTemplates ? (
        <AgentRoomTemplatePicker
          adminJwt={adminJwt}
          disabled={!trimmedRoomId || isAgentBusy}
          value={templateSelection}
          onChange={setTemplateSelection}
        />
      ) : null}

      {/* ─── Co-pilot confirm ─── */}
      {showCopilotConfirm && pendingCompose ? (
        <AgentCopilotConfirm
          previewText={pendingCompose.previewText}
          modeLabel={pendingCompose.modeLabel}
          busy={isAgentBusy}
          onEdit={() => setPendingCompose(null)}
          onConfirm={() => {
            const payload = pendingCompose.payload;
            setPendingCompose(null);
            void executeSend(payload);
          }}
        />
      ) : null}

      {/* ─── Options row ─── */}
      {showCopilotConfirm ? (
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={confirmBeforeSend}
            onChange={(e) => setConfirmBeforeSend(e.target.checked)}
            disabled={Boolean(pendingCompose)}
          />
          Confirm before send
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={whisperMode}
            onChange={(e) => setWhisperMode(e.target.checked)}
          />
          Whisper to
          <Input
            value={whisperTo}
            onChange={(e) => setWhisperTo(e.target.value)}
            placeholder="user id"
            className="h-7 w-28 px-1.5 text-xs"
            disabled={!whisperMode}
          />
        </label>
        <label className="flex items-center gap-1.5">
          Ephemeral
          <select
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
            value={ephemeralTtlSeconds}
            onChange={(e) => setEphemeralTtlSeconds(Number(e.target.value))}
            disabled={isAgentBusy}
          >
            <option value={0}>Off</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>24 hours</option>
          </select>
        </label>
      </div>
      ) : null}

      {/* ─── Reply suggestions ─── */}
      {showReplySuggestions && !draft.trim() && messages.length > 0 && trimmedRoomId && !isAgentBusy ? (
        <ReplySuggestions
          roomId={trimmedRoomId}
          parentId={replyToId}
          onSelect={(s) => {
            setDraft(s);
            setReplyToId(null);
          }}
        />
      ) : null}

      {/* ─── Suggested prompts (onboarding / demo) ─── */}
      {showSuggestedPrompts && messages.length === 0 && !draft.trim() && !pendingCompose ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {suggestedPrompts!.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={!connected || isAgentBusy}
              onClick={() => sendSuggestedPrompt(prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 text-primary/60" aria-hidden />
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      {/* ─── Hidden file input ─── */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          await Promise.all(files.map((file) => uploadPendingFile(file)));
        }}
      />

      {/* ─── Pending attachments / tool chips ─── */}
      {(pendingAttachments.length > 0 || pendingTool) && !pendingCompose ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          {pendingTool ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fluxy-mention-bg)] px-2.5 py-1 text-xs font-medium text-[var(--fluxy-mention-text)]">
              {pendingTool.type === "image" ? (
                <FileImage className="size-3.5" aria-hidden />
              ) : pendingTool.type === "deep-research" ? (
                <BrainCircuit className="size-3.5" aria-hidden />
              ) : (
                <Globe className="size-3.5" aria-hidden />
              )}
              {pendingTool.type === "image"
                ? "Create image"
                : pendingTool.type === "deep-research"
                  ? "Deep Research active"
                  : "Web Search active"}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-[var(--fluxy-mention-bg)]"
                onClick={() => setPendingTool(null)}
                aria-label="Remove tool"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ) : null}
          {pendingAttachments.map((p, idx) => (
            <span
              key={p.attachment.url}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                p.error
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground",
              )}
              title={p.error}
            >
              {p.uploading ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : p.attachment.kind === "image" ? (
                <FileImage className="size-3" aria-hidden />
              ) : (
                <Paperclip className="size-3" aria-hidden />
              )}
              <span className="truncate">{p.attachment.name}</span>
              {!p.uploading ? (
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted-foreground/20"
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove attachment"
                >
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {/* ─── Composer with + menu ─── */}
      <Composer
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend) return;
          void requestSend();
        }}
        className="relative"
      >
        {/* Deep Research / Web Search chips above textarea */}
        {pendingTool?.type === "deep-research" || pendingTool?.type === "web-search" ? (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fluxy-mention-bg)] px-2.5 py-1 text-xs font-medium text-[var(--fluxy-mention-text)]">
              {pendingTool.type === "deep-research" ? (
                <>
                  <BookOpen className="size-3" />
                  Deep Research active
                </>
              ) : (
                <>
                  <Globe className="size-3" />
                  Web Search active
                </>
              )}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-[var(--fluxy-mention-bg)]"
                onClick={() => setPendingTool(null)}
                aria-label="Remove tool"
              >
                <X className="size-3" />
              </button>
            </span>
          </div>
        ) : null}

        <div className="relative">
          {showMentionMenu && !showSlashMenu ? (
            <MentionMenu
              inputRef={textareaRef}
              suggestions={mentionSuggestions}
              onSelect={(item) => {
                const input = textareaRef.current;
                if (!input) return;
                insertMentionAtCursor(input, item.label, setDraft);
                setShowMentionMenu(false);
              }}
              onClose={() => setShowMentionMenu(false)}
            />
          ) : null}
          {showSlashMenu ? (
            <SlashCommandMenu
              inputRef={textareaRef}
              commands={slashCommands}
              onCommand={(cmd) => {
                if (cmd === "/clear") { setDraft(""); setShowSlashMenu(false); return; }
                if (cmd === "/help") { setDraft("/help"); setShowSlashMenu(false); return; }
                setDraft(cmd + " "); setShowSlashMenu(false);
              }}
              onClose={() => setShowSlashMenu(false)}
            />
          ) : null}

          <ComposerTextarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            const val = e.target.value;
            setDraft(val);
            const cursor = e.target.selectionStart ?? val.length;
            const mentionQuery = detectMentionQuery(val, cursor);
            if (mentionQuery !== null) {
              setShowMentionMenu(true);
              setShowSlashMenu(false);
            } else {
              setShowMentionMenu(false);
            }
          }}
          placeholder={
            templateSelection
              ? "Optional note (template message will be sent)"
              : usesMentionInvoke
                ? `Message @${mentionHandle}…`
                : `Ask ${agentName}…`
          }
          disabled={!trimmedRoomId || isAgentBusy || Boolean(templateSelection)}
          onKeyDown={(e) => {
            if (showMentionMenu && (e.key === "ArrowDown" || e.key === "ArrowUp" || (e.key === "Enter" && mentionSuggestions.length))) return;
            if (e.key === "/" && (e.currentTarget.selectionStart ?? 0) === 0) {
              setShowSlashMenu(true);
              setShowMentionMenu(false);
              return;
            }
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            if (!canSend) return;
            void requestSend();
          }}
        />
        </div>

        <ComposerToolbar>
          <ComposerToolbarLeft>
            {/* + button menu */}
            {showPlusMenu ? (
            <div ref={plusMenuRef} className="relative shrink-0 self-stretch">
              <button
                type="button"
                className="flex h-full items-center rounded-md border border-border bg-background px-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                disabled={!trimmedRoomId || isAgentBusy || Boolean(templateSelection) || imageGenerating}
                onClick={() => setPlusMenuOpen((prev) => !prev)}
                aria-label="Attach files or use tools"
                aria-expanded={plusMenuOpen}
                aria-haspopup="menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                  aria-hidden
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
              {plusMenuOpen ? (
                <div
                  className="absolute bottom-full left-0 z-[200] mb-2 w-56 rounded-lg border border-slate-200 bg-white p-1 text-slate-900 shadow-2xl"
                  role="menu"
                >
                  {/* Add Photos & Files */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                    <div className="flex flex-col">
                      <span>Add photos & files</span>
                      <span className="text-[10px] text-muted-foreground">Up to 25 MB</span>
                    </div>
                  </button>
                  {showImageGen ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => prepareImageGeneration()}
                  >
                    <Sparkles className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
                    <div className="flex flex-col">
                      <span>Create image</span>
                      <span className="text-[10px] text-muted-foreground">AI generated</span>
                    </div>
                  </button>
                  ) : null}
                  {showDeepResearch ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => sendResearchPrompt("deep-research")}
                  >
                    <BookOpen className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
                    <div className="flex flex-col">
                      <span>Deep Research</span>
                      <span className="text-[10px] text-muted-foreground">Multi-step agent</span>
                    </div>
                  </button>
                  ) : null}
                  {showWebSearch ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => sendResearchPrompt("web-search")}
                  >
                    <Globe className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
                    <div className="flex flex-col">
                      <span>Web search</span>
                      <span className="text-[10px] text-muted-foreground">Live results</span>
                    </div>
                  </button>
                  ) : null}
                  {showPollCreate ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setPollCreateOpen((p) => !p);
                      setDecisionCreateOpen(false);
                      setScheduleSendOpen(false);
                    }}
                  >
                    <BarChart3 className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
                    <div className="flex flex-col">
                      <span>Create poll</span>
                      <span className="text-[10px] text-muted-foreground">Vote in chat</span>
                    </div>
                  </button>
                  ) : null}
                  {showDecisionCreate ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setDecisionCreateOpen((p) => !p);
                      setPollCreateOpen(false);
                      setScheduleSendOpen(false);
                    }}
                  >
                    <Gavel className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
                    <div className="flex flex-col">
                      <span>Create decision</span>
                      <span className="text-[10px] text-muted-foreground">Binding quorum ack</span>
                    </div>
                  </button>
                  ) : null}
                  {showScheduleSend ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setScheduleSendOpen((p) => !p);
                      setPollCreateOpen(false);
                      setDecisionCreateOpen(false);
                    }}
                  >
                    <Clock className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
                    <div className="flex flex-col">
                      <span>Schedule send</span>
                      <span className="text-[10px] text-muted-foreground">Deliver later</span>
                    </div>
                  </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}

            {showVoiceRecorder ? (
            <VoiceRecorder
              disabled={!trimmedRoomId || isAgentBusy || Boolean(templateSelection)}
              onSend={async (audio, durationMs) => {
                if (!fluxyClient || !trimmedRoomId) return;
                setInputError(null);
                try {
                  const sent = await fluxyClient.sendVoiceMessage(trimmedRoomId, audio, {
                    durationMs,
                    parentId: replyToId,
                  });
                  if (!sent) {
                    setInputError("Voice message not sent. Check authentication.");
                    return;
                  }
                  void loadHistory();
                  setReplyToId(null);
                  try {
                    await fluxyClient?.putRoomDraft(trimmedRoomId, {
                      content: "",
                      replyToId: null,
                    });
                  } catch {
                    /* draft sync is best-effort */
                  }
                } catch (err: unknown) {
                  setInputError(
                    err instanceof Error ? err.message : "Failed to send voice message",
                  );
                }
              }}
            />
            ) : null}
          </ComposerToolbarLeft>
          <ComposerToolbarRight>
            <ComposerSubmitButton
              loading={isAgentBusy}
              disabled={!canSend}
            />
          </ComposerToolbarRight>
        </ComposerToolbar>
      </Composer>

      {/* ─── Huddle toolbar ─── */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            huddleActive ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand/10 text-brand hover:bg-brand/20"
          }`}
          onClick={() => void toggleHuddle()}
          title={huddleActive ? "Leave huddle" : "Join huddle"}
        >
          {huddleActive ? "Leave" : "Huddle"}
        </button>
        {!stageSelf ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/80"
              onClick={() => chatUserId && joinVoiceStage("listener", chatUserId)}
              title="Join voice stage as listener"
            >
              Stage · Listen
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-600/20"
              onClick={() => chatUserId && joinVoiceStage("speaker", chatUserId)}
              title="Join voice stage as speaker"
            >
              Stage · Speak
            </button>
          </>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2.5 py-1 text-xs text-emerald-800"
            onClick={leaveVoiceStage}
            title="Leave voice stage"
          >
            Leave stage ({stageSelf.role})
          </button>
        )}
        {huddleActive && (
          <>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                huddleAudioOn ? "bg-green-600/20 text-green-700" : "bg-muted text-muted-foreground"
              }`}
              onClick={toggleHuddleMic}
              title={huddleAudioOn ? "Mute" : "Unmute"}
            >
              Mic {huddleAudioOn ? "On" : "Off"}
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                huddleVideoOn ? "bg-green-600/20 text-green-700" : "bg-muted text-muted-foreground"
              }`}
              onClick={toggleHuddleCam}
              title={huddleVideoOn ? "Disable camera" : "Enable camera"}
            >
              Cam {huddleVideoOn ? "On" : "Off"}
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                huddleScreenOn ? "bg-green-600/20 text-green-700" : "bg-muted text-muted-foreground"
              }`}
              onClick={() => void toggleScreenShare()}
              title={huddleScreenOn ? "Stop sharing" : "Share screen"}
            >
              Screen {huddleScreenOn ? "On" : "Off"}
            </button>
            {huddleVideoOn ? (
              <video ref={huddleVideoRef} autoPlay muted playsInline className="ml-auto size-8 rounded-full bg-black object-cover" />
            ) : (
              <span
                className="ml-auto flex size-8 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                title="Camera off. Enable Cam to preview video"
              >
                You
              </span>
            )}
          </>
        )}
      </div>

      {/* Poll creator */}
      {pollCreateOpen ? (
        <PollCreate
          onCreate={async (question, options) => {
            if (!fluxyClient || !trimmedRoomId) return;
            await fluxyClient.createPoll(trimmedRoomId, { question, options });
            setPollCreateOpen(false);
          }}
        />
      ) : null}

      {decisionCreateOpen ? (
        <DecisionCreate
          onCreate={async (content, requiredRoles, ttlHours) => {
            if (!fluxyClient || !trimmedRoomId) return;
            await fluxyClient.createDecision(trimmedRoomId, {
              content,
              requiredRoles,
              ttlSeconds: ttlHours * 3600,
            });
            setDecisionCreateOpen(false);
          }}
        />
      ) : null}

      {scheduleSendOpen ? (
        <ScheduleSend
          initialContent={draft}
          onCancel={() => setScheduleSendOpen(false)}
          onSchedule={async (content, sendAt) => {
            if (!fluxyClient || !trimmedRoomId) return;
            await fluxyClient.scheduleMessage(trimmedRoomId, {
              content,
              sendAt,
              replyTo: replyToId,
            });
            setScheduleSendOpen(false);
            setDraft("");
            setReplyToId(null);
          }}
        />
      ) : null}

      {/* ─── Errors ─── */}
      {inputError || uploadError ? (
        <p className="text-xs text-red-600" role="alert">
          {inputError || uploadError}
        </p>
      ) : null}
      {imageGenerating ? (
        <p className="text-xs text-muted-foreground" role="status">
          Generating image…
        </p>
      ) : null}
      {invokeError ? (
        <p className="text-xs text-amber-800" role="alert">
          {invokeError}
        </p>
      ) : null}

      {/* ─── Offline notify settings ─── */}
      {showOfflineNotify && memberJwt.trim() && trimmedRoomId ? (
        <RoomOfflineNotifySettings
          compact
          roomId={trimmedRoomId}
          memberJwt={memberJwt}
          memberUserId={memberUserId}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        {usesMentionInvoke
          ? "Sends @mention; tools stream in-thread over WebSocket. Run banner polls every 2s (admin JWT)."
          : "REST invoke: tools stream live when connected; run summary in the banner above."}{" "}
        Set <code className="text-xs">toolExecuteUrl</code> on the agent profile for tool rounds.
      </p>

      {/* ─── Reaction Picker ─── */}
      <ReactionPicker
        open={reactionPickerMessageId !== null}
        anchorRect={reactionPickerAnchor}
        onClose={() => {
          setReactionPickerMessageId(null);
          setReactionPickerAnchor(null);
        }}
        onReact={(emoji) => {
          if (reactionPickerMessageId != null) {
            toggleReaction(reactionPickerMessageId, emoji);
          }
          setReactionPickerMessageId(null);
          setReactionPickerAnchor(null);
        }}
      />

      {/* ─── Image Generation Dialog ─── */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create image with AI</DialogTitle>
            <DialogDescription>
              Enter a prompt and Pollinations will generate an image for you.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[80px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
            placeholder="Describe the image you want to generate…"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="primary"
              className="bg-[var(--fluxy-btn-primary-bg)] text-[var(--fluxy-btn-primary-text)] hover:bg-[var(--fluxy-btn-primary-hover-bg)]"
              disabled={!imagePrompt.trim() || imageGenerating}
              onClick={() => {
                if (!imagePrompt.trim() || isAgentBusy) return;
                setImageDialogOpen(false);
                setDraft(imagePrompt);
                setPendingTool({ type: "image" });
                setImagePrompt("");
              }}
            >
              {imageGenerating ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeRoomId && roomAccessToken && showRoomInfo ? (
        <RoomInfoPanel
          roomId={activeRoomId}
          token={roomAccessToken}
          open={roomInfoOpen}
          onClose={() => setRoomInfoOpen(false)}
          onJumpToMessage={scrollToMessage}
        />
      ) : null}
    </div>
  );
}

// ─── Attachment renderer ───

function AuthedImage({
  src,
  alt,
  authToken,
  className,
}: {
  src: string;
  alt?: string;
  authToken?: string | null;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let revoke: string | null = null;
    if (authToken && src.startsWith("http")) {
      fetch(src, { headers: { Authorization: `Bearer ${authToken}` } })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            revoke = url;
            setBlobUrl(url);
          }
        })
        .catch(() => {});
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src, authToken]);

  // Don't render the raw http URL — CSP blocks it and it would 401 anyway.
  // Show a placeholder until the blob URL is ready.
  if (authToken && src.startsWith("http") && !blobUrl) {
    return (
      <div
        className={cn(className, "flex items-center justify-center bg-muted/50")}
        style={{ minHeight: 120 }}
      >
        <span className="text-xs text-muted-foreground">Loading image…</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl ?? src}
      alt={alt}
      className={className}
    />
  );
}

function ImagePreviewDialog({
  src,
  alt,
  authToken,
  fileName,
  onClose,
}: {
  src: string;
  alt?: string;
  authToken?: string | null;
  fileName?: string;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let revoke: string | null = null;
    if (authToken && src.startsWith("http")) {
      fetch(src, { headers: { Authorization: `Bearer ${authToken}` } })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            revoke = url;
            setBlobUrl(url);
          }
        })
        .catch(() => {});
    } else if (src.startsWith("blob:") || src.startsWith("data:")) {
      setBlobUrl(src);
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src, authToken]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "image.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-3xl flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={alt}
            className="max-h-[75vh] max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-white/60">
            Loading image…
          </div>
        )}
        <div className="flex items-center gap-3">
          {fileName ? (
            <span className="text-sm text-white/70">{fileName}</span>
          ) : null}
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FluxyAttachment({
  attachment,
  mediaBaseUrl,
  authToken,
}: {
  attachment: FluxyChatAttachment;
  mediaBaseUrl?: string;
  authToken?: string | null;
}) {
  const kind = attachment.kind as string;
  const [previewOpen, setPreviewOpen] = useState(false);

  if (kind === "image") {
    const src = attachment.url;
    if (!src) return null;
    const fullSrc = src.startsWith("http") ? src : `${mediaBaseUrl}${src}`;
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="mt-2 block overflow-hidden rounded-lg transition-opacity hover:opacity-90"
        >
          <AuthedImage
            src={fullSrc}
            alt={attachment.name}
            authToken={authToken}
            className="max-h-64 max-w-xs rounded-lg object-cover"
          />
        </button>
        {attachment.name ? (
          <div className="mt-1 text-[10px] text-muted-foreground">{attachment.name}</div>
        ) : null}
        {previewOpen ? (
          <ImagePreviewDialog
            src={fullSrc}
            alt={attachment.name}
            authToken={authToken}
            fileName={attachment.name}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null}
      </>
    );
  }

  if (kind === "audio") {
    const src = attachment.url;
    if (!src) return null;
    const fullSrc = src.startsWith("http") ? src : `${mediaBaseUrl}${src}`;
    return (
      <AuthedAudioAttachment
        src={fullSrc}
        name={attachment.name}
        authToken={authToken}
      />
    );
  }

  // Generic file
  const href = attachment.url;
  if (!href) return null;
  const fullHref = href.startsWith("http") ? href : `${mediaBaseUrl}${href}`;
  return (
    <a
      href={fullHref}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs hover:bg-muted/50"
    >
      <Paperclip className="size-4 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate font-medium">{attachment.name}</div>
        {attachment.sizeBytes ? (
          <div className="text-[10px] text-muted-foreground">
            {(attachment.sizeBytes / 1024).toFixed(0)} KB
          </div>
        ) : null}
      </div>
    </a>
  );
}

function AuthedAudioAttachment({
  src,
  name,
  authToken,
}: {
  src: string;
  name?: string;
  authToken?: string | null;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(authToken));

  React.useEffect(() => {
    if (!authToken) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }
    let revoke: string | null = null;
    let cancelled = false;
    setLoading(true);
    void fetch(src, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src, authToken]);

  const effectiveSrc = blobUrl ?? (authToken ? null : src);

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
      <button
        type="button"
        disabled={loading || !effectiveSrc}
        className="flex size-8 items-center justify-center rounded-full bg-[var(--fluxy-btn-primary-bg)] text-[var(--fluxy-btn-primary-text)] hover:bg-[var(--fluxy-btn-primary-hover-bg)] disabled:opacity-50"
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          void (el.paused ? el.play() : Promise.resolve(el.pause()));
        }}
        aria-label="Play audio"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        {name ? <div className="truncate text-xs font-medium">{name}</div> : null}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={audioRef}
          controls
          src={effectiveSrc ?? undefined}
          preload="metadata"
          className="mt-1 max-w-full"
          style={{ maxHeight: "28px" }}
        />
      </div>
    </div>
  );
}
