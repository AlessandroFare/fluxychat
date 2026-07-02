/**
 * P23-5: DevTools / OpenTelemetry — Worker Implementation
 * Tracing, span collection, and OTLP export for agent runs.
 */

/**
 * Create a devtools span collector.
 * @param {Object} config
 */
export function createDevTools(config = {}) {
  const {
    enabled = true,
    exporter = null,
    sampleRate = 1,
    maxSpansPerTrace = 200,
    consoleLogging = false,
  } = config;

  const traces = new Map(); // traceId -> Span[]
  let flushQueue = [];

  function generateId() {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }

  function shouldSample() {
    return Math.random() < sampleRate;
  }

  return {
    startSpan(name, attributes = {}) {
      if (!enabled || !shouldSample()) {
        return { traceId: "", spanId: "", name, startTime: 0, attributes: {}, events: [], status: "ok" };
      }

      const traceId = traces.size > 0 ? [...traces.keys()][traces.size - 1] : generateId();
      const spanId = generateId();
      const span = {
        traceId,
        spanId,
        name,
        startTime: performance.now(),
        attributes,
        events: [],
        status: "ok",
      };

      if (!traces.has(traceId)) {
        traces.set(traceId, []);
      }
      const traceSpans = traces.get(traceId);
      if (traceSpans.length < maxSpansPerTrace) {
        traceSpans.push(span);
      }

      return span;
    },

    endSpan(span, status = "ok", error) {
      if (!enabled || !span || !span.spanId) return;

      span.endTime = performance.now();
      span.status = status;
      if (error) {
        span.errorMessage = error.message;
      }

      if (consoleLogging) {
        const duration = span.endTime - span.startTime;
        console.log(`[devtools] ${span.name} ${duration.toFixed(1)}ms ${status}`);
      }

      flushQueue.push(span);
    },

    addEvent(span, name, attributes = {}) {
      if (!enabled || !span || !span.spanId) return;

      span.events.push({
        name,
        timestamp: performance.now(),
        attributes,
      });
    },

    getSpans(traceId) {
      return traces.get(traceId) || [];
    },

    async flush() {
      if (flushQueue.length === 0) return;

      const toExport = [...flushQueue];
      flushQueue = [];

      if (exporter) {
        try {
          await exporter.export(toExport);
        } catch (err) {
          console.error("[devtools] Export failed:", err.message);
        }
      }
    },
  };
}

/**
 * Convert spans to OTLP trace payload format.
 * @param {Array} spans
 * @param {string} [serviceName]
 */
export function spansToOtlp(spans, serviceName = "fluxychat-agent") {
  const byTrace = new Map();
  for (const span of spans) {
    if (!byTrace.has(span.traceId)) {
      byTrace.set(span.traceId, []);
    }
    byTrace.get(span.traceId).push(span);
  }

  const resourceSpans = [];
  for (const [traceId, traceSpans] of byTrace) {
    const otlpSpans = traceSpans.map((span) => ({
      traceId: span.traceId.padEnd(32, "0"),
      spanId: span.spanId.padEnd(16, "0"),
      parentSpanId: span.parentSpanId?.padEnd(16, "0"),
      name: span.name,
      kind: 1, // SPAN_KIND_INTERNAL
      startTimeUnixNano: String(Math.floor((span.startTime || 0) * 1e6)),
      endTimeUnixNano: String(Math.floor((span.endTime || span.startTime || 0) * 1e6)),
      attributes: Object.fromEntries(
        Object.entries(span.attributes || {}).map(([k, v]) => [k, { stringValue: String(v) }])
      ),
      events: (span.events || []).map((e) => ({
        name: e.name,
        timeUnixNano: String(Math.floor(e.timestamp * 1e6)),
        attributes: Object.fromEntries(
          Object.entries(e.attributes || {}).map(([k, v]) => [k, { stringValue: String(v) }])
        ),
      })),
      status: {
        code: span.status === "ok" ? 1 : span.status === "error" ? 2 : 0,
        message: span.errorMessage,
      },
    }));

    resourceSpans.push({
      resource: {
        attributes: { "service.name": serviceName },
      },
      scopeSpans: [
        {
          scope: { name: "fluxychat-agent", version: "1.0.0" },
          spans: otlpSpans,
        },
      ],
    });
  }

  return { resourceSpans };
}
