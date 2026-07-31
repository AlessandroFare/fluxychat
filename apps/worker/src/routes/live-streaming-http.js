import * as Live from "../lib/live-streaming.js";
import { createLiveInput, deleteLiveInput } from "../lib/cloudflare-stream.js";
import {
  requireApiProjectMember,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchLiveStreamingRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/live")) return null;

  const gate = await requireApiProjectMember(request, h);
  if (gate.response) {
    const headers = { ...h.corsHeaders, "Content-Type": "application/json" };
    return new Response(JSON.stringify({ error: gate.response.status === 401 ? "unauthorized" : "forbidden" }), { status: gate.response.status, headers });
  }
  const { env, projectId, auth } = gate;
  const json = h.json;

  if (path === "/api/live/events" && request.method === "POST") {
    try {
      const body = withAuthProjectId(await request.json().catch(() => ({})), projectId);
      if (!body.title || !String(body.title).trim()) {
        return json({ error: "title required" }, { status: 400 });
      }
      const event = await Live.createEvent(env, body);
      return json({ event });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, { status: 500 });
    }
  }

  if (path === "/api/live/events" && request.method === "GET") {
    const result = await Live.listEvents(env, {
      projectId, status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json({ events: result });
  }

  if (path.match(/^\/api\/live\/events\/[^/]+$/) && request.method === "GET") {
    const eventId = path.split("/").pop();
    const result = await Live.getEvent(env, { eventId, projectId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+$/) && request.method === "PATCH") {
    const eventId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.updateEvent(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/provision$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const event = await Live.getEvent(env, { eventId, projectId });
    if (!event) return json({ error: "not_found" }, 404);
    if (event.liveInputUid) return json(event);
    try {
      const input = await createLiveInput(env, { eventId, projectId, title: event.title });
      await env.DB.prepare(
        `UPDATE live_events SET live_input_uid = ?, rtmps_url = ?, stream_key = ?, whip_url = ?,
          stream_url = ?, playback_hls = ?, playback_dash = ?, provider_state = ?, updated_at = ?
         WHERE id = ? AND project_id = ?`
      ).bind(
        input.uid, input.rtmpsUrl, input.streamKey, input.whipUrl, input.streamUrl,
        input.playbackHls, input.playbackDash, input.providerState,
        new Date().toISOString(), eventId, projectId,
      ).run();
      return json(await Live.getEvent(env, { eventId, projectId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, message === "cloudflare_stream_not_configured" ? 503 : 502);
    }
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/input$/) && request.method === "DELETE") {
    const eventId = path.split("/")[4];
    const event = await Live.getEvent(env, { eventId, projectId });
    if (!event) return json({ error: "not_found" }, 404);
    if (event.liveInputUid) await deleteLiveInput(env, event.liveInputUid);
    await env.DB.prepare(
      `UPDATE live_events SET live_input_uid = NULL, rtmps_url = NULL, stream_key = NULL,
        whip_url = NULL, stream_url = NULL, playback_hls = NULL, playback_dash = NULL,
        provider_state = NULL, updated_at = ? WHERE id = ? AND project_id = ?`
    ).bind(new Date().toISOString(), eventId, projectId).run();
    return json({ deleted: true });
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/rules$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.upsertChatRules(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/rules$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getChatRules(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/join$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.joinEvent(env, { eventId, ...body, userId: auth.userId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/leave$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.leaveEvent(env, { eventId, ...body, userId: auth.userId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/viewers$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.listViewers(env, {
      eventId, role: url.searchParams.get("role"),
      limit: parseInt(url.searchParams.get("limit") || "100"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/viewer-count$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getViewerCount(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/peak$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getPeakViewers(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/peak$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const result = await Live.updateViewerPeak(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/ban$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.banViewer(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/mute$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.muteViewer(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/pin$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.pinMessage(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/unpin$/) && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.unpinMessage(env, body);
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/pinned$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.listPinnedMessages(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/messages$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.sendLiveMessage(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/messages$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.listLiveMessages(env, {
      eventId, limit: parseInt(url.searchParams.get("limit") || "100"),
      before: url.searchParams.get("before"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/analytics$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.recordAnalyticsBucket(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/analytics$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getEventAnalytics(env, {
      eventId, fromBucket: url.searchParams.get("fromBucket"), toBucket: url.searchParams.get("toBucket"),
    });
    return json(result);
  }

  if (path === "/api/live/stats" && request.method === "GET") {
    const result = await Live.getLiveStats(env, { projectId });
    return json(result);
  }

  // --- Multi-angle cameras ---
  if (path.match(/^\/api\/live\/events\/[^/]+\/angles$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const rows = await env.DB.prepare(
      "SELECT * FROM live_stream_angles WHERE event_id = ? AND project_id = ? ORDER BY sort_order ASC"
    ).bind(eventId, projectId).all();
    return json((rows.results || []).map((r) => ({
      id: r.id, eventId: r.event_id, projectId: r.project_id,
      label: r.label, streamUrl: r.stream_url, sortOrder: r.sort_order, enabled: r.enabled === 1,
    })));
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/angles$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const id = `ang_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO live_stream_angles (id, event_id, project_id, label, stream_url, sort_order, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, eventId, projectId, body.label || "Angle", body.streamUrl || "", body.sortOrder || 0, 1, now).run();
    return json({ id });
  }

  // --- Highlights ---
  if (path.match(/^\/api\/live\/events\/[^/]+\/highlights$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const rows = await env.DB.prepare(
      "SELECT * FROM live_stream_highlights WHERE event_id = ? AND project_id = ? ORDER BY created_at DESC"
    ).bind(eventId, projectId).all();
    return json((rows.results || []).map((r) => ({
      id: r.id, eventId: r.event_id, projectId: r.project_id,
      title: r.title, startSeconds: r.start_seconds, endSeconds: r.end_seconds,
      reason: r.reason, clipUrl: r.clip_url, status: r.status, createdAt: r.created_at,
    })));
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/highlights$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const id = `hl_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO live_stream_highlights (id, event_id, project_id, title, start_seconds, end_seconds, reason, clip_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, eventId, projectId, body.title || "Highlight", body.startSeconds || 0, body.endSeconds || 0, body.reason || null, body.clipUrl || null, "suggested", now).run();
    return json({ id });
  }

  // --- Live shopping products ---
  if (path.match(/^\/api\/live\/events\/[^/]+\/products$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const rows = await env.DB.prepare(
      "SELECT * FROM live_stream_products WHERE event_id = ? AND project_id = ? ORDER BY created_at DESC"
    ).bind(eventId, projectId).all();
    return json((rows.results || []).map((r) => ({
      id: r.id, eventId: r.event_id, projectId: r.project_id,
      name: r.name, description: r.description, imageUrl: r.image_url,
      checkoutUrl: r.checkout_url, priceAmount: r.price_amount, currency: r.currency,
      active: r.active === 1, shownAt: r.shown_at, createdAt: r.created_at,
    })));
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/products$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const id = `prod_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO live_stream_products (id, event_id, project_id, name, description, image_url, checkout_url, price_amount, currency, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, eventId, projectId, body.name || "Product", body.description || null, body.imageUrl || null, body.checkoutUrl || "", body.priceAmount || null, body.currency || "usd", 0, now).run();
    return json({ id });
  }

  // --- Gifts / tips ---
  if (path.match(/^\/api\/live\/events\/[^/]+\/gifts$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const rows = await env.DB.prepare(
      "SELECT * FROM live_stream_gifts WHERE event_id = ? AND project_id = ? ORDER BY created_at DESC"
    ).bind(eventId, projectId).all();
    return json((rows.results || []).map((r) => ({
      id: r.id, eventId: r.event_id, projectId: r.project_id,
      userId: r.user_id, giftType: r.gift_type, amount: r.amount,
      currency: r.currency, paymentStatus: r.payment_status, createdAt: r.created_at,
    })));
  }

  if (path.match(/^\/api\/live\/events\/[^/]+\/gifts$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const id = `gift_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO live_stream_gifts (id, event_id, project_id, user_id, gift_type, amount, currency, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, eventId, projectId, body.userId || auth.userId, body.giftType || "tip", body.amount || 0, body.currency || "usd", "pending", now).run();
    return json({ id });
  }

  // --- Sentiment ---
  if (path.match(/^\/api\/live\/events\/[^/]+\/sentiment$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const rows = await env.DB.prepare(
      "SELECT * FROM live_stream_sentiment WHERE event_id = ? AND project_id = ? ORDER BY timestamp_bucket ASC"
    ).bind(eventId, projectId).all();
    return json((rows.results || []).map((r) => ({
      id: r.id, eventId: r.event_id, projectId: r.project_id,
      timestampBucket: r.timestamp_bucket, positive: r.positive,
      neutral: r.neutral, negative: r.negative, score: r.score, createdAt: r.created_at,
    })));
  }

  // --- TURN credentials for WebRTC relay ---
  if (path === "/api/live/turn-credentials" && request.method === "GET") {
    // Generate ephemeral TURN credentials with 1h TTL.
    // Uses Metered.ca API or self-hosted Coturn.
    const turnApiUrl = String(env.TURN_API_URL || "").trim();
    const turnApiKey = String(env.TURN_API_KEY || "").trim();
    const turnSecret = String(env.TURN_SECRET || "").trim();
    const turnServers = String(env.TURN_SERVERS || "").trim();

    if (!turnSecret && !turnApiKey) {
      return json({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        ttl: 3600,
        note: "TURN not configured. Set TURN_SECRET or TURN_API_KEY for production WebRTC relay.",
      });
    }

    // HMAC-SHA1 ephemeral credentials (Coturn REST API pattern)
    if (turnSecret) {
      const username = `${Math.floor(Date.now() / 1000) + 3600}:${auth.userId || "guest"}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(turnSecret),
        { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
      const credential = btoa(String.fromCharCode(...new Uint8Array(sig)));
      const servers = turnServers
        ? turnServers.split(",").map((s) => ({ urls: s.trim(), username, credential }))
        : [{ urls: "turn:turn.example.com:3478", username, credential }];
      return json({ iceServers: servers, ttl: 3600 });
    }

    // Metered.ca pattern: proxy to their API
    if (turnApiUrl && turnApiKey) {
      try {
        const res = await fetch(`${turnApiUrl}?apiKey=${turnApiKey}`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          return json({ iceServers: data.iceServers || [], ttl: data.ttl || 3600 });
        }
      } catch { /* fall through */ }
    }

    return json({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      ttl: 3600,
    });
  }

  return null;
}
