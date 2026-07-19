/**
 * Central HTTP route dispatcher (P0-2 / ENG-01).
 * Preserves legacy sequential dispatch order from worker.js.
 * Regenerate: node scripts/generate-route-dispatch.mjs
 */
import { dispatchStripeWebhookRoutes } from "../routes/billing-stripe-http.js";
import { dispatchGdprRoutes } from "../routes/gdpr-http.js";
import { dispatchBillingRoutes } from "../routes/billing-http.js";
import { dispatchMessagesAgentsRoutes } from "../routes/messages-agents-http.js";
import { dispatchRealtimeStatsRoutes } from "../routes/realtime-stats-http.js";
import { dispatchReportsWebhooksRoutes } from "../routes/reports-webhooks-http.js";
import { dispatchAdminSearchAutomationRoutes } from "../routes/admin-search-automation-http.js";
import { dispatchRoomsListExportRoutes } from "../routes/rooms-list-export-http.js";
import { dispatchRoomsMutationsRoutes } from "../routes/rooms-mutations-http.js";
import { dispatchNotificationsRoutes } from "../routes/notifications-http.js";
import { dispatchDigestRoutes } from "../routes/digest-http.js";
import { dispatchScheduledAdminRoutes } from "../routes/scheduled-admin-http.js";
import { dispatchSearchRoutes } from "../routes/search-http.js";
import { dispatchInboxRoutes } from "../routes/inbox-http.js";
import { dispatchAgentQueueRoutes } from "../routes/agent-queue-http.js";
import { dispatchHandoffRoutes } from "../routes/handoff-http.js";
import { dispatchOmnichannelRoutes } from "../routes/omnichannel-http.js";
import { dispatchNotificationControlsRoutes } from "../routes/notification-controls-http.js";
import { dispatchSearchEnhancementsRoutes } from "../routes/search-enhancements-http.js";
import { dispatchRichPreviewsRoutes } from "../routes/rich-previews-http.js";
import { dispatchPinnedMessagesRoutes } from "../routes/pinned-messages-http.js";
import { dispatchBreakoutRoomsRoutes } from "../routes/breakout-rooms-http.js";
import { dispatchMobileUxRoutes } from "../routes/mobile-ux-http.js";
import { dispatchPollsFormsRoutes } from "../routes/polls-forms-http.js";
import { dispatchGamificationRoutes } from "../routes/gamification-http.js";
import { dispatchAutonomousModRoutes } from "../routes/autonomous-moderation-http.js";
import { dispatchInboxZeroRoutes } from "../routes/inbox-zero-http.js";
import { dispatchIdentityRoutes } from "../routes/identity-access-http.js";
import { dispatchEnterpriseComplianceRoutes } from "../routes/enterprise-compliance-http.js";
import { dispatchComplianceExportRoutes } from "../routes/compliance-export-http.js";
import { dispatchSlaAndEngagementRoutes } from "../routes/sla-engagement-http.js";
import { dispatchReplayRoutes } from "../routes/replay-http.js";
import { dispatchAnalyticsRoutes } from "../routes/conversational-analytics-http.js";
import { dispatchAIRoomRoutes } from "../routes/instant-ai-room-http.js";
import { dispatchMultimodalRoutes } from "../routes/multimodal-ai-http.js";
import { dispatchAiImageRoutes } from "../routes/ai-image-http.js";
import { dispatchAiAnalyticsRoutes } from "../routes/ai-analytics-http.js";
import { dispatchWhiteLabelRoutes } from "../routes/white-label-http.js";
import { dispatchRateLimitDashboardRoutes } from "../routes/rate-limit-dashboard-http.js";
import { dispatchCommandRoutes } from "../routes/commands-http.js";
import { dispatchTemplatesRoutes } from "../routes/templates-http.js";
import { dispatchOtelRoutes } from "../routes/otel-http.js";
import { dispatchPresenceRoutes } from "../routes/presence-http.js";
import { dispatchInsightsRoutes } from "../routes/insights-http.js";
import { dispatchBusinessObjectRoutes } from "../routes/business-objects-http.js";
import { dispatchAuctionRoutes } from "../routes/auction-http.js";
import { dispatchIpWhitelistRoutes } from "../routes/ip-whitelist-http.js";
import { dispatchCustomRetentionRoutes } from "../routes/custom-retention-http.js";
import { dispatchAuditExportRoutes } from "../routes/audit-export-http.js";
import { dispatchEdiscoveryRoutes } from "../routes/ediscovery-http.js";
import { dispatchDlpIntegrationRoutes } from "../routes/dlp-integration-http.js";
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
import { dispatchDashboardRoutes } from "../routes/live-dashboards-http.js";
import { dispatchLiveEventRoutes } from "../routes/live-events-http.js";
import { dispatchActivityFeedRoutes } from "../routes/activity-feed-http.js";
import { dispatchNotificationEngineRoutes } from "../routes/notification-engine-http.js";
import { dispatchQAModeratorRoutes } from "../routes/qa-moderator-http.js";
import { dispatchIncidentRoutes } from "../routes/incident-response-http.js";
import { dispatchApprovalRoutes } from "../routes/approval-workflows-http.js";
import { dispatchFieldOpsRoutes } from "../routes/field-ops-http.js";
import { dispatchHybridRoutes } from "../routes/hybrid-events-http.js";
import { dispatchBroadcastRoutes } from "../routes/broadcast-segmentation-http.js";
import { dispatchOnCallRoutes } from "../routes/oncall-collaboration-http.js";
import { dispatchOverlayRoutes } from "../routes/streaming-overlays-http.js";
import { dispatchAnalyticsRoomRoutes } from "../routes/analytics-room-http.js";
import { dispatchCommunityRoutes } from "../routes/community-reputation-http.js";
import { dispatchAdminProjectsRoutes } from "../routes/admin-projects-http.js";
import { dispatchIntegrationsSentRoutes } from "../routes/integrations-sent-http.js";
import { dispatchUserBlocksRoutes } from "../routes/user-blocks-http.js";
import { dispatchPushRoutes } from "../routes/push-http.js";
import { dispatchCustomDomainsRoutes } from "../routes/custom-domains-http.js";
import { dispatchEmbedRoutes } from "../routes/embed-http.js";
import { dispatchMcpRoutes } from "../routes/mcp-http.js";
import { dispatchRoomMemoryRoutes } from "../routes/room-memory-http.js";
import { dispatchAiActionsRoutes } from "../routes/ai-actions-http.js";
import { dispatchAiModerationRoutes } from "../routes/ai-moderation-http.js";
import { dispatchKnowledgeGraphRoutes } from "../routes/knowledge-graph-http.js";
import { dispatchQueueRoutes } from "../routes/queue-http.js";
import { dispatchEscalationRoutes } from "../routes/escalation-http.js";
import { dispatchIntelligenceRoutes } from "../routes/intelligence-http.js";
import { dispatchModerationQueueRoutes } from "../routes/moderation-queue-http.js";
import { dispatchAgentProfilesRoutes } from "../routes/agent-profiles-http.js";
import { dispatchAdaptersRoutes } from "../routes/adapters-http.js";
import { dispatchFleetTrackingRoutes } from "../routes/fleet-tracking-http.js";
import { dispatchCollabHttp } from "../routes/collab-http.js";

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
  dispatchFleetTrackingRoutes,
  dispatchCollabHttp,
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
  dispatchTemplatesRoutes,
  dispatchOtelRoutes,
  dispatchPresenceRoutes,
  dispatchInsightsRoutes,
  dispatchBusinessObjectRoutes,
  dispatchAuctionRoutes,
  dispatchIpWhitelistRoutes,
  dispatchCustomRetentionRoutes,
  dispatchAuditExportRoutes,
  dispatchEdiscoveryRoutes,
  dispatchDlpIntegrationRoutes,
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
  dispatchQueueRoutes,
  dispatchEscalationRoutes,
  dispatchIntelligenceRoutes,
  dispatchModerationQueueRoutes,
  dispatchAdaptersRoutes,
  dispatchAgentProfilesRoutes,
];

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY = [
  dispatchRoomsMutationsRoutes,
  dispatchAdminProjectsRoutes,
  dispatchIntegrationsSentRoutes,
  dispatchUserBlocksRoutes,
  dispatchPushRoutes,
  dispatchStripeWebhookRoutes,
];

const PRIVACY_BILLING_DISPATCHERS = [dispatchGdprRoutes, dispatchBillingRoutes];

export const WORKER_ROUTE_DISPATCHER_COUNT =
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length +
  PRIVACY_BILLING_DISPATCHERS.length +
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length;

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
  for (const dispatch of WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  for (const dispatch of PRIVACY_BILLING_DISPATCHERS) {
    const res = await dispatch(request, url, privacyBillingDeps);
    if (res !== null) return res;
  }
  for (const dispatch of WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  return null;
}
