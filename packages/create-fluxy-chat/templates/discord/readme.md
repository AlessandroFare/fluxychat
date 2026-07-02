# fluxy-bot-discord

A Discord bot built with [FluxyChat](https://github.com/AlessandroFare/fluxychat) and deployed on Cloudflare Workers.

## Getting Started

1. Copy the example environment file:

```bash
cp .env.example .dev.vars
```

2. Create a Discord application at https://discord.com/developers/applications and get your bot token, application ID, and public key.

3. Start the dev server:

```bash
pnpm dev
```

4. Set the Discord Interactions Endpoint URL to point to your worker's `/discord/interactions` endpoint.

## Endpoints

- Discord Interactions: `/discord/interactions`

## Environment Variables

- `FLUXY_BASE_URL` — Your FluxyChat worker URL
- `FLUXY_API_KEY` — FluxyChat API key
- `DISCORD_BOT_TOKEN` — Discord bot token
- `DISCORD_APPLICATION_ID` — Discord application ID
- `DISCORD_PUBLIC_KEY` — Discord public key (for signature verification)

## License

MIT
