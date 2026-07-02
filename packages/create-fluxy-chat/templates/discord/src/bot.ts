import { FluxyChatClient } from "@fluxy-chat/sdk";

interface BotEnv {
  FLUXY_BASE_URL: string;
  FLUXY_API_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
}

export async function handleDiscordInteraction(
  request: Request,
  env: BotEnv,
): Promise<Response> {
  const body = await request.text();

  const client = new FluxyChatClient({
    baseUrl: env.FLUXY_BASE_URL,
    userId: "discord-bot",
    apiKey: env.FLUXY_API_KEY,
  });

  try {
    const interaction = JSON.parse(body);

    // Handle Discord ping (verification)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle application command
    if (interaction.type === 2) {
      const commandName = interaction.data?.name;

      if (commandName === "chat") {
        const userId = interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";
        const text = interaction.data?.options?.[0]?.value ?? "";

        // Forward to FluxyChat
        const roomId = `discord-${interaction.channel_id}`;
        await client.createMessage(roomId, String(text));

        return new Response(
          JSON.stringify({
            type: 4,
            data: { content: "Message forwarded to FluxyChat!" },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    }

    return new Response("Unknown interaction type", { status: 400 });
  } catch (error) {
    console.error("Discord interaction error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
