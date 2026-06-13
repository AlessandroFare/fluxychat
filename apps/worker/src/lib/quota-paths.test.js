import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_QUOTA_METRICS } from "./project-plan-quota.js";
import { quotaResetInfo } from "./message-enrichment.js";
import { RoomDurableObject } from "../durable-objects/room-do.js";
import * as projectPlanQuota from "./project-plan-quota.js";

/** HTTP POST /messages and DO WS `message` both consume this metric. */
export const MESSAGE_QUOTA_METRIC = "messages_created";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerSrc = resolve(__dirname, "..");

function collectQuotaCallSites() {
  const dirs = ["routes", "lib", "durable-objects"];
  const sites = [];
  for (const dir of dirs) {
    const base = resolve(workerSrc, dir);
    for (const file of readdirSync(base)) {
      if (!file.endsWith(".js") || file.endsWith(".test.js")) continue;
      if (file === "project-plan-quota.js") continue;
      const source = readFileSync(resolve(base, file), "utf8");
      if (!source.includes("checkAndConsumeProjectQuota")) continue;
      const re = /checkAndConsumeProjectQuota\([\s\S]*?\{([\s\S]*?)\}/g;
      let match;
      while ((match = re.exec(source)) !== null) {
        const block = match[1];
        const wrongParam = block.match(/\bmetric\s*:/);
        const metricName = block.match(/metricName\s*:\s*["']([^"']+)["']/);
        sites.push({
          file: `${dir}/${file}`,
          wrongParam: Boolean(wrongParam),
          metricName: metricName?.[1] ?? null,
        });
      }
    }
  }
  return sites;
}

describe("quota path consistency (ENG-16)", () => {
  it("uses messages_created for REST and WebSocket entry points", () => {
    expect(MESSAGE_QUOTA_METRIC).toBe("messages_created");
  });

  it("all checkAndConsumeProjectQuota call sites use metricName with canonical metrics", () => {
    const sites = collectQuotaCallSites();
    expect(sites.length).toBeGreaterThan(0);
    const canonical = new Set(Object.keys(DEFAULT_QUOTA_METRICS));
    for (const site of sites) {
      expect(site.wrongParam, `${site.file} must use metricName, not metric`).toBe(false);
      expect(
        site.metricName,
        `${site.file} must pass metricName to checkAndConsumeProjectQuota`,
      ).toBeTruthy();
      expect(canonical.has(site.metricName), `${site.file} unknown metric ${site.metricName}`).toBe(
        true,
      );
    }
  });

  it("DO WS quota_exceeded includes same reset fields as HTTP 402 body", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: false,
      metricName: MESSAGE_QUOTA_METRIC,
      limit: 10,
      used: 10,
      monthKey: "2026-05",
    });

    const projectId = "proj_quota_shape";
    const userId = "user_quota_shape";
    const roomId = "room_quota_shape";
    const roomDo = new RoomDurableObject(
      { id: { toString: () => roomId } },
      { DB: {}, RATE_LIMIT_WS_MESSAGES_PER_MINUTE: "60" },
    );
    roomDo.projectId = projectId;
    const ws = { sent: [], send(data) { this.sent.push(data); } };
    roomDo.clients.add(ws);
    roomDo.userIds.set(ws, userId);

    await roomDo.onMessage(ws, {
      data: JSON.stringify({
        type: "message",
        userId,
        content: "blocked",
      }),
    });

    const err = JSON.parse(ws.sent.find((s) => s.includes("quota_exceeded")));
    const reset = quotaResetInfo();
    expect(err.message).toBe("quota_exceeded");
    expect(err.details).toMatchObject({
      metric: MESSAGE_QUOTA_METRIC,
      limit: 10,
      used: 10,
      month: "2026-05",
      resetsAt: reset.resetsAt,
      retryAfterSeconds: reset.retryAfterSeconds,
    });
  });

  it("voice upload route bills messages_created (ENG-16)", () => {
    const sites = collectQuotaCallSites();
    const voice = sites.filter((s) => s.file === "routes/voice-messages-http.js");
    expect(voice.length).toBeGreaterThan(0);
    for (const site of voice) {
      expect(site.metricName).toBe("messages_created");
    }
  });
});
