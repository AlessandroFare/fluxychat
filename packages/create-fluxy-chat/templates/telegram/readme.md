# fluxy-bot-telegram

A Telegram bot built with [FluxyChat](https://github.com/AlessandroFare/fluxychat) and deployed on Cloudflare Workers.

## Getting Started

1. Copy the example environment file:

```bash
cp .env.example .dev.vars
```

2. Create a Telegram bot via [@BotFather](https://t.me/BotFather) and get your bot token.

3. Start the dev server:

```bash
pnpm dev
```

4. Set the Telegram webhook to point to your worker's `/telegram/webhook` endpoint:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-worker.example.com/telegram/webhook"
```

## Endpoints

- Telegram Webhook: `/telegram/webhook`

## Environment Variables

- `FLUXY_BASE_URL` — Your FluxyChat worker URL
- `FLUXY_API_KEY` — FluxyChat API key
- `TELEGRAM_BOT_TOKEN` — Telegram bot token from BotFather

## License

MIT
