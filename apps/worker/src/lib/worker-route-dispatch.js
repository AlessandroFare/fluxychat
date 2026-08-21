/**
 * Central HTTP route dispatcher (P0-2 / ENG-01).
 * Prefix-indexed candidates by first path segment; unscanned modules always candidates.
 * Labs/verticals use lazyRoute() dynamic import — GA hot paths stay static.
 * Never skip by function name alone — shared prefixes stay in the same bucket.
 * Regenerate: node scripts/generate-route-dispatch.mjs
 */
import { dispatchMessagesAgentsRoutes } from "../routes/messages-agents-http.js";
import { dispatchRealtimeStatsRoutes } from "../routes/realtime-stats-http.js";
import { dispatchRoomsListExportRoutes } from "../routes/rooms-list-export-http.js";
import { dispatchNotificationsRoutes } from "../routes/notifications-http.js";
import { dispatchInboxRoutes } from "../routes/inbox-http.js";
import { dispatchAgentQueueRoutes } from "../routes/agent-queue-http.js";
import { dispatchHandoffRoutes } from "../routes/handoff-http.js";
import { dispatchOmnichannelRoutes } from "../routes/omnichannel-http.js";
import { dispatchSearchEnhancementsRoutes } from "../routes/search-enhancements-http.js";
import { dispatchPinnedMessagesRoutes } from "../routes/pinned-messages-http.js";
import { dispatchBreakoutRoomsRoutes } from "../routes/breakout-rooms-http.js";
import { dispatchCapabilitiesRoutes } from "../routes/capabilities-http.js";
import { dispatchThreadStateRoutes } from "../routes/thread-state-http.js";
import { dispatchHitlApprovalRoutes } from "../routes/hitl-approval-http.js";
import { dispatchKbConnectorRoutes } from "../routes/kb-connectors-http.js";
import { dispatchCrossChannelRoutes } from "../routes/cross-channel-http.js";
import { dispatchMobileUxRoutes } from "../routes/mobile-ux-http.js";
import { dispatchIdentityRoutes } from "../routes/identity-access-http.js";
import { dispatchCommandRoutes } from "../routes/commands-http.js";
import { dispatchPresenceRoutes } from "../routes/presence-http.js";
import { dispatchInsightsRoutes } from "../routes/insights-http.js";
import { dispatchBusinessObjectRoutes } from "../routes/business-objects-http.js";
import { dispatchAuctionRoutes } from "../routes/auction-http.js";
import { dispatchIpWhitelistRoutes } from "../routes/ip-whitelist-http.js";
import { dispatchCustomRetentionRoutes } from "../routes/custom-retention-http.js";
import { dispatchAuditExportRoutes } from "../routes/audit-export-http.js";
import { dispatchEuAiActRoutes } from "../routes/eu-ai-act-http.js";
import { dispatchMergeConflictsRoutes } from "../routes/merge-conflicts-http.js";
import { dispatchRehearsalRoomsRoutes } from "../routes/rehearsal-rooms-http.js";
import { dispatchCartographyRoutes } from "../routes/cartography-http.js";
import { dispatchIotEventRoutes } from "../routes/iot-event-http.js";
import { dispatchTruthMarketRoutes } from "../routes/truth-market-http.js";
import { dispatchRoomEmpathyRoutes } from "../routes/room-empathy-http.js";
import { dispatchRoomFirmwareRoutes } from "../routes/room-firmware-http.js";
import { dispatchAgentEvalRoutes } from "../routes/agent-eval-http.js";
import { dispatchAgentDebateRoutes } from "../routes/agent-debate-http.js";
import { dispatchAmbientAgentsRoutes } from "../routes/ambient-agents-http.js";
import { dispatchEdiscoveryRoutes } from "../routes/ediscovery-http.js";
import { dispatchDlpIntegrationRoutes } from "../routes/dlp-integration-http.js";
import { dispatchCmkRoutes } from "../routes/cmk-http.js";
import { dispatchWorkspaceRoutes } from "../routes/workspace-http.js";
import { dispatchMarketplaceRoutes } from "../routes/marketplace-http.js";
import { dispatchWidgetBuilderRoutes } from "../routes/widget-builder-http.js";
import { dispatchWorkflowBuilderRoutes } from "../routes/workflow-builder-http.js";
import { dispatchVideoVoiceRoutes } from "../routes/video-voice-http.js";
import { dispatchCobrowsingRoutes } from "../routes/cobrowsing-http.js";
import { dispatchBridgeRoutes } from "../routes/bridge-http.js";
import { dispatchMatrixBridgeRoutes } from "../routes/matrix-bridge-http.js";
import { dispatchCompanionRoutes } from "../routes/companion-http.js";
import { dispatchCompanionAdvancedRoutes } from "../routes/companion-advanced-http.js";
import { dispatchVoiceTranslationRoutes } from "../routes/voice-translation-http.js";
import { dispatchSOC2Routes } from "../routes/soc2-http.js";
import { dispatchHIPAARoutes } from "../routes/hipaa-http.js";
import { dispatchSupportRoutes } from "../routes/support-http.js";
import { dispatchCDPRoutes } from "../routes/cdp-http.js";
import { dispatchLiveStreamingRoutes } from "../routes/live-streaming-http.js";
import { dispatchWorkflowAutomationRoutes } from "../routes/workflow-automation-http.js";
import { dispatchSSORoutes } from "../routes/sso-http.js";
import { dispatchReplayRoutes } from "../routes/replay-http.js";
import { dispatchCustomDomainsRoutes } from "../routes/custom-domains-http.js";
import { dispatchRoomMemoryRoutes } from "../routes/room-memory-http.js";
import { dispatchKnowledgeGraphRoutes } from "../routes/knowledge-graph-http.js";
import { dispatchCompetitorParityRoutes } from "../routes/competitor-parity-http.js";
import { dispatchAgentDurableWorkflowRoutes } from "../routes/agent-durable-workflow-http.js";
import { dispatchAgentTaskBusRoutes } from "../routes/agent-task-bus-http.js";
import { dispatchAgentPlatformRoutes } from "../routes/agent-platform-http.js";
import { dispatchPresenceEscalationRoutes } from "../routes/presence-escalation-http.js";
import { dispatchRoomConfigRoutes } from "../routes/room-config-http.js";
import { dispatchRoomIntelligenceRoutes } from "../routes/room-intelligence-http.js";
import { dispatchGdprRoutes } from "../routes/gdpr-http.js";
import { dispatchBillingRoutes } from "../routes/billing-http.js";
import { dispatchRoomMessageRetentionRoutes } from "../routes/room-message-retention-http.js";
import { dispatchRoomVoiceStageRoutes } from "../routes/room-voice-stage-http.js";
import { dispatchRoomTranslationSettingsRoutes } from "../routes/room-translation-settings-http.js";
import { dispatchSupportRoutingRoutes } from "../routes/support-routing-http.js";
import { dispatchRoomsMutationsRoutes } from "../routes/rooms-mutations-http.js";
import { dispatchAdminProjectsRoutes } from "../routes/admin-projects-http.js";
import { dispatchBridgeWebhookRoutes } from "../routes/bridge-webhook-http.js";

/**
 * @param {() => Promise<Record<string, Function>>} loader
 * @param {string} exportName
 */
function lazyRoute(loader, exportName) {
  /** @type {Function | null} */
  let cached = null;
  /** @type {Promise<Function> | null} */
  let loading = null;
  async function dispatch(request, url, deps) {
    if (!cached) {
      loading ??= loader().then((mod) => {
        cached = mod[exportName];
        return cached;
      });
      cached = await loading;
    }
    return cached(request, url, deps);
  }
  Object.defineProperty(dispatch, "name", { value: exportName });
  return dispatch;
}

const dispatchReportsWebhooksRoutes = lazyRoute(() => import("../routes/reports-webhooks-http.js"), "dispatchReportsWebhooksRoutes");
const dispatchAdminSearchAutomationRoutes = lazyRoute(() => import("../routes/admin-search-automation-http.js"), "dispatchAdminSearchAutomationRoutes");
const dispatchDigestRoutes = lazyRoute(() => import("../routes/digest-http.js"), "dispatchDigestRoutes");
const dispatchScheduledAdminRoutes = lazyRoute(() => import("../routes/scheduled-admin-http.js"), "dispatchScheduledAdminRoutes");
const dispatchSearchRoutes = lazyRoute(() => import("../routes/search-http.js"), "dispatchSearchRoutes");
const dispatchNotificationControlsRoutes = lazyRoute(() => import("../routes/notification-controls-http.js"), "dispatchNotificationControlsRoutes");
const dispatchRichPreviewsRoutes = lazyRoute(() => import("../routes/rich-previews-http.js"), "dispatchRichPreviewsRoutes");
const dispatchDevtoolsRoutes = lazyRoute(() => import("../routes/devtools-http.js"), "dispatchDevtoolsRoutes");
const dispatchCardsRoutes = lazyRoute(() => import("../routes/cards-http.js"), "dispatchCardsRoutes");
const dispatchAiGovernanceRoutes = lazyRoute(() => import("../routes/ai-governance-http.js"), "dispatchAiGovernanceRoutes");
const dispatchAiStreamRoutes = lazyRoute(() => import("../routes/ai-stream-http.js"), "dispatchAiStreamRoutes");
const dispatchA2ARoutes = lazyRoute(() => import("../routes/a2a-http.js"), "dispatchA2ARoutes");
const dispatchCrossOrgRoutes = lazyRoute(() => import("../routes/cross-org-http.js"), "dispatchCrossOrgRoutes");
const dispatchMcpAppsRoutes = lazyRoute(() => import("../routes/mcp-apps-http.js"), "dispatchMcpAppsRoutes");
const dispatchCrmRoutes = lazyRoute(() => import("../routes/crm-http.js"), "dispatchCrmRoutes");
const dispatchVoiceAiRoutes = lazyRoute(() => import("../routes/voice-ai-http.js"), "dispatchVoiceAiRoutes");
const dispatchFleetTrackingRoutes = lazyRoute(() => import("../routes/fleet-tracking-http.js"), "dispatchFleetTrackingRoutes");
const dispatchPollsFormsRoutes = lazyRoute(() => import("../routes/polls-forms-http.js"), "dispatchPollsFormsRoutes");
const dispatchGamificationRoutes = lazyRoute(() => import("../routes/gamification-http.js"), "dispatchGamificationRoutes");
const dispatchAutonomousModRoutes = lazyRoute(() => import("../routes/autonomous-moderation-http.js"), "dispatchAutonomousModRoutes");
const dispatchInboxZeroRoutes = lazyRoute(() => import("../routes/inbox-zero-http.js"), "dispatchInboxZeroRoutes");
const dispatchEnterpriseComplianceRoutes = lazyRoute(() => import("../routes/enterprise-compliance-http.js"), "dispatchEnterpriseComplianceRoutes");
const dispatchComplianceExportRoutes = lazyRoute(() => import("../routes/compliance-export-http.js"), "dispatchComplianceExportRoutes");
const dispatchSlaAndEngagementRoutes = lazyRoute(() => import("../routes/sla-engagement-http.js"), "dispatchSlaAndEngagementRoutes");
const dispatchAnalyticsRoutes = lazyRoute(() => import("../routes/conversational-analytics-http.js"), "dispatchAnalyticsRoutes");
const dispatchAIRoomRoutes = lazyRoute(() => import("../routes/instant-ai-room-http.js"), "dispatchAIRoomRoutes");
const dispatchMultimodalRoutes = lazyRoute(() => import("../routes/multimodal-ai-http.js"), "dispatchMultimodalRoutes");
const dispatchAiImageRoutes = lazyRoute(() => import("../routes/ai-image-http.js"), "dispatchAiImageRoutes");
const dispatchAiAnalyticsRoutes = lazyRoute(() => import("../routes/ai-analytics-http.js"), "dispatchAiAnalyticsRoutes");
const dispatchWhiteLabelRoutes = lazyRoute(() => import("../routes/white-label-http.js"), "dispatchWhiteLabelRoutes");
const dispatchRateLimitDashboardRoutes = lazyRoute(() => import("../routes/rate-limit-dashboard-http.js"), "dispatchRateLimitDashboardRoutes");
const dispatchTenantUsageRoutes = lazyRoute(() => import("../routes/tenant-usage-http.js"), "dispatchTenantUsageRoutes");
const dispatchTemplatesRoutes = lazyRoute(() => import("../routes/templates-http.js"), "dispatchTemplatesRoutes");
const dispatchOtelRoutes = lazyRoute(() => import("../routes/otel-http.js"), "dispatchOtelRoutes");
const dispatchAuditChainRoutes = lazyRoute(() => import("../routes/audit-chain-http.js"), "dispatchAuditChainRoutes");
const dispatchDataResidencyRoutes = lazyRoute(() => import("../routes/data-residency-http.js"), "dispatchDataResidencyRoutes");
const dispatchConsentDpaRoutes = lazyRoute(() => import("../routes/consent-dpa-http.js"), "dispatchConsentDpaRoutes");
const dispatchChannelFormsRoutes = lazyRoute(() => import("../routes/channel-forms-http.js"), "dispatchChannelFormsRoutes");
const dispatchDecisionRoomsPackRoutes = lazyRoute(() => import("../routes/decision-rooms-pack-http.js"), "dispatchDecisionRoomsPackRoutes");
const dispatchEnterpriseAgentRoomRoutes = lazyRoute(() => import("../routes/enterprise-agent-room-http.js"), "dispatchEnterpriseAgentRoomRoutes");
const dispatchTelephonyHandoffRoutes = lazyRoute(() => import("../routes/telephony-handoff-http.js"), "dispatchTelephonyHandoffRoutes");
const dispatchMediaPipelineRoutes = lazyRoute(() => import("../routes/media-pipeline-http.js"), "dispatchMediaPipelineRoutes");
const dispatchMessageImportRoutes = lazyRoute(() => import("../routes/message-import-http.js"), "dispatchMessageImportRoutes");
const dispatchMcpIdentityRoutes = lazyRoute(() => import("../routes/mcp-identity-http.js"), "dispatchMcpIdentityRoutes");
const dispatchDashboardRoutes = lazyRoute(() => import("../routes/live-dashboards-http.js"), "dispatchDashboardRoutes");
const dispatchLiveEventRoutes = lazyRoute(() => import("../routes/live-events-http.js"), "dispatchLiveEventRoutes");
const dispatchActivityFeedRoutes = lazyRoute(() => import("../routes/activity-feed-http.js"), "dispatchActivityFeedRoutes");
const dispatchNotificationEngineRoutes = lazyRoute(() => import("../routes/notification-engine-http.js"), "dispatchNotificationEngineRoutes");
const dispatchQAModeratorRoutes = lazyRoute(() => import("../routes/qa-moderator-http.js"), "dispatchQAModeratorRoutes");
const dispatchIncidentRoutes = lazyRoute(() => import("../routes/incident-response-http.js"), "dispatchIncidentRoutes");
const dispatchApprovalRoutes = lazyRoute(() => import("../routes/approval-workflows-http.js"), "dispatchApprovalRoutes");
const dispatchFieldOpsRoutes = lazyRoute(() => import("../routes/field-ops-http.js"), "dispatchFieldOpsRoutes");
const dispatchHybridRoutes = lazyRoute(() => import("../routes/hybrid-events-http.js"), "dispatchHybridRoutes");
const dispatchBroadcastRoutes = lazyRoute(() => import("../routes/broadcast-segmentation-http.js"), "dispatchBroadcastRoutes");
const dispatchOnCallRoutes = lazyRoute(() => import("../routes/oncall-collaboration-http.js"), "dispatchOnCallRoutes");
const dispatchOverlayRoutes = lazyRoute(() => import("../routes/streaming-overlays-http.js"), "dispatchOverlayRoutes");
const dispatchAnalyticsRoomRoutes = lazyRoute(() => import("../routes/analytics-room-http.js"), "dispatchAnalyticsRoomRoutes");
const dispatchCommunityRoutes = lazyRoute(() => import("../routes/community-reputation-http.js"), "dispatchCommunityRoutes");
const dispatchEmbedRoutes = lazyRoute(() => import("../routes/embed-http.js"), "dispatchEmbedRoutes");
const dispatchMcpRoutes = lazyRoute(() => import("../routes/mcp-http.js"), "dispatchMcpRoutes");
const dispatchAiActionsRoutes = lazyRoute(() => import("../routes/ai-actions-http.js"), "dispatchAiActionsRoutes");
const dispatchAiModerationRoutes = lazyRoute(() => import("../routes/ai-moderation-http.js"), "dispatchAiModerationRoutes");
const dispatchVisualModerationRoutes = lazyRoute(() => import("../routes/visual-moderation-http.js"), "dispatchVisualModerationRoutes");
const dispatchChatApiRoutes = lazyRoute(() => import("../routes/chat-api-http.js"), "dispatchChatApiRoutes");
const dispatchAgentToolPolicyRoutes = lazyRoute(() => import("../routes/agent-tool-policy-http.js"), "dispatchAgentToolPolicyRoutes");
const dispatchUrlFetchAuditRoutes = lazyRoute(() => import("../routes/url-fetch-audit-http.js"), "dispatchUrlFetchAuditRoutes");
const dispatchDigitalTwinRoutes = lazyRoute(() => import("../routes/digital-twin-http.js"), "dispatchDigitalTwinRoutes");
const dispatchFluxyGameRoutes = lazyRoute(() => import("../routes/fluxy-game-http.js"), "dispatchFluxyGameRoutes");
const dispatchFluxyIoTRoutes = lazyRoute(() => import("../routes/fluxy-iot-http.js"), "dispatchFluxyIoTRoutes");
const dispatchModerationLabelsRoutes = lazyRoute(() => import("../routes/moderation-labels-http.js"), "dispatchModerationLabelsRoutes");
const dispatchQueueRoutes = lazyRoute(() => import("../routes/queue-http.js"), "dispatchQueueRoutes");
const dispatchEscalationRoutes = lazyRoute(() => import("../routes/escalation-http.js"), "dispatchEscalationRoutes");
const dispatchAnonymousFeedbackRoutes = lazyRoute(() => import("../routes/anonymous-feedback-http.js"), "dispatchAnonymousFeedbackRoutes");
const dispatchIntelligenceRoutes = lazyRoute(() => import("../routes/intelligence-http.js"), "dispatchIntelligenceRoutes");
const dispatchModerationQueueRoutes = lazyRoute(() => import("../routes/moderation-queue-http.js"), "dispatchModerationQueueRoutes");
const dispatchAdaptersRoutes = lazyRoute(() => import("../routes/adapters-http.js"), "dispatchAdaptersRoutes");
const dispatchAgentProfilesRoutes = lazyRoute(() => import("../routes/agent-profiles-http.js"), "dispatchAgentProfilesRoutes");
const dispatchIntegrationsSentRoutes = lazyRoute(() => import("../routes/integrations-sent-http.js"), "dispatchIntegrationsSentRoutes");
const dispatchUserBlocksRoutes = lazyRoute(() => import("../routes/user-blocks-http.js"), "dispatchUserBlocksRoutes");
const dispatchPushRoutes = lazyRoute(() => import("../routes/push-http.js"), "dispatchPushRoutes");
const dispatchStripeWebhookRoutes = lazyRoute(() => import("../routes/billing-stripe-http.js"), "dispatchStripeWebhookRoutes");

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY = [
  dispatchMessagesAgentsRoutes,
  dispatchRealtimeStatsRoutes,
  dispatchReportsWebhooksRoutes,
  dispatchAdminSearchAutomationRoutes,
  dispatchRoomsListExportRoutes,
  dispatchNotificationsRoutes,
  dispatchDigestRoutes,
  dispatchScheduledAdminRoutes,
  dispatchSearchRoutes,
  dispatchInboxRoutes,
  dispatchAgentQueueRoutes,
  dispatchHandoffRoutes,
  dispatchOmnichannelRoutes,
  dispatchNotificationControlsRoutes,
  dispatchSearchEnhancementsRoutes,
  dispatchRichPreviewsRoutes,
  dispatchPinnedMessagesRoutes,
  dispatchBreakoutRoomsRoutes,
  dispatchCapabilitiesRoutes,
  dispatchDevtoolsRoutes,
  dispatchCardsRoutes,
  dispatchThreadStateRoutes,
  dispatchHitlApprovalRoutes,
  dispatchAiGovernanceRoutes,
  dispatchKbConnectorRoutes,
  dispatchAiStreamRoutes,
  dispatchA2ARoutes,
  dispatchCrossOrgRoutes,
  dispatchMcpAppsRoutes,
  dispatchCrmRoutes,
  dispatchVoiceAiRoutes,
  dispatchCrossChannelRoutes,
  dispatchFleetTrackingRoutes,
  dispatchMobileUxRoutes,
  dispatchPollsFormsRoutes,
  dispatchGamificationRoutes,
  dispatchAutonomousModRoutes,
  dispatchInboxZeroRoutes,
  dispatchIdentityRoutes,
  dispatchEnterpriseComplianceRoutes,
  dispatchComplianceExportRoutes,
  dispatchSlaAndEngagementRoutes,
  dispatchAnalyticsRoutes,
  dispatchAIRoomRoutes,
  dispatchMultimodalRoutes,
  dispatchAiImageRoutes,
  dispatchAiAnalyticsRoutes,
  dispatchWhiteLabelRoutes,
  dispatchRateLimitDashboardRoutes,
  dispatchCommandRoutes,
  dispatchTenantUsageRoutes,
  dispatchTemplatesRoutes,
  dispatchOtelRoutes,
  dispatchPresenceRoutes,
  dispatchInsightsRoutes,
  dispatchBusinessObjectRoutes,
  dispatchAuctionRoutes,
  dispatchIpWhitelistRoutes,
  dispatchCustomRetentionRoutes,
  dispatchAuditExportRoutes,
  dispatchAuditChainRoutes,
  dispatchDataResidencyRoutes,
  dispatchEuAiActRoutes,
  dispatchConsentDpaRoutes,
  dispatchChannelFormsRoutes,
  dispatchMergeConflictsRoutes,
  dispatchRehearsalRoomsRoutes,
  dispatchCartographyRoutes,
  dispatchDecisionRoomsPackRoutes,
  dispatchEnterpriseAgentRoomRoutes,
  dispatchTelephonyHandoffRoutes,
  dispatchIotEventRoutes,
  dispatchMediaPipelineRoutes,
  dispatchTruthMarketRoutes,
  dispatchRoomEmpathyRoutes,
  dispatchRoomFirmwareRoutes,
  dispatchAgentEvalRoutes,
  dispatchAgentDebateRoutes,
  dispatchAmbientAgentsRoutes,
  dispatchEdiscoveryRoutes,
  dispatchMessageImportRoutes,
  dispatchDlpIntegrationRoutes,
  dispatchCmkRoutes,
  dispatchMcpIdentityRoutes,
  dispatchWorkspaceRoutes,
  dispatchMarketplaceRoutes,
  dispatchWidgetBuilderRoutes,
  dispatchWorkflowBuilderRoutes,
  dispatchVideoVoiceRoutes,
  dispatchCobrowsingRoutes,
  dispatchBridgeRoutes,
  dispatchMatrixBridgeRoutes,
  dispatchCompanionRoutes,
  dispatchCompanionAdvancedRoutes,
  dispatchVoiceTranslationRoutes,
  dispatchSOC2Routes,
  dispatchHIPAARoutes,
  dispatchSupportRoutes,
  dispatchCDPRoutes,
  dispatchLiveStreamingRoutes,
  dispatchWorkflowAutomationRoutes,
  dispatchSSORoutes,
  dispatchReplayRoutes,
  dispatchDashboardRoutes,
  dispatchLiveEventRoutes,
  dispatchActivityFeedRoutes,
  dispatchNotificationEngineRoutes,
  dispatchQAModeratorRoutes,
  dispatchIncidentRoutes,
  dispatchApprovalRoutes,
  dispatchFieldOpsRoutes,
  dispatchHybridRoutes,
  dispatchBroadcastRoutes,
  dispatchOnCallRoutes,
  dispatchOverlayRoutes,
  dispatchAnalyticsRoomRoutes,
  dispatchCommunityRoutes,
  dispatchCustomDomainsRoutes,
  dispatchEmbedRoutes,
  dispatchMcpRoutes,
  dispatchRoomMemoryRoutes,
  dispatchAiActionsRoutes,
  dispatchKnowledgeGraphRoutes,
  dispatchAiModerationRoutes,
  dispatchVisualModerationRoutes,
  dispatchCompetitorParityRoutes,
  dispatchChatApiRoutes,
  dispatchAgentToolPolicyRoutes,
  dispatchAgentDurableWorkflowRoutes,
  dispatchUrlFetchAuditRoutes,
  dispatchAgentTaskBusRoutes,
  dispatchDigitalTwinRoutes,
  dispatchFluxyGameRoutes,
  dispatchFluxyIoTRoutes,
  dispatchAgentPlatformRoutes,
  dispatchModerationLabelsRoutes,
  dispatchQueueRoutes,
  dispatchEscalationRoutes,
  dispatchPresenceEscalationRoutes,
  dispatchRoomConfigRoutes,
  dispatchAnonymousFeedbackRoutes,
  dispatchRoomIntelligenceRoutes,
  dispatchIntelligenceRoutes,
  dispatchModerationQueueRoutes,
  dispatchAdaptersRoutes,
  dispatchAgentProfilesRoutes,
];

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY = [
  dispatchRoomMessageRetentionRoutes,
  dispatchRoomVoiceStageRoutes,
  dispatchRoomTranslationSettingsRoutes,
  dispatchSupportRoutingRoutes,
  dispatchRoomsMutationsRoutes,
  dispatchAdminProjectsRoutes,
  dispatchIntegrationsSentRoutes,
  dispatchUserBlocksRoutes,
  dispatchPushRoutes,
  dispatchStripeWebhookRoutes,
  dispatchBridgeWebhookRoutes,
];

const PRIVACY_BILLING_DISPATCHERS = [dispatchGdprRoutes, dispatchBillingRoutes];

/** Modules with no scraped pathname — always candidates (order preserved). */
const WORKER_ROUTE_UNSCANNED = [
  dispatchReportsWebhooksRoutes,
  dispatchAdminSearchAutomationRoutes,
  dispatchDigestRoutes,
  dispatchScheduledAdminRoutes,
  dispatchSearchRoutes,
  dispatchRichPreviewsRoutes,
  dispatchDevtoolsRoutes,
  dispatchCardsRoutes,
  dispatchAiGovernanceRoutes,
  dispatchCrmRoutes,
  dispatchVoiceAiRoutes,
  dispatchInboxZeroRoutes,
  dispatchAnalyticsRoutes,
  dispatchRateLimitDashboardRoutes,
  dispatchTenantUsageRoutes,
  dispatchOtelRoutes,
  dispatchAuditChainRoutes,
  dispatchDataResidencyRoutes,
  dispatchConsentDpaRoutes,
  dispatchChannelFormsRoutes,
  dispatchDecisionRoomsPackRoutes,
  dispatchEnterpriseAgentRoomRoutes,
  dispatchTelephonyHandoffRoutes,
  dispatchMediaPipelineRoutes,
  dispatchMessageImportRoutes,
  dispatchMcpIdentityRoutes,
  dispatchEmbedRoutes,
  dispatchAiModerationRoutes,
  dispatchVisualModerationRoutes,
  dispatchChatApiRoutes,
  dispatchAgentToolPolicyRoutes,
  dispatchUrlFetchAuditRoutes,
  dispatchModerationLabelsRoutes,
  dispatchAnonymousFeedbackRoutes,
  dispatchIntelligenceRoutes,
  dispatchModerationQueueRoutes,
  dispatchIntegrationsSentRoutes,
  dispatchStripeWebhookRoutes,
];

/**
 * First-path-segment → candidate dispatchers (global order).
 * @type {Record<string, Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>>}
 */
export const WORKER_ROUTE_PREFIX_INDEX = {
  "a2a": [
    dispatchA2ARoutes,
  ],
  "adapters": [
    dispatchAdaptersRoutes,
  ],
  "admin": [
    dispatchKbConnectorRoutes,
    dispatchCrossChannelRoutes,
    dispatchIdentityRoutes,
    dispatchCommandRoutes,
    dispatchIpWhitelistRoutes,
    dispatchCustomRetentionRoutes,
    dispatchAuditExportRoutes,
    dispatchEuAiActRoutes,
    dispatchTruthMarketRoutes,
    dispatchAgentEvalRoutes,
    dispatchAgentDebateRoutes,
    dispatchAmbientAgentsRoutes,
    dispatchEdiscoveryRoutes,
    dispatchDlpIntegrationRoutes,
    dispatchCmkRoutes,
    dispatchWorkspaceRoutes,
    dispatchMarketplaceRoutes,
    dispatchWidgetBuilderRoutes,
    dispatchWorkflowBuilderRoutes,
    dispatchVideoVoiceRoutes,
    dispatchCobrowsingRoutes,
    dispatchBridgeRoutes,
    dispatchMatrixBridgeRoutes,
    dispatchCompanionRoutes,
    dispatchCustomDomainsRoutes,
    dispatchRoomMessageRetentionRoutes,
    dispatchAdminProjectsRoutes,
  ],
  "agent-profiles": [
    dispatchAgentProfilesRoutes,
  ],
  "agent-queue": [
    dispatchAgentQueueRoutes,
  ],
  "agents": [
    dispatchAgentDurableWorkflowRoutes,
    dispatchAgentTaskBusRoutes,
    dispatchAgentPlatformRoutes,
  ],
  "ai": [
    dispatchAiStreamRoutes,
  ],
  "ai-actions": [
    dispatchAiActionsRoutes,
  ],
  "ai-analytics": [
    dispatchAiAnalyticsRoutes,
  ],
  "ai-images": [
    dispatchAiImageRoutes,
  ],
  "analytics": [
    dispatchAnalyticsRoomRoutes,
  ],
  "api": [
    dispatchRealtimeStatsRoutes,
    dispatchThreadStateRoutes,
    dispatchHitlApprovalRoutes,
    dispatchMobileUxRoutes,
    dispatchCompanionAdvancedRoutes,
    dispatchVoiceTranslationRoutes,
    dispatchSOC2Routes,
    dispatchHIPAARoutes,
    dispatchSupportRoutes,
    dispatchCDPRoutes,
    dispatchLiveStreamingRoutes,
    dispatchWorkflowAutomationRoutes,
    dispatchSSORoutes,
    dispatchReplayRoutes,
  ],
  "approvals": [
    dispatchHitlApprovalRoutes,
  ],
  "auto-mod": [
    dispatchAutonomousModRoutes,
  ],
  "blocks": [
    dispatchUserBlocksRoutes,
  ],
  "broadcast": [
    dispatchBroadcastRoutes,
  ],
  "community": [
    dispatchCommunityRoutes,
  ],
  "cross-org": [
    dispatchCrossOrgRoutes,
  ],
  "enterprise": [
    dispatchEnterpriseComplianceRoutes,
    dispatchComplianceExportRoutes,
    dispatchSlaAndEngagementRoutes,
    dispatchAIRoomRoutes,
    dispatchMultimodalRoutes,
    dispatchDashboardRoutes,
    dispatchLiveEventRoutes,
    dispatchActivityFeedRoutes,
    dispatchNotificationEngineRoutes,
    dispatchQAModeratorRoutes,
    dispatchApprovalRoutes,
  ],
  "escalation": [
    dispatchEscalationRoutes,
  ],
  "export": [
    dispatchRoomsListExportRoutes,
  ],
  "field-ops": [
    dispatchFieldOpsRoutes,
  ],
  "fleet": [
    dispatchFleetTrackingRoutes,
  ],
  "forms": [
    dispatchPollsFormsRoutes,
  ],
  "games": [
    dispatchFluxyGameRoutes,
  ],
  "gamification": [
    dispatchGamificationRoutes,
  ],
  "hybrid": [
    dispatchHybridRoutes,
  ],
  "inbox": [
    dispatchInboxRoutes,
  ],
  "incidents": [
    dispatchIncidentRoutes,
  ],
  "iot": [
    dispatchFluxyIoTRoutes,
  ],
  "kg": [
    dispatchKnowledgeGraphRoutes,
  ],
  "marketplace": [
    dispatchMcpAppsRoutes,
    dispatchMarketplaceRoutes,
  ],
  "mcp": [
    dispatchMcpRoutes,
  ],
  "merge-conflicts": [
    dispatchMergeConflictsRoutes,
  ],
  "messages": [
    dispatchMessagesAgentsRoutes,
  ],
  "notification": [
    dispatchNotificationControlsRoutes,
  ],
  "notifications": [
    dispatchNotificationsRoutes,
  ],
  "omnichannel": [
    dispatchOmnichannelRoutes,
  ],
  "oncall": [
    dispatchOnCallRoutes,
  ],
  "overlays": [
    dispatchOverlayRoutes,
  ],
  "polls": [
    dispatchPollsFormsRoutes,
  ],
  "push": [
    dispatchPushRoutes,
  ],
  "queue": [
    dispatchQueueRoutes,
  ],
  "rehearsals": [
    dispatchRehearsalRoomsRoutes,
  ],
  "room-templates": [
    dispatchMessagesAgentsRoutes,
    dispatchTemplatesRoutes,
  ],
  "rooms": [
    dispatchRealtimeStatsRoutes,
    dispatchHandoffRoutes,
    dispatchOmnichannelRoutes,
    dispatchPinnedMessagesRoutes,
    dispatchBreakoutRoomsRoutes,
    dispatchCapabilitiesRoutes,
    dispatchPresenceRoutes,
    dispatchInsightsRoutes,
    dispatchBusinessObjectRoutes,
    dispatchAuctionRoutes,
    dispatchMergeConflictsRoutes,
    dispatchRehearsalRoomsRoutes,
    dispatchCartographyRoutes,
    dispatchIotEventRoutes,
    dispatchTruthMarketRoutes,
    dispatchRoomEmpathyRoutes,
    dispatchRoomFirmwareRoutes,
    dispatchRoomMemoryRoutes,
    dispatchKnowledgeGraphRoutes,
    dispatchCompetitorParityRoutes,
    dispatchPresenceEscalationRoutes,
    dispatchRoomConfigRoutes,
    dispatchRoomIntelligenceRoutes,
    dispatchRoomMessageRetentionRoutes,
    dispatchRoomVoiceStageRoutes,
    dispatchRoomTranslationSettingsRoutes,
    dispatchSupportRoutingRoutes,
    dispatchRoomsMutationsRoutes,
  ],
  "scim": [
    dispatchIdentityRoutes,
  ],
  "search": [
    dispatchSearchEnhancementsRoutes,
  ],
  "spatial": [
    dispatchDigitalTwinRoutes,
  ],
  "support": [
    dispatchCompetitorParityRoutes,
  ],
  "templates": [
    dispatchMessagesAgentsRoutes,
  ],
  "truth-claims": [
    dispatchTruthMarketRoutes,
  ],
  "user": [
    dispatchCompetitorParityRoutes,
  ],
  "users": [
    dispatchMessagesAgentsRoutes,
  ],
  "webauthn": [
    dispatchIdentityRoutes,
  ],
  "webhooks": [
    dispatchBridgeWebhookRoutes,
  ],
  "white-label": [
    dispatchWhiteLabelRoutes,
  ],
};

export const WORKER_ROUTE_DISPATCHER_COUNT =
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length +
  PRIVACY_BILLING_DISPATCHERS.length +
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length;

export const WORKER_ROUTE_LAZY_COUNT = 81;
export const WORKER_ROUTE_EAGER_COUNT = 78;

/**
 * @param {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} ordered
 * @param {string} segment
 */
function candidatesForSegment(ordered, segment) {
  const indexed = segment ? WORKER_ROUTE_PREFIX_INDEX[segment] : null;
  if (!indexed?.length) return ordered;
  const indexedSet = new Set(indexed);
  const unscannedSet = new Set(WORKER_ROUTE_UNSCANNED);
  return ordered.filter((fn) => indexedSet.has(fn) || unscannedSet.has(fn));
}

/**
 * @param {Request} request
 * @param {URL} url
 * @param {Record<string, unknown>} routeDeps
 * @param {Record<string, unknown>} privacyBillingDeps
 * @returns {Promise<Response|null>}
 */
export async function dispatchWorkerHttpRoutes(
  request,
  url,
  routeDeps,
  privacyBillingDeps,
) {
  const segment = url.pathname.split("/").filter(Boolean)[0] || "";
  const before = candidatesForSegment(WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY, segment);
  for (const dispatch of before) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  for (const dispatch of PRIVACY_BILLING_DISPATCHERS) {
    const res = await dispatch(request, url, privacyBillingDeps);
    if (res !== null) return res;
  }
  const after = candidatesForSegment(WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY, segment);
  for (const dispatch of after) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  return null;
}
