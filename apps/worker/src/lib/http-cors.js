/**
 * Attach CORS headers to an HTTP Response (e.g. auth failures thrown as Response).
 */
export function mergeCorsHeadersOntoResponse(response, corsHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (value != null && !headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Top-level fetch catch: JWT routes throw Response; without this, Cloudflare returns 1101 with no CORS.
 */
export function handleFetchThrownError(
  err,
  { corsHeaders, traceId, logError, requestLogCtx },
) {
  if (err instanceof Response) {
    return mergeCorsHeadersOntoResponse(err, corsHeaders);
  }
  if (err != null) {
    logError("request.unhandled_exception", err, requestLogCtx);
  }
  return new Response(
    JSON.stringify({ error: "Internal server error", traceId }),
    {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}
