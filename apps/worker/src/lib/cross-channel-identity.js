/**
 * Cross-channel identity binding, profile merge, journey history (KV + CDP events).
 */

import { getCustomerById, trackEvent } from "./customer-data.js";

function bindingsKey(projectId) {
  return `xc:bindings:${projectId}`;
}

function journeyKey(projectId, customerId) {
  return `xc:journey:${projectId}:${customerId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readBindings(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(bindingsKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeBindings(env, projectId, bindings) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(bindingsKey(projectId), JSON.stringify(bindings));
}

async function readJourney(env, projectId, customerId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(journeyKey(projectId, customerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendJourney(env, projectId, customerId, entry) {
  const kv = getKv(env);
  if (!kv) return;
  const log = await readJourney(env, projectId, customerId);
  log.unshift(entry);
  if (log.length > 500) log.length = 500;
  await kv.put(journeyKey(projectId, customerId), JSON.stringify(log));
}

const CHANNELS = ["web", "mobile", "whatsapp", "sms", "voice", "email", "slack", "discord"];

export async function bindChannelIdentity(env, { projectId, customerId, channel, channelUserId }) {
  if (!customerId || !channelUserId) return { error: "customerId and channelUserId required" };
  if (!CHANNELS.includes(channel)) return { error: `channel must be one of: ${CHANNELS.join(", ")}` };
  const customer = await getCustomerById(env, { customerId, projectId });
  if (!customer) return { error: "customer_not_found" };

  const bindings = await readBindings(env, projectId);
  const entry = {
    id: `xcb_${crypto.randomUUID().slice(0, 10)}`,
    customerId,
    channel,
    channelUserId: String(channelUserId),
    linkedAt: new Date().toISOString(),
  };
  bindings.unshift(entry);
  await writeBindings(env, projectId, bindings);

  await appendJourney(env, projectId, customerId, {
    type: "identity_bound",
    channel,
    channelUserId: entry.channelUserId,
    timestamp: entry.linkedAt,
  });

  try {
    await trackEvent(env, {
      projectId,
      customerId,
      eventType: "cross_channel",
      eventName: "identity_bound",
      properties: { channel, channelUserId: entry.channelUserId },
    });
  } catch {
    /* best-effort */
  }

  return { binding: entry };
}

export async function listIdentityBindings(env, { projectId, customerId }) {
  const bindings = await readBindings(env, projectId);
  if (customerId) return bindings.filter((b) => b.customerId === customerId);
  return bindings;
}

export async function mergeCustomerProfiles(env, { projectId, primaryCustomerId, secondaryCustomerId }) {
  if (!primaryCustomerId || !secondaryCustomerId || primaryCustomerId === secondaryCustomerId) {
    return { error: "primary and secondary customer ids required and must differ" };
  }
  const primary = await getCustomerById(env, { customerId: primaryCustomerId, projectId });
  const secondary = await getCustomerById(env, { customerId: secondaryCustomerId, projectId });
  if (!primary || !secondary) return { error: "customer_not_found" };

  const bindings = await readBindings(env, projectId);
  for (const b of bindings) {
    if (b.customerId === secondaryCustomerId) b.customerId = primaryCustomerId;
  }
  await writeBindings(env, projectId, bindings);

  const secondaryJourney = await readJourney(env, projectId, secondaryCustomerId);
  for (const step of secondaryJourney) {
    await appendJourney(env, projectId, primaryCustomerId, { ...step, mergedFrom: secondaryCustomerId });
  }

  await appendJourney(env, projectId, primaryCustomerId, {
    type: "profile_merged",
    secondaryCustomerId,
    timestamp: new Date().toISOString(),
  });

  return { merged: true, primaryCustomerId, secondaryCustomerId };
}

export async function recordJourneyStep(env, { projectId, customerId, channel, step, metadata }) {
  if (!customerId || !channel) return { error: "customerId and channel required" };
  const entry = {
    type: step || "touchpoint",
    channel,
    metadata: metadata ?? null,
    timestamp: new Date().toISOString(),
  };
  await appendJourney(env, projectId, customerId, entry);
  try {
    await trackEvent(env, {
      projectId,
      customerId,
      eventType: "cross_channel",
      eventName: step || "touchpoint",
      properties: { channel, ...metadata },
    });
  } catch {
    /* best-effort */
  }
  return { recorded: true, entry };
}

export async function listJourneyHistory(env, { projectId, customerId, limit = 50 }) {
  const log = await readJourney(env, projectId, customerId);
  return log.slice(0, Math.min(limit, 200));
}

export async function getUnifiedCustomerView(env, { projectId, customerId }) {
  const customer = await getCustomerById(env, { customerId, projectId });
  if (!customer) return null;
  const bindings = await listIdentityBindings(env, { projectId, customerId });
  const journey = await listJourneyHistory(env, { projectId, customerId, limit: 20 });
  return { customer, bindings, journey, channels: [...new Set(bindings.map((b) => b.channel))] };
}
