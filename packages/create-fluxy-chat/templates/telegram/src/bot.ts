import { FluxyChatClient } from "@fluxy-chat/sdk";

interface BotEnv {
  FLUXY_BASE_URL: string;
  FLUXY_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
}

export async function handleTelegramUpdate(
  update: Record<string, unknown>,
  env: BotEnv,
): Promise<Response> {
  const client = new FluxyChatClient({
    baseUrl: env.FLUXY_BASE_URL,
    userId: "telegram-bot",
    apiKey: env.FLUXY_API_KEY,
  });

  try {
    const message = update.message as
      | { chat?: { id?: number }; text?: string; from?: { first_name?: string } }
      | undefined;

    if (message?.chat?.id && message.text) {
      const roomId = `telegram-${message.chat.id}`;

      // Forward to FluxyChat
      await client.createMessage(roomId, message.text);

      // Send reply back to Telegram
      const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: `Hi ${message.from?.first_name ?? "there"}! Message received.`,
        }),
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Telegram update error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
