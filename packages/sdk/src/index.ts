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
  createOfflineSyncController,
  type FluxySyncStatus,
  type OfflineSyncController,
  type CreateOfflineSyncOptions,
} from "./offline-sync";

export {
  createOfflineEventLog,
  createMemoryEventLog,
  type OfflineEventLog,
  type OfflineEventRecord,
} from "./offline-event-log";

export { createIndexedDbOutboxStore } from "./transport/indexed-db-outbox";

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
  buildAgentWorkspaceSteps,
  isAgentWorkspaceLive,
  agentWorkspaceStepsToUiParts,
  toolLabel,
  toolCategory,
  normalizeToolName,
  type AgentWorkspaceStep,
  type AgentWorkspaceStepStatus,
  type AgentWorkspaceStepCategory,
  type AgentWorkspaceToolEvent,
  type AgentWorkspaceContext,
} from "./agent-workspace";

export {
  mergeDebateSteps,
  isDebateSessionLive,
  debateStepsByRound,
  type AgentDebateStep,
  type AgentDebateStepStatus,
  type AgentDebateParticipantRole,
  type AgentDebateSession,
} from "./agent-debate";

export {
  findStageParticipant,
  isUserActiveSpeaker,
  type VoiceStageRole,
  type VoiceStageParticipant,
  type VoiceStageSnapshot,
} from "./voice-stage";

export {
  createAgUiAdapter,
  mergeAgUiTextParts,
  type AgUiStreamEvent,
  type AgUiRunState,
  type AgUiAdapter,
  type AgUiAdapterOptions,
} from "./ag-ui-adapter";

export {
  agentStreamPartToCanonical,
  canonicalStreamPartToAgUiEvent,
  canonicalStreamPartsToUiParts,
  uiPartsToCanonicalStreamParts,
  mergeCanonicalTextDeltas,
  canonicalStreamPartsToDisplay,
  type FluxyCanonicalStreamPart,
} from "./stream-parts-bridge";

export {
  scheduleSessionTokenRefresh,
  sessionTokenFingerprint,
  type SessionTokenRefreshOptions,
} from "./session-token-refresh";

export {
  applyLocationPrivacy,
  roundLocationCoordinates,
  type LocationPrivacyOptions,
} from "./location-privacy";

export {
  createMessagePatternMatcher,
  type MessagePatternRule,
  type MessagePatternHandler,
  type MessagePatternMatcher,
} from "./regex-message-matching";



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
  buildAgentCardPayload,
  generateAgentIdentityKeyPair,
  signAgentCard,
  verifyAgentCardSignature,
  type FluxyAgentCardPayload,
} from "./agent-identity";

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
  type FluxyMessageVisibility,
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
  detectDeliveryContentConflict,
  markMessageDeliveryFailed,
  mergeHistoryWithPendingDelivery,
  tryMatchPendingByInbound,
  type FluxyChatMessageWithDelivery,
  type FluxyDeliverableMessage,
  type FluxyMessageDeliveryFields,
  type FluxyMessageDeliveryStatus,
} from "./message-delivery";



export { useRooms } from "./use-rooms";
export { useNotifications } from "./use-notifications";
export { useWebPush } from "./use-web-push";
export {
  POSTABLE_OBJECT,
  isPostableObject,
  postPostableObject,
  withPostable,
  type PostableObject,
  type PostableObjectContext,
} from "./postable-object";
export {
  inferAdapterFromUserId,
  parseAdapterSlug,
  buildThreadId,
  type FluxyThreadRef,
  type FluxyOpenDmResult,
} from "./chat-api";
export type {
  WebPushPermissionState,
  WebPushSubscriptionRow,
  UseWebPushOptions,
} from "./use-web-push";


/** Markdown → `@fluxy-chat/sdk/markdown`; Yjs CRDT → `@fluxy-chat/sdk/yjs`. */

export * from "./fluxy-chat-client";
import type { FluxyChatClient } from "./fluxy-chat-client";

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
  resolveVoicePipelineStages,
  type PipelineStage,
  type PipelineMode,
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
  type VadBackend,
  type SileroVadScorer,
} from "./voice-turn-detection";

export {
  createSileroVadScorer,
  audioLevelFromPcmBuffer,
  scorePcmFrame,
  DEFAULT_SILERO_ONNX_MODEL_URL,
  DEFAULT_SILERO_VAD_WASM_URL,
  type SileroVadOptions,
  type SileroVadInstance,
  type SileroVadMode,
} from "./silero-vad";

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

export {
  createEmpathyProsodyController,
  buildEmpathyAgentPromptSuffix,
  type EmpathyInferredState,
  type ProsodySignal,
  type EmpathyProsodySample,
  type EmpathyProsodyController,
} from "./empathy-prosody";

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

export {
  hydrateMlsManagerFromRegistry,
  buildMlsRegistryUpsertFromManager,
  type RoomMlsRegistryGroup,
} from "./room-mls-sync";

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

export { secureRandomInt, secureRandomIntInRange } from "./secure-random";

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
