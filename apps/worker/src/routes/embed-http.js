import { pickRouteDeps } from "./route-http-deps.js";
import {
  getAdminEmbedConfig,
  getEmbedConfigForProject,
  getPublicEmbedConfig,
  isEmbedWidgetGloballyEnabled,
  upsertEmbedConfig,
} from "../lib/embed-config.js";
import { EMBED_LOADER_SOURCE } from "../lib/embed-loader.js";
import { buildEmbedFrameHtml } from "../lib/embed-frame-html.js";

export async function dispatchEmbedRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
    isValidId,
    projectId,
    customDomain,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
    "isValidId",
    "projectId",
    "customDomain",
  ]);

  if (url.pathname === "/embed.js" && request.method === "GET") {
    if (!(await isEmbedWidgetGloballyEnabled(env))) {
      return new Response("// embed widget disabled\n", {
        status: 404,
        headers: { "Content-Type": "application/javascript; charset=utf-8" },
      });
    }
    return new Response(EMBED_LOADER_SOURCE, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (url.pathname === "/embed/frame" && request.method === "GET") {
    if (!(await isEmbedWidgetGloballyEnabled(env))) {
      return new Response("Embed disabled", { status: 404, headers: corsHeaders });
    }

    const resolvedProjectId = customDomain?.projectId || projectId;
    let theme = { primaryColor: "#2563eb", position: "bottom-right" };
    let launcherTitle = "Chat";
    let readOnly =
      env.PUBLIC_GUEST_READ_ONLY !== "false" && env.PUBLIC_GUEST_READ_ONLY !== "0";

    if (resolvedProjectId) {
      const config = await getEmbedConfigForProject(env, resolvedProjectId);
      if (config?.enabled) {
        theme = config.theme;
        launcherTitle = config.launcherTitle;
      }
    }

    const html = buildEmbedFrameHtml({
      primaryColor: theme.primaryColor,
      launcherTitle,
      readOnly,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  }

  if (url.pathname === "/public/embed-config" && request.method === "GET") {
    const hostname = url.hostname;
    const queryProjectId = url.searchParams.get("projectId");
    const resolvedProjectId =
      (queryProjectId && isValidId(queryProjectId) ? queryProjectId : null) ||
      customDomain?.projectId ||
      projectId;
    if (!resolvedProjectId) {
      return json({ enabled: false, reason: "no_project" }, { headers: corsHeaders });
    }
    const config = await getPublicEmbedConfig(env, resolvedProjectId, hostname);
    return json(config, { headers: corsHeaders });
  }

  if (url.pathname === "/admin/embed-config" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const config = await getAdminEmbedConfig(env, auth.projectId);
    const snippet = buildEmbedSnippet(url.origin, config);
    return json({ config, snippet }, { headers: corsHeaders });
  }

  if (url.pathname === "/admin/embed-config" && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const allowedOrigins = Array.isArray(body?.allowedOrigins)
      ? body.allowedOrigins.filter((o) => typeof o === "string")
      : undefined;

    const result = await upsertEmbedConfig(
      env,
      {
        projectId: auth.projectId,
        enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
        defaultRoomId:
          body?.defaultRoomId === null
            ? null
            : typeof body?.defaultRoomId === "string" && isValidId(body.defaultRoomId)
              ? body.defaultRoomId
              : undefined,
        allowedOrigins,
        zIndex: typeof body?.zIndex === "number" ? body.zIndex : undefined,
        launcherTitle:
          typeof body?.launcherTitle === "string" ? body.launcherTitle : undefined,
        theme:
          body?.theme && typeof body.theme === "object"
            ? {
                primaryColor:
                  typeof body.theme.primaryColor === "string"
                    ? body.theme.primaryColor
                    : undefined,
                position:
                  typeof body.theme.position === "string" ? body.theme.position : undefined,
              }
            : undefined,
        proactiveTriggers: Array.isArray(body?.proactiveTriggers)
          ? body.proactiveTriggers
          : undefined,
      },
      { isValidId },
    );

    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }

    const snippet = buildEmbedSnippet(url.origin, result.config);
    return json({ config: result.config, snippet }, { headers: corsHeaders });
  }

  return null;
}

/**
 * @param {string} apiOrigin
 * @param {{ enabled?: boolean, defaultRoomId?: string | null, zIndex?: number, launcherTitle?: string, theme?: { primaryColor?: string, position?: string } } | null} config
 */
function buildEmbedSnippet(apiOrigin, config) {
  const attrs = [
    `src="${apiOrigin}/embed.js"`,
    `data-fluxy-api-url="${apiOrigin}"`,
    "async",
  ];
  if (config?.projectId) {
    attrs.push(`data-project-id="${config.projectId}"`);
  }
  if (config?.defaultRoomId) {
    attrs.push(`data-room-id="${config.defaultRoomId}"`);
  }
  if (config?.zIndex) {
    attrs.push(`data-z-index="${config.zIndex}"`);
  }
  if (config?.launcherTitle) {
    attrs.push(`data-launcher-title="${config.launcherTitle.replace(/"/g, "&quot;")}"`);
  }
  if (config?.theme?.primaryColor) {
    attrs.push(`data-primary-color="${config.theme.primaryColor}"`);
  }
  if (config?.theme?.position) {
    attrs.push(`data-position="${config.theme.position}"`);
  }
  return `<script ${attrs.join(" ")}></script>`;
}
