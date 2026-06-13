import { pickRouteDeps } from "./route-http-deps.js";
import { resolveMemberContext } from "../lib/admin-route-context.js";
import {
  createPoll,
  votePoll,
  getPollResults,
  closePoll,
  createForm,
  submitForm,
  getFormResults,
} from "../lib/polls-forms.js";

export async function dispatchPollsFormsRoutes(request, url, h) {
  const { json, corsHeaders } = pickRouteDeps(h, ["json", "corsHeaders"]);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId, userId } = ctx;
  const path = url.pathname;

  if (path === "/polls" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await createPoll(env, {
      projectId,
      roomId: body.roomId,
      createdBy: body.userId || userId,
      title: body.title,
      description: body.description,
      pollType: body.pollType,
      isAnonymous: body.isAnonymous,
      maxSelections: body.maxSelections,
      expiresAt: body.expiresAt,
      options: body.options,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const voteMatch = path.match(/^\/polls\/([^/]+)\/vote$/);
  if (voteMatch && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await votePoll(env, {
      projectId,
      pollId: voteMatch[1],
      optionIds: body.optionIds || [],
      userId: body.userId || userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  const pollMatch = path.match(/^\/polls\/([^/]+)$/);
  if (pollMatch && request.method === "GET") {
    const result = await getPollResults(env, { projectId, pollId: pollMatch[1] });
    return json(result, { status: result.ok ? 200 : 404 });
  }

  const closeMatch = path.match(/^\/polls\/([^/]+)\/close$/);
  if (closeMatch && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await closePoll(env, {
      projectId,
      pollId: closeMatch[1],
      userId: body.userId || userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/forms" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await createForm(env, {
      projectId,
      roomId: body.roomId,
      createdBy: body.userId || userId,
      title: body.title,
      description: body.description,
      schema: body.schema,
      isAnonymous: body.isAnonymous,
      expiresAt: body.expiresAt,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const submitMatch = path.match(/^\/forms\/([^/]+)\/submit$/);
  if (submitMatch && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await submitForm(env, {
      projectId,
      formId: submitMatch[1],
      userId: body.userId || userId,
      response: body.response,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const formMatch = path.match(/^\/forms\/([^/]+)$/);
  if (formMatch && request.method === "GET") {
    const result = await getFormResults(env, { projectId, formId: formMatch[1] });
    return json(result, { status: result.ok ? 200 : 404 });
  }

  return null;
}
