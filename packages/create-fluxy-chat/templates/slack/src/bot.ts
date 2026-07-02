import { FluxyChatClient } from "@fluxy-chat/sdk";

interface BotEnv {
  FLUXY_BASE_URL: string;
  FLUXY_API_KEY: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
}

export interface SlackBot {
  fluxyClient: FluxyChatClient;
}

export function createSlackBot(): SlackBot {
  return {
    fluxyClient: null as unknown as FluxyChatClient,
  };
}

export async function handleSlackRequest(
  request: Request,
  env: BotEnv,
  bot: SlackBot,
): Promise<Response> {
  const body = await request.text();

  const client = new FluxyChatClient({
    baseUrl: env.FLUXY_BASE_URL,
    userId: "slack-bot",
    apiKey: env.FLUXY_API_KEY,
  });

  try {
    const payload = JSON.parse(body);

    // Handle Slack URL verification challenge
    if (payload.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle events
    if (payload.event) {
      const event = payload.event;

      if (event.type === "message" && !event.bot_id) {
        const roomId = `slack-${event.channel}`;
        await client.createMessage(roomId, event.text || "");
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Slack event error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
