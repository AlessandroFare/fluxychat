/**
 * CP-042: CSAT post-chat — auto-trigger on ticket close / room handoff end.
 */

import {
  createSatisfactionSurvey,
  respondToSurvey,
  createTicket,
  updateTicket,
} from "./enterprise-support.js";

const TERMINAL_STATUSES = new Set(["resolved", "closed"]);
const SURVEY_TYPES = new Set(["post_resolution", "post_interaction", "nps", "csat"]);

/**
 * @param {*} env
 * @param {{ projectId: string, ticketId: string, surveyType?: string }} input
 */
export async function triggerCsatSurvey(env, input) {
  const surveyType = SURVEY_TYPES.has(input.surveyType)
    ? input.surveyType
    : "post_resolution";

  const existing = await env.DB.prepare(
    `SELECT id FROM support_satisfaction_surveys
     WHERE project_id = ? AND ticket_id = ? AND responded_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(input.projectId, input.ticketId)
    .first();
  if (existing?.id) {
    return { ok: true, surveyId: existing.id, created: false };
  }

  const result = await createSatisfactionSurvey(env, {
    projectId: input.projectId,
    ticketId: input.ticketId,
    surveyType,
  });
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, surveyId: result.id, created: true };
}

/**
 * @param {*} env
 * @param {{ projectId: string, ticketId: string, previousStatus?: string, newStatus?: string }} input
 */
export async function maybeTriggerCsatOnTicketStatus(env, input) {
  if (!input.newStatus || !TERMINAL_STATUSES.has(input.newStatus)) {
    return { ok: true, skipped: true };
  }
  if (input.previousStatus && TERMINAL_STATUSES.has(input.previousStatus)) {
    return { ok: true, skipped: true };
  }
  return triggerCsatSurvey(env, {
    projectId: input.projectId,
    ticketId: input.ticketId,
    surveyType: input.newStatus === "closed" ? "csat" : "post_resolution",
  });
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function findTicketIdForRoom(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT id FROM support_tickets
     WHERE project_id = ? AND tags LIKE ?
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(projectId, `%"${roomId}"%`)
    .first();
  return row?.id ?? null;
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, userId?: string }} input
 */
export async function maybeTriggerCsatOnRoomEnd(env, input) {
  let ticketId = await findTicketIdForRoom(env, input.projectId, input.roomId);
  if (!ticketId) {
    const ticket = await createTicket(env, {
      projectId: input.projectId,
      subject: `Chat session ${input.roomId}`,
      description: "Auto-created for post-chat CSAT",
      priority: "low",
      reportedBy: input.userId || "system",
      channel: "chat",
      tags: [input.roomId],
    });
    ticketId = ticket.id;
    await updateTicket(env, {
      ticketId,
      projectId: input.projectId,
      status: "resolved",
    });
  }
  return triggerCsatSurvey(env, {
    projectId: input.projectId,
    ticketId,
    surveyType: "post_interaction",
  });
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string }} input
 */
export async function getPendingCsatForRoom(env, input) {
  const ticketId = await findTicketIdForRoom(env, input.projectId, input.roomId);
  if (!ticketId) return { survey: null };

  const row = await env.DB.prepare(
    `SELECT id, survey_type, created_at FROM support_satisfaction_surveys
     WHERE project_id = ? AND ticket_id = ? AND responded_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(input.projectId, ticketId)
    .first();

  if (!row) return { survey: null };
  return {
    survey: {
      id: row.id,
      ticketId,
      surveyType: row.survey_type,
      createdAt: row.created_at,
    },
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, surveyId: string, rating: number, feedback?: string }} input
 */
export async function submitCsatResponse(env, input) {
  const rating = Number(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    return { ok: false, error: "invalid_rating" };
  }

  const survey = await env.DB.prepare(
    `SELECT s.id, s.ticket_id, s.responded_at
     FROM support_satisfaction_surveys s
     JOIN support_tickets t ON t.id = s.ticket_id
     WHERE s.id = ? AND t.project_id = ?`,
  )
    .bind(input.surveyId, input.projectId)
    .first();

  if (!survey) return { ok: false, error: "not_found" };
  if (survey.responded_at) return { ok: false, error: "already_responded" };

  const result = await respondToSurvey(env, {
    surveyId: input.surveyId,
    projectId: input.projectId,
    rating,
    feedback: input.feedback,
  });
  if (!result.responded) return { ok: false, error: "respond_failed" };

  await updateTicket(env, {
    ticketId: survey.ticket_id,
    projectId: input.projectId,
    satisfactionRating: rating,
    satisfactionComment: input.feedback,
  });

  return { ok: true };
}
