/**
 * P15-M: Polls & Forms inline
 *
 * Polls (single/multi choice, rating, yes/no) and structured forms
 * embedded in chat rooms. Supports anonymous voting, expiration,
 * close/open, CSAT-style rating polls, and form schema validation.
 */

import { logInfo } from "./worker-log.js";
import { fanoutServerEvent } from "./message-realtime-fanout.js";

const MAX_POLL_OPTIONS = 20;
const MAX_FORM_FIELDS = 30;

/**
 * Create a poll in a room.
 */
export async function createPoll(env, input) {
  const { projectId, roomId, createdBy, title, description, pollType, isAnonymous, maxSelections, expiresAt, options } = input;
  if (!title?.trim()) return { ok: false, error: "title_required" };
  if (!options?.length) return { ok: false, error: "options_required" };
  if (options.length > MAX_POLL_OPTIONS) return { ok: false, error: "too_many_options", max: MAX_POLL_OPTIONS };

  const validTypes = ["single", "multi", "rating", "yes_no"];
  const type = pollType || "single";
  if (!validTypes.includes(type)) return { ok: false, error: "invalid_poll_type" };

  const pollId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create poll
  const ratingOptions = type === "rating"
    ? ["1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"]
    : type === "yes_no"
      ? ["Yes", "No"]
      : options;

  await env.DB.prepare(
    `INSERT INTO polls (id, project_id, room_id, created_by, title, description, poll_type, is_anonymous, max_selections, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(pollId, projectId, roomId, createdBy, title.trim(), description || null, type, isAnonymous ? 1 : 0, maxSelections || 1, expiresAt || null, now)
    .run();

  // Insert options
  for (let i = 0; i < ratingOptions.length; i++) {
    const optText = typeof ratingOptions[i] === "string" ? ratingOptions[i] : ratingOptions[i].text || String(ratingOptions[i]);
    await env.DB.prepare(
      "INSERT INTO poll_options (id, poll_id, option_text, sort_order, color) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), pollId, optText, i, ratingOptions[i]?.color || null)
      .run();
  }

  logInfo("poll.created", { projectId, roomId, pollId, createdBy, type, optionCount: ratingOptions.length });

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "poll.created",
    userId: createdBy,
    data: { pollId, title: title.trim(), pollType: type, optionCount: ratingOptions.length },
  }).catch(() => {});

  return { ok: true, id: pollId };
}

/**
 * Vote on a poll.
 */
export async function votePoll(env, input) {
  const { projectId, pollId, optionIds, userId } = input;
  if (!optionIds?.length) return { ok: false, error: "option_required" };

  // Get poll
  const poll = await env.DB.prepare(
    "SELECT * FROM polls WHERE id = ? AND project_id = ?"
  )
    .bind(pollId, projectId)
    .first();

  if (!poll) return { ok: false, error: "poll_not_found" };
  if (poll.is_closed) return { ok: false, error: "poll_closed" };
  if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
    return { ok: false, error: "poll_expired" };
  }
  if (poll.created_by === userId) return { ok: false, error: "cannot_vote_own_poll" };

  // Validate max selections
  if (optionIds.length > (poll.max_selections || 1)) {
    return { ok: false, error: "too_many_selections", max: poll.max_selections };
  }

  // For single/yes_no, only allow 1
  if ((poll.poll_type === "single" || poll.poll_type === "yes_no") && optionIds.length !== 1) {
    return { ok: false, error: "single_choice_required" };
  }

  // Delete existing votes (re-vote)
  await env.DB.prepare("DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?")
    .bind(pollId, userId)
    .run();

  // Insert votes
  const now = new Date().toISOString();
  for (const optionId of optionIds) {
    // Verify option belongs to poll
    const opt = await env.DB.prepare("SELECT id FROM poll_options WHERE id = ? AND poll_id = ?")
      .bind(optionId, pollId)
      .first();
    if (!opt) continue;

    await env.DB.prepare(
      "INSERT INTO poll_votes (id, poll_id, option_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), pollId, optionId, userId, now)
      .run();
  }

  logInfo("poll.voted", { projectId, pollId, userId, optionCount: optionIds.length });

  await fanoutServerEvent(env, {
    projectId,
    roomId: poll.room_id,
    name: "poll.voted",
    userId,
    data: { pollId, optionIds, pollType: poll.poll_type },
  }).catch(() => {});

  return { ok: true };
}

/**
 * Get poll results with vote counts.
 */
export async function getPollResults(env, input) {
  const { projectId, pollId } = input;

  const poll = await env.DB.prepare(
    "SELECT * FROM polls WHERE id = ? AND project_id = ?"
  )
    .bind(pollId, projectId)
    .first();

  if (!poll) return { ok: false, error: "poll_not_found" };

  // Get options with vote counts
  const optionsResult = await env.DB.prepare(
    "SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order"
  )
    .bind(pollId)
    .all();

  const totalVotesResult = await env.DB.prepare(
    "SELECT COUNT(DISTINCT user_id) as cnt FROM poll_votes WHERE poll_id = ?"
  )
    .bind(pollId)
    .first();

  const totalVoters = totalVotesResult?.cnt || 0;

  const options = [];
  for (const opt of optionsResult.results || []) {
    const voteCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM poll_votes WHERE poll_id = ? AND option_id = ?"
    )
      .bind(pollId, opt.id)
      .first();

    options.push({
      id: opt.id,
      text: opt.option_text,
      sortOrder: opt.sort_order,
      color: opt.color,
      votes: voteCount?.cnt || 0,
      percentage: totalVoters > 0 ? Math.round(((voteCount?.cnt || 0) / totalVoters) * 100) : 0,
    });
  }

  return {
    ok: true,
    poll: {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      type: poll.poll_type,
      isAnonymous: !!poll.is_anonymous,
      isClosed: !!poll.is_closed,
      expiresAt: poll.expires_at,
      createdBy: poll.created_by,
      createdAt: poll.created_at,
      closedAt: poll.closed_at,
    },
    options,
    totalVoters,
  };
}

/**
 * Close a poll.
 */
export async function closePoll(env, input) {
  const { projectId, pollId, userId } = input;

  const poll = await env.DB.prepare(
    "SELECT * FROM polls WHERE id = ? AND project_id = ?"
  )
    .bind(pollId, projectId)
    .first();

  if (!poll) return { ok: false, error: "poll_not_found" };
  if (poll.is_closed) return { ok: false, error: "already_closed" };
  if (poll.created_by !== userId) return { ok: false, error: "not_author" };

  await env.DB.prepare("UPDATE polls SET is_closed = 1, closed_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), pollId)
    .run();

  await fanoutServerEvent(env, {
    projectId,
    roomId: poll.room_id,
    name: "poll.closed",
    userId,
    data: { pollId },
  }).catch(() => {});

  return { ok: true };
}

/**
 * Create a form.
 */
export async function createForm(env, input) {
  const { projectId, roomId, createdBy, title, description, schema, isAnonymous, expiresAt } = input;
  if (!title?.trim()) return { ok: false, error: "title_required" };
  if (!schema?.fields?.length) return { ok: false, error: "fields_required" };
  if (schema.fields.length > MAX_FORM_FIELDS) return { ok: false, error: "too_many_fields", max: MAX_FORM_FIELDS };

  const formId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO forms (id, project_id, room_id, created_by, title, description, form_schema, is_anonymous, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(formId, projectId, roomId, createdBy, title.trim(), description || null, JSON.stringify(schema), isAnonymous ? 1 : 0, expiresAt || null, now)
    .run();

  logInfo("form.created", { projectId, roomId, formId, createdBy, fieldCount: schema.fields.length });

  if (roomId) {
    await fanoutServerEvent(env, {
      projectId,
      roomId,
      name: "form.created",
      userId: createdBy,
      data: { formId, title: title.trim(), fieldCount: schema.fields.length },
    }).catch(() => {});
  }

  return { ok: true, id: formId };
}

/**
 * Submit a form response.
 */
export async function submitForm(env, input) {
  const { projectId, formId, userId, response } = input;
  if (!response) return { ok: false, error: "response_required" };

  const form = await env.DB.prepare(
    "SELECT * FROM forms WHERE id = ? AND project_id = ?"
  )
    .bind(formId, projectId)
    .first();

  if (!form) return { ok: false, error: "form_not_found" };
  if (form.is_closed) return { ok: false, error: "form_closed" };
  if (form.expires_at && new Date(form.expires_at) < new Date()) {
    return { ok: false, error: "form_expired" };
  }

  // Check for duplicate submission
  const existing = await env.DB.prepare(
    "SELECT id FROM form_submissions WHERE form_id = ? AND user_id = ?"
  )
    .bind(formId, userId)
    .first();

  if (existing) return { ok: false, error: "already_submitted" };

  const submissionId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO form_submissions (id, form_id, user_id, response_json, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(submissionId, formId, userId, JSON.stringify(response), new Date().toISOString())
    .run();

  logInfo("form.submitted", { projectId, formId, userId });

  if (form.room_id) {
    await fanoutServerEvent(env, {
      projectId,
      roomId: form.room_id,
      name: "form.submitted",
      userId,
      data: { formId, submissionId },
    }).catch(() => {});
  }

  return { ok: true, id: submissionId };
}

/**
 * Get form results.
 */
export async function getFormResults(env, input) {
  const { projectId, formId } = input;

  const form = await env.DB.prepare(
    "SELECT * FROM forms WHERE id = ? AND project_id = ?"
  )
    .bind(formId, projectId)
    .first();

  if (!form) return { ok: false, error: "form_not_found" };

  const submissions = await env.DB.prepare(
    "SELECT * FROM form_submissions WHERE form_id = ? ORDER BY created_at"
  )
    .bind(formId)
    .all();

  const totalResult = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM form_submissions WHERE form_id = ?"
  )
    .bind(formId)
    .first();

  return {
    ok: true,
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      schema: JSON.parse(form.form_schema || "{}"),
      isAnonymous: !!form.is_anonymous,
      isClosed: !!form.is_closed,
      expiresAt: form.expires_at,
      createdBy: form.created_by,
      createdAt: form.created_at,
    },
    submissions: (submissions.results || []).map((s) => ({
      id: s.id,
      userId: form.is_anonymous ? "anonymous" : s.user_id,
      response: JSON.parse(s.response_json || "{}"),
      createdAt: s.created_at,
    })),
    totalSubmissions: totalResult?.cnt || 0,
  };
}
