/**
 * Worker OTLP export helper for tracing.publish events.
 *
 * Self-host with Jaeger (4318), Grafana Tempo, or Langfuse OSS OTLP ingest.
 */

const DEFAULT_CHANNELS = [
  "ai.tool.start",
  "ai.tool.end",
  "ai.llm.start",
  "ai.llm.end",
  "ai.run.start",
  "ai.run.end",
];

/**
 * @param {object} options
 * @param {string} options.endpoint OTLP HTTP traces endpoint (e.g. http://localhost:4318/v1/traces)
 * @param {Record<string, string>} [options.headers]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.serviceName]
 * @param {import('./tracing.js').tracing} options.tracing
 * @param {string[]} [options.channels]
 */
export function attachOtlpTracingExport(options) {
  const {
    endpoint,
    headers = {},
    fetchImpl = fetch,
    serviceName = "fluxy-chat-worker",
    tracing,
    channels = DEFAULT_CHANNELS,
  } = options;

  const unsubscribers = channels.map((channel) =>
    tracing.subscribe(channel, (event) => {
      const spanName = `${channel}`;
      const payload = {
        resourceSpans: [
          {
            resource: {
              attributes: [{ key: "service.name", value: { stringValue: serviceName } }],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: event.traceId ?? "0".repeat(32),
                    spanId: String(event.timestamp).slice(-16).padStart(16, "0"),
                    name: spanName,
                    startTimeUnixNano: String(BigInt(event.timestamp) * 1_000_000n),
                    endTimeUnixNano: String(BigInt(event.timestamp) * 1_000_000n + 1_000_000n),
                    attributes: [
                      { key: "fluxy.channel", value: { stringValue: channel } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Best-effort — never throw from tracing handlers.
      });
    }),
  );

  return () => {
    for (const unsub of unsubscribers) unsub();
  };
}
