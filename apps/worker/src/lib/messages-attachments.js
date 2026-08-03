function parseMentionsJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function attachAttachmentsToMessages(env, projectId, roomId, rows) {
  const mapped = rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    userId: r.user_id,
    senderId: r.user_id,
    content: r.content,
    createdAt: r.created_at,
    parentId: r.parent_id,
    editedAt: r.edited_at ?? null,
    deletedAt: r.deleted_at ?? null,
    expiresAt: r.expires_at ?? null,
    kind: r.kind ?? "text",
    audioUrl: r.audio_url ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    transcription: r.transcription ?? undefined,
    transcriptionStatus: r.transcription_status ?? undefined,
    visibility: r.visibility ?? "room",
    visibleTo: (() => {
      if (!r.visible_to_json) return undefined;
      try {
        const parsed = JSON.parse(r.visible_to_json);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    })(),
    clientMessageId: r.client_message_id ?? undefined,
    mentions: parseMentionsJson(r.mentions),
    preview: r.og_url
      ? {
          url: r.og_url,
          title: r.og_title,
          description: r.og_description,
          imageUrl: r.og_image,
        }
      : undefined,
    attachments: [],
  }));

  if (!mapped.length) return mapped;
  const ids = mapped.map((m) => m.id);
  const placeholders = ids.map(() => "?").join(",");
  const sql = `SELECT id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at
               FROM attachments
               WHERE project_id = ? AND room_id = ? AND message_id IN (${placeholders})
               ORDER BY created_at ASC`;
  const res = await env.DB.prepare(sql)
    .bind(projectId, roomId, ...ids)
    .all();
  const attRows = res.results || [];
  const byMessage = new Map();
  for (const a of attRows) {
    const arr = byMessage.get(a.message_id) || [];
    arr.push({
      id: a.id,
      kind: a.kind,
      url: a.url,
      name: a.name,
      sizeBytes: a.size_bytes,
      contentType: a.content_type,
    });
    byMessage.set(a.message_id, arr);
  }
  for (const m of mapped) {
    m.attachments = byMessage.get(m.id) || [];
  }

  const previewUrls = [...new Set(mapped.map((m) => m.preview?.url).filter(Boolean))];
  if (previewUrls.length) {
    const ph = previewUrls.map(() => "?").join(",");
    const lpRows = await env.DB.prepare(
      `SELECT url, ai_summary FROM link_previews WHERE project_id = ? AND url IN (${ph})`,
    )
      .bind(projectId, ...previewUrls)
      .all();
    const aiByUrl = new Map((lpRows.results || []).map((r) => [r.url, r.ai_summary ?? null]));
    for (const m of mapped) {
      if (m.preview?.url && aiByUrl.has(m.preview.url)) {
        m.preview.aiSummary = aiByUrl.get(m.preview.url);
      }
    }
  }

  return mapped;
}
