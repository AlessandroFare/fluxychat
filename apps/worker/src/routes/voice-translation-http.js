import { json } from "../lib/http-json.js";
import * as VoiceTranslation from "../lib/voice-translation.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchVoiceTranslationRoutes(request, url, h) {
  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;
  const path = url.pathname;

  if (path === "/api/voice-translation/profiles" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.upsertProfile(env, body);
    return json(result);
  }

  if (path === "/api/voice-translation/profiles" && request.method === "GET") {
    const result = await VoiceTranslation.getProfile(env, { projectId, userId: url.searchParams.get("userId") });
    return json(result || { error: "not_found" }, 404);
  }

  if (path === "/api/voice-translation/rooms" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.upsertRoomConfig(env, body);
    return json(result);
  }

  if (path === "/api/voice-translation/rooms" && request.method === "GET") {
    const result = await VoiceTranslation.getRoomConfig(env, { projectId, roomId: url.searchParams.get("roomId") });
    return json(result || { error: "not_found" }, 404);
  }

  if (path === "/api/voice-translation/jobs" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.createJob(env, body);
    return json(result);
  }

  if (path === "/api/voice-translation/jobs" && request.method === "GET") {
    const result = await VoiceTranslation.listJobs(env, {
      projectId,
      roomId: url.searchParams.get("roomId"),
      status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/voice-translation\/jobs\/[a-z0-9]+\/complete$/) && request.method === "POST") {
    const jobId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.completeJob(env, { jobId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/voice-translation\/jobs\/[a-z0-9]+\/fail$/) && request.method === "POST") {
    const jobId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.failJob(env, { jobId, ...body });
    return json(result);
  }

  if (path === "/api/voice-translation/feedback" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.submitFeedback(env, body);
    return json(result);
  }

  if (path === "/api/voice-translation/quality" && request.method === "GET") {
    const result = await VoiceTranslation.getTranslationQuality(env, { projectId });
    return json(result);
  }

  if (path === "/api/voice-translation/cache" && request.method === "GET") {
    const result = await VoiceTranslation.getCachedTranslation(env, {
      projectId,
      sourceLang: url.searchParams.get("sourceLang"),
      targetLang: url.searchParams.get("targetLang"),
      sourceHash: url.searchParams.get("sourceHash"),
    });
    return json(result || { miss: true });
  }

  if (path === "/api/voice-translation/cache" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await VoiceTranslation.setCachedTranslation(env, body);
    return json(result);
  }

  if (path === "/api/voice-translation/stats" && request.method === "GET") {
    const result = await VoiceTranslation.getStats(env, { projectId });
    return json(result);
  }

  return null;
}
