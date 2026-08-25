/**
 * P15-I: Multimodal AI — analyze images, audio, video with AI.
 *
 * Features:
 *   • Image analysis (describe, detect objects, OCR, sentiment)
 *   • Audio transcription and analysis
 *   • Video frame analysis
 *   • Content moderation for media
 *   • Contextual responses based on media + text
 */

import { safeOutboundFetch } from "./url-ssrf.js";

const MEDIA_TYPES = ["image", "audio", "video", "document"];
const IMAGE_ANALYSIS_PROMPT = `Analyze this image and provide:
1. A brief description of what you see
2. Any text visible (OCR)
3. Objects, people, or scenes detected
4. Overall sentiment or mood
5. Any potentially sensitive content (content moderation)
Return as JSON with keys: description, detectedText, objects, sentiment, moderationFlags.`;

const AUDIO_ANALYSIS_PROMPT = `Analyze this audio and provide:
1. Transcription of the speech
2. Speaker sentiment
3. Key topics discussed
4. Any action items or requests mentioned
Return as JSON with keys: transcription, sentiment, topics, actionItems.`;

const VIDEO_ANALYSIS_PROMPT = `Analyze this video and provide:
1. Scene descriptions (key frames)
2. Any text visible in frames
3. Activities or actions occurring
4. Overall sentiment
Return as JSON with keys: scenes, detectedText, activities, sentiment.`;

export async function analyzeMedia(env, {
  projectId, messageId, roomId, mediaType, mediaUrl, mediaBase64,
  customPrompt, model, userId,
}) {
  if (!MEDIA_TYPES.includes(mediaType)) {
    throw new Error(`Invalid media type: ${mediaType}. Must be one of: ${MEDIA_TYPES.join(", ")}`);
  }

  const startTime = Date.now();
  const analysisPrompt = customPrompt || getPromptForType(mediaType);
  const selectedModel = model || getDefaultModel(mediaType);

  let analysisResult;
  try {
    analysisResult = await callAIForMedia(env, {
      mediaType, mediaUrl, mediaBase64, prompt: analysisPrompt, model: selectedModel,
    });
  } catch (err) {
    analysisResult = { error: err.message, fallback: true };
  }

  const processingTimeMs = Date.now() - startTime;
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO multimodal_analyses (id, project_id, message_id, room_id, media_type, media_url,
     analysis_result, ai_model, tokens_used, processing_time_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, projectId, messageId, roomId, mediaType, mediaUrl || null,
    JSON.stringify(analysisResult), selectedModel, analysisResult.tokensUsed || 0,
    processingTimeMs,
  ).run();

  return {
    id, mediaType, analysis: analysisResult, model: selectedModel,
    processingTimeMs, tokensUsed: analysisResult.tokensUsed || 0,
  };
}

export async function getMediaAnalysis(env, { projectId, messageId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM multimodal_analyses WHERE project_id = ? AND message_id = ?`
  ).bind(projectId, messageId).first();
  if (!row) return null;
  return formatAnalysis(row);
}

export async function getRoomMediaAnalyses(env, { projectId, roomId, limit = 20 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM multimodal_analyses WHERE project_id = ? AND room_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(projectId, roomId, limit).all();
  return results.map(formatAnalysis);
}

export async function moderateMediaContent(env, { projectId, messageId }) {
  const analysis = await getMediaAnalysis(env, { projectId, messageId });
  if (!analysis) return { status: "no_analysis", safe: true };

  const flags = analysis.analysis.moderationFlags || [];
  const hasFlags = flags.length > 0 || analysis.analysis.error;
  return {
    status: hasFlags ? "flagged" : "safe",
    safe: !hasFlags,
    flags,
    analysis: analysis.analysis,
  };
}

export async function getMediaStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM multimodal_analyses WHERE project_id = ?`
  ).bind(projectId).first();
  const byType = await env.DB.prepare(
    `SELECT media_type, COUNT(*) as count FROM multimodal_analyses
     WHERE project_id = ? GROUP BY media_type`
  ).bind(projectId).all();
  return { total: total?.total || 0, byType: byType.results || byType };
}

async function callAIForMedia(env, { mediaType, mediaUrl, mediaBase64, prompt, model }) {
  if (!env.AI_BASE_URL) {
    return {
      description: `[Mock analysis of ${mediaType}] Content analyzed successfully.`,
      sentiment: "neutral",
      moderationFlags: [],
      tokensUsed: 0,
      mock: true,
    };
  }

  const messages = [
    { role: "system", content: "You are a multimodal AI assistant. Analyze media content and return structured JSON." },
    { role: "user", content: [
      { type: "text", text: prompt },
      mediaType === "image" ? { type: "image_url", image_url: { url: mediaUrl || `data:image/jpeg;base64,${mediaBase64}` } } :
      mediaType === "audio" ? { type: "audio_url", audio_url: { url: mediaUrl } } :
      { type: "video_url", video_url: { url: mediaUrl } },
    ]},
  ];

  const resp = await safeOutboundFetch(`${env.AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.AI_API_KEY ? { Authorization: `Bearer ${env.AI_API_KEY}` } : {}),
    },
    body: JSON.stringify({ model, messages, max_tokens: 1000 }),
  });

  if (!resp.ok) throw new Error(`AI API error: ${resp.status}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";

  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

  return { ...parsed, tokensUsed: data.usage?.total_tokens || 0 };
}

function getPromptForType(mediaType) {
  switch (mediaType) {
    case "image": return IMAGE_ANALYSIS_PROMPT;
    case "audio": return AUDIO_ANALYSIS_PROMPT;
    case "video": return VIDEO_ANALYSIS_PROMPT;
    default: return "Analyze this media content and provide a description.";
  }
}

function getDefaultModel(mediaType) {
  switch (mediaType) {
    case "image": return "gpt-4o";
    case "audio": return "whisper-1";
    case "video": return "gpt-4o";
    default: return "gpt-4o-mini";
  }
}

function formatAnalysis(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    messageId: row.message_id,
    roomId: row.room_id,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    analysis: JSON.parse(row.analysis_result || "{}"),
    model: row.ai_model,
    tokensUsed: row.tokens_used,
    processingTimeMs: row.processing_time_ms,
    createdAt: row.created_at,
  };
}

