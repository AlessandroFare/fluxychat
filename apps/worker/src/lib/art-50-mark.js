/**
 * Art. 50 machine-readable marks for AI chat messages.
 * HMAC is integrity for export/audit, not a legal seal.
 */

export const ART50_MARK_VERSION = 1;

function hexFromBuffer(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function art50Secret(env) {
  const secret = env?.ART50_MARK_SECRET || env?.JWT_SECRET || "";
  return typeof secret === "string" ? secret : "";
}

export function buildArt50Unsigned({
  agentId,
  messageId,
  createdAt,
  firstContact = false,
  disclosureLabel = "AI assistant",
  euAiActRiskCategory = null,
  extra = null,
}) {
  return {
    v: ART50_MARK_VERSION,
    participantType: "ai",
    aiGenerated: true,
    aiDisclosure: disclosureLabel,
    firstContactInRoom: Boolean(firstContact),
    firstContactNotice: firstContact
      ? `This room includes an AI system (${disclosureLabel}). Outputs can be wrong. Art. 50 transparency — not legal advice.`
      : null,
    agentId: agentId || null,
    messageId: messageId ?? null,
    createdAt: createdAt || new Date().toISOString(),
    euAiActRiskCategory: euAiActRiskCategory ?? null,
    ...(extra && typeof extra === "object" ? extra : {}),
  };
}

export async function signArt50Mark(secret, unsigned) {
  const { sig: _drop, ...payload } = unsigned || {};
  const canonical = JSON.stringify(payload);
  if (!secret) {
    return { ...payload, sig: null, sigAlg: null };
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  return { ...payload, sig: hexFromBuffer(mac), sigAlg: "HMAC-SHA256" };
}

export function art50SecretPrevious(env) {
  const secret = env?.ART50_MARK_SECRET_PREVIOUS || "";
  return typeof secret === "string" ? secret : "";
}

export async function verifyArt50Mark(secret, marked) {
  if (!marked || typeof marked !== "object") return false;
  if (!secret || !marked.sig) return false;
  const { sig, sigAlg: _alg, ...unsigned } = marked;
  const again = await signArt50Mark(secret, unsigned);
  return again.sig === sig;
}

export async function verifyArt50MarkWithRotation(env, marked) {
  if (await verifyArt50Mark(art50Secret(env), marked)) return true;
  const previous = art50SecretPrevious(env);
  if (previous) return verifyArt50Mark(previous, marked);
  return false;
}

export async function isFirstAiMessageInRoom(env, projectId, roomId, exceptMessageId) {
  try {
    const row = await env.DB.prepare(
      `SELECT id FROM messages
       WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
         AND (participant_type = 'ai' OR metadata_json LIKE '%"aiGenerated":true%')
         AND id != ?
       LIMIT 1`,
    )
      .bind(projectId, roomId, exceptMessageId || 0)
      .first();
    return !row;
  } catch {
    return false;
  }
}

export async function persistArt50OnAgentMessage(env, {
  projectId,
  roomId,
  messageId,
  agentId,
  createdAt,
  extraMetadata = null,
  firstContactDisclosure = true,
}) {
  const id = Number(messageId);
  if (!id || !projectId || !roomId) return null;
  if (extraMetadata?.imported === true) return null;

  const firstContact =
    firstContactDisclosure !== false && (await isFirstAiMessageInRoom(env, projectId, roomId, id));
  const disclosureLabel =
    extraMetadata?.aiDisclosure || extraMetadata?.aiDisclosureLabel || "AI assistant";
  const extra = extraMetadata && typeof extraMetadata === "object" ? { ...extraMetadata } : {};
  delete extra.aiDisclosure;
  delete extra.aiDisclosureLabel;
  delete extra.euAiActRiskCategory;
  const unsigned = buildArt50Unsigned({
    agentId,
    messageId: id,
    createdAt,
    firstContact,
    disclosureLabel,
    euAiActRiskCategory: extraMetadata?.euAiActRiskCategory ?? null,
    extra,
  });
  const signed = await signArt50Mark(art50Secret(env), unsigned);

  try {
    await env.DB.prepare(
      `UPDATE messages SET participant_type = 'ai', metadata_json = ?
       WHERE id = ? AND project_id = ? AND room_id = ?`,
    )
      .bind(JSON.stringify(signed), id, projectId, roomId)
      .run();
  } catch {
    /* migration 0226 not applied */
  }

  return signed;
}

export async function listArt50Marks(env, projectId, { roomId, limit = 500 } = {}) {
  const cap = Math.min(2000, Math.max(1, Number(limit) || 500));
  let sql = `SELECT id, room_id, user_id, created_at, participant_type, metadata_json
             FROM messages
             WHERE project_id = ? AND deleted_at IS NULL AND participant_type = 'ai'`;
  const binds = [projectId];
  if (roomId) {
    sql += ` AND room_id = ?`;
    binds.push(roomId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(cap);
  try {
    const rows = await env.DB.prepare(sql).bind(...binds).all();
    const marks = [];
    for (const row of rows.results ?? []) {
      let metadata = null;
      try {
        metadata = row.metadata_json ? JSON.parse(row.metadata_json) : null;
      } catch {
        metadata = null;
      }
      const sigValid = metadata ? await verifyArt50MarkWithRotation(env, metadata) : false;
      marks.push({
        messageId: row.id,
        roomId: row.room_id,
        agentId: row.user_id,
        createdAt: row.created_at,
        participantType: row.participant_type,
        metadata,
        sigValid,
      });
    }
    return marks;
  } catch {
    return [];
  }
}
