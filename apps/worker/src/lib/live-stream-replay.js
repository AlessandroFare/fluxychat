/**
 * Live stream VOD replay — Cloudflare Stream recordings + manual HTTPS URLs.
 */

import { listLiveInputVideos, createLiveInput } from "./cloudflare-stream.js";
import { validateExternalHttpsUrl } from "./a2a-worker.js";
import { listLiveMessages } from "./live-streaming.js";
import { fanoutServerEvent } from "./message-realtime-fanout.js";

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function mapReplayRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    projectId: row.project_id,
    source: row.source,
    videoUid: row.video_uid ?? undefined,
    label: row.label ?? undefined,
    playbackHls: row.playback_hls ?? undefined,
    playbackDash: row.playback_dash ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : undefined,
    status: row.status,
    isPrimary: row.is_primary === 1,
    angleId: row.angle_id ?? undefined,
    syncGroupId: row.sync_group_id ?? undefined,
    offsetMs: row.offset_ms != null ? Number(row.offset_ms) : 0,
    createdAt: row.created_at,
    readyAt: row.ready_at ?? undefined,
  };
}

export function eventSyncGroupId(eventId) {
  return `sg_${eventId}`;
}

async function fanoutReplayReady(env, { projectId, eventId, replay, userId }) {
  const row = await env.DB.prepare(
    "SELECT room_id FROM live_events WHERE id = ? AND project_id = ?",
  ).bind(eventId, projectId).first();
  if (!row?.room_id) return;
  await fanoutServerEvent(env, {
    projectId,
    roomId: row.room_id,
    name: "live.replay_ready",
    userId: userId || "system",
    data: { eventId, replay },
  }).catch(() => {});
}

async function setPrimaryReplay(env, { projectId, eventId, replayId }) {
  await env.DB.prepare(
    "UPDATE live_stream_replays SET is_primary = 0 WHERE event_id = ? AND project_id = ?",
  ).bind(eventId, projectId).run();
  await env.DB.prepare(
    "UPDATE live_stream_replays SET is_primary = 1 WHERE id = ? AND project_id = ?",
  ).bind(replayId, projectId).run();
}

export async function listEventReplays(env, { projectId, eventId, limit = 20 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM live_stream_replays
     WHERE project_id = ? AND event_id = ?
     ORDER BY is_primary DESC, created_at DESC
     LIMIT ?`,
  )
    .bind(projectId, eventId, Math.min(Number(limit) || 20, 50))
    .all();
  return (rows.results || []).map(mapReplayRow);
}

export async function getPrimaryEventReplay(env, { projectId, eventId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM live_stream_replays
     WHERE project_id = ? AND event_id = ? AND status = 'ready'
     ORDER BY is_primary DESC, ready_at DESC, created_at DESC
     LIMIT 1`,
  )
    .bind(projectId, eventId)
    .first();
  return mapReplayRow(row);
}

export async function registerManualReplay(env, { projectId, eventId, userId, label, playbackHls, playbackDash, thumbnailUrl, durationSeconds, angleId, offsetMs, syncGroupId }) {
  const event = await env.DB.prepare(
    "SELECT id FROM live_events WHERE id = ? AND project_id = ?",
  ).bind(eventId, projectId).first();
  if (!event) return { ok: false, error: "event_not_found" };

  const hls = validateExternalHttpsUrl(playbackHls);
  if (!hls.ok) return { ok: false, error: hls.error };
  let dashUrl = null;
  if (playbackDash) {
    const dash = validateExternalHttpsUrl(playbackDash);
    if (!dash.ok) return { ok: false, error: dash.error };
    dashUrl = dash.url;
  }
  if (thumbnailUrl) {
    const thumb = validateExternalHttpsUrl(thumbnailUrl);
    if (!thumb.ok) return { ok: false, error: thumb.error };
  }

  const id = generateId("replay");
  const now = new Date().toISOString();
  const resolvedSyncGroup = syncGroupId || eventSyncGroupId(eventId);
  const resolvedOffset = Math.max(0, Number(offsetMs) || 0);
  await env.DB.prepare(
    `INSERT INTO live_stream_replays
     (id, event_id, project_id, source, label, playback_hls, playback_dash, thumbnail_url, duration_seconds, status, is_primary, angle_id, sync_group_id, offset_ms, created_at, ready_at)
     VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, 'ready', 0, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      eventId,
      projectId,
      label ? String(label).slice(0, 120) : "Manual replay",
      hls.url,
      dashUrl,
      thumbnailUrl ? String(thumbnailUrl).slice(0, 500) : null,
      durationSeconds != null ? Number(durationSeconds) : null,
      angleId ? String(angleId).slice(0, 64) : null,
      resolvedSyncGroup,
      resolvedOffset,
      now,
      now,
    )
    .run();

  const existingPrimary = await getPrimaryEventReplay(env, { projectId, eventId });
  if (!existingPrimary && !angleId) {
    await setPrimaryReplay(env, { projectId, eventId, replayId: id });
  }

  const replay = mapReplayRow(await env.DB.prepare(
    "SELECT * FROM live_stream_replays WHERE id = ? AND project_id = ?",
  ).bind(id, projectId).first());

  await fanoutReplayReady(env, { projectId, eventId, replay, userId });
  return { ok: true, replay };
}

export async function reconcileEventReplayFromCloudflare(env, {
  projectId,
  eventId,
  userId,
  angleId = null,
  syncGroupId = null,
  liveInputUid = null,
}) {
  const eventRow = await env.DB.prepare(
    "SELECT * FROM live_events WHERE id = ? AND project_id = ?",
  ).bind(eventId, projectId).first();
  if (!eventRow) return { ok: false, error: "event_not_found" };

  const inputUid = liveInputUid || eventRow.live_input_uid;
  if (!inputUid) return { ok: false, error: "no_live_input" };

  const resolvedSyncGroup = syncGroupId || eventSyncGroupId(eventId);
  const resolvedAngleId = angleId ? String(angleId) : null;

  const videos = await listLiveInputVideos(env, inputUid);
  if (!videos.length) return { ok: true, replays: [], synced: 0 };

  const now = new Date().toISOString();
  let synced = 0;
  let latestReadyId = null;

  for (const video of videos) {
    if (!video.videoUid) continue;
    let existing;
    if (resolvedAngleId) {
      existing = await env.DB.prepare(
        "SELECT id FROM live_stream_replays WHERE project_id = ? AND event_id = ? AND video_uid = ? AND angle_id = ?",
      ).bind(projectId, eventId, video.videoUid, resolvedAngleId).first();
    } else {
      existing = await env.DB.prepare(
        "SELECT id FROM live_stream_replays WHERE project_id = ? AND event_id = ? AND video_uid = ? AND (angle_id IS NULL OR angle_id = '')",
      ).bind(projectId, eventId, video.videoUid).first();
    }

    if (existing) {
      await env.DB.prepare(
        `UPDATE live_stream_replays SET status = ?, playback_hls = ?, playback_dash = ?, thumbnail_url = ?,
          duration_seconds = ?, sync_group_id = ?, ready_at = CASE WHEN ? = 'ready' THEN COALESCE(ready_at, ?) ELSE ready_at END
         WHERE id = ?`,
      )
        .bind(
          video.status,
          video.playbackHls,
          video.playbackDash,
          video.thumbnailUrl,
          video.durationSeconds,
          resolvedSyncGroup,
          video.status,
          now,
          existing.id,
        )
        .run();
      if (video.status === "ready") latestReadyId = existing.id;
      synced++;
      continue;
    }

    const id = generateId("replay");
    await env.DB.prepare(
      `INSERT INTO live_stream_replays
       (id, event_id, project_id, source, video_uid, label, playback_hls, playback_dash, thumbnail_url,
        duration_seconds, status, is_primary, angle_id, sync_group_id, offset_ms, created_at, ready_at)
       VALUES (?, ?, ?, 'cloudflare', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
    )
      .bind(
        id,
        eventId,
        projectId,
        video.videoUid,
        resolvedAngleId ? "Angle recording" : "Cloudflare recording",
        video.playbackHls,
        video.playbackDash,
        video.thumbnailUrl,
        video.durationSeconds,
        video.status,
        resolvedAngleId,
        resolvedSyncGroup,
        now,
        video.status === "ready" ? now : null,
      )
      .run();
    if (video.status === "ready") latestReadyId = id;
    synced++;
  }

  if (!resolvedAngleId) {
    const primary = await getPrimaryEventReplay(env, { projectId, eventId });
    if (!primary && latestReadyId) {
      await setPrimaryReplay(env, { projectId, eventId, replayId: latestReadyId });
      const replay = mapReplayRow(await env.DB.prepare(
        "SELECT * FROM live_stream_replays WHERE id = ?",
      ).bind(latestReadyId).first());
      await fanoutReplayReady(env, { projectId, eventId, replay, userId });
    }
  }

  const replays = await listEventReplays(env, { projectId, eventId });
  return { ok: true, replays, synced, angleId: resolvedAngleId, syncGroupId: resolvedSyncGroup };
}

async function provisionMissingAngleLiveInputs(env, { projectId, eventId }) {
  const angleRows = await env.DB.prepare(
    "SELECT id, label, live_input_uid FROM live_stream_angles WHERE event_id = ? AND project_id = ? AND enabled = 1",
  )
    .bind(eventId, projectId)
    .all();

  let provisioned = 0;
  for (const angle of angleRows.results || []) {
    if (angle.live_input_uid) continue;
    try {
      const input = await createLiveInput(env, {
        eventId,
        projectId,
        title: `${angle.label || "Angle"} (${eventId})`,
      });
      await env.DB.prepare(
        "UPDATE live_stream_angles SET live_input_uid = ?, playback_hls = ? WHERE id = ? AND project_id = ?",
      )
        .bind(input.uid, input.playbackHls ?? null, angle.id, projectId)
        .run();
      provisioned += 1;
    } catch {
      /* CF not configured or quota — skip angle */
    }
  }
  return provisioned;
}

export async function reconcileEventAngleReplays(env, { projectId, eventId, userId }) {
  await provisionMissingAngleLiveInputs(env, { projectId, eventId });
  const syncGroupId = eventSyncGroupId(eventId);
  const main = await reconcileEventReplayFromCloudflare(env, {
    projectId,
    eventId,
    userId,
    syncGroupId,
  }).catch(() => ({ ok: false, synced: 0 }));

  const angleRows = await env.DB.prepare(
    "SELECT id, live_input_uid FROM live_stream_angles WHERE event_id = ? AND project_id = ? AND enabled = 1 ORDER BY sort_order ASC",
  )
    .bind(eventId, projectId)
    .all();

  let synced = Number(main.synced) || 0;
  for (const angle of angleRows.results || []) {
    if (!angle.live_input_uid) continue;
    const result = await reconcileEventReplayFromCloudflare(env, {
      projectId,
      eventId,
      userId,
      angleId: angle.id,
      syncGroupId,
      liveInputUid: angle.live_input_uid,
    }).catch(() => ({ synced: 0 }));
    synced += Number(result.synced) || 0;
  }

  const replays = await listEventReplays(env, { projectId, eventId });
  return { ok: true, replays, synced, syncGroupId };
}

export async function getEventReplayBundle(env, { projectId, eventId, messageLimit = 200 }) {
  const replay = await getPrimaryEventReplay(env, { projectId, eventId });
  const allReplays = await listEventReplays(env, { projectId, eventId, limit: 50 });
  const angleRows = await env.DB.prepare(
    "SELECT id, label, sort_order FROM live_stream_angles WHERE event_id = ? AND project_id = ? AND enabled = 1 ORDER BY sort_order ASC",
  )
    .bind(eventId, projectId)
    .all();

  /** @type {Array<{ angleId: string, label: string, sortOrder: number, replay: ReturnType<typeof mapReplayRow>, offsetMs: number }>} */
  const angleReplays = [];
  for (const angle of angleRows.results || []) {
    const ready = allReplays.filter(
      (r) => r.angleId === angle.id && r.status === "ready" && r.playbackHls,
    );
    const angleReplay = ready[0] || allReplays.find((r) => r.angleId === angle.id);
    if (!angleReplay?.playbackHls) continue;
    angleReplays.push({
      angleId: angle.id,
      label: angle.label,
      sortOrder: Number(angle.sort_order) || 0,
      replay: angleReplay,
      offsetMs: angleReplay.offsetMs ?? 0,
    });
  }

  if (!angleReplays.length && replay?.playbackHls) {
    angleReplays.push({
      angleId: "primary",
      label: replay.label || "Main",
      sortOrder: 0,
      replay,
      offsetMs: replay.offsetMs ?? 0,
    });
  }

  const syncGroupId =
    replay?.syncGroupId ||
    angleReplays[0]?.replay?.syncGroupId ||
    allReplays.find((r) => r.syncGroupId)?.syncGroupId ||
    null;

  const messages = await listLiveMessages(env, { eventId, limit: messageLimit });
  return {
    ok: true,
    replay,
    angleReplays,
    syncGroupId,
    chatTimeline: messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.username,
      content: m.content,
      contentType: m.contentType,
      createdAt: m.createdAt,
    })),
  };
}

export { mapReplayRow };
