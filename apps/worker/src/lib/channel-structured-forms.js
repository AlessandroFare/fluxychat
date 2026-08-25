/**
 * WhatsApp / RCS structured forms (#43).
 * Internal form schema → provider payload → normalized room message on response.
 */

import { fanoutPersistedMessage } from "./message-realtime-fanout.js";
import { submitForm } from "./polls-forms.js";
import { getChannelConfig } from "./omnichannel.js";
import { logInfo, logError } from "./worker-log.js";
import { safeOutboundFetch } from "./url-ssrf.js";

const E164_RE = /^\+[1-9]\d{6,14}$/;
const VALID_CHANNELS = new Set(["whatsapp", "rcs"]);
const MAX_FIELDS = 10;
const MAX_OPTIONS = 10;

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function normalizeE164(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const withPlus = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  return E164_RE.test(withPlus) ? withPlus : null;
}

/**
 * @param {{ fields?: Array<Record<string, unknown>> }} schema
 */
export function validateChannelFormSchema(schema) {
  if (!schema?.fields?.length) return { ok: false, error: "fields_required" };
  if (schema.fields.length > MAX_FIELDS) return { ok: false, error: "too_many_fields", max: MAX_FIELDS };

  const fields = [];
  for (const raw of schema.fields) {
    const type = String(raw.type || "select").toLowerCase();
    const id = String(raw.id || raw.name || "").trim();
    const label = String(raw.label || raw.title || id).trim();
    if (!id || !label) return { ok: false, error: "field_id_label_required" };

    if (type === "yes_no") {
      fields.push({ id, label, type: "yes_no" });
      continue;
    }
    if (type === "select" || type === "rating") {
      const options = Array.isArray(raw.options)
        ? raw.options.map((o, i) => ({
            value: String(o.value ?? o.id ?? i),
            label: String(o.label ?? o.text ?? o.value ?? i),
          }))
        : type === "rating"
          ? ["1", "2", "3", "4", "5"].map((n) => ({ value: n, label: n }))
          : [];
      if (!options.length) return { ok: false, error: "options_required", fieldId: id };
      if (options.length > MAX_OPTIONS) return { ok: false, error: "too_many_options", fieldId: id };
      fields.push({ id, label, type, options });
      continue;
    }
    if (type === "text") {
      fields.push({ id, label, type: "text", placeholder: raw.placeholder ? String(raw.placeholder) : null });
      continue;
    }
    return { ok: false, error: "invalid_field_type", fieldId: id };
  }

  return { ok: true, fields };
}

function replyToken(deliveryId, fieldIndex, value) {
  return `cfd:${deliveryId}:${fieldIndex}:${encodeURIComponent(String(value))}`;
}

export function parseReplyToken(id) {
  if (!id?.startsWith("cfd:")) return null;
  const parts = id.split(":");
  if (parts.length < 4) return null;
  return {
    deliveryId: parts[1],
    fieldIndex: Number(parts[2]),
    value: decodeURIComponent(parts.slice(3).join(":")),
  };
}

/**
 * Build WhatsApp Cloud API message body for one schema field step.
 */
export function buildWhatsAppInteractiveForField(field, deliveryId, fieldIndex, introText) {
  const bodyText = introText || field.label;
  const prefix = `cfd:${deliveryId}:${fieldIndex}`;

  if (field.type === "yes_no") {
    return {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText.slice(0, 1024) },
        action: {
          buttons: [
            { type: "reply", reply: { id: `${prefix}:yes`, title: "Yes" } },
            { type: "reply", reply: { id: `${prefix}:no`, title: "No" } },
          ],
        },
      },
    };
  }

  if (field.type === "select" || field.type === "rating") {
    const rows = field.options.slice(0, MAX_OPTIONS).map((opt) => ({
      id: `${prefix}:${opt.value}`,
      title: String(opt.label).slice(0, 24),
      description: String(opt.value).slice(0, 72),
    }));
    return {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText.slice(0, 1024) },
        action: {
          button: "Choose",
          sections: [{ title: field.label.slice(0, 24), rows }],
        },
      },
    };
  }

  return {
    type: "text",
    text: {
      body: `${bodyText}\n\nReply with your answer in a message.`.slice(0, 4096),
    },
  };
}

/**
 * Build RCS suggested-replies payload (Google RCS / generic JSON envelope).
 */
export function buildRcsSuggestedRepliesForField(field, deliveryId, fieldIndex, introText) {
  const bodyText = introText || field.label;
  const prefix = `cfd:${deliveryId}:${fieldIndex}`;
  const suggestions = [];

  if (field.type === "yes_no") {
    suggestions.push(
      { reply: { text: "Yes", postbackData: `${prefix}:yes` } },
      { reply: { text: "No", postbackData: `${prefix}:no` } },
    );
  } else if (field.type === "select" || field.type === "rating") {
    for (const opt of field.options.slice(0, MAX_OPTIONS)) {
      suggestions.push({
        reply: { text: String(opt.label).slice(0, 25), postbackData: `${prefix}:${opt.value}` },
      });
    }
  }

  return {
    contentMessage: {
      text: bodyText.slice(0, 3072),
      suggestions: suggestions.length ? suggestions : undefined,
    },
    metadata: { deliveryId, fieldIndex, channel: "rcs" },
  };
}

export function parseWhatsAppInteractiveReply(message) {
  if (!message || typeof message !== "object") return null;
  const interactive = message.interactive;
  if (interactive?.type === "button_reply" && interactive.button_reply?.id) {
    return parseReplyToken(interactive.button_reply.id);
  }
  if (interactive?.type === "list_reply" && interactive.list_reply?.id) {
    return parseReplyToken(interactive.list_reply.id);
  }
  if (interactive?.type === "nfm_reply" && interactive.nfm_reply?.response_json) {
    try {
      const parsed = JSON.parse(interactive.nfm_reply.response_json);
      return { flowResponse: parsed, from: message.from };
    } catch {
      return null;
    }
  }
  if (message.type === "text" && message.text?.body) {
    return { textReply: message.text.body, from: message.from };
  }
  return null;
}

export function parseRcsFormReply(body) {
  if (!body || typeof body !== "object") return null;
  const suggestion = body.suggestionResponse || body.postbackData || body.message?.suggestionResponse;
  const postback =
    typeof suggestion === "string"
      ? suggestion
      : suggestion?.postbackData || suggestion?.reply?.postbackData;
  if (postback) {
    const token = parseReplyToken(postback);
    if (token) return token;
  }
  const text = body.text || body.message?.text;
  if (text) return { textReply: String(text), from: body.from || body.senderPhoneNumber };
  return null;
}

export function normalizeFormResponses(schemaFields, responses) {
  const lines = [];
  for (const field of schemaFields) {
    const value = responses[field.id];
    if (value == null || value === "") continue;
    lines.push(`${field.label}: ${value}`);
  }
  return {
    summaryText: lines.length ? lines.join("\n") : "Form submitted",
    response: responses,
  };
}

export async function resolveWhatsAppCredentials(env, projectId, channelConfigId) {
  if (channelConfigId) {
    const cfg = await getChannelConfig(env.DB, { projectId, configId: channelConfigId });
    const settings = cfg?.settings;
    if (settings?.phoneNumberId && settings?.accessToken) {
      return {
        phoneNumberId: String(settings.phoneNumberId),
        accessToken: String(settings.accessToken),
        flowId: settings.flowId ? String(settings.flowId) : null,
      };
    }
  }
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (phoneNumberId && accessToken) {
    return { phoneNumberId, accessToken, flowId: env.WHATSAPP_FLOW_ID?.trim() || null };
  }
  return null;
}

export async function resolveRcsCredentials(env, projectId, channelConfigId) {
  if (channelConfigId) {
    const cfg = await getChannelConfig(env.DB, { projectId, configId: channelConfigId });
    const settings = cfg?.settings;
    if (settings?.rcsOutboundUrl) {
      return {
        outboundUrl: String(settings.rcsOutboundUrl),
        apiKey: settings.apiKey ? String(settings.apiKey) : null,
      };
    }
  }
  const outboundUrl = env.RCS_OUTBOUND_URL?.trim();
  if (outboundUrl) {
    return { outboundUrl, apiKey: env.RCS_API_KEY?.trim() || null };
  }
  return null;
}

export async function sendWhatsAppCloudMessage(env, { phoneNumberId, accessToken, toE164, payload }) {
  const to = toE164.replace(/^\+/, "");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...payload,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`whatsapp_${res.status}:${text.slice(0, 300)}`);
  }
  const json = await res.json().catch(() => ({}));
  return json.messages?.[0]?.id || json.message_id || null;
}

export async function sendRcsOutbound(env, { outboundUrl, apiKey, toE164, payload }) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  // SECURITY: `outboundUrl` is tenant-configured RCS provider credentials, i.e.
  // an attacker-controllable destination. The guard blocks private, loopback,
  // link-local and cloud-metadata targets so a tenant cannot turn form dispatch
  // into an SSRF primitive (the provider response is surfaced in the error text).
  const res = await safeOutboundFetch(outboundUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ to: toE164, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`rcs_${res.status}:${text.slice(0, 300)}`);
  }
  const json = await res.json().catch(() => ({}));
  return json.messageId || json.id || null;
}

export async function getChannelFormDelivery(env, { projectId, deliveryId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM channel_form_deliveries WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, deliveryId)
    .first();
  if (!row) return null;
  return mapDeliveryRow(row);
}

function mapDeliveryRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    formId: row.form_id,
    channel: row.channel,
    recipientE164: row.recipient_e164,
    status: row.status,
    schema: JSON.parse(row.schema_json || "{}"),
    responses: row.responses_json ? JSON.parse(row.responses_json) : {},
    currentFieldIndex: row.current_field_index ?? 0,
    externalMessageId: row.external_message_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

async function persistDeliveryStep(env, delivery, { responses, fieldIndex, status, externalMessageId }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE channel_form_deliveries
     SET responses_json = ?, current_field_index = ?, status = ?, external_message_id = COALESCE(?, external_message_id),
         responded_at = CASE WHEN ? IN ('completed', 'partial') THEN ? ELSE responded_at END
     WHERE id = ? AND project_id = ?`,
  )
    .bind(
      JSON.stringify(responses),
      fieldIndex,
      status,
      externalMessageId ?? null,
      status,
      now,
      delivery.id,
      delivery.projectId,
    )
    .run();
}

async function postNormalizedFormMessage(env, { projectId, roomId, userId, channel, summaryText, deliveryId }) {
  const content = `[${channel.toUpperCase()} form ${deliveryId.slice(0, 8)}]\n${summaryText}`.slice(0, 4000);
  const now = new Date().toISOString();
  const insert = await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, kind)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  )
    .bind(projectId, roomId, userId, content, now, channel === "whatsapp" ? "whatsapp" : "rcs")
    .run();

  const messageId = insert.meta?.last_row_id;
  if (messageId) {
    await fanoutPersistedMessage(env, {
      projectId,
      roomId,
      messageId,
      userId,
      content,
      createdAt: now,
      kind: channel === "whatsapp" ? "whatsapp" : "rcs",
      source: "channel-form",
    }).catch(() => {});
  }
  return messageId;
}

/**
 * Dispatch structured form to WhatsApp or RCS (first field step).
 */
export async function dispatchStructuredForm(env, input) {
  const channel = String(input.channel || "").toLowerCase();
  if (!VALID_CHANNELS.has(channel)) return { ok: false, error: "invalid_channel" };

  const recipientE164 = normalizeE164(input.recipientE164);
  if (!recipientE164) return { ok: false, error: "invalid_recipient" };
  if (!input.projectId || !input.roomId) return { ok: false, error: "missing_fields" };

  let schema = input.schema;
  if (input.formId) {
    const form = await env.DB.prepare(
      `SELECT form_schema, title, description FROM forms WHERE id = ? AND project_id = ?`,
    )
      .bind(input.formId, input.projectId)
      .first();
    if (!form) return { ok: false, error: "form_not_found" };
    schema = JSON.parse(form.form_schema || "{}");
    schema.title = schema.title || form.title;
    schema.description = schema.description || form.description;
  }

  const validated = validateChannelFormSchema(schema);
  if (!validated.ok) return validated;

  const deliveryId = generateId("cfd");
  const now = new Date().toISOString();
  const fields = validated.fields;
  const intro = schema.description
    ? `${schema.title || "Form"}: ${schema.description}\n\n${fields[0].label}`
    : fields[0].label;

  let providerPayload;
  if (channel === "whatsapp") {
    providerPayload = buildWhatsAppInteractiveForField(fields[0], deliveryId, 0, intro);
  } else {
    providerPayload = buildRcsSuggestedRepliesForField(fields[0], deliveryId, 0, intro);
  }

  await env.DB.prepare(
    `INSERT INTO channel_form_deliveries
       (id, project_id, room_id, form_id, channel, recipient_e164, status, schema_json, responses_json,
        current_field_index, provider_payload_json, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, '{}', 0, ?, ?, ?)`,
  )
    .bind(
      deliveryId,
      input.projectId,
      input.roomId,
      input.formId ?? null,
      channel,
      recipientE164,
      JSON.stringify({ title: schema.title, fields }),
      JSON.stringify(providerPayload),
      input.createdBy ?? null,
      now,
    )
    .run();

  let externalMessageId = null;
  let dryRun = false;

  try {
    if (channel === "whatsapp") {
      const creds = await resolveWhatsAppCredentials(env, input.projectId, input.channelConfigId);
      if (!creds) {
        dryRun = true;
      } else {
        externalMessageId = await sendWhatsAppCloudMessage(env, {
          ...creds,
          toE164: recipientE164,
          payload: providerPayload,
        });
      }
    } else {
      const creds = await resolveRcsCredentials(env, input.projectId, input.channelConfigId);
      if (!creds) {
        dryRun = true;
      } else {
        externalMessageId = await sendRcsOutbound(env, {
          ...creds,
          toE164: recipientE164,
          payload: providerPayload,
        });
      }
    }
  } catch (err) {
    await env.DB.prepare(
      `UPDATE channel_form_deliveries SET status = 'failed' WHERE id = ? AND project_id = ?`,
    )
      .bind(deliveryId, input.projectId)
      .run();
    logError("channel_form.dispatch_failed", err, { deliveryId, channel });
    return { ok: false, error: "dispatch_failed", detail: err.message };
  }

  if (externalMessageId) {
    await env.DB.prepare(
      `UPDATE channel_form_deliveries SET external_message_id = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(externalMessageId, deliveryId, input.projectId)
      .run();
  }

  logInfo("channel_form.dispatched", {
    deliveryId,
    channel,
    recipientE164,
    dryRun,
  });

  return {
    ok: true,
    deliveryId,
    channel,
    recipientE164,
    dryRun,
    externalMessageId,
    providerPayload,
    fieldCount: fields.length,
  };
}

/**
 * Ingest provider reply (multi-step until all fields collected).
 */
export async function ingestStructuredFormResponse(env, input) {
  const { projectId, deliveryId, parsed, fromE164, userId } = input;
  const delivery = await getChannelFormDelivery(env, { projectId, deliveryId });
  if (!delivery) return { ok: false, error: "delivery_not_found" };
  if (delivery.status === "completed") return { ok: true, duplicate: true };

  const fields = delivery.schema.fields || [];
  const responses = { ...delivery.responses };
  let fieldIndex = delivery.currentFieldIndex;

  if (parsed.flowResponse && typeof parsed.flowResponse === "object") {
    Object.assign(responses, parsed.flowResponse);
    fieldIndex = fields.length;
  } else if (parsed.textReply != null && fields[fieldIndex]?.type === "text") {
    responses[fields[fieldIndex].id] = String(parsed.textReply).trim().slice(0, 500);
    fieldIndex += 1;
  } else if (parsed.value != null && fields[fieldIndex]) {
    responses[fields[fieldIndex].id] = String(parsed.value);
    fieldIndex += 1;
  } else {
    return { ok: false, error: "unrecognized_reply" };
  }

  const actorUserId = userId || `telco:${fromE164 || delivery.recipientE164}`;

  if (fieldIndex < fields.length) {
    await persistDeliveryStep(env, delivery, {
      responses,
      fieldIndex,
      status: "partial",
      externalMessageId: null,
    });

    const nextField = fields[fieldIndex];
    let providerPayload;
    if (delivery.channel === "whatsapp") {
      providerPayload = buildWhatsAppInteractiveForField(
        nextField,
        deliveryId,
        fieldIndex,
        nextField.label,
      );
      const creds = await resolveWhatsAppCredentials(env, projectId, null);
      if (creds) {
        await sendWhatsAppCloudMessage(env, {
          ...creds,
          toE164: delivery.recipientE164,
          payload: providerPayload,
        }).catch(() => {});
      }
    } else {
      providerPayload = buildRcsSuggestedRepliesForField(
        nextField,
        deliveryId,
        fieldIndex,
        nextField.label,
      );
      const creds = await resolveRcsCredentials(env, projectId, null);
      if (creds) {
        await sendRcsOutbound(env, {
          ...creds,
          toE164: delivery.recipientE164,
          payload: providerPayload,
        }).catch(() => {});
      }
    }

    return { ok: true, status: "partial", fieldIndex, responses };
  }

  const normalized = normalizeFormResponses(fields, responses);
  await persistDeliveryStep(env, delivery, {
    responses,
    fieldIndex,
    status: "completed",
    externalMessageId: null,
  });

  const messageId = await postNormalizedFormMessage(env, {
    projectId,
    roomId: delivery.roomId,
    userId: actorUserId,
    channel: delivery.channel,
    summaryText: normalized.summaryText,
    deliveryId,
  });

  if (delivery.formId) {
    await submitForm(env, {
      projectId,
      formId: delivery.formId,
      userId: actorUserId,
      response: normalized.response,
    }).catch(() => {});
  }

  logInfo("channel_form.completed", { deliveryId, messageId, channel: delivery.channel });

  return {
    ok: true,
    status: "completed",
    messageId,
    summaryText: normalized.summaryText,
    responses,
  };
}

export async function handleWhatsAppFormWebhook(env, body, { projectId }) {
  const entry = body?.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];
  if (!message) return { ok: true, ignored: true };

  const parsed = parseWhatsAppInteractiveReply(message);
  if (!parsed) return { ok: true, ignored: true, reason: "not_interactive" };

  if (parsed.flowResponse) {
    const deliveryId = message.context?.referral?.source_id || null;
    if (!deliveryId) return { ok: true, ignored: true, reason: "no_delivery_context" };
    return ingestStructuredFormResponse(env, {
      projectId,
      deliveryId,
      parsed,
      fromE164: normalizeE164(message.from),
    });
  }

  if (parsed.deliveryId) {
    return ingestStructuredFormResponse(env, {
      projectId,
      deliveryId: parsed.deliveryId,
      parsed,
      fromE164: normalizeE164(message.from),
    });
  }

  if (parsed.textReply) {
    const from = normalizeE164(message.from);
    const pending = await env.DB.prepare(
      `SELECT id FROM channel_form_deliveries
       WHERE project_id = ? AND recipient_e164 = ? AND status IN ('sent', 'partial')
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(projectId, from)
      .first();
    if (!pending?.id) return { ok: true, ignored: true, reason: "no_pending_text_form" };
    return ingestStructuredFormResponse(env, {
      projectId,
      deliveryId: pending.id,
      parsed,
      fromE164: normalizeE164(message.from),
    });
  }

  return { ok: true, ignored: true };
}

export async function handleRcsFormWebhook(env, body, { projectId }) {
  const parsed = parseRcsFormReply(body);
  if (!parsed) return { ok: true, ignored: true };
  if (parsed.deliveryId) {
    return ingestStructuredFormResponse(env, {
      projectId,
      deliveryId: parsed.deliveryId,
      parsed,
      fromE164: normalizeE164(body.from || body.senderPhoneNumber),
    });
  }
  if (parsed.textReply) {
    const from = normalizeE164(body.from || body.senderPhoneNumber);
    const pending = await env.DB.prepare(
      `SELECT id FROM channel_form_deliveries
       WHERE project_id = ? AND recipient_e164 = ? AND status IN ('sent', 'partial')
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(projectId, from)
      .first();
    if (!pending?.id) return { ok: true, ignored: true };
    return ingestStructuredFormResponse(env, {
      projectId,
      deliveryId: pending.id,
      parsed,
      fromE164: from,
    });
  }
  return { ok: true, ignored: true };
}

export async function listChannelFormDeliveries(env, { projectId, roomId, limit = 30 }) {
  let sql = `SELECT * FROM channel_form_deliveries WHERE project_id = ?`;
  const binds = [projectId];
  if (roomId) {
    sql += ` AND room_id = ?`;
    binds.push(roomId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(Math.min(Number(limit) || 30, 100));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map(mapDeliveryRow);
}
