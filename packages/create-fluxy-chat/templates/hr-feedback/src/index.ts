import { submitHrFeedback } from "./feedback.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("HR anonymous feedback bot is running.", { status: 200 });
    }

    if (url.pathname === "/feedback" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        content?: string;
        roomId?: string;
      };
      const result = await submitHrFeedback(env, body);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
