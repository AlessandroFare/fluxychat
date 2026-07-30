# Observability — OpenTelemetry (self-host)

FluxyChat ships lightweight telemetry hooks in the SDK and Worker. Export to **console** for local dev, or **OTLP HTTP** for self-hosted backends — no SaaS required.

## SDK

```typescript
import {
  createTelemetryManager,
  registerTelemetry,
  createConsoleTelemetryIntegration,
  createOtlpTelemetryIntegration,
} from "@fluxy-chat/sdk";

const telemetry = createTelemetryManager({ functionId: "support-agent" });

registerTelemetry(telemetry, createConsoleTelemetryIntegration());

registerTelemetry(
  telemetry,
  createOtlpTelemetryIntegration({
    endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "http://localhost:4318/v1/traces",
    serviceName: "my-app",
  }),
);
```

Wire `telemetry.record(...)` from your agent middleware or use `OpenTelemetryIntegration` when you already have an OTel tracer.

## Worker

The Worker exposes a diagnostics-style channel via `tracing.publish` / `tracing.subscribe`:

```javascript
import { tracing } from "./lib/tracing.js";
import { attachOtlpTracingExport } from "./lib/tracing-otlp.js";

attachOtlpTracingExport({
  tracing,
  endpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "http://localhost:4318/v1/traces",
  serviceName: "fluxy-chat-worker",
});
```

## Self-host backends (zero SaaS)

| Backend | OTLP HTTP endpoint | Notes |
|---------|-------------------|-------|
| **Jaeger** | `http://localhost:4318/v1/traces` | All-in-one docker: `jaegertracing/all-in-one` |
| **Grafana Tempo** | `http://localhost:4318/v1/traces` | Pair with Grafana for dashboards |
| **Langfuse OSS** | See Langfuse docs for OTLP ingest URL | LLM-focused traces + cost |

Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` in Worker secrets or your app env. Telemetry export is best-effort and never blocks chat delivery.

## DevTools inspector

For interactive debugging (token usage, tool calls, timeline), use the dashboard **DevTools** page (`/devtools`) and SDK `createDevToolsInspector`. See [DevTools inspector guide](/docs/guides/advanced/devtools-inspector).
