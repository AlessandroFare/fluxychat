/**
 * JSON responder for Worker HTTP routes: attaches traceId to error payloads (4xx/5xx).
 */
export function createJsonResponder({ traceId, corsHeaders, onErrorStatus }) {
  return function json(data, init = {}) {
    const statusCode = Number(init?.status || 200);
    let body = data;
    if (
      statusCode >= 400 &&
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      body.traceId === undefined
    ) {
      body = { traceId, ...body };
    }
    if (statusCode >= 400 && typeof onErrorStatus === "function") {
      onErrorStatus(statusCode);
    }
    const headers = { "Content-Type": "application/json", ...corsHeaders, ...(init.headers || {}) };
    return new Response(JSON.stringify(body), {
      ...init,
      headers,
    });
  };
}
