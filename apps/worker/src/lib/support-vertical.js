/**
 * CP-043/044: Business hours, chat→ticket continuity.
 */

import { createTicket, addTicketMessage } from "./enterprise-support.js";

const DEFAULT_OFFLINE_MESSAGE =
  "We are currently offline. Leave a message and we will reply soon.";

const DEFAULT_SCHEDULE = {
  monday: { open: "09:00", close: "17:00", enabled: true },
  tuesday: { open: "09:00", close: "17:00", enabled: true },
  wednesday: { open: "09:00", close: "17:00", enabled: true },
  thursday: { open: "09:00", close: "17:00", enabled: true },
  friday: { open: "09:00", close: "17:00", enabled: true },
  saturday: { enabled: false },
  sunday: { enabled: false },
};

export async function getBusinessHours(env, projectId) {
  const row = await env.DB.prepare(
    `SELECT * FROM support_business_hours WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();
  if (!row) {
    return {
      enabled: false,
      timezone: "UTC",
      schedule: DEFAULT_SCHEDULE,
      offlineMessage: DEFAULT_OFFLINE_MESSAGE,
      isWithinHours: true,
    };
  }
  let schedule = DEFAULT_SCHEDULE;
  try {
    schedule = JSON.parse(row.schedule_json);
  } catch {
    schedule = DEFAULT_SCHEDULE;
  }
  const enabled = row.enabled === 1;
  return {
    enabled,
    timezone: row.timezone || "UTC",
    schedule,
    offlineMessage: row.offline_message,
    isWithinHours: enabled ? isWithinBusinessHours(schedule, row.timezone) : true,
  };
}

export async function upsertBusinessHours(env, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const schedule = input.schedule || DEFAULT_SCHEDULE;
  await env.DB.prepare(
    `INSERT INTO support_business_hours (id, project_id, timezone, schedule_json, offline_message, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       timezone = excluded.timezone,
       schedule_json = excluded.schedule_json,
       offline_message = excluded.offline_message,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      input.projectId,
      input.timezone || "UTC",
      JSON.stringify(schedule),
      input.offlineMessage || DEFAULT_OFFLINE_MESSAGE,
      input.enabled === false ? 0 : 1,
      now,
      now,
    )
    .run();
  return { ok: true };
}

function isWithinBusinessHours(schedule, timezone) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const current = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    const day = schedule[weekday];
    if (!day?.enabled) return false;
    return current >= day.open && current <= day.close;
  } catch {
    return true;
  }
}

/**
 * CP-044: Create support ticket from room transcript.
 */
export async function createTicketFromRoom(env, {
  projectId,
  roomId,
  reportedBy,
  subject,
  messages,
}) {
  const transcript = (messages || [])
    .map((m) => `[${m.createdAt || ""}] ${m.userId || "?"}: ${m.content || ""}`)
    .join("\n")
    .slice(0, 50000);

  const ticket = await createTicket(env, {
    projectId,
    subject: subject || `Chat from room ${roomId}`,
    description: transcript,
    priority: "medium",
    reportedBy,
    channel: "chat",
    tags: [roomId],
  });

  if (ticket?.id && transcript) {
    await addTicketMessage(env, {
      ticketId: ticket.id,
      projectId,
      authorId: reportedBy,
      body: transcript,
      isInternal: false,
    });
  }

  return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
}
