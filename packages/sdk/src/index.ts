export {
  FluxyAuthError,
  FluxyNotMemberError,
  FluxyTokenExpiredError,
  FluxyAnonymousNotAllowedError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
  FLUXY_WS_CLOSE_NORMAL,
  FLUXY_WS_CLOSE_POLICY,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
  parseConnectionRefusal,
  describeConnectionError,
  type FluxyConnectionErrorInfo,
} from "./errors";

export {
  FluxyChatError,
  isFluxyChatError,
  ChatError,
  RateLimitError,
  FluxyRateLimitError,
  LockError,
  FluxyLockError,
  NotImplementedError,
  FluxyNotImplementedError,
} from "./structured-errors";

export {
  createLogger,
  type Logger,
} from "./logger";

export type {
  StreamingMarkdownRenderer,
  StreamingMarkdownRendererOptions,
} from "./streaming-markdown";

export type {
  LockScope,
  ChannelVisibility,
  Author,
  UserInfo,
  MessageMetadata,
  RawMessage,
  FormattedMessage,
  FormatConverter,
  ThreadAdapter,
  AdapterEphemeralResult,
  EphemeralMessage,
  PostEphemeralOptions,
} from "./adapter-types";

export {
  Card,
  Text,
  Button,
  LinkButton,
  Image,
  Divider,
  Actions,
  Section,
  Field,
  Fields,
  Link,
  Table,
  isCardElement,
  cardToFallbackText,
  cardToMarkdown,
} from "./cards";

export type {
  ButtonStyle,
  TextStyle,
  TableAlignment,
  ActionType,
  ButtonElement,
  LinkButtonElement,
  TextElement,
  ImageElement,
  DividerElement,
  ActionsElement,
  SectionElement,
  FieldElement,
  FieldsElement,
  LinkElement,
  TableElement,
  CardChild,
  CardElement,
  AnyCardElement,
} from "./cards";

export {
  getPresetTools,
  needsApproval,
  getToolDefinition,
  listPresets,
  buildToolList,
  createChatTools,
  type ToolPreset,
  type ToolName,
  type ToolDefinition,
  type PresetConfig,
  type ChatWriteToolName,
  type ApprovalConfig,
  type ChatBinding,
  type ToolOverrides,
  type ChatToolsOptions,
  type ChatTool,
} from "./ai-tools";

export type {
  ToolOverride,
  ToolOverridesConfig,
  ToolWithOverrides,
} from "./tool-overrides";

export {
  normalizeEmoji,
  isValidEmoji,
  getEmojiCategory,
  EMOJI_CATEGORIES,
} from "./emoji";

export {
  createPlan,
  addTask,
  updateTaskStatus,
  getPlanProgress,
  type Plan,
  type PlanTask,
  type TaskStatus,
} from "./plan";

export {
  createMockAdapter,
  MockAdapter,
} from "./mock-adapter";

export {
  encryptToken,
  decryptToken,
  deriveKey,
  isEncryptedTokenData,
  TokenCrypto,
} from "./token-crypto";

export {
  createThreadState,
  createThreadStateStore,
  THREAD_STATE_TTL_MS,
  type ThreadState,
  type ThreadStateStore,
  type TypedThreadState,
} from "./thread-state";

export {
  useStreamingMarkdown,
  type UseStreamingMarkdownResult,
} from "./use-streaming-markdown";

export {
  createLLMMiddleware,
  wrapLanguageModel,
  composeMiddlewares,
  createLoggingMiddleware,
  type LLMCallParams,
  type LLMCallResult,
  type LLMStreamChunk,
  type LLMMiddleware,
  type TransformParamsFn,
  type WrapGenerateFn,
  type WrapStreamFn,
} from "./llm-middleware";

export type {
  ToolContext,
  ScopedToolContext,
  ToolContextScope,
  ToolContextManager,
} from "./tool-context";

export type {
  StreamResumptionEntry,
  StreamResumptionStore,
} from "./stream-resumption";

export type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalStore,
  ApprovalGate,
} from "./hitl-approval";

export {
  streamToolCalls,
  type ToolCallStreamChunk,
  type ToolCallStreamOptions,
} from "./tool-call-streaming";

export {
  LOOP_PRESETS,
  type LoopControlConfig,
  type LoopController,
  type LoopContext,
} from "./loop-control";

export {
  mcpToolsToFluxyChat,
  fluxyChatResultToMcp,
  createMcpClient,
  createMcpRegistry,
  type McpServerConfig,
  type McpToolDefinition,
  type McpToolCall,
  type McpToolResult,
  type McpClient,
  type McpRegistry,
  type McpResource,
  type McpResourceTemplate,
} from "./mcp-integration";

export {
  createDeltaPoller,
  createMemoryDeltaStore,
  createPresenceLeaseManager,
  createMemoryDurableStreamStore,
  type DeltaChange,
  type DeltaCursor,
  type DeltaSnapshot,
  type DeltaStore,
  type DeltaSyncOptions,
  type DeltaSyncStage,
  type PresenceLease,
  type PresenceLeaseOptions,
  type DurableAgentStream,
  type DurableStreamStore,
} from "./delta-sync";

export {
  createMemoryOutboxStore,
  createOutboxProcessor,
  createLaneProcessor,
  createChaosHarness,
  type OutboxEntry,
  type OutboxStore,
  type OutboxOptions,
  type LaneType,
  type LaneMessage,
  type LaneProcessor,
  type ChaosConfig,
  type ChaosEvent,
} from "./outbox-lanes";

export {
  createMessageOutbox,
  type MessageOutbox,
  type MessageOutboxOptions,
  type MessageOutboxSendOptions,
  type ReconnectSource,
} from "./transport/outbox";

export {
  routeTask,
  createMemorySharedStateStore,
  createHandoffManager,
  type RoutingPolicy,
  type RoutedAgent,
  type SharedAgentState,
  type SharedStateStore,
  type HandoffRequest,
  type HandoffOptions,
} from "./agent-delegation";

export {
  createSemanticEOTDetector,
  createBackchannelDetector,
  createBargeInDetector,
  createWebRTCVoiceTransport,
  type EOTDecision,
  type EOTDetector,
  type BackchannelConfig,
  type BackchannelEvent,
  type BargeInConfig,
  type BargeInEvent,
  type WebRTCVoiceConfig,
} from "./voice-realtime";

export {
  createMemorySummaryStore,
  createMemorySearchIndex,
  createModerationEngine,
  createMemoryTranslationCache,
  type ConversationSummary,
  type SummaryStore,
  type SearchResult,
  type SearchIndex,
  type ModerationAction,
  type ModerationResult,
  type ModerationRule,
  type ModerationConfig,
  type ModerationReport,
  type TranslationResult,
  type TranslationCache,
} from "./ai-moderation";

export {
  createWorkflowAgent,
  createMemoryWorkflowStore,
  type WorkflowStatus,
  type StepStatus,
  type WorkflowStep,
  type WorkflowDefinition,
  type WorkflowState,
  type WorkflowStore,
  type WorkflowAgent,
} from "./workflow-agent";

export type {
  SandboxStatus,
  SandboxConfig,
  SandboxExecutionResult,
  Sandbox,
  SandboxManager,
} from "./sandbox";

export type {
  Platform,
  PlatformMessage,
  PlatformReply,
  PlatformAdapter,
  BotDeploymentConfig,
  BotDeployment,
  BotDeploymentManager,
} from "./cross-platform";

export {
  createVoiceManager,
  audioToBase64,
  base64ToAudio,
  type VoiceStatus,
  type VoiceConfig,
  type VoiceChunk,
  type VoiceSession,
  type VoiceManager,
  type VoiceTransport,
  type VoiceManagerOptions,
  type VoiceInterruptionMode,
  type VoiceInterruptionConfig,
} from "./voice";

export {
  PROVIDER_TOOL_SETS,
  type ProviderDefinedTool,
  type ProviderToolContext,
  type ProviderToolSet,
  type ProviderToolRegistry,
} from "./provider-tools";

export {
  createHTTPTransport,
  createSSETransport,
  createLongPollTransport,
  createWebSocketTransport,
  createWebTransportTransport,
  createTransportRegistry,
  type TransportConfig,
  type TransportRequest,
  type TransportResponse,
  type Transport,
  type TransportFactory,
  type TransportRegistry,
} from "./transport";

export {
  createDataPartRegistry,
  BUILTIN_PARSERS,
  parsePartialJSON,
  type DataPart,
  type StreamPart,
  type DataPartParser,
  type DataPartRegistry,
  type UseObjectOptions,
  type UseObjectResult,
} from "./data-parts";

export type {
  StructuredOutputConfig,
  StructuredOutputResult,
} from "./structured-output";

export {
  IMAGE_GENERATION_TOOL,
  type ImageSize,
  type ImageQuality,
  type ImageStyle,
  type ImageGenerationConfig,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageGenerator,
} from "./image-generation";

export {
  TTS_TOOL,
  type TTSVoice,
  type TTSConfig,
  type TTSRequest,
  type TTSResult,
  type TextToSpeech,
} from "./tts";

export {
  createSlashCommandRegistry,
  BUILTIN_COMMANDS,
  type SlashCommand,
  type ParsedArgs,
  type CommandContext,
  type CommandResult,
  type SlashCommandRegistry,
} from "./slash-commands";

export {
  FLUXY_AGENT_PROTOCOL_VERSION,
  createAgentCommunicationBus,
  delegateToAgent,
  agentMessageToAGUI,
  agentTaskToA2A,
  type AgentArtifact,
  type AgentBusOptions,
  type AgentCapability,
  type AgentCard,
  type AgentTask,
  type AgentTaskStatus,
  type AgentMessage,
  type AgentMessageType,
  type AgentMessageHandler,
  type AgentCommunicationBus,
  type AGUIEvent,
} from "./agent-to-agent";

export {
  BUILTIN_PROMPT_TEMPLATES,
  type PromptTemplate,
  type PromptRenderer,
  type PromptTemplateRegistry,
} from "./dynamic-prompts";

export type {
  ToolCallAnnotation,
  ToolCallAnnotationStore,
} from "./tool-annotations";

export {
  METADATA_KEYS,
  type MessageMetadataMap,
  type MetadataStore,
} from "./message-metadata";

export {
  createAttachmentManager,
  mimeToAttachmentType,
  formatFileSize,
  type AttachmentType,
  type AttachmentConfig,
  type Attachment,
  type AttachmentUploadResult,
  type AttachmentManager,
} from "./attachments";

export {
  toAiMessages,
  type AiTextPart,
  type AiImagePart,
  type AiFilePart,
  type AiMessagePart,
  type AiUserMessage,
  type AiAssistantMessage,
  type AiMessage,
  type ToAiMessagesOptions,
} from "./messages-to-ai";

export {
  postEphemeral,
} from "./ephemeral";

export {
  createSentMessage,
  type SentMessage,
} from "./sent-message";

export {
  createTextPart,
  createToolCallPart,
  createToolResultPart,
  createComponentRegistry,
  renderParts,
  partTypeFor,
  parseToolName,
  isTextPart,
  isToolPart,
  isToolCallPart,
  isToolResultPart,
  type UIPart,
  type UIPartState,
  type TextUIPart,
  type ToolCallUIPart,
  type ToolResultUIPart,
  type ComponentRenderer,
  type ComponentRegistryEntry,
  type ComponentRegistry,
  type RenderPartsOptions,
} from "./generative-ui";

export {
  createMessagePatternMatcher,
  type MessagePatternRule,
  type MessagePatternHandler,
  type MessagePatternMatcher,
} from "./regex-message-matching";

export {
  text,
  strong,
  emphasis,
  strikethrough,
  inlineCode,
  codeBlock,
  link,
  blockquote,
  paragraph,
  root,
  parseMarkdown,
  stringifyMarkdown,
  toPlainText,
  markdownToPlainText,
  walkAst,
  getNodeChildren,
  getNodeValue,
  tableToAscii,
  isTextNode,
  isParagraphNode,
  isStrongNode,
  isEmphasisNode,
  isDeleteNode,
  isInlineCodeNode,
  isCodeNode,
  isLinkNode,
  isBlockquoteNode,
  isListNode,
  isListItemNode,
  isTableNode,
  isTableRowNode,
  isTableCellNode,
  isHeadingNode,
  type StringifyOptions,
  type Nodes,
  type Blockquote,
  type Code,
  type Content,
  type Delete,
  type Emphasis,
  type Heading,
  type InlineCode,
  type Link as MarkdownLink,
  type List,
  type ListItem,
  type Paragraph,
  type Root,
  type Strong,
  type Table as MarkdownTable,
  type TableCell,
  type TableRow,
  type Text as MarkdownText,
} from "./markdown";

export {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_PROTOCOL_VERSION,
  isFluxyInboundEvent,
  parseInboundWsFrame,
  dispatchInboundWsFrame,
} from "@fluxy-chat/protocol";

export {
  FluxyChatRoomConnection,
  type FluxyRoomConnectionOptions,
  type FluxyRoomConnectionStatus,
  type FluxyWaitForOptions,
} from "./room-connection";

export {
  locationTrack,
  type LocationTrackController,
  type LocationTrackOptions,
} from "./location-track";

export {
  useLocation,
  type LocationTrackState,
  type UseLocationOptions,
} from "./use-location";

export {
  useServerEvents,
  type ServerEventLogEntry,
  type UseServerEventsOptions,
  type UseServerEventsResult,
} from "./use-server-events";

export type {
  LocationSnapshotInbound,
  LocationTelemetry,
  LocationTrack,
  LocationTrackEndedInbound,
  LocationUpdateInbound,
} from "@fluxy-chat/protocol";

export { FluxyMessageStream, type FluxyMessageStreamOptions } from "./message-stream";

export {
  clampHistoryLimit,
  mergeMessagesChronological,
  sortMessagesChronological,
  MAX_HISTORY_LIMIT,
  type HistoryMessage,
} from "./message-history";

export { decodeFluxyJwtPayload, jwtRefreshDelayMs, type DecodedFluxyJwt } from "./jwt-utils";

export {
  FLUXY_MAX_MESSAGE_LENGTH,
  normalizeRoomMember,
  normalizeRoomMembers,
} from "./room-rest";

export {
  validateAgentOutboundMessage,
  buildAgentOutboundWsPayload,
  type AgentOutboundMessageInput,
  type AgentOutboundValidationResult,
} from "./agent-outbound";

export {
  FluxyRealtimeProvider,
  type FluxyRealtimeProviderProps,
  type FluxyAuthTokenResult,
} from "./realtime-provider";

export { useFluxyChat, useFluxyChatOptional, type FluxyRealtimeContextValue } from "./use-fluxy-chat";

export {
  useChat,
  type UseChatOptions,
  type UseChatHistoryReplay,
  type UseChatReadOn,
} from "./use-chat";

export {
  useVoice,
  type UseVoiceOptions,
  type UseVoiceResult,
} from "./use-voice";

export {
  useLiveKitToken,
  type UseLiveKitTokenOptions,
  type UseLiveKitTokenResult,
  type LiveKitTokenResponse,
} from "./use-livekit-token";

export {
  useInbox,
  type UseInboxOptions,
  type UseInboxResult,
} from "./use-inbox";

export {
  inboxSummaryToItems,
  mergeInboxItem,
  countUnseenItems,
  type FluxyInboxItem,
  type FluxyInboxItemKind,
} from "./inbox-items";

export {
  useUserChannel,
  type UseUserChannelOptions,
  type UseUserChannelState,
} from "./use-user-channel";

export {
  FluxyClientCredentials,
  type FluxyClientCredentialsOptions,
  type FluxyTokenSource,
} from "./client-credentials";

export {
  acquireFluxyRoomSession,
  FLUXY_ROOM_SESSION_GRACE_MS,
  resetFluxyRoomSessionHandlesForTests,
} from "./room-session-handle";

export {
  applyInboxQuery,
  isInboxRefreshUserEvent,
  parseInboxItemFromUserEvent,
  FLUXY_INBOX_REFRESH_EVENT_NAMES,
  type FluxyWhereOp,
  type FluxyWhere,
  type FluxyInboxWhere,
  type FluxyInboxQuery,
  type FluxyInboxSummaryLike,
} from "./inbox-filter";

export { createFluxyWebSocket } from "./websocket-factory";

export {
  isE2eContentEnvelope,
  encryptE2eContent,
  decryptE2eContent,
  type FluxyE2eEnvelope,
} from "./room-e2e";

export {
  buildDeepResearchPrompt,
  buildWebSearchPrompt,
  buildImageGenerationCaption,
  type ComposerToolPromptOptions,
} from "./composer-prompts";

export {
  createFluxyRoomStore,
  syncRoomConnectionState,
  type FluxyRoomStore,
  type FluxyRoomStoreState,
  type FluxyUseChatConnectionStatus,
  type FluxyToolThreadEvent,
} from "./fluxy-room-store";

export {
  createFluxyRoomSession,
  startFluxyRoomSession,
  type StartFluxyRoomSessionOptions,
} from "./room-session";

export { useFluxyRoomStore, useFluxyRoomStoreState, INERT_FLUXY_ROOM_SNAPSHOT } from "./use-fluxy-room-store";

export {
  renderMessageTemplate,
  extractTemplateVarNames,
  type FluxyMessageTemplate,
  type FluxySendMessageOptions,
  type FluxyPresenceIntent,
  type FluxyProjectActivity,
} from "./message-template";

export {
  buildFluxyConnectionState,
  getConnectionStatusLabel,
  isBlockedConnectionStatus,
  isDegradedConnectionStatus,
  normalizeConnectionStateStatus,
  type ConnectionStatusLabelOptions,
  type FluxyChatTransport,
  type FluxyConnectionState,
  type FluxyConnectionStateStatus,
} from "./connection-state";

export {
  applyServerMessageAck,
  createClientMessageId,
  createOptimisticMessage,
  markMessageDeliveryFailed,
  tryMatchPendingByInbound,
  type FluxyChatMessageWithDelivery,
  type FluxyDeliverableMessage,
  type FluxyMessageDeliveryFields,
  type FluxyMessageDeliveryStatus,
} from "./message-delivery";

export { useRooms } from "./use-rooms";
export { useNotifications } from "./use-notifications";
export { useWebPush } from "./use-web-push";
export type {
  WebPushPermissionState,
  WebPushSubscriptionRow,
  UseWebPushOptions,
} from "./use-web-push";

import { FluxyChatRoomConnection, type FluxyRoomConnectionOptions } from "./room-connection";
import { FluxyAuthError, FluxySendError } from "./errors";
import { clampHistoryLimit, sortMessagesChronological } from "./message-history";
import { normalizeRoomMembers } from "./room-rest";
import { trimTrailingSlashes } from "./url-utils";
import { FluxyClientCredentials, type FluxyTokenSource } from "./client-credentials";
import { applyInboxQuery, type FluxyInboxQuery } from "./inbox-filter";
import { createFluxyWebSocket } from "./websocket-factory";
import { decodeFluxyJwtPayload } from "./jwt-utils";

export interface FluxyChatMessage {
  id: number;
  roomId: string;
  userId: string;
  senderId?: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  mentions?: string[];
  preview?: {
    url: string;
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  };
  attachments?: FluxyChatAttachment[];
  /** True while an agent (or user) is still streaming tokens into this message. */
  streaming?: boolean;
  /** Client-only id for optimistic send dedupe (not stored server-side yet). */
  clientMessageId?: string;
  /** Client-only delivery state for optimistic UI. */
  deliveryStatus?: "pending" | "sent" | "failed";
  deliveryError?: string;
  /** ISO timestamp when the message self-deletes (ephemeral / TTL). */
  expiresAt?: string | null;
  visibility?: "room" | "whisper";
  visibleTo?: string[];
  /**
   * Reaction tallies keyed by emoji (e.g. `{ "ðŸ‘": 2 }`). Client-side for now;
   * the Worker does not persist these yet, so the map is assembled by the UI
   * from local interactions. Optional â€” absent means "no reactions".
   */
  reactions?: Record<string, number>;
  poll?: {
    messageId: number;
    question: string;
    allowMultiple: boolean;
    options: Array<{ index: number; text: string; votes: number }>;
    totalVoters: number;
    closed: boolean;
  };
  /** Message kind. `text` is the default and is implicit; `voice` is set
   *  by `POST /messages/voice` and carries audio metadata + a possibly
   *  pending transcription. */
  kind?: "text" | "voice";
  /** Public URL (or R2 key path) of the recorded audio. Present when
   *  `kind === "voice"`. */
  audioUrl?: string | null;
  /** MIME type of the recorded audio (e.g. `audio/webm`). */
  audioMimeType?: string | null;
  /** Size in bytes of the recorded audio. */
  audioSizeBytes?: number | null;
  /** Client-measured recording duration in milliseconds. */
  durationMs?: number | null;
  /** Transcript of the audio. Populated asynchronously by the Worker
   *  after the upload; `null` while `transcriptionStatus === "pending"`. */
  transcription?: string | null;
  /** Status of the async transcription job.
   *  - `pending`  : the Worker has the audio, transcription is in flight
   *  - `done`     : `transcription` is populated
   *  - `failed`   : transcription could not be produced (UI may show a
   *                 "transcript unavailable" placeholder) */
  transcriptionStatus?: "pending" | "done" | "failed" | null;
  /** Rich interactive card payload (inline or parsed from content). */
  card?: import("./cards").CardElement;
}

export interface FluxyChatAttachment {
  id?: number;
  /** Attachment category. The known kinds drive rendering (`image`, `file`,
   *  `audio`, `location`); the `string & {}` tail keeps the type open so
   *  callers can pass custom kinds without a cast. */
  kind: "image" | "file" | "audio" | "location" | (string & {});
  url: string;
  name: string;
  sizeBytes?: number;
  contentType?: string;
}

const AUDIO_FILE_SUFFIXES = [".webm", ".m4a", ".mp3", ".wav", ".ogg"];

function fileNameLooksLikeAudio(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  for (const ext of AUDIO_FILE_SUFFIXES) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function inferAttachmentKind(contentType: string, fileName: string): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("audio/")) return "audio";
  if (fileNameLooksLikeAudio(fileName)) return "audio";
  return "file";
}

function httpUrlToWebSocketBase(url: string): string {
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
}

export interface FluxyChatRoom {
  id: string;
  type: "dm" | "group" | "public";
  name: string;
  created_at: string;
  unreadCount?: number;
}

/** Catch-up metadata from `GET /rooms/:id/unread` (jump-to-first-unread UX). */
export interface FluxyRoomCatchUp {
  unreadCount: number;
  lastReadMessageId: number;
  firstUnreadMessageId: number | null;
}

/** Room-scoped compose draft synced via member preferences. */
export interface FluxyRoomMessageDraft {
  content: string;
  replyToId: number | null;
  updatedAt: string;
}

export interface FluxyInAppNotification {
  id: number;
  kind: string;
  title: string;
  body?: string | null;
  room_id?: string | null;
  message_id?: number | null;
  read_at?: string | null;
  created_at: string;
}

export interface FluxyInboxMention {
  messageId: number;
  roomId: string;
  roomName: string;
  roomType?: string;
  authorId: string;
  preview: string;
  createdAt: string;
  isUnread: boolean;
}

export interface FluxyInboxRoomEntry {
  roomId: string;
  roomName: string;
  roomType?: string;
  unreadCount: number;
  lastReadMessageId: number;
  firstUnreadMessageId: number | null;
  snoozedUntil?: string | null;
  lastMessage?: {
    messageId: number;
    userId: string;
    preview: string;
    createdAt: string;
  } | null;
}

export interface FluxyInboxFollowUp {
  id: string;
  roomId: string;
  roomName: string;
  messageId?: number | null;
  note?: string | null;
  dueAt?: string | null;
  status: string;
  createdAt: string;
}

export interface FluxyInboxSummary {
  mentions: FluxyInboxMention[];
  unreadRooms: FluxyInboxRoomEntry[];
  snoozedRooms: FluxyInboxRoomEntry[];
  followUps: FluxyInboxFollowUp[];
  counts: {
    mentions: number;
    unreadRooms: number;
    snoozedRooms: number;
    followUps: number;
  };
}

export interface FluxyAgentTask {
  id: string;
  roomId: string;
  roomName: string;
  roomType?: string | null;
  status: "open" | "claimed" | "resolved" | "cancelled" | string;
  priority: number;
  assigneeUserId?: string | null;
  claimedAt?: string | null;
  slaDueAt: string;
  slaBreached: boolean;
  secondsToSla?: number | null;
  resolvedAt?: string | null;
  disposition?: string | null;
  note?: string | null;
  triggerSource: string;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FluxyAgentQueueSummary {
  tasks: FluxyAgentTask[];
  counts: {
    total: number;
    open: number;
    claimed: number;
    slaBreached: number;
  };
  slaMinutes: number;
}

export interface FluxyAgentDisposition {
  code: string;
  label: string;
}

export interface FluxyCustomDomain {
  id: string;
  projectId: string;
  hostname: string;
  defaultRoomId?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  allowedOrigins?: string[];
  status: "pending" | "active" | "disabled" | string;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FluxyPublicHostConfig {
  configured: boolean;
  projectId?: string;
  hostname?: string;
  defaultRoomId?: string | null;
  brand?: { name?: string | null; logoUrl?: string | null };
}

export interface FluxyClientFeatureFlags {
  flags: {
    voice_messages: boolean;
    reply_suggestions: boolean;
    embed_widget: boolean;
    reconnect_backoff_fluxy: boolean;
  };
  flagship: boolean;
  reconnectBackoff: { baseBackoffMs: number; maxBackoffMs: number };
}

export interface FluxyEmbedTheme {
  primaryColor: string;
  position: "bottom-right" | "bottom-left" | string;
}

export interface FluxyEmbedConfig {
  projectId: string;
  enabled: boolean;
  defaultRoomId?: string | null;
  allowedOrigins: string[];
  zIndex: number;
  launcherTitle: string;
  theme: FluxyEmbedTheme;
  createdAt: string;
  updatedAt: string;
}

export interface FluxyQuietHoursPreferences {
  enabled: boolean;
  timezone: string;
  quietStart: string;
  quietEnd: string;
  batchPush: boolean;
  batchInApp: boolean;
  updatedAt: string | null;
}

export interface FluxyPublicEmbedConfig {
  enabled: boolean;
  reason?: string;
  projectId?: string;
  defaultRoomId?: string | null;
  zIndex?: number;
  launcherTitle?: string;
  theme?: FluxyEmbedTheme;
  readOnly?: boolean;
  scriptUrl?: string;
  framePath?: string;
}

export interface FluxyRoomHandoffState {
  status: string;
  active: boolean;
  handoffId?: string | null;
  agentId?: string | null;
  agentTaskId?: string | null;
  handedOffByUserId?: string | null;
  handedOffAt?: string | null;
  contextSummary?: string | null;
  disposition?: string | null;
  resolvedAt?: string | null;
}

export interface FluxyRoomMember {
  userId: string;
  role: string;
  joined_at?: string;
  joinedAt?: string;
  notifyEnabled?: boolean;
  preferences?: Record<string, unknown>;
}

export interface FetchMessagesOptions {
  limit?: number;
  /** ISO `createdAt` cursor  returns messages older than this timestamp. */
  before?: string;
}

export interface FluxyChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface FluxyChatAgent {
  id: string;
  projectId: string;
  name: string;
  handle?: string | null;
  provider?: string | null;
  model?: string | null;
  capabilities?: string[];
  config?: Record<string, unknown> | null;
  systemPrompt?: string | null;
  contextFetchUrl?: string | null;
  toolExecuteUrl?: string | null;
  toolsSchema?: FluxyChatToolDefinition[] | null;
  rateLimitRpm?: number | null;
  createdAt?: string;
}

export interface FluxyChatToolCall {
  id: string;
  name: string;
  arguments: string;
  success?: boolean;
  result?: unknown;
  error?: string;
}

export interface FluxyChatAgentRun {
  id: string;
  status: "queued" | "completed" | "failed";
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  error?: string | null;
  room_id?: string | null;
  tool_calls?: FluxyChatToolCall[];
  context_fetched?: boolean;
  iterations?: number;
  created_at: string;
}
/** Query params for `FluxyChatClient.connect()`. */
export interface FluxyWebSocketConnectOptions {
  /** Skip server history snapshot on connect (default: send snapshot). */
  replay?: "connect" | "off";
  /** Cap for WS history/replay snapshot (default server: 50, max 500). */
  replayLimit?: number;
  /** Optional presence profile sent on WS connect (`presenceInfo` query param). */
  presenceInfo?: Record<string, unknown>;
  /** Request Pusher-style cache snapshot on connect (`cache=1` query param). */
  cache?: "on" | "off";
}

/** Single member in a `FluxyRoomLive.members` snapshot. */
export interface FluxyRoomLiveMember {
  userId: string;
  userInfo?: Record<string, unknown>;
}

/** REST snapshot of a room's live presence (Pusher-style channel stats + members). */
export interface FluxyRoomLive {
  roomId: string;
  shardCount: number;
  occupied: boolean;
  subscriptionCount: number;
  userCount: number;
  online: number;
  users: string[];
  members: FluxyRoomLiveMember[];
  socketIds: string[];
}

export type FluxyChatEvent =
  | { type: "history"; messages: FluxyChatMessage[]; reactions?: Record<number, Record<string, number>> }
  | { type: "replay"; messages: FluxyChatMessage[]; reactions?: Record<number, Record<string, number>> }
  | {
      type: "streamState";
      messageId: number;
      roomId: string;
      userId: string;
      content: string;
      createdAt: string;
      parentId?: number | null;
      streaming: boolean;
    }
  | ({ type: "message" } & FluxyChatMessage)
  | {
      /** Patch event for a previously broadcast message. Used for
       *  asynchronous enrichments (e.g. voice message transcription
       *  arriving after the upload has already been announced). The
       *  client should merge the fields into the existing message in
       *  its store, keyed by `id` + `roomId`. */
      type: "message_updated";
      id: number;
      roomId: string;
      kind?: "text" | "voice";
      transcription?: string | null;
      transcriptionStatus?: "pending" | "done" | "failed" | null;
      transcriptionModel?: string;
    }
  | {
      type: "edit";
      id: number;
      roomId: string;
      userId: string;
      content: string;
      editedAt: string;
      streaming?: boolean;
    }
  | {
      type: "stream";
      op: "started";
      id: number;
      roomId: string;
    }
  | {
      type: "reaction";
      roomId: string;
      userId: string;
      messageId: number;
      emoji: string;
      op: "add" | "remove";
    }
  | {
      type: "read";
      roomId: string;
      userId: string;
      messageId: number;
      createdAt: string;
    }
  | {
      type: "delete";
      id: number;
      roomId: string;
      userId: string;
      deletedAt: string;
      hard?: boolean;
    }
  | {
      type: "message_expired";
      id: number;
      roomId: string;
      userId: string;
      expiredAt: string;
      deletedAt?: string;
    }
  | {
      type: "typing";
      userId: string;
      isTyping: boolean;
      intent?: import("./message-template").FluxyPresenceIntent;
    }
  | {
      type: "subscription_succeeded";
      roomId: string;
      socketId?: string;
      subscriptionCount: number;
      members: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
    }
  | {
      type: "subscription_count";
      roomId: string;
      subscriptionCount: number;
    }
  | {
      type: "member_joined";
      roomId: string;
      userId: string;
      userInfo?: Record<string, unknown>;
    }
  | { type: "member_left"; roomId: string; userId: string }
  | {
      type: "client_event";
      roomId: string;
      userId: string;
      eventName: string;
      data: unknown;
    }
  | import("@fluxy-chat/protocol").LocationUpdateInbound
  | import("@fluxy-chat/protocol").LocationSnapshotInbound
  | import("@fluxy-chat/protocol").LocationTrackEndedInbound
  | { type: "agentTyping"; agentId: string; isTyping: boolean }
  | {
      type: "tool_call";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      arguments?: string;
    }
  | {
      type: "tool_result";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      result?: unknown;
    }
  | {
      type: "tool_error";
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      error?: string;
    }
  | {
      type: "approval_request";
      approvalId: string;
      runId: string;
      agentId: string;
      toolCallId: string;
      name: string;
      input: Record<string, unknown>;
      reason?: string;
      expiresAt?: string;
    }
  | {
      type: "approval_decision";
      approvalId: string;
      runId: string;
      toolCallId: string;
      status: "approved" | "denied" | "expired" | "cancelled";
      decidedBy?: string;
      note?: string;
    }
  | { type: "agentRun"; run: FluxyChatAgentRun }
  | {
      type: "presence";
      online: number;
      users?: string[];
      members?: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
    }
  | {
      type: "cache_snapshot";
      roomId: string;
      event: Record<string, unknown>;
      cachedAt: string;
    }
  | {
      type: "server_event";
      roomId: string;
      name: string;
      data: unknown;
      userId?: string;
    }
  | {
      type: "user_event";
      userId: string;
      name: string;
      data: unknown;
      at?: string;
      roomId?: string;
    }
  | {
      type: "user_subscription_succeeded";
      userId: string;
      socketId?: string;
      connectionCount: number;
    }
  | {
      type: "state_change";
      roomId: string;
      previous: import("./room-connection").FluxyRoomConnectionStatus;
      current: import("./room-connection").FluxyRoomConnectionStatus;
    }
  | { type: "error"; message: string };

export interface FluxySignInResponse {
  token: string;
  expiresIn: number;
  claims: { sub: string; tid: string; roles: string[] };
  signin: true;
  userId: string;
  projectId: string;
  userChannel: {
    websocketPath: string;
    eventsPath: string;
  };
}

export interface FluxyChatClientOptions {
  baseUrl: string;
  userId: string;
  apiKey?: string;
  /**
   * Optional JWT for authenticated REST calls (POST /messages, reactions, read, reports, etc).
   * When provided, the SDK will prefer REST for writes and use WebSocket mainly for realtime updates.
   * Omit with `apiKey` to enable anonymous auto-mint via POST /tokens/anonymous (Portal-style).
   */
  token?: FluxyTokenSource;
  /** Use partysocket auto-reconnect for room/user WebSockets (default false). */
  usePartySocket?: boolean;
}

export class FluxyChatClient {
  private baseUrl: string;
  private _userId: string;
  readonly apiKey?: string;
  private readonly credentials: FluxyClientCredentials | null;
  private readonly usePartySocket: boolean;

  constructor(options: FluxyChatClientOptions) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl);
    this._userId = options.userId;
    this.apiKey = options.apiKey;
    this.usePartySocket = options.usePartySocket ?? false;
    if (options.apiKey) {
      this.credentials = new FluxyClientCredentials({
        baseUrl: this.baseUrl,
        apiKey: options.apiKey,
        token: options.token,
      });
    } else {
      this.credentials = null;
      if (typeof options.token === "string") {
        this._cachedToken = options.token;
      }
    }
  }

  private _cachedToken: string | undefined;

  /** Current bearer token (may be undefined until {@link resolveToken}). */
  get token(): string | undefined {
    return this.credentials?.getCachedToken() ?? this._cachedToken;
  }

  /** Effective user id (JWT `sub` after anonymous mint when applicable). */
  get userId(): string {
    return this.credentials?.getResolvedUserId(this._userId) ?? this._userId;
  }

  isAuthenticated(): boolean {
    if (this.token) return true;
    return Boolean(this.apiKey && this.credentials?.managed);
  }

  /** True when the SDK auto-mints anonymous credentials (apiKey, no user token). */
  isAnonymous(): boolean {
    return Boolean(this.credentials?.managed && this.token);
  }

  /** Resolve bearer token (mints anonymous JWT when configured). */
  async resolveToken(): Promise<string | undefined> {
    if (this.credentials) {
      const token = await this.credentials.resolve();
      const sub = decodeFluxyJwtPayload(token).sub;
      if (sub) this._userId = sub;
      return token;
    }
    return this._cachedToken;
  }

  /**
   * Replace session token (login/logout). Returns true when identity changed —
   * active connections should reconnect.
   */
  setToken(next: FluxyTokenSource | undefined): boolean {
    if (this.credentials) {
      const changed = this.credentials.setToken(next);
      const sub = this.token ? decodeFluxyJwtPayload(this.token).sub : undefined;
      if (sub) this._userId = sub;
      return changed;
    }
    const prev = this._cachedToken;
    if (typeof next === "string") this._cachedToken = next;
    else if (next === undefined) this._cachedToken = undefined;
    else this._cachedToken = undefined;
    const nextSub = typeof next === "string" ? decodeFluxyJwtPayload(next).sub : undefined;
    return decodeFluxyJwtPayload(prev ?? "").sub !== nextSub;
  }

  /** Expire cached anonymous token so the next resolve re-mints (stable anonId). */
  invalidateCredential(): void {
    this.credentials?.invalidate();
  }

  /** Join a public room without an account (P10-SB6). No API key required. */
  static async joinPublicRoomAsGuest(
    baseUrl: string,
    roomId: string,
    opts?: { displayName?: string; turnstileToken?: string },
  ): Promise<{
    token: string;
    userId: string;
    roomId: string;
    projectId: string;
    expiresIn: number;
    readOnly: boolean;
  }> {
    const url = new URL(
      `/public/rooms/${encodeURIComponent(roomId)}/guest-session`,
      trimTrailingSlashes(baseUrl),
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: opts?.displayName,
        turnstileToken: opts?.turnstileToken,
      }),
    });
    if (!res.ok) throw new Error(`Failed to join public room as guest: ${res.status}`);
    return res.json();
  }

  private authHeaders(): HeadersInit | undefined {
    if (this.token) {
      return {
        Authorization: `Bearer ${this.token}`,
      };
    }
    if (this.apiKey) {
      return {
        "X-Fluxy-Api-Key": this.apiKey,
      };
    }
    return undefined;
  }

  /**
   * Open a room WebSocket.
   *
   * SECURITY (SDK-1): the browser `WebSocket` API cannot send custom
   * headers, so the JWT is passed as the `token` query parameter. URLs
   * (including query strings) can be captured in reverse-proxy / CDN /
   * Cloudflare access logs and browser history. Mitigations:
   *   - Mint short-lived tokens (the Worker enforces `exp`).
   *   - Prefer dedicated, single-use connection tickets for the WS
   *     handshake instead of a long-lived session JWT where possible.
   * The same limitation applies to `connectSSE()` (EventSource).
   */
  connect(roomId: string, options?: FluxyWebSocketConnectOptions): WebSocket {
    const wsBase = httpUrlToWebSocketBase(this.baseUrl);
    const url = new URL(
      `/ws/room/${encodeURIComponent(roomId)}`,
      wsBase.endsWith("/") ? wsBase : `${wsBase}/`
    );
    if (this.apiKey) {
      url.searchParams.set("apiKey", this.apiKey);
    }
    if (this.token) {
      url.searchParams.set("token", this.token);
    }
    url.searchParams.set("userId", this.userId);
    if (options?.replay === "off") {
      url.searchParams.set("replay", "off");
    } else {
      if (options?.replay === "connect") {
        url.searchParams.set("replay", "connect");
      }
      if (options?.replayLimit != null && Number.isFinite(options.replayLimit)) {
        url.searchParams.set(
          "replayLimit",
          String(Math.max(1, Math.floor(options.replayLimit))),
        );
      }
    }
    if (options?.presenceInfo && Object.keys(options.presenceInfo).length) {
      url.searchParams.set("presenceInfo", JSON.stringify(options.presenceInfo));
    }
    if (options?.cache === "on") {
      url.searchParams.set("cache", "1");
    }
    return createFluxyWebSocket(url.toString(), this.usePartySocket);
  }

  /**
   * Resilient room WebSocket with typed errors, exponential backoff reconnect,
   * and optional REST history replay after reconnect.
   */
  connectRoom(roomId: string, options?: FluxyRoomConnectionOptions): FluxyChatRoomConnection {
    return new FluxyChatRoomConnection(this, roomId, {
      usePartySocket: this.usePartySocket,
      ...options,
    });
  }

  /**
   * REST snapshot of who's connected in a room right now (Portal-style
   * `getParticipants()`). Aggregated across shards for supergroup rooms
   * (P10-SB8). Returns `members: [{ userId, userInfo }]` plus occupancy stats.
   */
  async getRoomLive(roomId: string): Promise<FluxyRoomLive> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) {
      return {
        roomId: "",
        shardCount: 1,
        occupied: false,
        subscriptionCount: 0,
        userCount: 0,
        online: 0,
        users: [],
        members: [],
        socketIds: [],
      };
    }
    const url = new URL(`/rooms/${encodeURIComponent(trimmedRoomId)}/live`, this.baseUrl);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch room live snapshot: ${res.status}`);
    const body = (await res.json()) as Partial<FluxyRoomLive>;
    return {
      roomId: body.roomId ?? trimmedRoomId,
      shardCount: Number(body.shardCount ?? 1),
      occupied: Boolean(body.occupied),
      subscriptionCount: Number(body.subscriptionCount ?? body.online ?? 0),
      userCount: Number(body.userCount ?? (Array.isArray(body.users) ? body.users.length : 0)),
      online: Number(body.online ?? 0),
      users: Array.isArray(body.users) ? body.users : [],
      members: Array.isArray(body.members)
        ? body.members
            .filter((m): m is FluxyRoomLiveMember => !!m && typeof m.userId === "string")
            .map((m) => ({
              userId: m.userId,
              ...(m.userInfo && typeof m.userInfo === "object" ? { userInfo: m.userInfo } : {}),
            }))
        : [],
      socketIds: Array.isArray(body.socketIds) ? body.socketIds : [],
    };
  }

  /**
   * Portal-style `getParticipants()` alias: returns the `members` slice
   * (userId + userInfo) for the room right now. Use `getRoomLive()` if you
   * also need `online` / `subscriptionCount` / `socketIds`.
   */
  async getRoomParticipants(roomId: string): Promise<FluxyRoomLiveMember[]> {
    const live = await this.getRoomLive(roomId);
    return live.members;
  }

  connectSSE(roomId: string): EventSource | null {
    if (!this.token) return null;
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/stream`, this.baseUrl);
    url.searchParams.set("token", this.token);
    url.searchParams.set("userId", this.userId);
    return new EventSource(url.toString());
  }

  async fetchMessages(
    roomId: string,
    limitOrOptions: number | FetchMessagesOptions = 50,
  ): Promise<FluxyChatMessage[]> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return [];

    const options: FetchMessagesOptions =
      typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
    const limit = clampHistoryLimit(options.limit);

    const url = new URL("/api/messages", this.baseUrl);
    url.searchParams.set("roomId", trimmedRoomId);
    url.searchParams.set("limit", String(limit));
    if (options.before?.trim()) {
      url.searchParams.set("before", options.before.trim());
    }
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
    const body = await res.json();
    // Store reactions from response for later access via getLastFetchReactions()
    if (body.reactions && typeof body.reactions === "object") {
      this._lastFetchReactions = body.reactions;
    }
    return sortMessagesChronological((body.messages ?? []) as FluxyChatMessage[]);
  }

  /** Reactions map from the most recent fetchMessages call. */
  private _lastFetchReactions: Record<number, Record<string, number>> = {};
  get lastFetchReactions(): Record<number, Record<string, number>> {
    return this._lastFetchReactions;
  }

  /**
   * Pusher-style HTTP trigger: broadcast an event to multiple rooms.
   * Requires JWT; caller must be a member of each room (or project admin/owner).
   */
  async triggerEvents(options: {
    roomIds: string[];
    name?: string;
    data?: unknown;
    event?: Record<string, unknown>;
    excludeSocketId?: string;
  }): Promise<{ ok: boolean; triggered: string[]; failed?: string[] }> {
    if (!this.token) {
      throw new Error("triggerEvents requires a JWT token");
    }
    const res = await fetch(new URL("/events", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomIds: options.roomIds,
        name: options.name,
        data: options.data,
        event: options.event,
        excludeSocketId: options.excludeSocketId,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `triggerEvents failed: ${res.status}`,
      );
    }
    return body as { ok: boolean; triggered: string[]; failed?: string[] };
  }

  /**
   * Mint a member JWT via API key (Pusher-style user sign-in).
   * Returns token plus user-channel paths for WS + HTTP events.
   */
  async signIn(options?: {
    userId?: string;
    roles?: string[];
    ttlSeconds?: number;
  }): Promise<FluxySignInResponse> {
    if (!this.apiKey) {
      throw new Error("signIn requires apiKey on FluxyChatClient");
    }
    const res = await fetch(new URL("/auth/signin", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fluxy-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        userId: options?.userId ?? this.userId,
        roles: options?.roles,
        ttlSeconds: options?.ttlSeconds,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string" ? body.error : `signIn failed: ${res.status}`,
      );
    }
    return body as FluxySignInResponse;
  }

  /** WebSocket to the per-user channel (`/ws/user/:userId`). JWT `sub` must match userId. */
  connectUser(userId?: string): WebSocket {
    const uid = (userId ?? this.userId).trim();
    const wsBase = httpUrlToWebSocketBase(this.baseUrl);
    const url = new URL(
      `/ws/user/${encodeURIComponent(uid)}`,
      wsBase.endsWith("/") ? wsBase : `${wsBase}/`,
    );
    if (this.apiKey) url.searchParams.set("apiKey", this.apiKey);
    if (this.token) url.searchParams.set("token", this.token);
    url.searchParams.set("userId", uid);
    return createFluxyWebSocket(url.toString(), this.usePartySocket);
  }

  /**
   * Deliver an event to a user (user channel WS + optional room fanout).
   * Caller must be the same user or project admin/owner.
   */
  async triggerUserEvent(
    targetUserId: string,
    options: {
      name: string;
      data?: unknown;
      excludeSocketId?: string;
      /** When true (default), also deliver on room sockets the user is subscribed to. */
      fanoutRooms?: boolean;
    },
  ): Promise<{
    ok: boolean;
    userId: string;
    delivered: { userChannel: number; rooms: number };
  }> {
    if (!this.token) {
      throw new Error("triggerUserEvent requires a JWT token");
    }
    const res = await fetch(
      new URL(`/users/${encodeURIComponent(targetUserId)}/events`, this.baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeaders(),
        },
        body: JSON.stringify({
          name: options.name,
          data: options.data,
          excludeSocketId: options.excludeSocketId,
          fanoutRooms: options.fanoutRooms,
        }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `triggerUserEvent failed: ${res.status}`,
      );
    }
    return body as {
      ok: boolean;
      userId: string;
      delivered: { userChannel: number; rooms: number };
    };
  }

  /** Terminate all WebSocket connections for a user (admin/owner or self). */
  async terminateUserConnections(targetUserId: string): Promise<{
    ok: boolean;
    userId: string;
    closed: { userChannel: number; roomSockets: number };
  }> {
    if (!this.token) {
      throw new Error("terminateUserConnections requires a JWT token");
    }
    const res = await fetch(
      new URL(`/users/${encodeURIComponent(targetUserId)}/connections`, this.baseUrl).toString(),
      {
        method: "DELETE",
        headers: this.authHeaders(),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `terminateUserConnections failed: ${res.status}`,
      );
    }
    return body as {
      ok: boolean;
      userId: string;
      closed: { userChannel: number; roomSockets: number };
    };
  }

  async getWatchlist(userId?: string): Promise<{
    userId: string;
    targets: Array<{ type: string; targetId: string; createdAt: string }>;
  }> {
    if (!this.token) throw new Error("getWatchlist requires a JWT token");
    const uid = encodeURIComponent(userId ?? this.userId);
    const res = await fetch(new URL(`/users/${uid}/watchlist`, this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getWatchlist failed: ${res.status}`);
    return res.json();
  }

  async addWatchlistTarget(
    target: { type: "room" | "user"; targetId: string },
    userId?: string,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("addWatchlistTarget requires a JWT token");
    const uid = encodeURIComponent(userId ?? this.userId);
    const res = await fetch(new URL(`/users/${uid}/watchlist`, this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(target),
    });
    if (!res.ok) throw new Error(`addWatchlistTarget failed: ${res.status}`);
    return res.json();
  }

  async removeWatchlistTarget(
    target: { type: "room" | "user"; targetId: string },
    userId?: string,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("removeWatchlistTarget requires a JWT token");
    const uid = encodeURIComponent(userId ?? this.userId);
    const url = new URL(`/users/${uid}/watchlist`, this.baseUrl);
    url.searchParams.set("type", target.type);
    url.searchParams.set("targetId", target.targetId);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`removeWatchlistTarget failed: ${res.status}`);
    return res.json();
  }

  async listMessageTemplates(): Promise<import("./message-template").FluxyMessageTemplate[]> {
    if (!this.token) return [];
    const res = await fetch(new URL("/templates", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
    const body = await res.json();
    return body.templates ?? [];
  }

  async createMessageTemplate(
    name: string,
    body: string,
  ): Promise<import("./message-template").FluxyMessageTemplate | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/templates", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ name, body }),
    });
    if (!res.ok) throw new Error(`Failed to create template: ${res.status}`);
    const json = await res.json();
    return json.template ?? null;
  }

  async updateMessageTemplate(
    templateId: string,
    patch: { name?: string; body?: string },
  ): Promise<import("./message-template").FluxyMessageTemplate | null> {
    if (!this.token) return null;
    const url = new URL(`/templates/${encodeURIComponent(templateId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update template: ${res.status}`);
    const json = await res.json();
    return json.template ?? null;
  }

  async deleteMessageTemplate(templateId: string): Promise<boolean> {
    if (!this.token) return false;
    const url = new URL(`/templates/${encodeURIComponent(templateId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    return res.ok;
  }

  async renderMessageTemplate(options: {
    templateId?: string;
    body?: string;
    vars?: Record<string, string | number | boolean | null | undefined>;
  }): Promise<string> {
    if (!this.token) throw new Error("JWT is required to render templates");
    const res = await fetch(new URL("/templates/render", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        templateId: options.templateId,
        body: options.body,
        vars: options.vars,
        templateVars: options.vars,
      }),
    });
    if (!res.ok) throw new Error(`Failed to render template: ${res.status}`);
    const json = await res.json();
    return String(json.content ?? "");
  }

  async listActivities(options?: {
    limit?: number;
    roomId?: string;
  }): Promise<import("./message-template").FluxyProjectActivity[]> {
    if (!this.token) return [];
    const url = new URL("/activities", this.baseUrl);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    if (options?.roomId?.trim()) url.searchParams.set("roomId", options.roomId.trim());
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list activities: ${res.status}`);
    const body = await res.json();
    return body.activities ?? [];
  }

  async updateMemberPreferences(
    roomId: string,
    patch: { notifyEnabled?: boolean; preferences?: Record<string, unknown> },
  ): Promise<FluxyRoomMember | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/members/me/preferences`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update member preferences: ${res.status}`);
    const body = await res.json();
    const member = body.member;
    if (!member) return null;
    return normalizeRoomMembers([member])[0] ?? null;
  }

  async fetchRoomMembers(roomId: string): Promise<FluxyRoomMember[]> {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return [];
    const url = new URL(`/rooms/${encodeURIComponent(trimmedRoomId)}/members`, this.baseUrl);
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch room members: ${res.status}`);
    const body = await res.json();
    return normalizeRoomMembers(body.members ?? []);
  }

  /** Fetch optional room E2E key (members only, when room has `e2eEnabled`). */
  async getRoomE2eKey(
    roomId: string,
  ): Promise<{ e2eEnabled: boolean; e2eKey?: string } | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return null;
    const res = await fetch(
      new URL(`/rooms/${encodeURIComponent(trimmedRoomId)}/e2e-key`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) return null;
    return res.json() as Promise<{ e2eEnabled: boolean; e2eKey?: string }>;
  }

  /** Alias for {@link fetchMessages} â€” chronological room history via REST. */
  fetchRoomHistory(
    roomId: string,
    options?: FetchMessagesOptions,
  ): Promise<FluxyChatMessage[]> {
    return this.fetchMessages(roomId, options ?? {});
  }

  async listRooms(type?: string): Promise<FluxyChatRoom[]> {
    const url = new URL("/rooms", this.baseUrl);
    if (type) url.searchParams.set("type", type);
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load rooms: ${res.status}`);
    const body = await res.json();
    return body.rooms ?? [];
  }

  // --- Authenticated REST helpers (used opportunistically by hooks) ---

  async createMessage(
    roomId: string,
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[],
    clientMessageId?: string,
    options?: import("./message-template").FluxySendMessageOptions,
  ): Promise<FluxyChatMessage | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/messages", this.baseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomId,
        content: options?.templateId ? content || "" : content,
        replyTo: replyTo ?? null,
        ...(attachments?.length ? { attachments } : {}),
        ...(clientMessageId?.trim() ? { clientMessageId: clientMessageId.trim() } : {}),
        ...(options?.templateId ? { templateId: options.templateId } : {}),
        ...(options?.templateVars ? { templateVars: options.templateVars } : {}),
        ...(options?.expiresInSeconds != null
          ? { expiresInSeconds: options.expiresInSeconds }
          : {}),
        ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
        ...(options?.visibility ? { visibility: options.visibility } : {}),
        ...(options?.visibleTo?.length ? { visibleTo: options.visibleTo } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create message: ${res.status}`);
    }
    const body = await res.json();
    return body.message ?? null;
  }

  /** Ephemeral whisper — visible only to `visibleToUserId` (Portal B-10). */
  async postEphemeral(
    roomId: string,
    content: string,
    visibleToUserId: string,
    options?: { expiresInSeconds?: number },
  ): Promise<FluxyChatMessage | null> {
    return this.createMessage(roomId, content, null, undefined, undefined, {
      visibility: "whisper",
      visibleTo: [visibleToUserId],
      expiresInSeconds: options?.expiresInSeconds ?? 3600,
    });
  }

  /** Send rich interactive card (Portal B-1). */
  async sendCard(
    roomId: string,
    card: import("./cards").CardElement,
    options?: { parentId?: number | null },
  ): Promise<FluxyChatMessage | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/api/cards/send", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ roomId, card, parentId: options?.parentId ?? null }),
    });
    if (!res.ok) throw new Error(`sendCard failed: ${res.status}`);
    const body = (await res.json()) as { message?: FluxyChatMessage };
    return body.message ?? null;
  }

  /** Chat history → AI SDK messages (Portal B-2). */
  async toAiMessagesFromRoom(
    roomId: string,
    options?: import("./messages-to-ai").ToAiMessagesOptions,
  ) {
    const { toAiMessages } = await import("./messages-to-ai");
    const messages = await this.fetchMessages(roomId, { limit: 50 });
    return toAiMessages(messages, options);
  }

  /** Per-thread typed KV state (Portal B-5). */
  async getThreadState<T = Record<string, unknown>>(threadId: string): Promise<T | null> {
    if (!this.token) return null;
    const res = await fetch(
      new URL(`/api/threads/${encodeURIComponent(threadId)}/state`, this.baseUrl).toString(),
      { headers: this.authHeaders() },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { state?: T | null };
    return body.state ?? null;
  }

  async setThreadState(
    threadId: string,
    state: Record<string, unknown>,
    ttlMs?: number,
  ): Promise<boolean> {
    if (!this.token) return false;
    const res = await fetch(
      new URL(`/api/threads/${encodeURIComponent(threadId)}/state`, this.baseUrl).toString(),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify({ state, ttlMs }),
      },
    );
    return res.ok;
  }

  async deleteThreadState(threadId: string): Promise<boolean> {
    if (!this.token) return false;
    const res = await fetch(
      new URL(`/api/threads/${encodeURIComponent(threadId)}/state`, this.baseUrl).toString(),
      { method: "DELETE", headers: this.authHeaders() },
    );
    return res.ok;
  }

  /**
   * Upload a recorded voice message to `POST /messages/voice` (P12-B).
   *
   * The Worker stores the audio in R2, broadcasts a `message` event with
   * `kind: "voice"` and `transcriptionStatus: "pending"`, then runs the
   * async transcription and broadcasts a `message_updated` event with the
   * transcript a few seconds later. Subscribe to the room session events
   * to surface the transcript inline.
   *
   * @param roomId  Target room.
   * @param audio   A `Blob` / `File` recorded with `MediaRecorder`
   *                (webm/ogg/mp3/m4a/wav; max 10 MB; max 10 min).
   * @param options Optional `parentId` (reply target), `durationMs`
   *                (client-measured length), and `clientMessageId`
   *                (optimistic-UI id).
   * @returns The created message envelope with `kind: "voice"` and
   *          `transcriptionStatus: "pending"`, or `null` if no JWT is set.
   */
  async sendVoiceMessage(
    roomId: string,
    audio: Blob,
    options?: { parentId?: number | null; durationMs?: number | null; clientMessageId?: string | null },
  ): Promise<FluxyChatMessage | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) return null;
    const form = new FormData();
    const baseMime = audio.type?.split(";")[0]?.trim() || "audio/webm";
    const uploadBlob =
      audio instanceof File && audio.type === baseMime
        ? audio
        : new File([audio], "voice.webm", { type: baseMime });
    form.append("audio", uploadBlob);
    form.append("roomId", trimmedRoomId);
    if (options?.parentId != null) form.append("parentId", String(options.parentId));
    if (options?.durationMs != null) form.append("durationMs", String(options.durationMs));
    if (options?.clientMessageId?.trim()) {
      form.append("clientMessageId", options.clientMessageId.trim());
    }
    const url = new URL("/messages/voice", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.authHeaders() },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`sendVoiceMessage failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      messageId: number;
      kind: "voice";
      audioUrl: string;
      durationMs?: number | null;
      transcriptionStatus: "pending" | "done" | "failed";
      createdAt: string;
    };
    return {
      id: body.messageId,
      roomId: trimmedRoomId,
      userId: this.userId,
      content: "",
      createdAt: body.createdAt,
      parentId: options?.parentId ?? null,
      kind: "voice",
      audioUrl: body.audioUrl,
      audioMimeType: audio.type || null,
      audioSizeBytes: audio.size,
      durationMs: body.durationMs ?? null,
      transcription: null,
      transcriptionStatus: body.transcriptionStatus,
      clientMessageId: options?.clientMessageId ?? undefined,
    };
  }

  /**
   * Request AI reply suggestions for a room.
   *
   * @param roomId   The room to generate suggestions for.
   * @param parentId Optional reply-target message id for context.
   * @returns Up to 3 short suggestion strings, or `null` if no JWT.
   */
  /**
   * Summarize a reply thread anchored at a message (P12-M).
   */
  async summarizeThread(
    messageId: number,
    roomId: string,
  ): Promise<{
    summary: string;
    rootMessageId: number;
    messageCount: number;
    truncated?: boolean;
  } | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId || !Number.isFinite(messageId) || messageId <= 0) return null;
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/summary`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomId: trimmedRoomId }),
    });
    if (!res.ok) {
      throw new Error(`summarizeThread failed: ${res.status}`);
    }
    return (await res.json()) as {
      summary: string;
      rootMessageId: number;
      messageCount: number;
      truncated?: boolean;
    };
  }

  async suggestReplies(
    roomId: string,
    parentId?: number | null,
  ): Promise<string[] | null> {
    if (!this.token) return null;
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) return null;
    const url = new URL("/messages/suggest-replies", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: trimmedRoomId,
        ...(parentId != null ? { parentId } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`suggestReplies failed: ${res.status}`);
    }
    const body = (await res.json()) as { suggestions?: string[] };
    return Array.isArray(body.suggestions) ? body.suggestions : [];
  }

  /** Daily digest preferences (P12-F). */
  async getDigestPreferences(): Promise<{
    enabled: boolean;
    email: string | null;
    emailEnabled: boolean;
    webPushEnabled: boolean;
    inAppEnabled: boolean;
    updatedAt: string | null;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/digest/preferences", this.baseUrl).toString();
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getDigestPreferences failed: ${res.status}`);
    const body = (await res.json()) as { preferences?: Record<string, unknown> };
    const p = body.preferences || {};
    return {
      enabled: Boolean(p.enabled),
      email: typeof p.email === "string" ? p.email : null,
      emailEnabled: p.emailEnabled !== false,
      webPushEnabled: p.webPushEnabled !== false,
      inAppEnabled: p.inAppEnabled !== false,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
    };
  }

  /** Quiet hours + batched notifications (P12-N). */
  async getQuietHoursPreferences(): Promise<{
    preferences: FluxyQuietHoursPreferences;
    pendingBatch: number;
    inQuietHours: boolean;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/notifications/quiet-hours", this.baseUrl).toString();
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getQuietHoursPreferences failed: ${res.status}`);
    return (await res.json()) as {
      preferences: FluxyQuietHoursPreferences;
      pendingBatch: number;
      inQuietHours: boolean;
    };
  }

  async updateQuietHoursPreferences(patch: {
    enabled?: boolean;
    timezone?: string;
    quietStart?: string;
    quietEnd?: string;
    batchPush?: boolean;
    batchInApp?: boolean;
  }): Promise<{
    preferences: FluxyQuietHoursPreferences;
    pendingBatch: number;
    inQuietHours: boolean;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/notifications/quiet-hours", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateQuietHoursPreferences failed: ${res.status}`);
    return (await res.json()) as {
      preferences: FluxyQuietHoursPreferences;
      pendingBatch: number;
      inQuietHours: boolean;
    };
  }

  async flushNotificationBatch(): Promise<{
    ok: boolean;
    flushed: number;
    push?: number;
    inApp?: number;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/notifications/flush-batch", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`flushNotificationBatch failed: ${res.status}`);
    return (await res.json()) as {
      ok: boolean;
      flushed: number;
      push?: number;
      inApp?: number;
    };
  }

  async updateDigestPreferences(patch: {
    enabled?: boolean;
    email?: string | null;
    emailEnabled?: boolean;
    webPushEnabled?: boolean;
    inAppEnabled?: boolean;
  }): Promise<{
    enabled: boolean;
    email: string | null;
    emailEnabled: boolean;
    webPushEnabled: boolean;
    inAppEnabled: boolean;
    updatedAt: string | null;
  } | null> {
    if (!this.token) return null;
    const url = new URL("/digest/preferences", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateDigestPreferences failed: ${res.status}`);
    const body = (await res.json()) as { preferences?: Record<string, unknown> };
    const p = body.preferences || {};
    return {
      enabled: Boolean(p.enabled),
      email: typeof p.email === "string" ? p.email : null,
      emailEnabled: p.emailEnabled !== false,
      webPushEnabled: p.webPushEnabled !== false,
      inAppEnabled: p.inAppEnabled !== false,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
    };
  }

  /** Full-text message search (P12-E). */
  async searchMessages(
    query: string,
    options?: { roomId?: string; from?: string; to?: string; limit?: number },
  ): Promise<{ query: string; results: Array<{
    id: number;
    roomId: string;
    userId: string;
    content: string;
    createdAt: string;
    snippet: string;
  }> } | null> {
    if (!this.token) return null;
    const trimmed = query?.trim();
    if (!trimmed) return { query: "", results: [] };
    const url = new URL("/search/messages", this.baseUrl);
    url.searchParams.set("q", trimmed);
    if (options?.roomId) url.searchParams.set("roomId", options.roomId);
    if (options?.from) url.searchParams.set("from", options.from);
    if (options?.to) url.searchParams.set("to", options.to);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`searchMessages failed: ${res.status}`);
    return (await res.json()) as {
      query: string;
      results: Array<{
        id: number;
        roomId: string;
        userId: string;
        content: string;
        createdAt: string;
        snippet: string;
      }>;
    };
  }

  /** Unified inbox summary (P12-C). Optional `where` filter (Portal §6) — server-side when passed as query params. */
  async getInbox(query?: FluxyInboxQuery): Promise<FluxyInboxSummary | null> {
    await this.resolveToken();
    if (!this.token) return null;
    const url = new URL("/inbox", this.baseUrl);
    if (query?.roomId) url.searchParams.set("roomId", query.roomId);
    if (query?.where) url.searchParams.set("where", JSON.stringify(query.where));
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getInbox failed: ${res.status}`);
    return (await res.json()) as FluxyInboxSummary;
  }

  async snoozeRoom(
    roomId: string,
    options: { until?: string; minutes?: number; hours?: number },
  ): Promise<{ ok: boolean; snoozeUntil?: string } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/inbox/rooms/${encodeURIComponent(roomId)}/snooze`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(`snoozeRoom failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; snoozeUntil?: string };
  }

  async unsnoozeRoom(roomId: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/inbox/rooms/${encodeURIComponent(roomId)}/snooze`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { method: "DELETE", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`unsnoozeRoom failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async createInboxFollowUp(input: {
    roomId: string;
    messageId?: number | null;
    note?: string | null;
    dueAt?: string | null;
  }): Promise<{ ok: boolean; id: string } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/inbox/follow-ups", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`createInboxFollowUp failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; id: string };
  }

  async completeInboxFollowUp(id: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(`/inbox/follow-ups/${encodeURIComponent(id)}`, this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (!res.ok) throw new Error(`completeInboxFollowUp failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  /** Agent task queue (P13-T4) â€” requires moderator/admin/owner JWT. */
  async getAgentQueue(options?: {
    status?: "resolved" | "cancelled";
    assignee?: "me" | "all";
    limit?: number;
  }): Promise<FluxyAgentQueueSummary | null> {
    if (!this.token) return null;
    const url = new URL("/agent-queue", this.baseUrl);
    if (options?.status) url.searchParams.set("status", options.status);
    if (options?.assignee) url.searchParams.set("assignee", options.assignee);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getAgentQueue failed: ${res.status}`);
    return (await res.json()) as FluxyAgentQueueSummary;
  }

  async createAgentTask(input: {
    roomId: string;
    note?: string | null;
    priority?: number;
    slaMinutes?: number;
  }): Promise<FluxyAgentTask | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/agent-queue", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`createAgentTask failed: ${res.status}`);
    return (await res.json()) as FluxyAgentTask;
  }

  async claimAgentTask(taskId: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/agent-queue/${encodeURIComponent(taskId)}/claim`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { method: "POST", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`claimAgentTask failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async releaseAgentTask(taskId: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/agent-queue/${encodeURIComponent(taskId)}/release`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { method: "POST", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`releaseAgentTask failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async resolveAgentTask(
    taskId: string,
    input: { status: "resolved" | "cancelled"; disposition?: string | null },
  ): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(`/agent-queue/${encodeURIComponent(taskId)}`, this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`resolveAgentTask failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async getAgentDispositions(): Promise<{ dispositions: FluxyAgentDisposition[] } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/agent-queue/dispositions", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getAgentDispositions failed: ${res.status}`);
    return (await res.json()) as { dispositions: FluxyAgentDisposition[] };
  }

  async getAgentQueueStats(): Promise<{
    total: number;
    breakdown: Array<FluxyAgentDisposition & { count: number }>;
    unknown: Array<{ code: string; count: number }>;
  } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/agent-queue/stats", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getAgentQueueStats failed: ${res.status}`);
    return (await res.json()) as {
      total: number;
      breakdown: Array<FluxyAgentDisposition & { count: number }>;
      unknown: Array<{ code: string; count: number }>;
    };
  }

  async getRoomHandoff(roomId: string): Promise<{
    handoff: FluxyRoomHandoffState;
    dispositions?: FluxyAgentDisposition[];
  } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/handoff`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`getRoomHandoff failed: ${res.status}`);
    return (await res.json()) as {
      handoff: FluxyRoomHandoffState;
      dispositions?: FluxyAgentDisposition[];
    };
  }

  async requestRoomHandoff(
    roomId: string,
    input?: { agentId?: string; note?: string | null },
  ): Promise<{ ok: boolean; handoff?: FluxyRoomHandoffState } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/handoff`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    if (!res.ok) throw new Error(`requestRoomHandoff failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; handoff?: FluxyRoomHandoffState };
  }

  async listCustomDomains(): Promise<{ domains: FluxyCustomDomain[] } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/custom-domains", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`listCustomDomains failed: ${res.status}`);
    return (await res.json()) as { domains: FluxyCustomDomain[] };
  }

  async createCustomDomain(input: {
    hostname: string;
    defaultRoomId?: string | null;
    brandName?: string | null;
    brandLogoUrl?: string | null;
    allowedOrigins?: string[];
  }): Promise<FluxyCustomDomain | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/custom-domains", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`createCustomDomain failed: ${res.status}`);
    return (await res.json()) as FluxyCustomDomain;
  }

  async updateCustomDomain(
    id: string,
    input: {
      status?: "pending" | "active" | "disabled";
      defaultRoomId?: string | null;
      brandName?: string | null;
      brandLogoUrl?: string | null;
      allowedOrigins?: string[];
    },
  ): Promise<FluxyCustomDomain | null> {
    if (!this.token) return null;
    const url = new URL(`/admin/custom-domains/${encodeURIComponent(id)}`, this.baseUrl).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`updateCustomDomain failed: ${res.status}`);
    return (await res.json()) as FluxyCustomDomain;
  }

  async deleteCustomDomain(id: string): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(`/admin/custom-domains/${encodeURIComponent(id)}`, this.baseUrl).toString();
    const res = await fetch(url, { method: "DELETE", headers: this.authHeaders() });
    if (!res.ok) throw new Error(`deleteCustomDomain failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  async getPublicHostConfig(): Promise<FluxyPublicHostConfig | null> {
    const res = await fetch(new URL("/public/host-config", this.baseUrl).toString());
    if (!res.ok) throw new Error(`getPublicHostConfig failed: ${res.status}`);
    return (await res.json()) as FluxyPublicHostConfig;
  }

  /** P12-J â€” Flagship flags with env fallback; optional JWT for user targeting. */
  async getFeatureFlags(): Promise<FluxyClientFeatureFlags> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(new URL("/client/feature-flags", this.baseUrl).toString(), {
      headers,
    });
    if (!res.ok) throw new Error(`getFeatureFlags failed: ${res.status}`);
    return (await res.json()) as FluxyClientFeatureFlags;
  }

  /** Server-authored SDK defaults from `fluxy.config` (`GET /config/client`). */
  async getClientConfig(): Promise<{
    client: import("@fluxy-chat/config").FluxyClientDefaults;
    source: string;
  } | null> {
    const res = await fetch(new URL("/config/client", this.baseUrl).toString());
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getClientConfig failed: ${res.status}`);
    return (await res.json()) as {
      client: import("@fluxy-chat/config").FluxyClientDefaults;
      source: string;
    };
  }

  async getEmbedConfig(): Promise<{ config: FluxyEmbedConfig; snippet: string } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/embed-config", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getEmbedConfig failed: ${res.status}`);
    return (await res.json()) as { config: FluxyEmbedConfig; snippet: string };
  }

  async updateEmbedConfig(input: {
    enabled?: boolean;
    defaultRoomId?: string | null;
    allowedOrigins?: string[];
    zIndex?: number;
    launcherTitle?: string | null;
    theme?: Partial<FluxyEmbedTheme>;
  }): Promise<{ config: FluxyEmbedConfig; snippet: string } | null> {
    if (!this.token) return null;
    const res = await fetch(new URL("/admin/embed-config", this.baseUrl).toString(), {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`updateEmbedConfig failed: ${res.status}`);
    return (await res.json()) as { config: FluxyEmbedConfig; snippet: string };
  }

  async getPublicEmbedConfig(): Promise<FluxyPublicEmbedConfig | null> {
    const res = await fetch(new URL("/public/embed-config", this.baseUrl).toString());
    if (!res.ok) throw new Error(`getPublicEmbedConfig failed: ${res.status}`);
    return (await res.json()) as FluxyPublicEmbedConfig;
  }

  async resolveRoomHandoff(
    roomId: string,
    disposition: string,
  ): Promise<{ ok: boolean } | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/handoff`,
      this.baseUrl,
    ).toString();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ disposition }),
    });
    if (!res.ok) throw new Error(`resolveRoomHandoff failed: ${res.status}`);
    return (await res.json()) as { ok: boolean };
  }

  /**
   * Upload to Worker `POST /upload` (requires JWT). Returns attachment fields for composing a message.
   */
  async uploadFile(roomId: string, file: File): Promise<FluxyChatAttachment> {
    if (!this.token) {
      throw new Error("JWT is required for uploads");
    }
    const contentType = file.type || "application/octet-stream";
    const url = new URL("/upload", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${this.token}`,
        "X-File-Name": file.name.slice(0, 255),
        "X-Room-Id": roomId,
      },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      file?: { url?: string; name?: string; size?: number; contentType?: string };
    };
    const f = json.file;
    if (!f?.url) throw new Error("Invalid upload response");
    return {
      kind: inferAttachmentKind(contentType, file.name || f.name || ""),
      url: f.url,
      name: (f.name || file.name || "upload").slice(0, 255),
      sizeBytes: typeof f.size === "number" ? f.size : file.size,
      contentType,
    };
  }

  /**
   * Generate an image via Worker `POST /ai-images/generate` (requires JWT).
   * Returns attachment fields suitable for composing a chat message when successful.
   */
  async generateAiImage(
    roomId: string,
    prompt: string,
    options?: {
      size?: string;
      quality?: string;
      style?: string;
      model?: string;
      messageId?: number;
    },
  ): Promise<{
    ok: boolean;
    attachment?: FluxyChatAttachment;
    id?: string;
    revisedPrompt?: string;
    error?: string;
    details?: string;
  }> {
    if (!this.token) {
      throw new Error("JWT is required for image generation");
    }
    const url = new URL("/ai-images/generate", this.baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomId,
        prompt,
        size: options?.size,
        quality: options?.quality,
        style: options?.style,
        model: options?.model,
        messageId: options?.messageId,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      details?: string;
      id?: string;
      imageUrl?: string;
      revisedPrompt?: string;
    };
    if (!res.ok || !json.ok || !json.imageUrl) {
      return {
        ok: false,
        error: json.error || `Image generation failed (${res.status})`,
        details: json.details,
      };
    }
    const imageUrl = json.imageUrl.startsWith("http")
      ? json.imageUrl
      : new URL(json.imageUrl, this.baseUrl).toString();
    return {
      ok: true,
      id: json.id,
      revisedPrompt: json.revisedPrompt,
      attachment: {
        kind: "image",
        url: imageUrl,
        name: `generated-${json.id?.slice(0, 8) || "image"}.png`,
        contentType: "image/png",
      },
    };
  }

  async editMessageRest(messageId: number, content: string): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/messages/${messageId}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error(`Failed to edit message: ${res.status}`);
    }
  }

  async deleteMessageRest(messageId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/messages/${messageId}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to delete message: ${res.status}`);
    }
  }

  async sendReactionRest(
    messageId: number,
    emoji: string,
    op: "add" | "remove" = "add"
  ): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/messages/${messageId}/reactions`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: op === "remove" ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update reaction: ${res.status}`);
    }
  }

  async listNotifications(options?: {
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<FluxyInAppNotification[]> {
    if (!this.token) return [];
    const url = new URL("/notifications", this.baseUrl);
    if (options?.limit) url.searchParams.set("limit", String(options.limit));
    if (options?.unreadOnly) url.searchParams.set("unreadOnly", "1");
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list notifications: ${res.status}`);
    const body = await res.json();
    return body.notifications ?? [];
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(
      `/notifications/${notificationId}/read`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark notification read: ${res.status}`);
  }

  async markAllNotificationsRead(): Promise<void> {
    if (!this.token) return;
    const url = new URL("/notifications/read-all", this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark notifications read: ${res.status}`);
  }

  async markReadRest(roomId: string, messageId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/read`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      throw new Error(`Failed to mark read: ${res.status}`);
    }
  }

  async getRoomCatchUp(roomId: string): Promise<FluxyRoomCatchUp> {
    if (!this.token) {
      return { unreadCount: 0, lastReadMessageId: 0, firstUnreadMessageId: null };
    }
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/unread`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to get room catch-up: ${res.status}`);
    }
    const body = await res.json();
    return {
      unreadCount: Number(body.unreadCount) || 0,
      lastReadMessageId: Number(body.lastReadMessageId) || 0,
      firstUnreadMessageId:
        body.firstUnreadMessageId != null ? Number(body.firstUnreadMessageId) : null,
    };
  }

  async getRoomDraft(roomId: string): Promise<FluxyRoomMessageDraft | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/draft`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to get room draft: ${res.status}`);
    }
    const body = await res.json();
    const draft = body.draft;
    if (!draft || typeof draft.content !== "string" || !draft.content.trim()) {
      return null;
    }
    return {
      content: draft.content,
      replyToId:
        draft.replyToId != null && draft.replyToId !== ""
          ? Number(draft.replyToId)
          : null,
      updatedAt: String(draft.updatedAt ?? ""),
    };
  }

  async getRoomHealth(roomId: string): Promise<Record<string, unknown>> {
    if (!this.token) return {};
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/health`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get room health: ${res.status}`);
    return res.json();
  }

  async pinMessage(
    roomId: string,
    messageId: number | null,
  ): Promise<{ ok: boolean; roomId: string; pinnedMessageId: number | null }> {
    if (!this.token) throw new Error("pinMessage requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pin`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) throw new Error(`Failed to pin message: ${res.status}`);
    return res.json();
  }

  async terminateRoomConnection(
    roomId: string,
    socketId: string,
    reason?: string,
  ): Promise<{ ok: boolean; closed?: number; socketId?: string }> {
    if (!this.token) throw new Error("terminateRoomConnection requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/terminate-connection`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ socketId, reason }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Failed to terminate connection: ${res.status}`);
    return body;
  }

  async createPoll(
    roomId: string,
    poll: { question: string; options: string[]; allowMultiple?: boolean },
    opts?: { replyTo?: number | null; clientMessageId?: string },
  ): Promise<{ message: Record<string, unknown> }> {
    if (!this.token) throw new Error("createPoll requires JWT token");
    const res = await fetch(new URL("/messages", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        poll,
        replyTo: opts?.replyTo ?? undefined,
        clientMessageId: opts?.clientMessageId,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create poll: ${res.status}`);
    return res.json();
  }

  async votePoll(
    messageId: number,
    optionIndex: number,
  ): Promise<{ ok: boolean; poll: Record<string, unknown> }> {
    if (!this.token) throw new Error("votePoll requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/vote`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndex }),
    });
    if (!res.ok) throw new Error(`Failed to vote: ${res.status}`);
    return res.json();
  }

  async getPoll(messageId: number): Promise<Record<string, unknown>> {
    if (!this.token) throw new Error("getPoll requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/poll`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get poll: ${res.status}`);
    const body = await res.json();
    return body.poll ?? body;
  }

  async closePoll(
    messageId: number,
  ): Promise<{ ok: boolean; poll: Record<string, unknown> }> {
    if (!this.token) throw new Error("closePoll requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/poll`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ closed: true }),
    });
    if (!res.ok) throw new Error(`Failed to close poll: ${res.status}`);
    return res.json();
  }

  async listRoomPins(
    roomId: string,
    opts?: { category?: string; limit?: number },
  ): Promise<{ ok: boolean; pins: Array<Record<string, unknown>>; count: number }> {
    if (!this.token) throw new Error("listRoomPins requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pins`,
      this.baseUrl,
    );
    if (opts?.category) url.searchParams.set("category", opts.category);
    if (opts?.limit) url.searchParams.set("limit", String(opts.limit));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list pins: ${res.status}`);
    return res.json();
  }

  async pinRoomMessage(
    roomId: string,
    messageId: number,
    category?: string,
  ): Promise<{ ok: boolean; pin: Record<string, unknown> }> {
    if (!this.token) throw new Error("pinRoomMessage requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pins`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, category }),
    });
    if (!res.ok) throw new Error(`Failed to pin message: ${res.status}`);
    return res.json();
  }

  async unpinRoomMessage(
    roomId: string,
    messageId: number,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("unpinRoomMessage requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/pins/${messageId}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unpin message: ${res.status}`);
    return res.json();
  }

  async listBreakouts(
    roomId: string,
  ): Promise<{ ok: boolean; breakouts: Array<Record<string, unknown>> }> {
    if (!this.token) throw new Error("listBreakouts requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/breakouts`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list breakouts: ${res.status}`);
    return res.json();
  }

  async createBreakout(
    roomId: string,
    name: string,
  ): Promise<{ ok: boolean; breakout: Record<string, unknown> }> {
    if (!this.token) throw new Error("createBreakout requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/breakouts`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create breakout: ${res.status}`);
    return res.json();
  }

  async closeBreakout(
    roomId: string,
    breakoutId: string,
  ): Promise<{ ok: boolean; closedAt?: string }> {
    if (!this.token) throw new Error("closeBreakout requires JWT token");
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/breakouts/${encodeURIComponent(breakoutId)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to close breakout: ${res.status}`);
    return res.json();
  }

  async reportMessage(
    roomId: string,
    messageId: number,
    reason?: string,
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("reportMessage requires JWT token");
    const res = await fetch(new URL("/reports", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, messageId, reason }),
    });
    if (!res.ok) throw new Error(`Failed to report message: ${res.status}`);
    return res.json();
  }

  async listBlocks(): Promise<{ userId: string; blockedAt: string }[]> {
    if (!this.token) throw new Error("listBlocks requires JWT token");
    const res = await fetch(new URL("/blocks", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list blocks: ${res.status}`);
    const body = await res.json();
    return body.blocks ?? [];
  }

  async blockUser(userId: string): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("blockUser requires JWT token");
    const res = await fetch(new URL("/blocks", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(`Failed to block user: ${res.status}`);
    return res.json();
  }

  async unblockUser(userId: string): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("unblockUser requires JWT token");
    const url = new URL(
      `/blocks/${encodeURIComponent(userId)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unblock user: ${res.status}`);
    return res.json();
  }

  async authorizeChannel(
    socketId: string,
    roomIdOrChannel: string,
    presenceInfo?: Record<string, unknown>,
  ): Promise<{ auth: string; channel_data?: string; roomId: string }> {
    if (!this.token) throw new Error("authorizeChannel requires JWT token");
    const isChannelName = roomIdOrChannel.includes("-room-");
    const res = await fetch(new URL("/auth/channel", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        socket_id: socketId,
        ...(isChannelName
          ? { channel_name: roomIdOrChannel }
          : { roomId: roomIdOrChannel }),
        presenceInfo,
      }),
    });
    if (!res.ok) throw new Error(`Channel auth failed: ${res.status}`);
    return res.json();
  }

  async translateMessage(
    messageId: number,
    targetLang: string,
    sourceLang?: string,
  ): Promise<{
    messageId: number;
    cached: boolean;
    translation: { targetLang: string; translatedText: string; sourceLang?: string };
  }> {
    if (!this.token) throw new Error("translateMessage requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/translate`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ targetLang, sourceLang }),
    });
    if (!res.ok) throw new Error(`Failed to translate message: ${res.status}`);
    return res.json();
  }

  async markMessageDelivered(messageId: number): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("markMessageDelivered requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/delivered`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark delivered: ${res.status}`);
    return res.json();
  }

  async getMessageDeliveries(messageId: number): Promise<{
    messageId: number;
    deliveries: { userId: string; status: string; updatedAt: string }[];
  }> {
    if (!this.token) throw new Error("getMessageDeliveries requires JWT token");
    const url = new URL(
      `/messages/${encodeURIComponent(String(messageId))}/deliveries`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get deliveries: ${res.status}`);
    return res.json();
  }

  async registerPushDevice(
    platform: "fcm" | "web",
    token: string,
  ): Promise<{ ok: boolean; id: string }> {
    if (!this.token) throw new Error("registerPushDevice requires JWT token");
    const res = await fetch(new URL("/push/devices", this.baseUrl).toString(), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ platform, token }),
    });
    if (!res.ok) throw new Error(`Failed to register push device: ${res.status}`);
    return res.json();
  }

  async unregisterPushDevice(deviceId: string): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("unregisterPushDevice requires JWT token");
    const url = new URL(
      `/push/devices/${encodeURIComponent(deviceId)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unregister push device: ${res.status}`);
    return res.json();
  }

  // ---------- Web Push / VAPID (P10-ext, Pusher Beams gap) ----------

  /**
   * Fetch the VAPID public key (and subject) for the project. Required before
   * `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
   * The public key is not secret.
   */
  async getVapidPublicKey(
    projectId?: string,
  ): Promise<{ publicKey: string; subject: string }> {
    const url = new URL("/push/web/vapid-public-key", this.baseUrl);
    if (projectId) url.searchParams.set("projectId", projectId);
    const res = await fetch(url.toString(), {
      headers: { "X-Fluxy-Project-Id": projectId || "" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch VAPID public key: ${res.status} ${(body as { error?: string }).error || ""}`,
      );
    }
    return res.json();
  }

  /**
   * Register a browser `PushSubscription` against the current JWT user.
   * Pass the result of `await registration.pushManager.subscribe(...)`.
   */
  async registerWebPush(
    subscription: PushSubscription,
    options?: { userAgent?: string; projectId?: string },
  ): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("registerWebPush requires JWT token");
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error("registerWebPush: invalid PushSubscription (missing endpoint/keys)");
    }
    const headers: Record<string, string> = {
      ...(this.authHeaders() as Record<string, string>),
      "Content-Type": "application/json",
    };
    if (options?.projectId) headers["X-Fluxy-Project-Id"] = options.projectId;
    const res = await fetch(new URL("/push/web/subscribe", this.baseUrl).toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: options?.userAgent,
      }),
    });
    if (!res.ok) throw new Error(`Failed to register web push: ${res.status}`);
    return res.json();
  }

  async unregisterWebPush(
    identifier: string,
  ): Promise<{ ok: boolean; removed: number }> {
    if (!this.token) throw new Error("unregisterWebPush requires JWT token");
    const url = new URL(
      `/push/web/subscribe/${encodeURIComponent(identifier)}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to unregister web push: ${res.status}`);
    return res.json();
  }

  async listWebPushSubscriptions(): Promise<{
    subscriptions: Array<{
      id: string;
      endpointHost: string;
      endpointPreview: string;
      userAgent: string | null;
      createdAt: string;
      updatedAt: string;
      lastSentAt: string | null;
      failureCount: number;
    }>;
  }> {
    if (!this.token) throw new Error("listWebPushSubscriptions requires JWT token");
    const res = await fetch(new URL("/push/web/subscriptions", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list web push subscriptions: ${res.status}`);
    return res.json();
  }

  async listPushDevices(): Promise<{
    enabled: boolean;
    devices: { id: string; platform: string; tokenPreview: string }[];
  }> {
    if (!this.token) throw new Error("listPushDevices requires JWT token");
    const res = await fetch(new URL("/push/devices", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list push devices: ${res.status}`);
    return res.json();
  }

  /** Sync Sent.dm contact + opt-out mirror (admin JWT). Requires project Sent API keys on worker. */
  async syncSentContact(
    e164: string,
    userId?: string,
  ): Promise<{ ok: boolean; contact?: { optOut?: boolean } }> {
    if (!this.token) throw new Error("syncSentContact requires JWT token");
    const res = await fetch(
      new URL("/integrations/sent/contacts/sync", this.baseUrl).toString(),
      {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ e164, userId }),
      },
    );
    if (!res.ok) throw new Error(`Failed to sync Sent contact: ${res.status}`);
    return res.json();
  }

  /** Request SMS OTP via Sent.dm (API key on request, not JWT). */
  static async requestSmsOtp(
    baseUrl: string,
    apiKey: string,
    userId: string,
    e164: string,
  ): Promise<{ ok: boolean; expiresAt?: string; ttlSeconds?: number }> {
    const res = await fetch(new URL("/auth/sms-otp/send", baseUrl).toString(), {
      method: "POST",
      headers: {
        "X-Fluxy-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, e164 }),
    });
    if (!res.ok) throw new Error(`SMS OTP request failed: ${res.status}`);
    return res.json();
  }

  /** Verify SMS OTP and receive JWT (API key on request). */
  static async verifySmsOtp(
    baseUrl: string,
    apiKey: string,
    userId: string,
    e164: string,
    code: string,
    roles?: string[],
  ): Promise<{ token: string; expiresIn: number; e164: string }> {
    const res = await fetch(new URL("/auth/sms-otp/verify", baseUrl).toString(), {
      method: "POST",
      headers: {
        "X-Fluxy-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, e164, code, roles }),
    });
    if (!res.ok) throw new Error(`SMS OTP verify failed: ${res.status}`);
    return res.json();
  }

  async getRoomComplianceExport(roomId: string): Promise<Record<string, unknown>> {
    if (!this.token) return {};
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/compliance-export`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to export compliance pack: ${res.status}`);
    return res.json();
  }

  /** Download room history as Markdown (P12-O). */
  async exportRoomMarkdown(
    roomId: string,
    options?: { from?: string; to?: string },
  ): Promise<Blob | null> {
    if (!this.token) return null;
    const url = new URL(
      `/export/rooms/${encodeURIComponent(roomId)}.markdown`,
      this.baseUrl,
    );
    if (options?.from) url.searchParams.set("from", options.from);
    if (options?.to) url.searchParams.set("to", options.to);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`exportRoomMarkdown failed: ${res.status}`);
    return res.blob();
  }

  /** Download room history as PDF (P12-O). */
  async exportRoomPdf(
    roomId: string,
    options?: { from?: string; to?: string },
  ): Promise<Blob | null> {
    if (!this.token) return null;
    const url = new URL(`/export/rooms/${encodeURIComponent(roomId)}.pdf`, this.baseUrl);
    if (options?.from) url.searchParams.set("from", options.from);
    if (options?.to) url.searchParams.set("to", options.to);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`exportRoomPdf failed: ${res.status}`);
    return res.blob();
  }

  async listScheduledMessages(roomId: string): Promise<Record<string, unknown>[]> {
    if (!this.token) return [];
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/scheduled-messages`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list scheduled messages: ${res.status}`);
    const body = await res.json();
    return body.scheduled ?? [];
  }

  async scheduleMessage(
    roomId: string,
    payload: { content: string; sendAt: string; replyTo?: number | null },
  ): Promise<Record<string, unknown>> {
    if (!this.token) return {};
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/scheduled-messages`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to schedule message: ${res.status}`);
    return res.json();
  }

  async cancelScheduledMessage(roomId: string, scheduleId: number): Promise<void> {
    if (!this.token) return;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/scheduled-messages/${scheduleId}`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to cancel scheduled message: ${res.status}`);
  }

  // --- Live Streaming ---

  async listStreams(status?: string): Promise<Record<string, unknown>[]> {
    const url = new URL("/api/live/events", this.baseUrl);
    if (status) url.searchParams.set("status", status);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`listStreams failed: ${res.status}`);
    return res.json();
  }

  async getStream(eventId: string): Promise<Record<string, unknown> | null> {
    const res = await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}`, this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getStream failed: ${res.status}`);
    return res.json();
  }

  async createStream(body: { title: string; description?: string; category?: string; roomId?: string }): Promise<{ id: string }> {
    if (!this.token) throw new Error("createStream requires JWT token");
    const res = await fetch(new URL("/api/live/events", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createStream failed: ${res.status}`);
    return res.json();
  }

  async updateStream(eventId: string, body: Record<string, unknown>): Promise<void> {
    if (!this.token) throw new Error("updateStream requires JWT token");
    const res = await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}`, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`updateStream failed: ${res.status}`);
  }

  async getViewerCount(eventId: string): Promise<number> {
    const res = await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}/viewer-count`, this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? data.viewerCount ?? 0;
  }

  async joinStream(eventId: string): Promise<void> {
    if (!this.token) return;
    await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}/join`, this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({}),
    });
  }

  async leaveStream(eventId: string): Promise<void> {
    if (!this.token) return;
    await fetch(new URL(`/api/live/events/${encodeURIComponent(eventId)}/leave`, this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({}),
    });
  }

  async putRoomDraft(
    roomId: string,
    payload: { content: string; replyToId?: number | null },
  ): Promise<FluxyRoomMessageDraft | null> {
    if (!this.token) return null;
    const url = new URL(
      `/rooms/${encodeURIComponent(roomId)}/draft`,
      this.baseUrl,
    );
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to save room draft: ${res.status}`);
    }
    const body = await res.json();
    const draft = body.draft;
    if (!draft || typeof draft.content !== "string" || !draft.content.trim()) {
      return null;
    }
    return {
      content: draft.content,
      replyToId:
        draft.replyToId != null && draft.replyToId !== ""
          ? Number(draft.replyToId)
          : null,
      updatedAt: String(draft.updatedAt ?? ""),
    };
  }

  async listAgents(): Promise<FluxyChatAgent[]> {
    if (!this.token) return [];
    const res = await fetch(new URL("/agents", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list agents: ${res.status}`);
    const body = await res.json();
    return body.agents ?? [];
  }

  async invokeAgentRest(
    agentId: string,
    roomId: string,
    content: string,
    options?: {
      replyTo?: number | null;
      stream?: boolean;
    }
  ): Promise<{
    run: {
      id: string;
      status: string;
      latencyMs?: number;
      inputTokens?: number;
      outputTokens?: number;
      estimatedCost?: number;
      iterations?: number;
      toolCalls?: FluxyChatToolCall[];
      createdAt: string;
    };
    message: FluxyChatMessage;
  }> {
    if (!this.token) throw new Error("invokeAgent requires JWT token");
    const url = new URL(`/agents/${encodeURIComponent(agentId)}/invoke`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        roomId,
        content,
        replyTo: options?.replyTo ?? null,
        stream: options?.stream !== false,
      }),
    });
    if (!res.ok) throw new Error(`Failed to invoke agent: ${res.status}`);
    return res.json();
  }

  async getAgentRuns(agentId: string, limit = 50): Promise<FluxyChatAgentRun[]> {
    if (!this.token) return [];
    const url = new URL(`/agents/${encodeURIComponent(agentId)}/runs`, this.baseUrl);
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch agent runs: ${res.status}`);
    const body = await res.json();
    return body.runs ?? [];
  }

  async getAgent(agentId: string): Promise<FluxyChatAgent | null> {
    if (!this.token) return null;
    const url = new URL(`/agents/${encodeURIComponent(agentId)}`, this.baseUrl);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get agent: ${res.status}`);
    const body = await res.json();
    return body.agent ?? null;
  }

  async createAgent(body: {
    name: string;
    handle?: string;
    provider?: string;
    model?: string;
    systemPrompt?: string;
    contextFetchUrl?: string;
    toolExecuteUrl?: string;
    toolsSchema?: unknown[];
    rateLimitRpm?: number;
  }): Promise<FluxyChatAgent> {
    if (!this.token) throw new Error("createAgent requires JWT token");
    const res = await fetch(new URL("/agents", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to create agent: ${res.status}`);
    const data = await res.json();
    return data.agent;
  }

  async updateAgent(agentId: string, body: Record<string, unknown>): Promise<FluxyChatAgent> {
    if (!this.token) throw new Error("updateAgent requires JWT token");
    const url = new URL(`/agents/${encodeURIComponent(agentId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update agent: ${res.status}`);
    const data = await res.json();
    return data.agent;
  }

  async deleteAgent(agentId: string): Promise<void> {
    if (!this.token) throw new Error("deleteAgent requires JWT token");
    const url = new URL(`/agents/${encodeURIComponent(agentId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete agent: ${res.status}`);
  }

  async createRoom(body: {
    name: string;
    type: string;
    id?: string;
    members?: { userId: string; role: string }[];
  }): Promise<{ id: string; type: string; name: string; created_at: string }> {
    if (!this.token) throw new Error("createRoom requires JWT token");
    const res = await fetch(new URL("/rooms", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to create room: ${res.status}`);
    const data = await res.json();
    return data.room;
  }

  async updateRoom(roomId: string, body: { name?: string; type?: string }): Promise<void> {
    if (!this.token) throw new Error("updateRoom requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update room: ${res.status}`);
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!this.token) throw new Error("deleteRoom requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete room: ${res.status}`);
  }

  async addRoomMember(roomId: string, userId: string, role = "member"): Promise<void> {
    if (!this.token) throw new Error("addRoomMember requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/members`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) throw new Error(`Failed to add room member: ${res.status}`);
  }

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    if (!this.token) throw new Error("removeRoomMember requires JWT token");
    const url = new URL(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to remove room member: ${res.status}`);
  }

  async registerWebhook(body: {
    url: string;
    eventTypes: string[];
    secret?: string;
  }): Promise<{ id: string; projectId: string; url: string; secret?: string }> {
    if (!this.token) throw new Error("registerWebhook requires JWT token");
    const res = await fetch(new URL("/webhooks/register", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to register webhook: ${res.status}`);
    const data = await res.json();
    return data.webhook;
  }

  async updateWebhook(webhookId: string, body: { url?: string; eventTypes?: string[]; secret?: string }): Promise<void> {
    if (!this.token) throw new Error("updateWebhook requires JWT token");
    const url = new URL(`/webhooks/${encodeURIComponent(webhookId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update webhook: ${res.status}`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    if (!this.token) throw new Error("deleteWebhook requires JWT token");
    const url = new URL(`/webhooks/${encodeURIComponent(webhookId)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete webhook: ${res.status}`);
  }

  // ── FluxyTrack: Fleet & GPS Tracking ──

  async ingestGps(data: {
    vehicleId: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
  }): Promise<{ ok: boolean; ts: number; geofenceEvents: Array<{ id: string; geofenceId: string; vehicleId: string; eventType: string }> }> {
    if (!this.token) throw new Error("ingestGps requires JWT token");
    const res = await fetch(new URL("/fleet/gps", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to ingest GPS: ${res.status}`);
    return res.json();
  }

  async getFleetPositions(): Promise<{ ok: boolean; vehicles: Array<{ id: string; name: string; plate: string | null; status: string; lat: number | null; lng: number | null; heading: number | null; speed: number | null; lastSeenAt: string | null }> }> {
    if (!this.token) throw new Error("getFleetPositions requires JWT token");
    const res = await fetch(new URL("/fleet/gps/current", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get fleet positions: ${res.status}`);
    return res.json();
  }

  async getGpsHistory(vehicleId: string, from?: number, to?: number): Promise<{ ok: boolean; points: Array<{ ts: number; lat: number; lng: number; speed: number | null; heading: number | null }> }> {
    if (!this.token) throw new Error("getGpsHistory requires JWT token");
    const url = new URL("/fleet/gps/history", this.baseUrl);
    url.searchParams.set("vehicleId", vehicleId);
    if (from) url.searchParams.set("from", String(from));
    if (to) url.searchParams.set("to", String(to));
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to get GPS history: ${res.status}`);
    return res.json();
  }

  async listFleetVehicles(): Promise<{ ok: boolean; vehicles: Array<{ id: string; name: string; plate: string | null; driverId: string | null; status: string; lat: number | null; lng: number | null; speed: number | null; lastSeenAt: string | null; createdAt: string }> }> {
    if (!this.token) throw new Error("listFleetVehicles requires JWT token");
    const res = await fetch(new URL("/fleet/vehicles", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list fleet vehicles: ${res.status}`);
    return res.json();
  }

  async createFleetVehicle(data: { name: string; plate?: string; driverId?: string }): Promise<{ ok: boolean; vehicle: { id: string; name: string; plate: string | null; driverId: string | null; status: string } }> {
    if (!this.token) throw new Error("createFleetVehicle requires JWT token");
    const res = await fetch(new URL("/fleet/vehicles", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create fleet vehicle: ${res.status}`);
    return res.json();
  }

  async updateFleetVehicle(vehicleId: string, data: { name?: string; plate?: string; driverId?: string; status?: string }): Promise<{ ok: boolean }> {
    if (!this.token) throw new Error("updateFleetVehicle requires JWT token");
    const res = await fetch(new URL(`/fleet/vehicles/${encodeURIComponent(vehicleId)}`, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update fleet vehicle: ${res.status}`);
    return res.json();
  }

  async listFleetTrips(status?: string): Promise<{ ok: boolean; trips: Array<{ id: string; vehicleId: string; status: string; startedAt: string | null; completedAt: string | null; driverId: string | null; pickup: { lat: number; lng: number; address: string | null }; dropoff: { lat: number; lng: number; address: string | null }; distanceMeters: number | null; createdAt: string }> }> {
    if (!this.token) throw new Error("listFleetTrips requires JWT token");
    const url = new URL("/fleet/trips", this.baseUrl);
    if (status) url.searchParams.set("status", status);
    const res = await fetch(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Failed to list fleet trips: ${res.status}`);
    return res.json();
  }

  async createFleetTrip(data: { vehicleId: string; pickupLat: number; pickupLng: number; pickupAddress?: string; dropoffLat: number; dropoffLng: number; dropoffAddress?: string }): Promise<{ ok: boolean; trip: { id: string; vehicleId: string; status: string; distanceMeters: number } }> {
    if (!this.token) throw new Error("createFleetTrip requires JWT token");
    const res = await fetch(new URL("/fleet/trips", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create fleet trip: ${res.status}`);
    return res.json();
  }

  async updateFleetTripStatus(tripId: string, status: "active" | "completed" | "cancelled"): Promise<{ ok: boolean; status: string }> {
    if (!this.token) throw new Error("updateFleetTripStatus requires JWT token");
    const res = await fetch(new URL(`/fleet/trips/${encodeURIComponent(tripId)}`, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Failed to update fleet trip: ${res.status}`);
    return res.json();
  }

  async listFleetGeofences(): Promise<{ ok: boolean; geofences: Array<{ id: string; name: string; lat: number; lng: number; radiusMeters: number; createdAt: string }> }> {
    if (!this.token) throw new Error("listFleetGeofences requires JWT token");
    const res = await fetch(new URL("/fleet/geofences", this.baseUrl).toString(), {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list fleet geofences: ${res.status}`);
    return res.json();
  }

  async createFleetGeofence(data: { name: string; lat: number; lng: number; radiusMeters?: number }): Promise<{ ok: boolean; geofence: { id: string; name: string; lat: number; lng: number; radiusMeters: number } }> {
    if (!this.token) throw new Error("createFleetGeofence requires JWT token");
    const res = await fetch(new URL("/fleet/geofences", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create fleet geofence: ${res.status}`);
    return res.json();
  }

  // ── FluxyTrack: Delivery Dispatch ──

  async findNearestDrivers(lat: number, lng: number, limit?: number): Promise<{ ok: boolean; drivers: Array<{ id: string; name: string; plate: string | null; lat: number; lng: number; speed: number | null; lastSeenAt: string | null; distanceMeters: number }> }> {
    if (!this.token) throw new Error("findNearestDrivers requires JWT token");
    const res = await fetch(new URL("/fleet/delivery/nearest", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ lat, lng, limit }),
    });
    if (!res.ok) throw new Error(`Failed to find nearest drivers: ${res.status}`);
    return res.json();
  }

  async matchDelivery(data: {
    pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number;
    pickupAddress?: string; dropoffAddress?: string;
  }): Promise<{ ok: boolean; trip: { id: string; vehicleId: string; status: string; distanceMeters: number }; driver: { id: string; name: string; plate: string | null; etaMinutes: number; distanceMeters: number } }> {
    if (!this.token) throw new Error("matchDelivery requires JWT token");
    const res = await fetch(new URL("/fleet/delivery/match", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to match delivery: ${res.status}`);
    return res.json();
  }

  async routeCopilot(data: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number }): Promise<{
    ok: boolean; copilot: { distanceMeters: number; baseDurationMin: number; trafficFactor: number; weather: string; weatherFactor: number; estimatedDurationMin: number; alternatives: Array<{ label: string; durationMin: number; traffic: string; note: string | null }>; advice: string; timestamp: string }
  }> {
    if (!this.token) throw new Error("routeCopilot requires JWT token");
    const res = await fetch(new URL("/fleet/route/copilot", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to get route copilot: ${res.status}`);
    return res.json();
  }

  async predictDeliveryWindow(data: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number }): Promise<{
    ok: boolean; window: { distanceKm: number; estimatedMinutes: number; windowLowMinutes: number; windowHighMinutes: number; windowLow: string; windowHigh: string; confidencePercent: number; sampleSize: number; factors: { peakHour: boolean; averageSpeedKmph: number } }
  }> {
    if (!this.token) throw new Error("predictDeliveryWindow requires JWT token");
    const res = await fetch(new URL("/fleet/delivery/predict", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to predict delivery window: ${res.status}`);
    return res.json();
  }

  async getDynamicPricing(): Promise<{
    ok: boolean; pricing: { basePrice: number; surgeMultiplier: number; surgePrice: number; surgeLabel: string; activeTrips: number; availableDrivers: number; demandRatio: number; currency: string }
  }> {
    if (!this.token) throw new Error("getDynamicPricing requires JWT token");
    const res = await fetch(new URL("/fleet/pricing", this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
    });
    if (!res.ok) throw new Error(`Failed to get dynamic pricing: ${res.status}`);
    return res.json();
  }
}

/**
 * Browser-only helper to subscribe to VAPID Web Push and register against the
 * current JWT user. Safe to call from React effects / pages.
 *
 * Requires:
 *  - `serviceWorkerRegistration` from `navigator.serviceWorker.ready`
 *  - a Service Worker that calls `self.pushManager.subscribe(...)`
 *
 * The VAPID public key is fetched from the worker (per-project, auto-generated
 * on first call) and used as `applicationServerKey` in the subscribe call.
 */
export async function enableWebPushInBrowser(
  client: FluxyChatClient,
  options: {
    serviceWorkerRegistration: ServiceWorkerRegistration;
    projectId?: string;
    userAgent?: string;
  },
): Promise<{ ok: true; subscription: PushSubscription } | { ok: false; error: string }> {
  if (typeof window === "undefined" || !("PushManager" in window)) {
    return { ok: false, error: "web_push_not_supported" };
  }
  const { publicKey } = await client.getVapidPublicKey(options.projectId);
  const rawKey = urlBase64ToUint8Array(publicKey);
  const sub = await options.serviceWorkerRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: rawKey.buffer.slice(
      rawKey.byteOffset,
      rawKey.byteOffset + rawKey.byteLength,
    ) as ArrayBuffer,
  });
  const result = await client.registerWebPush(sub, {
    projectId: options.projectId,
    userAgent: options.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
  });
  if (!result.ok) return { ok: false, error: "register_failed" };
  return { ok: true, subscription: sub };
}

// P22-D3: Concurrency Strategy
export {
  createConcurrencyStrategy,
  type ConcurrencyStrategy,
  type ConcurrencyConfig,
  type QueueEntry,
  type ConcurrencyStrategyInstance,
} from "./concurrency";

export {
  serializeCardMessage,
  parseCardFromContent,
  parseCardFromMessage,
  isCardMessage,
  cardDisplayText,
} from "./interactive-cards";

export {
  createInMemoryAgentMemoryProvider,
  createProjectMemoryProvider,
  createMem0AgentMemoryProvider,
  type AgentMemoryProvider,
  type AgentMemoryEntry,
  type Mem0AgentMemoryConfig,
} from "./agent-memory-providers";

export {
  createAgentLifecycleRunner,
  type AgentLifecycleCallbacks,
  type AgentRunContext,
  type AgentStepContext,
  type AgentToolContext,
} from "./agent-lifecycle";

export {
  createUnifiedDlpAdapter,
  createWorkerDlpIntegrationAdapter,
  type UnifiedDlpAdapter,
  type ExternalDlpAdapter,
  type DlpScanContext,
} from "./dlp-adapter";

// P22-F1: Transcripts API
export {
  createTranscriptsApi,
  type TranscriptRole,
  type TranscriptEntry,
  type AppendInput,
  type AppendOptions,
  type ListQuery,
  type DeleteTarget,
  type TranscriptsApi,
  type TranscriptsConfig,
  type TranscriptStore,
} from "./transcripts";

// P22-F3: Callback URL
export type {
  StoredCallback,
  ProcessedButton,
  CallbackUrlApi,
} from "./callback-url";

// P22-F4: Modal Context
export type {
  ModalStep,
  ModalDefinition,
  ModalState,
} from "./modal-context";

// P22-F5: Lock Scope
export type {
  LockScopeType,
  LockPlatform,
  LockResource,
  LockScopeHandle,
} from "./lock-scope";

// P22-F6: Identity Resolver
export type {
  PlatformIdentity,
  UnifiedIdentity,
} from "./identity-resolver";

// P22-F7: StreamingPlan
export type {
  StreamingPlanTaskStatus,
  StreamingPlanTask,
  StreamingPlanModel,
  StreamingPlanModelTask,
  StreamingPlanContent,
  StartStreamingPlanOptions,
  AddStreamingPlanTaskOptions,
  UpdateStreamingPlanTaskInput,
  CompleteStreamingPlanOptions,
  StreamingPlanOptions,
  StreamingPlanApi,
  StreamingPlanWrapper,
} from "./streaming-plan";

// B-12: Message serialization
export {
  serializeMessage,
  deserializeMessage,
  messageToJSON,
  messageFromJSON,
  type SerializedMessage,
} from "./message-serialization";

// B-13: User lookup API
export {
  createUserLookup,
  registerUser,
  type UserProfile,
  type UserLookupApi,
} from "./user-lookup";

// B-18: Streaming enhancements
export {
  createStreamChunk,
  isTextChunk,
  isToolCallChunk,
  isToolResultChunk,
  parseStreamChunks,
  serializeStreamChunks,
  healMarkdown,
  bufferTableCells,
  type StreamChunk,
  type StreamChunkType,
} from "./streaming-enhancements";

// B-20: Link preview
export {
  createLinkPreview,
  linkPreviewFromData,
  type LinkPreviewData,
  type LinkPreviewApi,
} from "./link-preview";

// B-21: Message subject
export {
  createSubject,
  subjectToString,
  subjectToUrl,
  type MessageSubject,
  type SubjectResourceType,
} from "./message-subject";

// B-22: Gamification
export {
  createGamification,
  type XpEvent,
  type Badge,
  type LeaderboardEntry,
  type GamificationApi,
} from "./gamification";

// C-1: Durable AI Transport
export {
  createDurableTransport,
  type DurableSession as TransportDurableSession,
  type DurableTransportApi,
  type DurableTransportConfig,
  type StreamChunkEntry,
  type SessionState,
} from "./durable-transport";

export {
  createResumableAgentStream,
  type ResumableAgentStream,
  type ResumableAgentStreamOptions,
} from "./durable-ai-resume";

// C-2: Collaborative editing (CRDT)
export {
  createCrdt,
  type CrdtDocument,
  type CrdtOperation,
  type CrdtAwareness,
  type CrdtSnapshot,
  type CrdtApi,
} from "./crdt";

// C-3: Broadcast/campaign messaging
export {
  createBroadcastApi,
  type BroadcastSegment,
  type BroadcastMessage,
  type BroadcastApi,
} from "./broadcast";

// C-4: Adaptive transport
export {
  createAdaptiveTransport,
  type TransportType,
  type TransportHealth,
  type AdaptiveTransportApi,
} from "./adaptive-transport";

// C-5: WebTransport adapter
export {
  createWebTransportAdapter,
  type WebTransportCapability,
  type WebTransportNegotiation,
  type WebTransportAdapterApi,
} from "./web-transport";

// C-6: Regional failover
export {
  createRegionalFailover,
  type RegionConfig,
  type FailoverState,
  type RegionalFailoverApi,
} from "./regional-failover";

// C-7: Per-room sequencing
export {
  createRoomSequencer,
  type SequencedEvent,
  type RoomSequencerApi,
} from "./room-sequencer";

// C-8: Delivery semantics
export {
  createDeliverySemantics,
  type DeliverySemantic,
  type DeliveryStage,
  type DeliveryReceipt,
  type DeliverySemanticsApi,
} from "./delivery-semantics";

// C-9: Platform adapters (stub wrappers)
export type {
  AdapterPlatform,
  PlatformMessage as AdapterPlatformMessage,
  PlatformAdapterApi,
} from "./platform-adapter";

// C-10: Spatial copresence
export {
  createSpatialCopresence,
  type SpatialPosition,
  type SpatialParticipant,
  type SpatialCopresenceApi,
} from "./spatial-copresence";

// C-11: MCP protocol negotiation
export {
  createMcpNegotiation,
  type McpProtocolVersion,
  type McpTransportType,
  type McpNegotiationResult,
  type McpProtocolNegotiationApi,
} from "./mcp-negotiation";

// C-12: Decentralized relay
export {
  createDecentralizedRelay,
  type RelayPeer,
  type RelayMessage,
  type DecentralizedRelayApi,
} from "./decentralized-relay";

// D-1: Voice AI pipeline end-to-end
export {
  createVoicePipeline,
  type PipelineStage,
  type PipelineMetrics,
  type PipelineEvent,
  type PipelineStatus,
  type PipelineConfig,
  type VoiceTransportMode,
  type VoicePipeline,
} from "./voice-pipeline";

// D-2: Time-to-first-audio SLO tracking
export {
  createSloTracker,
  type SloPhase,
  type SloSpan,
  type SloPercentile,
  type SloReport,
  type SloTracker,
} from "./voice-slo";

// D-3: Noise/echo handling
export {
  createNoiseProcessor,
  type NoiseConfig,
  type DeviceDiagnostics,
  type NoiseProcessor,
} from "./voice-noise";

// D-4: Voice quality dashboard
export {
  createQualityCollector,
  type QualitySnapshot,
  type DeviceBreakdown,
  type QualityReport,
  type QualityCollector,
} from "./voice-quality-dashboard";

// D-5: Turn detection VAD + semantic
export {
  createTurnDetector,
  type VadConfig,
  type VadEvent,
  type TurnDetectionConfig,
  type TurnDetector,
} from "./voice-turn-detection";

// D-6: Prosody/emotion controls
export {
  createProsodyController,
  type ProsodyStyle,
  type ProsodyRate,
  type ProsodyPitch,
  type ProsodyProvider,
  type ProsodyConfig,
  type ProsodySafetyBoundary,
  type ProsodyOptions,
  type ProsodyController,
} from "./voice-prosody";

// D-7: Speaker diarization
export {
  createDiarizer,
  type SpeakerSegment,
  type DiarizationConfig,
  type DiarizationSession,
  type SpeakerInfo,
  type OverlapRegion,
  type DiarizationResult,
  type Diarizer,
} from "./voice-diarization";

// D-8: Call QA intelligence
export {
  createQaAnalyzer,
  type QaScore,
  type EvidenceSpan,
  type HumanReview,
  type CallQaResult,
  type QaConfig,
  type QaAnalyzer,
  type TranscriptSegment,
} from "./voice-qa";

// D-9: Huddles/audio-video rooms
export {
  createHuddle,
  type HuddleStatus,
  type HuddleParticipantStatus,
  type HuddleParticipant,
  type HuddleConfig,
  type HuddleEvent,
  type Caption,
  type Huddle,
} from "./huddles";

// D-10: Video generation progress
export {
  createVideoGenerator,
  type VideoGenerationStatus,
  type VideoGenerationRequest,
  type VideoAsset,
  type VideoProgress,
  type VideoGenerationJob,
  type VideoGenerator,
} from "./video-generation";

// E-1: E2EE groups (MLS)
export {
  createMlsManager,
  type MlsCipherSuite,
  type MlsDevice,
  type MlsGroupConfig,
  type MlsMessage,
  type MlsGroup,
  type MlsKeyPackage,
  type MlsManager,
} from "./mls-encryption";

// E-2: AI governance
export {
  createAiGovernance,
  type RiskTier,
  type ApprovalStatus as GovernanceApprovalStatus,
  type ModelRegistryEntry,
  type PromptEntry,
  type ToolRegistryEntry,
  type EvaluationResult,
  type GovernanceConfig,
  type AiGovernance,
} from "./ai-governance";

// E-3: eDiscovery/legal hold
export {
  createEdiscoveryManager,
  type HoldStatus,
  type LegalHold,
  type ExportRequest,
  type AuditEntry,
  type EdiscoveryConfig,
  type EdiscoveryManager,
} from "./ediscovery";

// E-4: DLP PHI/PCI detection
export {
  createDlpDetector,
  type DlpEntityType,
  type DlpAction,
  type DlpContentKind,
  type DlpPattern,
  type DlpPolicy,
  type DlpMatch,
  type DlpResult,
  type DlpDetector,
} from "./dlp-detection";

// E-5: Customer-managed keys (CMK)
export {
  createCmkManager,
  type KeyStatus,
  type EncryptionAlgorithm,
  type CmkKey,
  type CmkPolicy,
  type EncryptionResult,
  type AuditEvent,
  type CmkManager,
} from "./cmk-encryption";

// E-6: Data residency/sovereignty
export {
  createResidencyValidator,
  type RegionCode,
  type RegionConstraint,
  type ResidencyPolicy,
  type DataLocation,
  type ResidencyValidator,
} from "./data-residency";

// E-7: Policy-based approvals (OPA)
export {
  createPolicyEngine,
  type PolicyEffect,
  type PolicyMode,
  type OpaPolicy,
  type PolicyInput,
  type PolicyDecision,
  type PolicyEngine,
} from "./policy-approvals";

// E-8: MCP server identity/instructions
export {
  createMcpIdentityManager,
  type McpServerInfo,
  type McpToolProvenance,
  type McpInstructions,
  type McpIdentityManager,
} from "./mcp-identity";

// E-9: Bot protection/anti-abuse
export {
  createBotProtection,
  type LimitScope,
  type TrustLevel,
  type RateLimitConfig as BotRateLimitConfig,
  type RaidModeConfig,
  type TrustScore,
  type BotProtectionEvent,
  type BotProtection,
} from "./bot-protection";

// E-10: Session replay privacy-safe
export {
  createSessionReplayManager,
  type RedactionLevel,
  type RedactionRule,
  type ReplaySession,
  type ReplayEvent,
  type ReplayProtocol,
  type SessionReplayManager,
} from "./session-replay";

// E-11: Federation interoperability
export {
  createFederationBridge,
  type FederationProtocol,
  type BridgeConfig,
  type RemoteIdentity,
  type BridgedMessage,
  type BridgeStatus,
  type FederationBridge,
} from "./federation-bridge";

// E-12: Feature flags management
export {
  createFeatureFlagManager,
  type FlagStatus,
  type FeatureFlag,
  type MetricGuardrail,
  type FlagEvaluation,
  type FeatureFlagManager,
} from "./feature-flags";

// E-13: Sandboxed tool execution
export {
  createSandboxExecutor,
  type SandboxExecutionConfig,
  type SandboxExecutionResult as ToolSandboxExecutionResult,
  type SandboxQuota,
  type SandboxExecutor,
} from "./sandbox-execution";

// E-14: Generative UI sandbox
export {
  createGuiSandboxManager,
  type GuiSandboxConfig,
  type GuiComponent,
  type CapabilityGrant,
  type GuiSandboxResult,
  type GuiSandboxManager,
} from "./gui-sandbox";

// F-1: Testing utilities (`@fluxy-chat/sdk/testing` subpath; re-exported here for convenience)
export {
  createSpyAdapter,
  createFluxyChatMockClient,
  createFluxyChatMockClient as createSpyChatInstance,
  registerFluxyChatMatchers,
  registerFluxyChatMatchers as registerMatchers,
  type SpyAdapter,
} from "./testing-utils";

// F-2: Error hierarchy (already exported as ChatError, RateLimitError, LockError, NotImplementedError)

// F-3: Telemetry/OpenTelemetry
export {
  createTelemetryManager,
  registerTelemetry,
  OpenTelemetryIntegration,
  DevToolsTelemetryIntegration,
  createConsoleTelemetryIntegration,
  createOtlpTelemetryIntegration,
  type TelemetryEvent,
  type TelemetrySpan,
  type TelemetryLifecycleEvent,
  type TelemetryIntegration,
  type TelemetryOptions,
  type TelemetryManager,
  type ConsoleTelemetryOptions,
  type OtlpTelemetryOptions,
} from "./telemetry";

// F-4: DevTools local inspector
export {
  createDevToolsStore,
  createDevToolsInspector,
  type DevToolsRun,
  type DevToolsStep,
  type DevToolsStore,
  type DevToolsInspector,
} from "./devtools";

// F-6: Call options schema
export {
  callOptionsSchema,
  prepareCall,
  createAgentWithCallOptions,
  type CallOptionsSchema,
  type InferCallOptions,
  type PrepareCallContext,
  type PrepareCallResult,
  type PrepareCall,
  type AgentWithCallOptions,
} from "./call-options";

// F-7: Dynamic tools runtime
export {
  dynamicTool,
  createDynamicToolRegistry,
  typeNarrowDynamicTool,
  type DynamicToolConfig,
  type DynamicTool,
  type DynamicToolRegistry,
  type ToolSet,
  type ToolCallResult,
} from "./dynamic-tools";

// F-8: Deterministic test models
export {
  createDeterministicLanguageModel,
  type ScriptedOutput,
  type ScriptedChunk,
  type DeterministicModelConfig,
  type DeterministicLanguageModel,
} from "./deterministic-models";

// F-9: Stream fixtures
export {
  streamFixtures,
  getStreamFixture,
  listStreamFixtures,
  simulateStream,
  type StreamFixture,
} from "./stream-fixtures";

// G-1: App marketplace
export {
  createAppMarketplace,
  type AppManifest,
  type AppGrantScope,
  type AppReview,
  type AppQuota,
  type InstalledApp,
  type AppMarketplace,
} from "./app-marketplace";

// G-2: CRM/Helpdesk integration
export {
  createCrmIntegration,
  type CrmProvider,
  type CrmEntityType,
  type CrmConfig,
  type CrmContact,
  type CrmTicket,
  type SyncResult,
  type CrmIntegration,
} from "./crm-integration";

// G-3: Custom chatbot builder
export {
  createChatbotBuilder,
  type TriggerEvent,
  type TriggerEventType as ChatbotEventType,
  type ActionType as ChatbotActionType,
  type Action,
  type WorkflowRule,
  type WorkflowExecution,
  type ChatbotBuilder,
} from "./chatbot-builder";

// G-4: Knowledge base integration
export {
  createKnowledgeBase,
  type SourceType,
  type KnowledgeSource,
  type KnowledgeDocument,
  type KnowledgeChunk,
  type SearchQuery,
  type SearchResult as KnowledgeSearchResult,
  type RagContext,
  type KnowledgeBase,
} from "./knowledge-base";

// G-5: Custom workflows/automations
export {
  createAutomationEngine,
  type TriggerEventType,
  type TriggerDef,
  type ActionDef,
  type AutomationRule,
  type AutomationExecution,
  type AutomationEngine,
} from "./automation-engine";

// G-6: Agent marketplace
export {
  createAgentMarketplace,
  type AgentSkill,
  type AgentSkillTemplate,
  type AgentMarketplace,
} from "./agent-marketplace";

// G-7: AI provider marketplace
export {
  createProviderMarketplace,
  type AiProvider,
  type AiModel,
  type ProviderKey,
  type ProviderMarketplace,
} from "./provider-marketplace";

export type { AiProvider as LlmProvider, AiModel as LlmModel } from "./provider-marketplace";

// G-8: Webhook event catalog
export {
  createWebhookEventCatalog,
  type WebhookEventType,
  type WebhookSubscription,
  type WebhookDelivery,
  type WebhookEventCatalog,
} from "./webhook-catalog";

// G-9: Cross-channel continuity
export {
  createCrossChannelContinuity,
  type ChannelType,
  type ChannelIdentity,
  type CrossChannelSession,
  type CrossChannelContinuity,
} from "./cross-channel";

// G-10: Customer journey mapping
export {
  createJourneyMapping,
  type JourneyStep,
  type CustomerJourney,
  type JourneyPath,
  type JourneyMapping,
} from "./journey-mapping";

// G-11: Expert routing
export {
  createExpertRouter,
  type SkillLevel,
  type AgentProfile,
  type RoutingRequest,
  type RoutingResult,
  type ExpertRouter,
} from "./expert-router";

// G-12: A/B testing engine
export {
  createAbTestingEngine,
  type TestVariant,
  type AbTestConfig,
  type AbTestResult,
  type AbTestingEngine,
} from "./ab-testing";

// G-13: MCP Apps (Model Context Protocol)
export {
  MCP_APP_MIME_TYPE,
  MCP_APP_EXTENSION_NAME,
  getMCPAppToolMeta,
  getMCPAppResourceUri,
  isMCPAppTool,
  splitMCPAppTools,
  getMCPAppResourceUris,
  getMCPAppResourceFromReadResult,
  readMCPAppResource,
  createMCPAppsClientCapabilities,
  createMCPAppManager,
  type MCPAppToolMeta,
  type MCPAppResourceMeta,
  type MCPAppResource,
  type MCPAppToolLike,
  type MCPAppManager,
  type ReadMCPAppResourceOptions,
} from "./mcp-apps";

// G-14: Resource links
export {
  createResourceLinkManager,
  RESOURCE_LINK_MIME_TYPE,
  type ResourceLinkContent,
  type UriPolicy,
  type ResourceLinkManager,
} from "./resource-links";

// H-1: AI Transport (durable AI sessions)
export {
  createDurableAITransport,
  type DurableSessionEvent,
  type DurableSession as AiDurableSession,
  type DurableAITransport,
} from "./ai-transport";

// H-2: Agent-to-agent (A2A) protocol
export {
  createA2AClient,
  type A2AStatus,
  type A2AEnvelope,
  type A2ATask,
  type A2AArtifact,
  type A2AClient,
} from "./a2a-protocol";

// H-3: Voice-first chat interface
export {
  createVoiceInterfaceManager,
  type VoiceMode,
  type VoiceSessionState,
  type VoiceCommand,
  type VoiceInterfaceManager,
} from "./voice-interface";

// H-4: Composable UI kits
export {
  createComposableUIKit,
  type ComponentFramework,
  type UIComponentDefinition,
  type ChannelListConfig,
  type ThreadViewConfig,
  type MessageListConfig,
  type ComposerConfig,
  type ComposableUIKit,
} from "./composable-ui";

// H-5: Spatial/digital-twin rooms
export {
  createDigitalTwinRoom,
  type SpatialEntity,
  type SpatialSceneState,
  type GrantType,
  type AgentSpatialGrant,
  type DigitalTwinRoom,
} from "./digital-twin";

// H-6: Real-time translation
export {
  createTranslationService,
  type TranslationStatus,
  type LanguagePreference,
  type GlossaryEntry,
  type TranslatedMessage,
  type TranslationService,
} from "./translation";

// H-7: Virtual waiting room
export {
  createVirtualWaitingRoom,
  type WaitingTicket,
  type WaitingRoomStats,
  type VirtualWaitingRoom,
} from "./waiting-room";

// H-8: AI-powered conversation analytics
export {
  createConversationAnalytics,
  type SentimentLabel,
  type SentimentResult,
  type IntentResult,
  type TopicCluster,
  type KnowledgeGap,
  type ConversationAnalytics,
} from "./conversation-analytics";

// H-9: Decentralized/Web3 chat
export {
  createWeb3Chat,
  type WalletProfile,
  type TokenGateRule,
  type OnChainMessage,
  type DecentralizedChatRoom,
  type Web3Chat,
} from "./web3-chat";

// H-10: AR/VR chat overlay
export {
  createAROverlayManager,
  type SpatialAudioSource,
  type ARPresence,
  type ARCanvasObject,
  type AROverlayManager,
} from "./ar-overlay";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}


// 3.3: FluxyStream � Live streaming & broadcast
export {
  createFluxyStream,
  type FluxyStreamApi,
  type StreamStatus,
  type StreamViewer,
  type CameraAngle,
  type StreamHighlight,
  type SentimentBucket,
  type StoryBranch,
  type StoryVote,
  type VirtualGift,
  type SentGift,
  type LiveProduct,
  type StreamPoll,
  type AIChatMessage,
  type StreamStats,
} from "./fluxy-stream";
// 3.5: AI Agent Platform expansion
export {
  createAgentPlatform,
  type AgentPlatformApi,
  type AgentConfig,
  type AgentVersion,
  type AgentPersonality,
  type AgentFlow,
  type FlowStep,
  type StepType,
  type AgentTier,
  type AgentStatus,
  type CostEntry,
  type CostSummary,
  type RateLimitConfig as AgentRateLimitConfig,
  type MemoryEntry,
  type DeployStage,
  type SandboxResult,
} from "./agent-platform";
// 5.1: FluxyGame � Multiplayer game backend SDK
export {
  createFluxyGame,
  type FluxyGameApi,
  type Player,
  type GameState,
  type GameEntity,
  type GameEvent,
  type InputCommand,
  type InputAction,
  type MatchResult,
  type LeaderboardEntry as GameLeaderboardEntry,
  type ReplayEntry,
  type Tournament,
  type TournamentRound,
  type PartyInvite,
  type AINPC,
  type GameStatus,
  type LobbyState,
} from "./fluxy-game";

// 5.3+: Vertical capability platform
export {
  createVerticalPlatform,
  VERTICAL_BLUEPRINTS,
  type VerticalId,
  type CapabilityId,
  type PlatformReadiness,
  type EventActor,
  type RoomEvent,
  type RoomPolicy,
  type CapabilityDefinition,
  type RoomKernelConfig,
  type DeviceCapabilities,
  type SessionCheckpoint,
  type PollDefinition,
  type PollVote,
  type VerticalPlatform,
} from "./vertical-platform";

export {
  createVerticalWorkflow,
  runVerticalDemoStep,
  VERTICAL_DEMO_SEEDS,
  type AttendanceRecord,
  type BreakoutAssignment,
  type GradeSuggestion,
  type ConsentRecord,
  type TicketVerification,
  type MarketAlert,
  type InvoiceDraft,
  type VerticalWorkflowApi,
  type VerticalWorkflowState,
  buildVerticalSessionReport,
  type SessionReportLine,
} from "./vertical-workflows";

export {
  createCapabilityClient,
  syncWorkflowEventsToWorker,
  type CapabilityClient,
  type CapabilityClientConfig,
  type PublishCapabilityInput,
} from "./capability-client";

export {
  isCapabilityRealtimeEvent,
  onCapabilityEvent,
  type CapabilityRealtimeEvent,
} from "./capability-realtime";

export {
  isServerRealtimeEvent,
  onServerEvent,
  type ServerRealtimeEvent,
  type ServerEventHandler,
} from "./server-realtime";

export {
  createCustomerMemoryClient,
  type CustomerMemoryClient,
  type CustomerMemoryGraph,
  type CustomerMemoryNode,
  type CustomerMemoryEdge,
} from "./customer-memory";

export {
  createModerationLabelsClient,
  evaluateModerationRules,
  type ModerationLabelResult,
  type ModerationLabelsClient,
  type ModerationRuleDefinition,
  type RuleBuilderContext,
} from "./moderation-labels";

export {
  createWorkerAgentTaskClient,
  type WorkerAgentTaskClient,
} from "./agent-task-client";

export { createDigitalTwinMcpRegistry, type DigitalTwinMcpRegistry } from "./digital-twin-mcp";

export {
  createWorkerDigitalTwinClient,
  type WorkerDigitalTwinClient,
} from "./worker-digital-twin-client";

export {
  createWorkerFluxyGameClient,
  type WorkerFluxyGameClient,
} from "./worker-fluxy-game-client";

export {
  createWorkerFluxyIoTClient,
  type WorkerFluxyIoTClient,
} from "./worker-fluxy-iot-client";

export {
  createWorkerAgentPlatformClient,
  type WorkerAgentPlatformClient,
} from "./worker-agent-platform-client";

export {
  createWorkerFluxyStreamClient,
  type WorkerFluxyStreamClient,
  type WorkerFluxyStreamEvent,
} from "./worker-fluxy-stream-client";

export {
  PLATFORM_READINESS,
  getReadinessEntry,
  type PlatformReadinessLabel,
  type ReadinessEntry,
} from "./readiness";

export {
  DEMO_ADAPTERS,
  type SfuAdapter,
  type SfuSession,
  type FhirAdapter,
  type TicketAdapter,
  type MarketDataAdapter,
  type MarketQuote,
} from "./vertical-adapters";

export {
  createYjsCollabPort,
  YJS_SNAPSHOT_POLICY,
  type YjsCollabPort,
  type YjsSnapshotPolicy,
} from "./yjs-collab";

// 5.2: FluxyIoT — MQTT bridge & IoT device management
export {
  createFluxyIoT,
  type FluxyIoTApi,
  type IoTDevice,
  type IoTDevicePublic,
  type RuleActionResult,
  type DeviceType,
  type DeviceStatus,
  type SensorReading,
  type IotRule,
  type RuleCondition,
  type RuleAction,
  type DeviceShadow,
  type Alert,
  type Fleet,
  type OTAUpdate,
  type Geofence,
} from "./fluxy-iot";
