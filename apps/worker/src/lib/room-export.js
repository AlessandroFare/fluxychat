/**
 * Room history export — Markdown + minimal PDF (P12-O).
 */
import { messageVisibilitySql } from "./message-visibility.js";
import { attachAttachmentsToMessages } from "./messages-attachments.js";

export const MAX_ROOM_EXPORT_MESSAGES = 5000;
const PDF_LINES_PER_PAGE = 52;

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   from?: string | null,
 *   to?: string | null,
 *   limit?: number,
 * }} input
 */
export async function fetchRoomExportData(env, input) {
  const limit = Math.min(
    MAX_ROOM_EXPORT_MESSAGES,
    Math.max(1, Number(input.limit || MAX_ROOM_EXPORT_MESSAGES)),
  );

  const room = await env.DB.prepare(
    `SELECT id, type, name, created_at FROM rooms
     WHERE project_id = ? AND id = ? LIMIT 1`,
  )
    .bind(input.projectId, input.roomId)
    .first();

  if (!room) return { ok: false, error: "room_not_found" };

  const vis = messageVisibilitySql(input.userId);
  let sql = `SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at,
                    mentions, og_title, og_description, og_image, og_url, visibility, visible_to_json
             FROM messages
             WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL${vis.sql}`;
  const params = [input.projectId, input.roomId, ...vis.binds];

  if (input.from) {
    sql += " AND created_at >= ?";
    params.push(input.from);
  }
  if (input.to) {
    sql += " AND created_at <= ?";
    params.push(input.to);
  }
  sql += " ORDER BY created_at ASC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const messages = await attachAttachmentsToMessages(
    env,
    input.projectId,
    input.roomId,
    rows.results || [],
  );

  return {
    ok: true,
    room: {
      id: room.id,
      type: room.type,
      name: room.name,
      createdAt: room.created_at,
    },
    messages,
    truncated: (rows.results?.length ?? 0) >= limit,
  };
}

/**
 * @param {{
 *   room: { id: string, name?: string | null, type?: string, createdAt?: string },
 *   projectId: string,
 *   messages: Array<Record<string, unknown>>,
 *   exportedAt?: string,
 *   truncated?: boolean,
 * }} input
 */
export function buildRoomMarkdown(input) {
  const exportedAt = input.exportedAt || new Date().toISOString();
  const roomTitle = input.room.name?.trim() || input.room.id;
  const byId = new Map(input.messages.map((m) => [m.id, m]));

  const lines = [
    `# Room export: ${roomTitle}`,
    "",
    `- **Room ID:** \`${input.room.id}\``,
    `- **Project:** \`${input.projectId}\``,
    `- **Exported at:** ${exportedAt}`,
    `- **Messages:** ${input.messages.length}`,
    input.truncated ? `- **Note:** export truncated at ${MAX_ROOM_EXPORT_MESSAGES} messages` : "",
    "",
    "---",
    "",
    "## Messages",
    "",
  ].filter((line) => line !== "");

  for (const msg of input.messages) {
    const ts = String(msg.createdAt || "");
    const author = String(msg.userId || "unknown");
    lines.push(`### ${ts} — ${author}`);
    if (msg.parentId != null) {
      const parent = byId.get(msg.parentId);
      const parentAuthor = parent ? String(parent.userId || "unknown") : `#${msg.parentId}`;
      const snippet = parent
        ? String(parent.content || "").replace(/\s+/g, " ").trim().slice(0, 120)
        : "";
      lines.push(`> Reply to **${parentAuthor}**${snippet ? `: ${snippet}` : ""}`);
      lines.push(">");
    }
    const content = String(msg.content || "").trim() || "_(empty)_";
    for (const line of content.split("\n")) {
      lines.push(msg.parentId != null ? `> ${line}` : line);
    }
    if (Array.isArray(msg.attachments) && msg.attachments.length) {
      lines.push("");
      for (const att of msg.attachments) {
        const name = att.name || att.url || "attachment";
        lines.push(`- Attachment: ${name}${att.url ? ` (${att.url})` : ""}`);
      }
    }
    if (msg.editedAt) {
      lines.push("");
      lines.push(`_Edited at ${msg.editedAt}_`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Plain-text lines for PDF rendering.
 * @param {ReturnType<typeof buildRoomMarkdown>} markdown
 */
export function markdownToPlainLines(markdown) {
  return String(markdown)
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^>\s?/gm, "  ")
    .replace(/^- /gm, "• ")
    .replace(/_([^_]+)_/g, "$1")
    .split("\n")
    .map((line) => line.slice(0, 100));
}

function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildPageStream(chunk) {
  const streamLines = ["BT", "/F1 10 Tf"];
  let y = 780;
  for (const line of chunk) {
    streamLines.push(`1 0 0 1 50 ${y} Tm (${escapePdfText(line)}) Tj`);
    y -= 14;
  }
  streamLines.push("ET");
  return streamLines.join("\n");
}

/**
 * Minimal PDF 1.4 generator (text-only, multi-page).
 * @param {string[]} lines
 */
export function buildSimplePdf(lines) {
  const pageChunks = [];
  for (let i = 0; i < lines.length; i += PDF_LINES_PER_PAGE) {
    pageChunks.push(lines.slice(i, i + PDF_LINES_PER_PAGE));
  }
  if (!pageChunks.length) pageChunks.push([""]);

  const fontId = 3 + pageChunks.length * 2;
  const parts = [];
  const pushObj = (id, body) => {
    parts.push({ id, text: `${id} 0 obj\n${body}\nendobj\n` });
  };

  pushObj(1, "<< /Type /Catalog /Pages 2 0 R >>");

  const pageKidRefs = [];
  let oid = 3;
  for (const chunk of pageChunks) {
    const stream = buildPageStream(chunk);
    const streamId = oid++;
    pushObj(streamId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = oid++;
    pageKidRefs.push(`${pageId} 0 R`);
    pushObj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
  }

  pushObj(
    2,
    `<< /Type /Pages /Kids [${pageKidRefs.join(" ")}] /Count ${pageKidRefs.length} >>`,
  );
  pushObj(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  parts.sort((a, b) => a.id - b.id);
  const header = "%PDF-1.4\n";
  let offset = header.length;
  const offsets = [0];
  const body = parts.map((part) => {
    offsets.push(offset);
    offset += part.text.length;
    return part.text;
  });
  let pdf = header + body.join("");
  const xrefStart = pdf.length;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf + xref;
}

/**
 * @param {{
 *   room: { id: string, name?: string | null },
 *   projectId: string,
 *   messages: Array<Record<string, unknown>>,
 *   exportedAt?: string,
 * }} input
 */
export function buildRoomPdf(input) {
  const markdown = buildRoomMarkdown(input);
  const lines = markdownToPlainLines(markdown);
  const header = [
    `FluxyChat room export`,
    `Room: ${input.room.name || input.room.id}`,
    `Project: ${input.projectId}`,
    `Exported: ${input.exportedAt || new Date().toISOString()}`,
    "",
  ];
  return buildSimplePdf([...header, ...lines]);
}
