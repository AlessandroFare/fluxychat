import { handleTelegramUpdate } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const update = await request.json();
      return handleTelegramUpdate(update, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Telegram bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
