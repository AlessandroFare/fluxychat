#!/usr/bin/env node
/**
 * Import legacy chat history into FluxyChat rooms.
 *
 * Usage:
 *   FLUXY_WORKER_URL=https://... FLUXY_ADMIN_JWT=... node scripts/import-chat-history.mjs ./messages.json
 *
 * JSON: [{ roomId, content, userId?, createdAt?, clientMessageId? }]
 * Uses POST /admin/messages/import (supports backdated createdAt + legacy userId).
 */

import fs from "node:fs";
import path from "node:path";

const WORKER_URL = (process.env.FLUXY_WORKER_URL || process.env.FIRST_MESSAGE_WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const ADMIN_JWT = process.env.FLUXY_ADMIN_JWT || process.env.ADMIN_JWT || "";
const DELAY_MS = Number(process.env.IMPORT_DELAY_MS || 100);
const BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 50);
const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postImport(row, attempt = 0) {
  const { roomId, content, userId, createdAt, clientMessageId } = row;
  if (!roomId || !content) {
    return { skipped: true, reason: "missing roomId or content" };
  }

  const res = await fetch(`${WORKER_URL}/admin/messages/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ADMIN_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roomId: String(roomId),
      content: String(content),
      userId: userId ? String(userId) : undefined,
      createdAt: createdAt ? String(createdAt) : undefined,
      clientMessageId: clientMessageId ? String(clientMessageId) : undefined,
    }),
  });

  if (res.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = Number(res.headers.get("Retry-After") || 2);
    await sleep(retryAfter * 1000);
    return postImport(row, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, body: text.slice(0, 200) };
  }

  const data = await res.json();
  return { ok: true, skipped: !!data.skipped, messageId: data.messageId };
}

async function postBatch(rows, attempt = 0) {
  const res = await fetch(`${WORKER_URL}/admin/messages/import/batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ADMIN_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: rows.map((row) => ({
        roomId: String(row.roomId),
        content: String(row.content),
        userId: row.userId ? String(row.userId) : undefined,
        createdAt: row.createdAt ? String(row.createdAt) : undefined,
        clientMessageId: row.clientMessageId ? String(row.clientMessageId) : undefined,
      })),
    }),
  });

  if (res.status === 429 && attempt < MAX_RETRIES) {
    await sleep(Number(res.headers.get("Retry-After") || 2) * 1000);
    return postBatch(rows, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, body: text.slice(0, 300) };
  }

  return { ok: true, ...(await res.json()) };
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/import-chat-history.mjs <messages.json>");
    process.exit(1);
  }
  if (!ADMIN_JWT.trim()) {
    console.error("Set FLUXY_ADMIN_JWT (admin JWT from dashboard Projects).");
    process.exit(1);
  }

  const abs = path.resolve(fileArg);
  const rows = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("JSON root must be an array.");
    process.exit(1);
  }

  console.log(`Importing ${rows.length} rows → ${WORKER_URL} (batch=${BATCH_SIZE})`);

  let imported = 0;
  let skipped = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const useBatch = chunk.every((r) => r.roomId && r.content);

    if (useBatch && chunk.length > 1) {
      const result = await postBatch(chunk);
      if (result.ok) {
        imported += result.imported ?? 0;
        skipped += result.skipped ?? 0;
        fail += result.failed ?? 0;
        console.log(`  batch ${i / BATCH_SIZE + 1}: +${result.imported} skip=${result.skipped} fail=${result.failed}`);
      } else {
        for (const row of chunk) {
          const single = await postImport(row);
          if (single.skipped) skip++;
          else if (single.ok) {
            if (single.skipped) skipped++;
            else imported++;
          } else fail++;
          await sleep(DELAY_MS);
        }
      }
    } else {
      for (const row of chunk) {
        const result = await postImport(row);
        if (result.skipped) skipped++;
        else if (result.ok) {
          if (result.skipped) skipped++;
          else imported++;
        } else {
          fail++;
          console.error(`  fail: HTTP ${result.status} ${result.body}`);
        }
        await sleep(DELAY_MS);
      }
    }
  }

  console.log(`Done. imported=${imported} skipped=${skipped} fail=${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
