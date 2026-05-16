#!/usr/bin/env node
/**
 * Lightweight performance workload check for FluxyChat Worker.
 *
 * Usage example:
 * node scripts/perf-workload-check.mjs \
 *   --base-url http://127.0.0.1:8787 \
 *   --member-token "<JWT_MEMBER>" \
 *   --admin-token "<JWT_ADMIN>" \
 *   --room-id perf-room \
 *   --messages 120 \
 *   --concurrency 12
 */

import process from "node:process";
import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    map.set(key, value);
    if (value !== "true") i += 1;
  }
  return {
    baseUrl: String(map.get("base-url") || "http://127.0.0.1:8787").replace(/\/+$/, ""),
    memberToken: String(map.get("member-token") || ""),
    adminToken: String(map.get("admin-token") || ""),
    roomId: String(map.get("room-id") || "perf-room"),
    messages: Number(map.get("messages") || 100),
    concurrency: Number(map.get("concurrency") || 10),
    benchmarkIterations: Number(map.get("benchmark-iterations") || 200),
    thresholdsFile: String(map.get("thresholds-file") || ""),
    strictThresholds:
      map.get("strict-thresholds") === "false" ? false : true,
  };
}

function toMs(value) {
  return Number(value.toFixed(2));
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function runPool(total, concurrency, taskFn) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= total) return;
      await taskFn(current);
    }
  });
  await Promise.all(workers);
}

async function loadThresholds(filePath) {
  if (!filePath) return null;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const t = parsed?.thresholds || {};
  return {
    source: filePath,
    name: parsed?.name || "unnamed-threshold-profile",
    values: {
      successRateMinPct: Number(t.successRateMinPct),
      throughputMinMsgPerSec: Number(t.throughputMinMsgPerSec),
      latencyP95MaxMs: Number(t.latencyP95MaxMs),
      latencyAvgMaxMs: Number(t.latencyAvgMaxMs),
      failureCountMax: Number(t.failureCountMax),
    },
  };
}

function evaluateThresholds(workload, profile) {
  if (!profile?.values) return null;
  const checks = [
    {
      key: "successRateMinPct",
      ok: workload.successRate >= profile.values.successRateMinPct,
      expected: `>= ${profile.values.successRateMinPct}`,
      actual: workload.successRate,
    },
    {
      key: "throughputMinMsgPerSec",
      ok: workload.throughputMsgPerSec >= profile.values.throughputMinMsgPerSec,
      expected: `>= ${profile.values.throughputMinMsgPerSec}`,
      actual: workload.throughputMsgPerSec,
    },
    {
      key: "latencyP95MaxMs",
      ok: workload.latencyMs.p95 <= profile.values.latencyP95MaxMs,
      expected: `<= ${profile.values.latencyP95MaxMs}`,
      actual: workload.latencyMs.p95,
    },
    {
      key: "latencyAvgMaxMs",
      ok: workload.latencyMs.avg <= profile.values.latencyAvgMaxMs,
      expected: `<= ${profile.values.latencyAvgMaxMs}`,
      actual: workload.latencyMs.avg,
    },
    {
      key: "failureCountMax",
      ok: workload.failed <= profile.values.failureCountMax,
      expected: `<= ${profile.values.failureCountMax}`,
      actual: workload.failed,
    },
  ];
  return {
    profile: profile.name,
    source: profile.source,
    passed: checks.every((c) => c.ok),
    checks,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.memberToken) {
    throw new Error("Missing --member-token");
  }
  if (!Number.isFinite(args.messages) || args.messages <= 0) {
    throw new Error("--messages must be > 0");
  }
  if (!Number.isFinite(args.concurrency) || args.concurrency <= 0) {
    throw new Error("--concurrency must be > 0");
  }

  const postUrl = `${args.baseUrl}/messages`;
  const latencies = [];
  const failures = [];
  const begin = performance.now();

  await runPool(args.messages, args.concurrency, async (index) => {
    const t0 = performance.now();
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.memberToken}`,
        },
        body: JSON.stringify({
          roomId: args.roomId,
          content: `perf-check ${index} @${new Date().toISOString()}`,
        }),
      });
      const dt = performance.now() - t0;
      latencies.push(dt);
      if (!res.ok) {
        failures.push({
          index,
          status: res.status,
          body: await res.text().catch(() => ""),
          latencyMs: toMs(dt),
        });
      }
    } catch (err) {
      const dt = performance.now() - t0;
      latencies.push(dt);
      failures.push({
        index,
        status: 0,
        body: err instanceof Error ? err.message : String(err),
        latencyMs: toMs(dt),
      });
    }
  });

  const elapsed = performance.now() - begin;
  const sorted = [...latencies].sort((a, b) => a - b);
  const successCount = latencies.length - failures.length;
  const workloadSummary = {
    requested: args.messages,
    succeeded: successCount,
    failed: failures.length,
    successRate: args.messages ? toMs((successCount / args.messages) * 100) : 0,
    elapsedMs: toMs(elapsed),
    throughputMsgPerSec: toMs(args.messages / Math.max(0.001, elapsed / 1000)),
    latencyMs: {
      min: toMs(sorted[0] || 0),
      p50: toMs(percentile(sorted, 50)),
      p95: toMs(percentile(sorted, 95)),
      max: toMs(sorted[sorted.length - 1] || 0),
      avg: toMs(sorted.reduce((acc, x) => acc + x, 0) / Math.max(1, sorted.length)),
    },
    sampleFailures: failures.slice(0, 5),
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const defaultThresholdPath = path.join(__dirname, "perf-thresholds.v1.json");
  const thresholdPath = args.thresholdsFile || defaultThresholdPath;
  let thresholdEvaluation = null;
  try {
    const profile = await loadThresholds(thresholdPath);
    if (profile) thresholdEvaluation = evaluateThresholds(workloadSummary, profile);
  } catch {
    thresholdEvaluation = {
      profile: "none",
      source: thresholdPath,
      passed: null,
      checks: [],
      warning: "threshold_file_unavailable",
    };
  }

  let benchmark = null;
  let slo = null;
  let health = null;

  if (args.adminToken) {
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.adminToken}`,
    };

    const [benchRes, sloRes, healthRes] = await Promise.all([
      fetch(`${args.baseUrl}/benchmark`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ iterations: args.benchmarkIterations }),
      }).catch(() => null),
      fetch(`${args.baseUrl}/stats/slo?minutes=15`, {
        method: "GET",
        headers: { Authorization: `Bearer ${args.adminToken}` },
      }).catch(() => null),
      fetch(`${args.baseUrl}/health`, { method: "GET" }).catch(() => null),
    ]);

    benchmark = benchRes ? await benchRes.json().catch(() => null) : null;
    slo = sloRes ? await sloRes.json().catch(() => null) : null;
    health = healthRes ? await healthRes.json().catch(() => null) : null;
  }

  const output = {
    ts: new Date().toISOString(),
    config: {
      baseUrl: args.baseUrl,
      roomId: args.roomId,
      messages: args.messages,
      concurrency: args.concurrency,
      benchmarkIterations: args.benchmarkIterations,
      adminChecks: Boolean(args.adminToken),
    },
    workload: workloadSummary,
    thresholds: thresholdEvaluation,
    benchmark,
    slo,
    health,
  };

  console.log(JSON.stringify(output, null, 2));
  if (failures.length > 0) process.exitCode = 2;
  if (
    args.strictThresholds &&
    thresholdEvaluation &&
    thresholdEvaluation.passed === false
  ) {
    process.exitCode = process.exitCode || 3;
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

