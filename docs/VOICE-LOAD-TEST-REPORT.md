# FluxyChat voice — flagship load report

Generated: **2026-08-26T15:02:18.664Z**  
Runtime: Node v24.13.0 · win32 x64

This is a **product report**. Every millisecond below was measured with `performance.now()` in `packages/sdk/src/voice-load-bench.test.ts`. Re-run: `pnpm --filter @fluxy-chat/sdk exec vitest run src/voice-load-bench.test.ts`.

## Surfaces

| Surface | Path | This report |
| --- | --- | --- |
| Voice AI SDK | `useVoice` / `createVoicePipeline` (unified, text_only) | Measured tick P50–P99 |
| Telemetry engine | `createSloTracker` | Measured ingest + percentile fixture |
| Worker HTTP | `GET /health`, `GET /voice-ai/providers` | Measured when `FLUXY_WORKER_URL` is set |
| Stage signaling | `joinVoiceStage` | Same room WebSocket as chat (`--example voice-stage`) |
| Async clips | `POST /messages/voice` | Upload + optional transcription |
| LiveKit SFU | `./scripts/voice-load-test.sh` | Optional WebRTC capacity addendum |

## Product SLO (commitments)

| Path | Target | Source of truth in production |
| --- | --- | --- |
| OpenAI Realtime | **P95 ≤ 300ms** e2e | `POST /admin/voice-ai/metrics` → `GET /admin/voice-ai/stats` |
| Chunked REST STT/TTS | **P95 ≤ 500ms** | Same stats API |
| Barge-in cancel | **≤ 500ms** | `applyDuplexBargeIn` + session settings |
| SDK tick (this bench) | Floor under the provider hop | Table below |

## Measured this run

| Series | n | min | p50 | p90 | p95 | p99 | max | mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sdk_useVoice_text_only_tick_ms | 400 | 0.006 | 0.012 | 0.015 | 0.032 | 0.066 | 2.463 | 0.019 |
| slo_tracker_ingest_ms | 5000 | 0.001 | 0.001 | 0.003 | 0.003 | 0.005 | 0.129 | 0.002 |
| worker_health_ms | skipped | FLUXY_WORKER_URL unset | | | | | | |
| voice_ai_providers_ms | skipped | FLUXY_WORKER_URL unset | | | | | | |

SLO tracker fixture (span values 80–119ms, algorithm check): P50=99 · P90=115 · P95=117 · P99=119 (n=5000).

## How to read it

- **SDK tick** is in-process pipeline bookkeeping on the unified text path — the floor a live OpenAI/Gemini hop sits on.
- **Worker HTTP** is a real round-trip when `FLUXY_WORKER_URL` is set. If skipped, we did not invent a number.
- **Customer P95** is the stats API, not this CI machine. Ship the bench + the telemetry path together.

## Reproduce

```bash
pnpm --filter @fluxy-chat/sdk exec vitest run src/voice-load-bench.test.ts
FLUXY_WORKER_URL=https://your-worker.workers.dev pnpm --filter @fluxy-chat/sdk exec vitest run src/voice-load-bench.test.ts
k6 run scripts/voice-signaling-k6.js -e WORKER_URL=https://your-worker.workers.dev
./scripts/voice-load-test.sh
```

JSON: `docs/voice-load-bench.json`.

## Production telemetry

```bash
curl -X POST "$WORKER/admin/voice-ai/metrics" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"vas_1","providerId":"openai-realtime","totalLatencyMs":245,"stages":[{"stage":"multimodal","durationMs":245}]}'
curl "$WORKER/admin/voice-ai/stats" -H "Authorization: Bearer $ADMIN_JWT"
```
