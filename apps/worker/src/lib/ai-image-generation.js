/**
 * P14-D: AI Image Generation in Chat.
 *
 * Generate images with DALL-E / Workers AI directly in chat.
 * Features:
 *   • Image generation from text prompt
 *   • Multiple sizes, quality levels, styles
 *   • R2 storage for generated images
 *   • Content policy filtering
 *   • Generation history and stats
 */

import { resolveImageTransport } from "./ai-gateway.js";
import { safeOutboundFetch } from "./url-ssrf.js";

const ALLOWED_SIZES = ["1024x1024", "1024x1792", "1792x1024"];
const ALLOWED_QUALITIES = ["standard", "hd"];
const ALLOWED_STYLESS = ["vivid", "natural"];

function getDefaultModel(env) {
  if (env.AI_IMAGE_PROVIDER === "pollinations") return "flux";
  return env.AI_IMAGE_MODEL || "dall-e-3";
}

function isImageGenerationEnabled(env) {
  if (env.AI_IMAGE_PROVIDER === "pollinations") return env.AI_IMAGE_GENERATION_ENABLED === "true";
  return env.AI_IMAGE_GENERATION_ENABLED === "true" && (!!env.AI_BASE_URL || !!env.AI_IMAGE_BASE_URL);
}

/**
 * Generate an image from a text prompt.
 */
export async function generateImage(env, {
  projectId, roomId, userId, prompt,
  size, quality, style, model, messageId,
}) {
  if (!isImageGenerationEnabled(env)) {
    return { ok: false, error: "image_generation_disabled", status: 503 };
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return { ok: false, error: "prompt_too_short", status: 400 };
  }

  if (prompt.length > 4000) {
    return { ok: false, error: "prompt_too_long", status: 400 };
  }

  const selectedSize = ALLOWED_SIZES.includes(size) ? size : "1024x1024";
  const selectedQuality = ALLOWED_QUALITIES.includes(quality) ? quality : "standard";
  const selectedStyle = ALLOWED_STYLESS.includes(style) ? style : "vivid";
  const selectedModel = model || getDefaultModel(env);
  const id = crypto.randomUUID();
  const startTime = Date.now();

  // Content policy check (basic)
  const policyResult = checkContentPolicy(prompt);
  if (!policyResult.ok) {
    return { ok: false, error: policyResult.error, status: 400 };
  }

  // Store pending record
  await env.DB.prepare(
    `INSERT INTO ai_image_generations (id, project_id, room_id, message_id, user_id, prompt, image_size, image_quality, image_style, model, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).bind(id, projectId, roomId, messageId || null, userId, prompt, selectedSize, selectedQuality, selectedStyle, selectedModel)
    .run();

  try {
    let b64 = null;
    let revisedPrompt = prompt;

    if (env.AI_IMAGE_PROVIDER === "pollinations") {
      // Pollinations.ai: simple GET, returns image bytes directly
      const [w, h] = selectedSize.split("x");
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=${selectedModel}&nologo=true`;
      const pollRes = await fetch(pollinationsUrl);
      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => "unknown");
        await env.DB.prepare(
          `UPDATE ai_image_generations SET status = 'failed', error = ?, processing_time_ms = ? WHERE id = ?`
        ).bind(`pollinations_error_${pollRes.status}: ${errText.slice(0, 200)}`, Date.now() - startTime, id).run();
        return { ok: false, error: "ai_api_error", details: errText.slice(0, 200), status: 502 };
      }
      const imgBuf = await pollRes.arrayBuffer();
      const bytes = new Uint8Array(imgBuf);
      // Convert to base64
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      b64 = btoa(binary);
    } else {
      // OpenAI-compatible /v1/images/generations
      const transport = resolveImageTransport(env);
      const response = await safeOutboundFetch(transport.imagesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...transport.headers,
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt,
          n: 1,
          size: selectedSize,
          quality: selectedQuality,
          style: selectedStyle,
          response_format: "b64_json",
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "unknown");
        await env.DB.prepare(
          `UPDATE ai_image_generations SET status = 'failed', error = ?, processing_time_ms = ? WHERE id = ?`
        ).bind(`api_error_${response.status}: ${errText.slice(0, 200)}`, Date.now() - startTime, id).run();
        return { ok: false, error: "ai_api_error", details: errText.slice(0, 200), status: 502 };
      }

      const data = await response.json();
      const imageData = data.data?.[0];
      if (!imageData) {
        await env.DB.prepare(
          `UPDATE ai_image_generations SET status = 'failed', error = 'no_image_data', processing_time_ms = ? WHERE id = ?`
        ).bind(Date.now() - startTime, id).run();
        return { ok: false, error: "no_image_data", status: 502 };
      }
      b64 = imageData.b64_json;
      revisedPrompt = imageData.revised_prompt || prompt;
    }

    // Upload to R2 if binding available
    let imageUrl = null;
    let r2Key = null;
    if (env.ATTACHMENTS) {
      r2Key = `ai-images/${projectId}/${roomId}/${id}.png`;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      await env.ATTACHMENTS.put(r2Key, bytes, {
        httpMetadata: { contentType: "image/png" },
      });
      imageUrl = `/attachments/${r2Key}`;
    }

    // Update record
    await env.DB.prepare(
      `UPDATE ai_image_generations
       SET status = 'completed', image_url = ?, image_r2_key = ?, revised_prompt = ?, processing_time_ms = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(imageUrl, r2Key, revisedPrompt, Date.now() - startTime, id).run();

    return {
      ok: true,
      id,
      imageUrl,
      r2Key,
      prompt,
      revisedPrompt,
      size: selectedSize,
      quality: selectedQuality,
      style: selectedStyle,
      model: selectedModel,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    await env.DB.prepare(
      `UPDATE ai_image_generations SET status = 'failed', error = ?, processing_time_ms = ? WHERE id = ?`
    ).bind(err.message?.slice(0, 200) || "unknown_error", Date.now() - startTime, id).run();
    return { ok: false, error: "generation_failed", details: err.message?.slice(0, 200), status: 500 };
  }
}

/**
 * Get a specific image generation by ID.
 */
export async function getImageGeneration(env, { projectId, id }) {
  const row = await env.DB.prepare(
    `SELECT * FROM ai_image_generations WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first();
  return row || null;
}

/**
 * List image generations for a room.
 */
export async function listRoomImageGenerations(env, { projectId, roomId, limit = 20, offset = 0 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ai_image_generations WHERE project_id = ? AND room_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(projectId, roomId, limit, offset).all();
  return results;
}

/**
 * Get image generation stats for a project.
 */
export async function getImageGenerationStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM ai_image_generations WHERE project_id = ?`
  ).bind(projectId).first();

  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM ai_image_generations WHERE project_id = ? GROUP BY status`
  ).bind(projectId).all();

  const recent = await env.DB.prepare(
    `SELECT AVG(processing_time_ms) as avg_time_ms, COUNT(*) as count
     FROM ai_image_generations WHERE project_id = ? AND status = 'completed'
     AND created_at > datetime('now', '-7 days')`
  ).bind(projectId).first();

  return {
    total: total?.count || 0,
    byStatus: Object.fromEntries((byStatus?.results || []).map(r => [r.status, r.count])),
    avgProcessingTimeMs: recent?.avg_time_ms || 0,
    recentCount: recent?.count || 0,
  };
}

/**
 * Delete an image generation record.
 */
export async function deleteImageGeneration(env, { projectId, id }) {
  const row = await env.DB.prepare(
    `SELECT * FROM ai_image_generations WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first();
  if (!row) return { ok: false, error: "not_found" };

  // Delete from R2 if exists
  if (row.image_r2_key && env.ATTACHMENTS) {
    try { await env.ATTACHMENTS.delete(row.image_r2_key); } catch (_) { /* ignore */ }
  }

  await env.DB.prepare(
    `DELETE FROM ai_image_generations WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).run();

  return { ok: true };
}

/**
 * Basic content policy check.
 */
function checkContentPolicy(prompt) {
  const lower = prompt.toLowerCase();
  const blocked = [
    "gore", "graphic violence", "child exploitation", "nsfw",
    "nude", "pornographic", "explicit sexual",
  ];
  for (const term of blocked) {
    if (lower.includes(term)) {
      return { ok: false, error: `content_policy_violation: ${term}` };
    }
  }
  return { ok: true };
}

/**
 * Resolve AI transport for image generation.
 */
  // resolveImageTransport is now imported from ai-gateway.js
