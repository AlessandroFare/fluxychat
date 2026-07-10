/**
 * P23-5: DevTools / OpenTelemetry
 * Standard observability and visual debugging for agent runs.
 */

export interface SpanAttributes {
  [key: string]: string | number | boolean;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: SpanAttributes;
  events: SpanEvent[];
  status: "ok" | "error" | "unset";
  errorMessage?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export interface TraceExporter {
  export(spans: Span[]): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface DevToolsConfig {
  /** Enable devtools tracing */
  enabled?: boolean;
  /** Export traces to a custom endpoint */
  exporter?: TraceExporter;
  /** Sample rate (0-1, default 1) */
  sampleRate?: number;
  /** Maximum number of spans per trace */
  maxSpansPerTrace?: number;
  /** Enable console logging of spans */
  consoleLogging?: boolean;
}

export interface DevToolsSpanCollector {
  startSpan(name: string, attributes?: SpanAttributes): Span;
  endSpan(span: Span, status?: "ok" | "error", error?: Error): void;
  addEvent(span: Span, name: string, attributes?: SpanAttributes): void;
  getSpans(traceId: string): Span[];
  flush(): Promise<void>;
}

export function createDevTools(config?: DevToolsConfig): DevToolsSpanCollector {
  throw new Error("createDevTools not implemented in SDK - use worker runtime");
}

/**
 * OTLP trace payload for exporting to external observability backends.
 */
export interface OtlpTracePayload {
  resourceSpans: Array<{
    resource: { attributes: Record<string, string> };
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: Array<{
        traceId: string;
        spanId: string;
        parentSpanId?: string;
        name: string;
        kind: number;
        startTimeUnixNano: string;
        endTimeUnixNano: string;
        attributes: Record<string, { stringValue?: string; intValue?: number; boolValue?: boolean }>;
        events: Array<{
          name: string;
          timeUnixNano: string;
          attributes: Record<string, { stringValue?: string }>;
        }>;
        status: { code: number; message?: string };
      }>;
    }>;
  }>;
}

export function spansToOtlp(spans: Span[], serviceName?: string): OtlpTracePayload {
  throw new Error("spansToOtlp not implemented in SDK - use worker runtime");
}
