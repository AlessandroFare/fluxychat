const MAX_POLL_OPTIONS = 10;
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_QUESTION = 500;
const MAX_POLL_OPTION_LEN = 200;

/**
 * @param {unknown} pollBody
 */
export function parsePollCreateInput(pollBody) {
  if (!pollBody || typeof pollBody !== "object") {
    return { ok: false, error: "poll object required" };
  }
  const question = String(pollBody.question ?? pollBody.title ?? "").trim();
  if (!question || question.length > MAX_POLL_QUESTION) {
    return { ok: false, error: "poll.question required (max 500 chars)" };
  }
  const rawOptions = pollBody.options;
  if (!Array.isArray(rawOptions) || rawOptions.length < MIN_POLL_OPTIONS) {
    return { ok: false, error: "poll.options must be an array with at least 2 items" };
  }
  if (rawOptions.length > MAX_POLL_OPTIONS) {
    return { ok: false, error: `poll.options max ${MAX_POLL_OPTIONS}` };
  }
  const options = [];
  for (const opt of rawOptions) {
    const text = String(opt ?? "").trim();
    if (!text || text.length > MAX_POLL_OPTION_LEN) {
      return { ok: false, error: "each poll option must be 1-200 chars" };
    }
    options.push(text);
  }
  const allowMultiple =
    pollBody.allowMultiple === true ||
    pollBody.allow_multiple === true ||
    pollBody.allowMultiple === 1;
  return { ok: true, question, options, allowMultiple };
}

/**
 * @param {*} env
 * @param {{
 *   messageId: number,
 *   projectId: string,
 *   roomId: string,
 *   question: string,
 *   options: string[],
 *   allowMultiple: boolean,
 * }} row
 */
export async function insertMessagePoll(env, row) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO message_polls
     (message_id, project_id, room_id, question, options_json, allow_multiple, closed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(
      row.messageId,
      row.projectId,
      row.roomId,
      row.question,
      JSON.stringify(row.options),
      row.allowMultiple ? 1 : 0,
      now,
    )
    .run();
  return buildPollSnapshot(row.question, row.options, row.allowMultiple, {}, row.messageId);
}

/**
 * @param {string} question
 * @param {string[]} options
 * @param {boolean} allowMultiple
 * @param {Record<number, number>} voteCounts
 * @param {number} messageId
 * @param {number} [totalVoters]
 */
export function buildPollSnapshot(
  question,
  options,
  allowMultiple,
  voteCounts,
  messageId,
  totalVoters = 0,
) {
  return {
    messageId,
    question,
    allowMultiple,
    options: options.map((text, index) => ({
      index,
      text,
      votes: voteCounts[index] ?? 0,
    })),
    totalVoters,
  };
}

/**
 * @param {*} env
 * @param {number} messageId
 * @param {string} projectId
 */
export async function getMessagePoll(env, messageId, projectId) {
  const row = await env.DB.prepare(
    `SELECT message_id, question, options_json, allow_multiple, closed
     FROM message_polls WHERE message_id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(messageId, projectId)
    .first();
  if (!row) return null;

  const options = JSON.parse(String(row.options_json || "[]"));
  const votes = await env.DB.prepare(
    `SELECT option_index, COUNT(*) as c FROM message_poll_votes
     WHERE message_id = ? GROUP BY option_index`,
  )
    .bind(messageId)
    .all();

  /** @type {Record<number, number>} */
  const voteCounts = {};
  for (const v of votes.results || []) {
    voteCounts[Number(v.option_index)] = Number(v.c) || 0;
  }

  const votersRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) as c FROM message_poll_votes WHERE message_id = ?`,
  )
    .bind(messageId)
    .first();

  return {
    ...buildPollSnapshot(
      row.question,
      options,
      row.allow_multiple === 1,
      voteCounts,
      messageId,
      Number(votersRow?.c) || 0,
    ),
    closed: row.closed === 1,
  };
}

/**
 * @param {*} env
 * @param {{
 *   messageId: number,
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   optionIndex: number,
 * }} input
 */
/**
 * @param {*} env
 * @param {number} messageId
 * @param {string} projectId
 */
export async function closeMessagePoll(env, messageId, projectId) {
  const row = await env.DB.prepare(
    `SELECT closed FROM message_polls WHERE message_id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(messageId, projectId)
    .first();
  if (!row) return { ok: false, error: "poll_not_found", status: 404 };
  if (row.closed === 1) return { ok: false, error: "already_closed", status: 409 };
  await env.DB.prepare(
    `UPDATE message_polls SET closed = 1 WHERE message_id = ? AND project_id = ?`,
  )
    .bind(messageId, projectId)
    .run();
  const snapshot = await getMessagePoll(env, messageId, projectId);
  return { ok: true, poll: snapshot };
}

export async function castPollVote(env, input) {
  const poll = await env.DB.prepare(
    `SELECT question, options_json, allow_multiple, closed, room_id
     FROM message_polls WHERE message_id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(input.messageId, input.projectId)
    .first();

  if (!poll) return { ok: false, error: "poll_not_found", status: 404 };
  if (poll.closed === 1) return { ok: false, error: "poll_closed", status: 403 };
  if (poll.room_id !== input.roomId) {
    return { ok: false, error: "room_mismatch", status: 403 };
  }

  const options = JSON.parse(String(poll.options_json || "[]"));
  if (
    !Number.isInteger(input.optionIndex) ||
    input.optionIndex < 0 ||
    input.optionIndex >= options.length
  ) {
    return { ok: false, error: "invalid_option_index", status: 400 };
  }

  const now = new Date().toISOString();
  const allowMultiple = poll.allow_multiple === 1;

  if (!allowMultiple) {
    await env.DB.prepare(
      "DELETE FROM message_poll_votes WHERE message_id = ? AND user_id = ?",
    )
      .bind(input.messageId, input.userId)
      .run();
  }

  await env.DB.prepare(
    `INSERT OR REPLACE INTO message_poll_votes (message_id, user_id, option_index, created_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(input.messageId, input.userId, input.optionIndex, now)
    .run();

  const snapshot = await getMessagePoll(env, input.messageId, input.projectId);
  return { ok: true, poll: snapshot };
}
