import { handleDiscordInteraction } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/discord/interactions" && request.method === "POST") {
      return handleDiscordInteraction(request, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Discord bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
