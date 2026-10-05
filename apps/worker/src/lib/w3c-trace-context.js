/**
 * W3C Trace Context (traceparent) for outbound webhooks and ticket HTTP.
 * @see https://www.w3.org/TR/trace-context/
 */

function hexIdFromKey(key, length = 32) {
  const hex = String(key || "")
    .replace(/-/g, "")
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase()
    .padEnd(length, "0");
  return hex.slice(0, length);
}

export function formatTraceparent({ traceId, spanId, sampled = true } = {}) {
  const tid = hexIdFromKey(traceId || crypto.randomUUID(), 32);
  const sid = hexIdFromKey(spanId || crypto.randomUUID(), 16);
  return `00-${tid}-${sid}-${sampled ? "01" : "00"}`;
}

export function injectW3cTraceHeaders(headers, ctx = {}) {
  const next = { ...(headers || {}) };
  next.traceparent = formatTraceparent(ctx);
  if (ctx.tracestate) next.tracestate = String(ctx.tracestate).slice(0, 512);
  return next;
}
