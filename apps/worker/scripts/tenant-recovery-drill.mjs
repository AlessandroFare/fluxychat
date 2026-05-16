import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";
const DEFAULT_LIMIT = 20;

async function main() {
  const baseUrl = process.env.FLUXY_BASE_URL || DEFAULT_BASE_URL;
  const apiKey = process.env.FLUXY_API_KEY;
  const sourceRoomId = process.env.DRILL_SOURCE_ROOM_ID;
  const messageLimit = Number(process.env.DRILL_MESSAGE_LIMIT || DEFAULT_LIMIT);
  const restoreRoomId =
    process.env.DRILL_RESTORE_ROOM_ID || `restore-drill-${Date.now()}`;

  if (!apiKey) {
    throw new Error("Missing FLUXY_API_KEY");
  }
  if (!sourceRoomId) {
    throw new Error("Missing DRILL_SOURCE_ROOM_ID");
  }
  if (!Number.isFinite(messageLimit) || messageLimit <= 0) {
    throw new Error("DRILL_MESSAGE_LIMIT must be a positive number");
  }

  const sourceExport = await fetchJson(
    `${baseUrl}/export/messages.json?roomId=${encodeURIComponent(sourceRoomId)}`,
    apiKey
  );
  const sourceMessages = Array.isArray(sourceExport?.messages)
    ? sourceExport.messages
    : [];
  const messagesToReplay = sourceMessages.slice(0, messageLimit);

  await fetchJson(
    `${baseUrl}/rooms`,
    apiKey,
    "POST",
    {
      id: restoreRoomId,
      type: "group",
      name: `restore-drill-${new Date().toISOString()}`,
    }
  );

  let replayedCount = 0;
  for (const message of messagesToReplay) {
    const originalContent = String(message?.content || "");
    const drillContent = `[recovered:${message?.id ?? "na"}] ${originalContent}`;
    const response = await fetchJson(
      `${baseUrl}/messages`,
      apiKey,
      "POST",
      {
        roomId: restoreRoomId,
        content: drillContent.slice(0, 4000),
      }
    );
    if (response?.ok || response?.message?.id) replayedCount += 1;
  }

  const restoredExport = await fetchJson(
    `${baseUrl}/export/messages.json?roomId=${encodeURIComponent(restoreRoomId)}`,
    apiKey
  );
  const restoredMessages = Array.isArray(restoredExport?.messages)
    ? restoredExport.messages
    : [];

  const drillResult = {
    ts: new Date().toISOString(),
    baseUrl,
    sourceRoomId,
    restoreRoomId,
    sourceCount: sourceMessages.length,
    attemptedReplayCount: messagesToReplay.length,
    replayedCount,
    restoredCount: restoredMessages.length,
    isRecoveryValid: restoredMessages.length === replayedCount,
  };

  const outputDir = join(process.cwd(), "drills");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, `tenant-recovery-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(drillResult, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ ok: true, outputPath, drillResult }, null, 2));
}

async function fetchJson(url, apiKey, method = "GET", body) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} for ${method} ${url}: ${JSON.stringify(payload)}`
    );
  }
  return payload;
}

main().catch((err) => {
  console.error("[tenant-recovery-drill] failed", err);
  process.exitCode = 1;
});

