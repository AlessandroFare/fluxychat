/**
 * Thin event maps. One kit, not ten products.
 * Fixture-only tests: no live vendor payloads with jailbreaks.
 */
import { stripHiddenUnicode } from "./shared-room-agent-guard.js";

export const INTEGRATION_PROVIDERS = [
  "linear",
  "github",
  "slack",
  "pagerduty",
  "incidentio",
  "sentry",
  "zendesk",
  "intercom",
  "hubspot",
  "notion",
  "jira",
];

const WRITE_VIA_TICKETS = new Set(["github", "linear", "jira"]);

export function integrationCatalog() {
  return INTEGRATION_PROVIDERS.map((id) => ({
    id,
    writes: WRITE_VIA_TICKETS.has(id) ? "intent_then_env_pat" : "intent_dry_run",
    oauthApp: false,
    marketplace: false,
    untrustedInbound: true,
    noTrainDefault: id === "slack" || id === "zendesk" || id === "intercom" || id === "hubspot",
  }));
}

export function parseEntityRef(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^([a-z0-9]+):([a-z0-9_-]+):(.+)$/i);
  if (!m) return null;
  const provider = m[1].toLowerCase();
  if (!INTEGRATION_PROVIDERS.includes(provider)) return null;
  return { provider, type: m[2].toLowerCase(), id: m[3].slice(0, 256) };
}

function text(v) {
  return stripHiddenUnicode(typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, 4000);
}

function event(partial) {
  return {
    kind: partial.kind || "commented",
    entityType: partial.entityType || "item",
    entityId: String(partial.entityId || "").slice(0, 256),
    title: text(partial.title),
    body: text(partial.body),
    trust: "untrusted",
    noTrain: Boolean(partial.noTrain),
    deliveryKey: String(partial.deliveryKey || "").slice(0, 200),
  };
}

export function mapProviderPayload(provider, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  switch (provider) {
    case "linear":
      return event({
        kind: String(p.action || p.type || "updated").toLowerCase(),
        entityType: "issue",
        entityId: p.data?.identifier || p.data?.id || p.issue?.identifier,
        title: p.data?.title || p.issue?.title,
        body: p.data?.description || p.promptContext || p.data?.body,
        deliveryKey: p.webhookId || p.data?.id || p.id,
      });
    case "github":
      return event({
        kind: p.action || (p.comment ? "commented" : "updated"),
        entityType: p.pull_request ? "pr" : "issue",
        entityId: p.pull_request
          ? `${p.repository?.full_name || "repo"}#${p.pull_request.number}`
          : `${p.repository?.full_name || "repo"}#${p.issue?.number || ""}`,
        title: p.pull_request?.title || p.issue?.title,
        body: p.comment?.body || p.pull_request?.body || p.issue?.body,
        deliveryKey: p.delivery || p.comment?.id || p.issue?.id || p.pull_request?.id,
      });
    case "slack":
      return event({
        kind: p.event?.type || "message",
        entityType: "thread",
        entityId: p.event?.thread_ts || p.event?.ts || p.event_id,
        title: "Slack thread",
        body: p.event?.text,
        noTrain: true,
        deliveryKey: p.event_id || p.event?.ts,
      });
    case "pagerduty":
      return event({
        kind: p.event?.event_type || p.event_type || "alert",
        entityType: "incident",
        entityId: p.event?.data?.id || p.dedup_key || p.incident?.id,
        title: p.event?.data?.title || p.incident?.title,
        body: JSON.stringify(p.event?.data || p).slice(0, 2000),
        deliveryKey: p.event?.id || p.id,
      });
    case "incidentio":
      return event({
        kind: p.event_type || p.type || "alert",
        entityType: "incident",
        entityId: p.incident?.id || p.id || p.fingerprint,
        title: p.incident?.name || p.title,
        body: p.incident?.summary || p.body,
        deliveryKey: p.id || p.incident?.id,
      });
    case "sentry":
      return event({
        kind: p.action || "alert",
        entityType: "issue",
        entityId: p.data?.issue?.id || p.issue?.id,
        title: p.data?.issue?.title || p.issue?.title,
        body: p.data?.issue?.culprit || "",
        deliveryKey: p.id || p.data?.issue?.id,
      });
    case "zendesk":
      return event({
        kind: p.type || "updated",
        entityType: "ticket",
        entityId: p.ticket?.id || p.id,
        title: p.ticket?.subject || p.subject,
        body: p.ticket?.description || p.description,
        noTrain: true,
        deliveryKey: p.id || p.ticket?.id,
      });
    case "intercom":
      return event({
        kind: p.topic || "updated",
        entityType: "conversation",
        entityId: p.data?.item?.id || p.id,
        title: "Intercom conversation",
        body: p.data?.item?.source?.body || p.data?.item?.conversation_message?.body,
        noTrain: true,
        deliveryKey: p.id,
      });
    case "hubspot":
      return event({
        kind: p.subscriptionType || "updated",
        entityType: "object",
        entityId: p.objectId || p.objectID,
        title: "HubSpot object",
        body: "",
        noTrain: true,
        deliveryKey: p.eventId || `${p.objectId}-${p.occurredAt}`,
      });
    case "notion":
      return event({
        kind: p.type || "updated",
        entityType: "page",
        entityId: p.entity?.id || p.id,
        title: p.entity?.title || "Notion page",
        body: "",
        deliveryKey: p.id,
      });
    case "jira":
      return event({
        kind: p.webhookEvent || p.issue_event_type_name || "updated",
        entityType: "issue",
        entityId: p.issue?.key || p.issue?.id,
        title: p.issue?.fields?.summary,
        body: p.issue?.fields?.description || p.comment?.body,
        deliveryKey: p.timestamp || p.issue?.id,
      });
    default:
      return null;
  }
}

export function writesViaEnvPat(provider) {
  return WRITE_VIA_TICKETS.has(provider);
}
