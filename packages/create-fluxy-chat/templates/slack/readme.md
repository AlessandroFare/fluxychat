# fluxy-bot-slack

A Slack bot built with [FluxyChat](https://github.com/AlessandroFare/fluxychat) and deployed on Cloudflare Workers.

## Getting Started

1. Copy the example environment file:

```bash
cp .env.example .dev.vars
```

2. Create a Slack app at https://api.slack.com/apps and get your bot token and signing secret.

3. Start the dev server:

```bash
pnpm dev
```

4. Set up the Slack Event Subscriptions URL to point to your worker's `/slack/events` endpoint.

## Endpoints

- Slack Events API: `/slack/events`
- Slack Interactive: `/slack/interactive`

## Environment Variables

- `FLUXY_BASE_URL` — Your FluxyChat worker URL
- `FLUXY_API_KEY` — FluxyChat API key
- `SLACK_BOT_TOKEN` — Slack bot token (xoxb-...)
- `SLACK_SIGNING_SECRET` — Slack signing secret

## License

MIT
