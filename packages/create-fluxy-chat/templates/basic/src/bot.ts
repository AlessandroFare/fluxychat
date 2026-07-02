import { FluxyChatClient } from "@fluxy-chat/sdk";

interface BotEnv {
  FLUXY_BASE_URL: string;
  FLUXY_API_KEY: string;
}

export async function handleWebhook(
  request: Request,
  env: BotEnv,
): Promise<Response> {
  const body = await request.json() as {
    roomId?: string;
    message?: string;
    userId?: string;
  };

  const client = new FluxyChatClient({
    baseUrl: env.FLUXY_BASE_URL,
    userId: body.userId ?? "bot",
    apiKey: env.FLUXY_API_KEY,
  });

  try {
    if (body.roomId && body.message) {
      await client.createMessage(body.roomId, body.message);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
