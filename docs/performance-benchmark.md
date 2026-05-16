## Performance verification (M6-D / P3 Load-SLO)

FluxyChat already exposes lightweight endpoints to validate baseline performance and SLO signals in a real environment.

Ordine consigliato con deploy e smoke: `docs/m6-operational-checklist.md` (Fase 4 + link a questo file).

### Endpoints

- **Health**: `GET /health`
  - Shows whether DB/DO are connected and whether the worker is in a **degraded** mode (no KV rate limit or no R2 attachments).
- **SLI / SLO**: `GET /stats/slo?minutes=15`
  - Returns current error-rate / webhook delivery SLI signals (implementation-dependent).
- **Benchmark**: `POST /benchmark` (admin JWT required)
  - Runs `iterations` DB `SELECT 1` calls and KV writes (when configured) and returns rough averages.

### Recommended workflow

1. **Deploy with prod bindings**
   - Ensure D1 (`DB`) and DO (`ROOM`) are connected.
   - Ensure KV namespace (`RATE_LIMIT_KV`) is configured to avoid local-fallback rate limits.
   - (Optional) Ensure R2 (`ATTACHMENTS`) is bound for uploads.

2. **Sanity check**

```bash
curl -sS https://<worker-domain>/health
```

3. **Run benchmark**

```bash
curl -sS -X POST https://<worker-domain>/benchmark \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"iterations":200}'
```

Interpretation:
- `dbAvgMs`: rough DB latency per `SELECT 1` (lower is better).
- `kvAvgMs`: only present if KV is configured.
- `rps`: a coarse derived number (not a load test substitute).

4. **Validate SLO counters**

```bash
curl -sS -H "Authorization: Bearer <ADMIN_JWT>" \
  "https://<worker-domain>/stats/slo?minutes=15"
```

### Notes / caveats

- `/benchmark` is a **micro-benchmark** to catch regressions and misconfigurations; it is not a full load test.
- For realistic load, use a dedicated load generator that exercises:
  - `POST /messages` (with JWT)
  - websocket connect + `type=message`
  - webhook deliveries (pending queue + retry)

## Built-in workload script

`apps/worker/scripts/perf-workload-check.mjs` runs a reproducible HTTP workload and prints a JSON summary.

### Run it

```bash
pnpm --filter @fluxychat/worker perf:workload-check -- \
  --base-url http://127.0.0.1:8787 \
  --member-token "<MEMBER_JWT>" \
  --admin-token "<ADMIN_JWT>" \
  --room-id perf-room \
  --messages 120 \
  --concurrency 12 \
  --benchmark-iterations 200
```

Optional flags:

- `--thresholds-file <path>` custom threshold profile JSON
- `--strict-thresholds true|false` (default `true`): return non-zero exit when thresholds fail

Output includes:

- request success/failure rate
- throughput (`msg/sec`)
- latency summary (`min`, `p50`, `p95`, `max`, `avg`)
- optional `/benchmark`, `/stats/slo`, `/health` snapshots when `--admin-token` is provided

### Threshold profiles

Default profile shipped in repo:

- `apps/worker/scripts/perf-thresholds.v1.json`

The script includes a threshold evaluation block in output and can fail CI/smoke runs when `strict-thresholds` is enabled.

