import { handleSlackRequest, createSlackBot } from "./bot.js";

const bot = createSlackBot();

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/slack/events" || url.pathname === "/slack/interactive") {
      return handleSlackRequest(request, env, bot);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Slack bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
