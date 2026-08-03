/**
 * #13 AI Visual Moderation — image attachments + live stream frame sampling.
 *
 * Uses vision-capable chat completions (AI Gateway / OpenAI-compatible).
 * Results are queued in ai_moderation_queue alongside text moderation.
 */

import { logError, logInfo } from "./worker-log.js";
import {
  buildAiAuthHeaders,
  isAiConfigured,
  resolveAiTransport,
} from "./ai-gateway.js";
import { attachmentUrlToR2Key } from "./attachment-storage.js";
import {
  inferTelcoMediaType,
  resolvePublicAttachmentUrl,
} from "./telco-outbound-media.js";
import {
  applyAutoAction,
  queueModerationEvent,
} from "./ai-moderation.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_SCAN = 3;
const MAX_BASE64_CHARS = 6 * 1024 * 1024;

const VISUAL_CATEGORIES = [
  "nsfw",
  "violence",
  "gore",
  "hate_symbols",
  "weapons",
  "drugs",
  "spam_overlay",
  "minor_safety",
  "self_harm",
];

const SEVERITY_ACTIONS = {
  none: "none",
  low: "log",
  medium: "flag",
  high: "warn",
  critical: "mute",
};

const VISUAL_ANALYSIS_PROMPT = `You are a visual content moderation engine for FluxyChat (chat images and live stream frames).
Analyze the image and return a structured moderation decision.

## Categories
- nsfw: explicit sexual content, nudity intended to arouse
- violence: fighting, assault, threats depicted visually
- gore: blood, mutilation, graphic injury
- hate_symbols: hate group symbols, extremist iconography
- weapons: guns, knives shown in threatening context
- drugs: illegal drug use or paraphernalia promotion
- spam_overlay: scam QR codes, phishing text overlays, fake giveaways
- minor_safety: content that sexualizes or endangers minors
- self_harm: visible self-injury encouragement or depiction

## Severity
- none: safe for general chat
- low: mildly suggestive or ambiguous — log only
- medium: clearly inappropriate — flag for human review
- high: seriously harmful — warn user
- critical: illegal or dangerous — immediate mute/hold

Be calibrated: art, medical, news, and sports context may be acceptable.
Return ONLY valid JSON:
{
  "severity": "none|low|medium|high|critical",
  "categories": ["category1"],
  "reason": "brief explanation",
  "confidence": 0.0-1.0,
  "suggested_action": "none|log|flag|warn|delete|mute|ban"
}`;

export function isVisualModerationEnabled(env) {
  return env.VISUAL_MODERATION_ENABLED === "true" || env.VISUAL_MODERATION_ENABLED === "1";
}

export function isImageAttachment(attachment) {
  if (!attachment?.url) return false;
  return inferTelcoMediaType(attachment) === "image";
}

export function pickImageAttachments(attachments, limit = MAX_ATTACHMENTS_PER_SCAN) {
  if (!Array.isArray(attachments)) return [];
  return attachments.filter(isImageAttachment).slice(0, limit);
}

/**
 * @param {*} env
 * @param {{ url?: string, contentType?: string, content_type?: string, name?: string }} attachment
 */
export async function loadAttachmentImageBytes(env, attachment) {
  const key = attachmentUrlToR2Key(attachment.url);
  if (key && env.ATTACHMENTS) {
    try {
      const obj = await env.ATTACHMENTS.get(key);
      if (obj) {
        const bytes = await obj.arrayBuffer();
        const contentType =
          obj.httpMetadata?.contentType ||
          attachment.contentType ||
          attachment.content_type ||
          "image/jpeg";
        return { bytes, contentType, source: "r2", key };
      }
    } catch (err) {
      logError("visual_moderation.r2_fetch_failed", err, { key });
    }
  }

  const publicUrl = resolvePublicAttachmentUrl(env, attachment.url);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { cf: { cacheTtl: 60 } });
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        const contentType =
          res.headers.get("content-type") ||
          attachment.contentType ||
          attachment.content_type ||
          "image/jpeg";
        return { bytes, contentType, source: "url", url: publicUrl };
      }
    } catch (err) {
      logError("visual_moderation.url_fetch_failed", err, { url: publicUrl });
    }
  }

  return null;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function normalizeBase64Input(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");
    return comma >= 0 ? trimmed.slice(comma + 1) : null;
  }
  return trimmed;
}

/**
 * @param {*} env
 * @param {{
 *   imageBase64?: string,
 *   imageBytes?: ArrayBuffer,
 *   contentType?: string,
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   messageId?: number,
 *   attachmentName?: string,
 *   source?: string,
 * }} input
 */
export async function analyzeVisualImage(env, input) {
  const {
    projectId,
    roomId,
    userId,
    messageId,
    attachmentName,
    source = "attachment",
    contentType = "image/jpeg",
  } = input;

  if (!isAiConfigured(env)) {
    return { ok: false, error: "ai_not_configured" };
  }

  let base64 = normalizeBase64Input(input.imageBase64);
  let mime = contentType;

  if (!base64 && input.imageBytes) {
    if (input.imageBytes.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, error: "image_too_large" };
    }
    base64 = arrayBufferToBase64(input.imageBytes);
  }

  if (!base64 || base64.length > MAX_BASE64_CHARS) {
    return { ok: false, error: "invalid_image_payload" };
  }

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: "image_too_large" };
  }

  const dataUrl = `data:${mime};base64,${base64}`;
  const ai = await visionChatCompletion(env, {
    model:
      env.AI_VISUAL_MODERATION_MODEL ||
      env.AI_MODERATION_MODEL ||
      env.AI_MODEL ||
      "openai/gpt-4o-mini",
    logContext: {
      projectId,
      roomId,
      userId,
      messageId,
      feature: "visual_moderation",
      source,
    },
    messages: [
      { role: "system", content: VISUAL_ANALYSIS_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Moderate this ${source} image${attachmentName ? ` (${attachmentName})` : ""}. Room: ${roomId}.`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  if (!ai.ok) return ai;

  let parsed;
  try {
    const text = ai.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(
      jsonMatch
        ? jsonMatch[0]
        : '{"severity":"none","categories":[],"reason":"","confidence":0,"suggested_action":"none"}',
    );
  } catch {
    return {
      ok: true,
      severity: "none",
      categories: [],
      reason: "parse_error",
      confidence: 0,
      suggestedAction: "none",
    };
  }

  const validSeverities = ["none", "low", "medium", "high", "critical"];
  const severity = validSeverities.includes(parsed.severity) ? parsed.severity : "none";
  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.filter((c) => VISUAL_CATEGORIES.includes(c))
    : [];
  const validActions = ["none", "log", "flag", "warn", "delete", "mute", "ban"];
  const suggestedAction = validActions.includes(parsed.suggested_action)
    ? parsed.suggested_action
    : SEVERITY_ACTIONS[severity] || "none";

  return {
    ok: true,
    severity,
    categories,
    reason: String(parsed.reason || "").slice(0, 500),
    confidence: Math.min(Math.max(Number(parsed.confidence) || 0.8, 0), 1),
    suggestedAction,
  };
}

async function visionChatCompletion(env, { messages, model, maxTokens, logContext }) {
  const transport = resolveAiTransport(env);
  if (!transport.configured || !transport.chatCompletionsUrl) {
    return { ok: false, error: "ai_not_configured" };
  }

  const res = await fetch(transport.chatCompletionsUrl, {
    method: "POST",
    headers: buildAiAuthHeaders(env, {
      contentType: "application/json",
      metadata: {
        feature: "visual_moderation",
        ...(logContext?.projectId ? { projectId: logContext.projectId } : {}),
      },
    }),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens ?? 256,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("visual_moderation.ai_failed", new Error(`AI status ${res.status}`), {
      ...(logContext || {}),
      aiStatus: res.status,
      aiBody: text.slice(0, 200),
    });
    return { ok: false, status: res.status, error: "ai_provider_failed" };
  }

  const json = await res.json();
  const content = String(json.choices?.[0]?.message?.content ?? "").trim();
  return { ok: true, content };
}

async function queueVisualFinding(env, detail, attachment, analysis) {
  if (!analysis.ok || analysis.severity === "none") return null;

  let autoActionTaken = null;
  const autoResult = await applyAutoAction(env, {
    projectId: detail.projectId,
    roomId: detail.roomId,
    userId: detail.authorUserId,
    severity: analysis.severity,
    suggestedAction: analysis.suggestedAction,
    messageId: detail.messageId ? Number(detail.messageId) : undefined,
  });
  autoActionTaken = autoResult.applied;

  const label = attachment?.name || attachment?.url || "image";
  await queueModerationEvent(env, {
    projectId: detail.projectId,
    roomId: detail.roomId,
    userId: detail.authorUserId,
    messageId: detail.messageId ? Number(detail.messageId) : undefined,
    content: `[visual] ${label}`,
    severity: analysis.severity,
    categories: analysis.categories,
    reason: `visual:${analysis.reason}`,
    confidence: analysis.confidence,
    suggestedAction: analysis.suggestedAction,
    autoActionTaken,
  });

  logInfo("visual_moderation.flagged", {
    projectId: detail.projectId,
    roomId: detail.roomId,
    messageId: detail.messageId,
    severity: analysis.severity,
    autoActionTaken,
  });

  return { severity: analysis.severity, autoActionTaken };
}

/**
 * Scan image attachments on a newly sent message.
 *
 * @param {*} env
 * @param {{ projectId, roomId, authorUserId, messageId?, attachments? }} detail
 */
export async function scanMessageVisualContent(env, detail) {
  if (!isVisualModerationEnabled(env)) return { scanned: 0, flagged: 0 };
  if (!workerSharedLlmAllowed(env, detail.projectId)) return { scanned: 0, flagged: 0 };

  const images = pickImageAttachments(detail.attachments);
  if (!images.length) return { scanned: 0, flagged: 0 };

  let scanned = 0;
  let flagged = 0;

  for (const attachment of images) {
    const loaded = await loadAttachmentImageBytes(env, attachment);
    if (!loaded) continue;
    if (loaded.bytes.byteLength > MAX_IMAGE_BYTES) continue;

    scanned += 1;
    const analysis = await analyzeVisualImage(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      userId: detail.authorUserId,
      messageId: detail.messageId ? Number(detail.messageId) : undefined,
      attachmentName: attachment.name,
      imageBytes: loaded.bytes,
      contentType: loaded.contentType,
      source: "attachment",
    });

    if (!analysis.ok) continue;
    const result = await queueVisualFinding(env, detail, attachment, analysis);
    if (result) flagged += 1;
  }

  return { scanned, flagged };
}

/**
 * Moderate a sampled live-stream frame (base64 JPEG/PNG).
 */
export async function analyzeStreamFrame(env, input) {
  const {
    projectId,
    roomId,
    userId,
    messageId,
    eventId,
    imageBase64,
    frameIndex,
  } = input;

  if (!isVisualModerationEnabled(env)) {
    return { ok: false, error: "visual_moderation_disabled" };
  }
  if (!workerSharedLlmAllowed(env, projectId)) {
    return { ok: false, error: "llm_not_allowed" };
  }
  if (!roomId || !userId) {
    return { ok: false, error: "room_and_user_required" };
  }

  const analysis = await analyzeVisualImage(env, {
    projectId,
    roomId,
    userId,
    messageId,
    imageBase64,
    contentType: "image/jpeg",
    source: "stream_frame",
    attachmentName: eventId ? `stream:${eventId}#${frameIndex ?? 0}` : `stream#${frameIndex ?? 0}`,
  });

  if (!analysis.ok) return analysis;
  if (analysis.severity === "none") {
    return { ok: true, severity: "none", safe: true, analysis };
  }

  const detail = {
    projectId,
    roomId,
    authorUserId: userId,
    messageId,
  };

  await queueVisualFinding(
    env,
    detail,
    { name: eventId ? `stream:${eventId}` : "stream_frame" },
    analysis,
  );

  return {
    ok: true,
    safe: false,
    severity: analysis.severity,
    categories: analysis.categories,
    reason: analysis.reason,
    analysis,
  };
}
