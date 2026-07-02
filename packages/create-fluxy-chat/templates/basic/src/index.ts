import { handleWebhook } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
