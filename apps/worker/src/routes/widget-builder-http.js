import { resolveAdminContext, resolveMemberContext } from "../lib/admin-route-context.js";
import {
  createWidget, updateWidget, getWidget, getWidgetBySlug, listWidgets, deleteWidget,
  createFlow, listFlows, deleteFlow,
  createTheme, listThemes,
  recordEvent, getWidgetAnalytics, getWidgetStats,
} from "../lib/widget-builder.js";

export async function dispatchWidgetBuilderRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/widgets")) return null;

  const needsMemberOnly =
    request.method === "POST" && path === "/admin/widgets/analytics";
  const ctx = needsMemberOnly
    ? await resolveMemberContext(request, h)
    : await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/widgets") {
    const widgets = await listWidgets(env, { projectId });
    return respond({ widgets }, h);
  }

  if (request.method === "POST" && path === "/admin/widgets") {
    const body = await request.json();
    const result = await createWidget(env, {
      projectId,
      name: body.name,
      slug: body.slug,
      agentId: body.agentId,
      type: body.type,
      theme: body.theme,
      position: body.position,
      greeting: body.greeting,
      fallbackMessage: body.fallbackMessage,
      allowedOrigins: body.allowedOrigins,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/admin\/widgets\/[^/]+$/)) {
    const id = path.split("/").pop();
    const widget = await getWidget(env, { id, projectId });
    if (!widget) return respond({ error: "not_found" }, h, 404);
    return respond({ widget }, h);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/widgets\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await updateWidget(env, { id, projectId, ...body });
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/widgets\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await deleteWidget(env, { id, projectId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/widgets/flows") {
    const body = await request.json();
    const result = await createFlow(env, {
      widgetId: body.widgetId,
      projectId,
      name: body.name,
      triggerType: body.triggerType,
      triggerValue: body.triggerValue,
      steps: body.steps,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/widgets/flows") {
    const widgetId = url.searchParams.get("widgetId");
    const flows = await listFlows(env, { widgetId });
    return respond({ flows }, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/widgets\/flows\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await deleteFlow(env, { id });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/widgets/themes") {
    const body = await request.json();
    const result = await createTheme(env, {
      projectId,
      name: body.name,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      backgroundColor: body.backgroundColor,
      textColor: body.textColor,
      fontFamily: body.fontFamily,
      borderRadius: body.borderRadius,
      bubbleSize: body.bubbleSize,
      customCss: body.customCss,
      isSystem: body.isSystem,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/widgets/themes") {
    const themes = await listThemes(env, { projectId });
    return respond({ themes }, h);
  }

  if (request.method === "POST" && path === "/admin/widgets/analytics") {
    const body = await request.json();
    const result = await recordEvent(env, {
      widgetId: body.widgetId,
      projectId,
      eventType: body.eventType,
      sessionId: body.sessionId,
      metadata: body.metadata,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/widgets/analytics") {
    const widgetId = url.searchParams.get("widgetId");
    const startTime = url.searchParams.get("startTime");
    const endTime = url.searchParams.get("endTime");
    const analytics = await getWidgetAnalytics(env, {
      widgetId,
      projectId,
      startTime,
      endTime,
    });
    return respond({ analytics }, h);
  }

  if (request.method === "GET" && path === "/admin/widgets/stats") {
    const stats = await getWidgetStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
