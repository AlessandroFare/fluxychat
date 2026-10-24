/**
 * AI summary for text-like message attachments (Slack "file summary").
 * Reads the object from R2 (own `/attachments/{projectId}/…` keys only) and
 * stores a short summary in `attachments.ai_summary`. Gated by the shared LLM
 * policy; best-effort — every failure is a silent no-op for the caller.
 */
import { chatCompletion } from "./ai-chat-completion.js";
import {
  attachmentUrlToR2Key,
  r2KeyBelongsToProject,
} from "./attachment-storage.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";

const MAX_FILE_BYTES = 128 * 1024;
const MAX_TEXT_CHARS = 6000;
const MAX_SUMMARY_CHARS = 280;

const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
]);

export function isSummarizableAttachment({ contentType, sizeBytes }) {
  const mime = String(contentType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (!mime) return false;
  const looksText = mime.startsWith("text/") || TEXT_MIME_EXACT.has(mime);
  if (!looksText) return false;
  const size = Number(sizeBytes);
  return !Number.isFinite(size) || size <= MAX_FILE_BYTES;
}

export async function summarizeMessageAttachments(env, { projectId, messageId }) {
  if (!env?.DB || !env?.ATTACHMENTS || !projectId || !messageId) {
    return { summarized: 0 };
  }
  if (!workerSharedLlmAllowed(env, projectId)) return { summarized: 0 };

  const rows = await env.DB.prepare(
    "SELECT id, url, name, content_type, size_bytes FROM attachments WHERE project_id = ? AND message_id = ? LIMIT 10",
  )
    .bind(projectId, messageId)
    .all();

  let summarized = 0;
  for (const row of rows.results || []) {
    if (
      !isSummarizableAttachment({
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
      })
    ) {
      continue;
    }
    const key = attachmentUrlToR2Key(row.url);
    if (!key || !r2KeyBelongsToProject(key, projectId)) continue;

    let text = "";
    try {
      const object = await env.ATTACHMENTS.get(key);
      if (!object) continue;
      const buffer = await object.arrayBuffer();
      if (buffer.byteLength > MAX_FILE_BYTES) continue;
      text = new TextDecoder().decode(buffer).slice(0, MAX_TEXT_CHARS);
    } catch {
      continue;
    }
    if (!text.trim()) continue;

    const ai = await chatCompletion(env, {
      messages: [
        {
          role: "system",
          content:
            "Summarize the attached file for a chat message in 1-2 concise sentences. Plain text only, no markdown.",
        },
        { role: "user", content: `File: ${row.name || "attachment"}\n\n${text}` },
      ],
      maxTokens: 120,
      temperature: 0.3,
      logContext: { projectId, feature: "attachment_ai_summary" },
    }).catch(() => null);
    if (!ai?.ok || !ai.content?.trim()) continue;

    const summary = ai.content.trim().slice(0, MAX_SUMMARY_CHARS);
    await env.DB.prepare(
      "UPDATE attachments SET ai_summary = ? WHERE id = ? AND project_id = ?",
    )
      .bind(summary, row.id, projectId)
      .run()
      .catch(() => null);
    summarized += 1;
  }
  return { summarized };
}
