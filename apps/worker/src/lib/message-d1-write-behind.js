/**
 * Durable write-behind for Room DO chat messages.
 * Queue lives in DO `state.storage` (survives hibernate). Flush uses D1.batch.
 * RAM-only queues are forbidden: a DO eviction would drop unacked chat.
 */

export const MESSAGE_D1_WAL_KEY = "message_d1_wal_v1";
export const MESSAGE_D1_WAL_MAX_BATCH = 20;
export const MESSAGE_D1_WAL_FLUSH_MS = 200;
export const MESSAGE_D1_WAL_ALARM_JOB = "message-d1-wal";

export function isMessageWriteBehindEnabled(env) {
  return env?.MESSAGE_D1_WRITE_BEHIND !== "false";
}

export async function loadMessageWal(storage) {
  if (!storage || typeof storage.get !== "function") return [];
  const raw = await storage.get(MESSAGE_D1_WAL_KEY);
  return Array.isArray(raw) ? raw : [];
}

export async function saveMessageWal(storage, rows) {
  if (!storage) return;
  if (!rows.length) {
    if (typeof storage.delete === "function") await storage.delete(MESSAGE_D1_WAL_KEY);
    else if (typeof storage.put === "function") await storage.put(MESSAGE_D1_WAL_KEY, []);
    return;
  }
  if (typeof storage.put === "function") await storage.put(MESSAGE_D1_WAL_KEY, rows);
}

export function walHasClientMessageId(wal, clientMessageId) {
  if (!clientMessageId) return false;
  return wal.some((row) => row.clientMessageId === clientMessageId);
}

/**
 * Audit F-53: stamp a stable id so a flush can remove exactly the rows it
 * persisted (a concurrent enqueue must never be dropped by the flush).
 */
function walEntryKey(row) {
  return (
    row?._walId ||
    `${row?.clientMessageId ?? ""}|${row?.roomId ?? ""}|${row?.userId ?? ""}|${row?.createdAt ?? ""}`
  );
}

export async function enqueueMessageWal(storage, entry) {
  if (entry && !entry._walId) entry._walId = crypto.randomUUID();
  // Audit F-53: read-modify-write on the queue must be atomic — two
  // concurrent sends would otherwise overwrite each other (lost update).
  const run = async (store) => {
    const wal = await loadMessageWal(store);
    wal.push(entry);
    await saveMessageWal(store, wal);
    return wal;
  };
  if (storage && typeof storage.transaction === "function") {
    return storage.transaction(run);
  }
  return run(storage);
}

function messageInsertStatement(db, row) {
  return db
    .prepare(
      "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url, expires_at, visibility, visible_to_json, client_message_id, metadata_json, also_to_channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.projectId,
      row.roomId,
      row.userId,
      row.content,
      row.createdAt,
      row.parentId || null,
      row.mentions?.length ? JSON.stringify(row.mentions) : null,
      row.preview?.title || null,
      row.preview?.description || null,
      row.preview?.imageUrl || null,
      row.preview?.url || null,
      row.messageExpiresAt || null,
      row.visibility === "room" ? null : row.visibility || null,
      row.visibleToJson || null,
      row.clientMessageId || null,
      row.metadataJson || null,
      row.alsoToChannel ? 1 : 0,
    );
}

function appendMessageSatellites(db, row, messageId, satellites) {
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  for (const attachment of attachments) {
    satellites.push(
      db
        .prepare(
          "INSERT INTO attachments (project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          row.projectId,
          row.roomId,
          messageId,
          attachment.kind || "file",
          attachment.url,
          attachment.name || attachment.url,
          attachment.sizeBytes ?? null,
          attachment.contentType ?? null,
          row.createdAt,
        ),
    );
  }
  const mentions = Array.isArray(row.mentions) ? row.mentions : [];
  for (const mentioned of mentions) {
    satellites.push(
      db
        .prepare(
          "INSERT INTO message_mentions (project_id, room_id, message_id, mentioned_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(row.projectId, row.roomId, messageId, mentioned, row.createdAt),
    );
  }
  if (mentions.length) {
    satellites.push(
      db
        .prepare(
          "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          row.projectId,
          "mention",
          row.roomId,
          JSON.stringify({
            fromUserId: row.userId,
            toUserIds: mentions,
            messageId,
          }),
          row.createdAt,
        ),
    );
  }
}

/**
 * Persist WAL rows to D1 in one batch (per-row fallback when the batch fails).
 * Returns rows with public `messageId`. Does not broadcast. Caller fans out
 * after this resolves.
 *
 * @returns {Promise<object[]>}
 */
export async function flushMessageWal(storage, db) {
  const wal = await loadMessageWal(storage);
  if (!wal.length) return [];
  if (!db || typeof db.prepare !== "function") return [];
  // Audit F-53: only keys snapshotted from this flush are ever removed — rows
  // enqueued while D1 was writing must survive the cleanup.
  const resolvedKeys = new Set();

  const stmts = wal.map((row) => messageInsertStatement(db, row));
  let results = null;
  try {
    results =
      typeof db.batch === "function" ? await db.batch(stmts) : await Promise.all(stmts.map((s) => s.run()));
  } catch (err) {
    // A batch that fails on one row used to abort the flush before cleanup,
    // wedging the queue forever. Fall back to per-row inserts below instead.
    console.error("message_d1_wal.batch_failed", err?.message || err);
  }

  const flushed = [];
  const satellites = [];
  if (!results) {
    // One un-insertable row (typically a clientMessageId the REST path already
    // committed) must not block the rest: persist what can be persisted, resolve
    // true duplicates to the row already in D1 (no second fanout, no duplicated
    // satellites), and leave only genuinely failing rows for the next flush.
    for (const row of wal) {
      try {
        const messageId = (await messageInsertStatement(db, row).run())?.meta?.last_row_id;
        if (messageId == null) continue;
        flushed.push({ ...row, messageId });
        appendMessageSatellites(db, row, messageId, satellites);
        resolvedKeys.add(walEntryKey(row));
      } catch (err) {
        const message = String(err?.message || err);
        if (message.includes("UNIQUE constraint failed")) {
          const existing = await db
            .prepare(
              "SELECT id FROM messages WHERE project_id = ? AND room_id = ? AND client_message_id = ? AND deleted_at IS NULL LIMIT 1",
            )
            .bind(row.projectId, row.roomId, row.clientMessageId)
            .first()
            .catch(() => null);
          if (existing?.id != null) {
            resolvedKeys.add(walEntryKey(row));
            continue;
          }
        }
        console.error("message_d1_wal.row_flush_failed", row?.clientMessageId || "", message);
      }
    }
  } else {
    for (let i = 0; i < wal.length; i += 1) {
      const messageId = results[i]?.meta?.last_row_id;
      if (messageId == null) continue;
      const row = { ...wal[i], messageId };
      flushed.push(row);
      appendMessageSatellites(db, wal[i], messageId, satellites);
      resolvedKeys.add(walEntryKey(wal[i]));
    }
  }

  if (satellites.length) {
    if (typeof db.batch === "function") await db.batch(satellites);
    else await Promise.all(satellites.map((s) => s.run()));
  }

  // Audit F-53: remove only the rows this flush resolved — an enqueue that
  // landed while D1 was writing must survive. `storage.transaction` keeps the
  // read-modify-write atomic with `enqueueMessageWal`.
  const removeFlushed = async (store) => {
    const current = await loadMessageWal(store);
    const remaining = current.filter((row) => !resolvedKeys.has(walEntryKey(row)));
    await saveMessageWal(store, remaining);
  };
  if (typeof storage.transaction === "function") {
    await storage.transaction(removeFlushed);
  } else {
    await removeFlushed(storage);
  }
  return flushed;
}

export async function flushRoomMessageWalStub(env, roomId, projectId) {
  if (!isMessageWriteBehindEnabled(env)) return { ok: true, skipped: true };
  if (!env?.ROOM?.get) return { ok: true, skipped: true };
  let stub = null;
  if (projectId) {
    const { getRoomStubForProject } = await import("./room-shard.js");
    stub = await getRoomStubForProject(env, projectId, roomId);
  } else if (typeof env.ROOM.idFromName === "function") {
    stub = env.ROOM.get(env.ROOM.idFromName(roomId));
  }
  if (!stub || typeof stub.fetch !== "function") return { ok: true, skipped: true };
  const res = await stub.fetch("https://internal/flush-message-wal", { method: "POST" });
  if (!res.ok) return { ok: false, status: res.status };
  return res.json().catch(() => ({ ok: true }));
}
