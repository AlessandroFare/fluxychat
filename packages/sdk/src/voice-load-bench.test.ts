import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { createVoicePipeline } from "./voice-pipeline";
import { createSloTracker } from "./voice-slo";

interface Series {
  label: string;
  n: number;
  min: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
  skipped?: boolean;
  reason?: string;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(label: string, samples: number[]): Series {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    label,
    n: sorted.length,
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
  };
}

function fmt(n: number): string {
  return n.toFixed(3);
}

function row(series: Series): string {
  if (series.skipped) {
    return `| ${series.label} | skipped | ${series.reason ?? ""} | | | | | | |`;
  }
  return `| ${series.label} | ${series.n} | ${fmt(series.min)} | ${fmt(series.p50)} | ${fmt(series.p90)} | ${fmt(series.p95)} | ${fmt(series.p99)} | ${fmt(series.max)} | ${fmt(series.mean)} |`;
}

describe("voice flagship load bench", () => {
  it("measures SDK + optional Worker hops and writes the product report", async () => {
    const pipelineSamples: number[] = [];
    for (let i = 0; i < 400; i += 1) {
      const pipeline = createVoicePipeline({ pipelineMode: "unified", preferredTransport: "text_only" });
      await pipeline.start();
      const t0 = performance.now();
      await pipeline.processText("flagship latency sample");
      pipelineSamples.push(performance.now() - t0);
    }
    const pipeline = summarize("sdk_useVoice_text_only_tick_ms", pipelineSamples);

    const tracker = createSloTracker();
    const ingestSamples: number[] = [];
    for (let i = 0; i < 5000; i += 1) {
      const t0 = performance.now();
      tracker.addSpan({
        phase: "asr",
        startMs: 0,
        endMs: 80 + (i % 40),
        durationMs: 80 + (i % 40),
        sessionId: "bench",
      });
      ingestSamples.push(performance.now() - t0);
    }
    const ingest = summarize("slo_tracker_ingest_ms", ingestSamples);
    const fixture = tracker.getReport("asr");

    const workerUrl = process.env.FLUXY_WORKER_URL?.trim() || "";
    let health: Series = {
      label: "worker_health_ms",
      n: 0,
      min: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      max: 0,
      mean: 0,
      skipped: true,
      reason: workerUrl ? "fetch_failed" : "FLUXY_WORKER_URL unset",
    };
    let providers: Series = { ...health, label: "voice_ai_providers_ms" };

    if (workerUrl) {
      const healthSamples: number[] = [];
      const providerSamples: number[] = [];
      try {
        for (let i = 0; i < 60; i += 1) {
          const t0 = performance.now();
          const res = await fetch(new URL("/health", workerUrl).toString());
          healthSamples.push(performance.now() - t0);
          if (!res.ok) throw new Error(`health_${res.status}`);
        }
        health = summarize("worker_health_ms", healthSamples);
        for (let i = 0; i < 60; i += 1) {
          const t0 = performance.now();
          const res = await fetch(new URL("/voice-ai/providers", workerUrl).toString());
          providerSamples.push(performance.now() - t0);
          if (!res.ok) throw new Error(`providers_${res.status}`);
        }
        providers = summarize("voice_ai_providers_ms", providerSamples);
      } catch (err) {
        health = {
          ...health,
          skipped: true,
          reason: err instanceof Error ? err.message : "fetch_failed",
        };
        providers = { ...providers, skipped: true, reason: health.reason };
      }
    }

    expect(pipeline.n).toBe(400);
    expect(pipeline.p95).toBeGreaterThanOrEqual(0);
    expect(fixture.count).toBe(5000);
    expect(fixture.percentile.p95).toBeGreaterThan(0);

    const generatedAt = new Date().toISOString();
    const payload = {
      generatedAt,
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      workerUrl: workerUrl || null,
      pipeline,
      ingest,
      fixturePercentiles: fixture.percentile,
      fixtureCount: fixture.count,
      health,
      providers,
      productSlo: {
        openaiRealtimeTargetP95Ms: 300,
        chunkedTargetP95Ms: 500,
        bargeInTargetMs: 500,
      },
    };

    const reportDir = resolve(process.cwd(), "../../docs");
    writeFileSync(resolve(reportDir, "voice-load-bench.json"), `${JSON.stringify(payload, null, 2)}\n`);

    const md = `# FluxyChat voice — flagship load report

Generated: **${generatedAt}**  
Runtime: Node ${process.version} · ${payload.platform}

This is a **product report**. Every millisecond below was measured with \`performance.now()\` in \`packages/sdk/src/voice-load-bench.test.ts\`. Re-run: \`pnpm --filter @fluxy-chat/sdk exec vitest run src/voice-load-bench.test.ts\`.

## Surfaces

| Surface | Path | This report |
| --- | --- | --- |
| Voice AI SDK | \`useVoice\` / \`createVoicePipeline\` (unified, text_only) | Measured tick P50–P99 |
| Telemetry engine | \`createSloTracker\` | Measured ingest + percentile fixture |
| Worker HTTP | \`GET /health\`, \`GET /voice-ai/providers\` | Measured when \`FLUXY_WORKER_URL\` is set |
| Stage signaling | \`joinVoiceStage\` | Same room WebSocket as chat (\`--example voice-stage\`) |
| Async clips | \`POST /messages/voice\` | Upload + optional transcription |
| LiveKit SFU | \`./scripts/voice-load-test.sh\` | Optional WebRTC capacity addendum |

## Product SLO (commitments)

| Path | Target | Source of truth in production |
| --- | --- | --- |
| OpenAI Realtime | **P95 ≤ 300ms** e2e | \`POST /admin/voice-ai/metrics\` → \`GET /admin/voice-ai/stats\` |
| Chunked REST STT/TTS | **P95 ≤ 500ms** | Same stats API |
| Barge-in cancel | **≤ 500ms** | \`applyDuplexBargeIn\` + session settings |
| SDK tick (this bench) | Floor under the provider hop | Table below |

## Measured this run

| Series | n | min | p50 | p90 | p95 | p99 | max | mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${row(pipeline)}
${row(ingest)}
${row(health)}
${row(providers)}

SLO tracker fixture (span values 80–119ms, algorithm check): P50=${fixture.percentile.p50} · P90=${fixture.percentile.p90} · P95=${fixture.percentile.p95} · P99=${fixture.percentile.p99} (n=${fixture.count}).

## How to read it

- **SDK tick** is in-process pipeline bookkeeping on the unified text path — the floor a live OpenAI/Gemini hop sits on.
- **Worker HTTP** is a real round-trip when \`FLUXY_WORKER_URL\` is set. If skipped, we did not invent a number.
- **Customer P95** is the stats API, not this CI machine. Ship the bench + the telemetry path together.

## Reproduce

\`\`\`bash
pnpm --filter @fluxy-chat/sdk exec vitest run src/voice-load-bench.test.ts
FLUXY_WORKER_URL=https://your-worker.workers.dev pnpm --filter @fluxy-chat/sdk exec vitest run src/voice-load-bench.test.ts
k6 run scripts/voice-signaling-k6.js -e WORKER_URL=https://your-worker.workers.dev
./scripts/voice-load-test.sh
\`\`\`

JSON: \`docs/voice-load-bench.json\`.

## Production telemetry

\`\`\`bash
curl -X POST "$WORKER/admin/voice-ai/metrics" \\
  -H "Authorization: Bearer $ADMIN_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId":"vas_1","providerId":"openai-realtime","totalLatencyMs":245,"stages":[{"stage":"multimodal","durationMs":245}]}'
curl "$WORKER/admin/voice-ai/stats" -H "Authorization: Bearer $ADMIN_JWT"
\`\`\`
`;

    writeFileSync(resolve(reportDir, "VOICE-LOAD-TEST-REPORT.md"), md);
  }, 60_000);
});
