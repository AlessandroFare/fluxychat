# fluxy-bot-basic

A basic webhook bot built with [FluxyChat](https://github.com/AlessandroFare/fluxychat) and deployed on Cloudflare Workers.

## Getting Started

1. Copy the example environment file:

```bash
cp .env.example .dev.vars
```

2. Start the dev server:

```bash
pnpm dev
```

3. Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

## Endpoints

- Health check: `/`
- Webhook: `/webhook`

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT
