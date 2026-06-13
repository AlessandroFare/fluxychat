/**
 * JSON responder for Worker HTTP routes: attaches traceId to error payloads (4xx/5xx).
 */
export function createJsonResponder({ traceId, corsHeaders, onErrorStatus }) {
  return function json(data, init = {}) {
    return jsonResponse(data, init, { traceId, corsHeaders, onErrorStatus });
  };
}

function resolveJsonInit(second, third) {
  if (typeof second === "number") {
    return { status: second };
  }
  if (second && typeof second === "object" && ("env" in second || "corsHeaders" in second || "json" in second)) {
    const deps = second;
    const status = typeof third === "number" ? third : 200;
    return {
      status,
      deps: {
        traceId: deps.traceId,
        corsHeaders: deps.corsHeaders,
      },
    };
  }
  if (second && typeof second === "object") {
    return { init: second, deps: null };
  }
  return { init: {}, deps: null };
}

function jsonResponse(data, second, thirdOrOptions) {
  let init = {};
  let deps = null;
  if (thirdOrOptions && typeof thirdOrOptions === "object" && "traceId" in thirdOrOptions) {
    deps = thirdOrOptions;
    init = typeof second === "object" && second !== null ? second : {};
  } else {
    const resolved = resolveJsonInit(second, thirdOrOptions);
    init = resolved.init ?? { status: resolved.status ?? 200 };
    if (resolved.deps) deps = resolved.deps;
    if (resolved.status != null && init.status == null) init = { ...init, status: resolved.status };
  }

  const statusCode = Number(init?.status || 200);
  let body = data;
  const traceId = deps?.traceId;
  if (
    traceId &&
    statusCode >= 400 &&
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    body.traceId === undefined
  ) {
    body = { traceId, ...body };
  }
  const corsHeaders = deps?.corsHeaders ?? {};
  const headers = {
    "Content-Type": "application/json",
    ...corsHeaders,
    ...(init.headers || {}),
  };
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

/** Standalone JSON helper for route modules (supports json(data, status) and json(data, deps, status)). */
export function json(data, second, third) {
  return jsonResponse(data, second, third);
}
