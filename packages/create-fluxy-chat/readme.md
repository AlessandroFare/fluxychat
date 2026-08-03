# create-fluxy-chat

Scaffold a new [FluxyChat](https://github.com/AlessandroFare/fluxychat) bot project with a single command.

## Quick start

```bash
# Minimal chat widget (recommended — 3 lines in App.tsx)
npx create-fluxy-chat my-chat --minimal

# React + useChat (guest room ~60s or member JWT)
npx create-fluxy-chat my-chat --template react
```

Interactive mode defaults to the **React chat app** template.

## Non-interactive usage

```bash
# React + Vite + useChat (recommended)
npx create-fluxy-chat my-chat --template react -y

# Create a Slack bot with pnpm
npx create-fluxy-chat my-bot --adapter slack --pm pnpm

# Create a Telegram bot, skip install
npx create-fluxy-chat my-bot --adapter telegram --skip-install

# Create a Discord bot with defaults
npx create-fluxy-chat my-bot -y --adapter discord

# Create a basic webhook bot (includes fluxy.config.ts template)
npx create-fluxy-chat my-bot --adapter basic
```

## Options

| Flag | Short | Description |
| --- | --- | --- |
| `--adapter <type>` | `-a` | Adapter: `react`, `basic`, `slack`, `telegram`, `discord`, `web` |
| `--template <type>` | `-t` | Alias for `--adapter (e.g. react)` |
| `--pm <manager>` | | Package manager: `npm`, `pnpm`, `yarn` |
| `--language <lang>` | `-l` | Language: `typescript` (default) or `javascript` |
| `--yes` | `-y` | Skip prompts and accept defaults |
| `--minimal` | | Chat-only widget (`@fluxy-chat/ui-kit`) — no platform modules |
| `--skip-install` | | Skip dependency installation |
| `--no-git` | | Skip git repository initialization |
| `--help` | `-h` | Show help |

## Adapters

| Adapter | Description | Platform |
| --- | --- | --- |
| `react` | Vite + React chat UI with `useChat` | Browser / SPA |
| `basic` | Generic webhook bot | Cloudflare Workers |
| `slack` | Slack Events API bot | Slack |
| `telegram` | Telegram webhook bot | Telegram |
| `discord` | Discord interactions bot | Discord |
| `web` | Web chat HTTP API bot | Any HTTP client |

## What you get

Each generated project includes:

- **`src/index.ts`** — Cloudflare Workers entry point with route handling
- **`src/bot.ts`** — Bot handler using `@fluxy-chat/sdk`
- **`fluxy.config.ts`** — Room authz and publish middleware (basic template)
- **`wrangler.toml`** — Cloudflare Workers deployment config
- **`.dev.vars`** — Local development environment variables
- **`.env.example`** — Example environment variables for your adapter
- **`tsconfig.json`** — TypeScript configuration (for TS projects)
- **`README.md`** — Project-specific setup instructions

## Package manager detection

The CLI auto-detects your package manager from lockfiles:

- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `package-lock.json` or none → npm

Override with `--pm`.

## Related packages

- [`@fluxy-chat/sdk`](https://www.npmjs.com/package/@fluxy-chat/sdk)
- [`@fluxy-chat/agent`](https://www.npmjs.com/package/@fluxy-chat/agent)
- [`@fluxy-chat/config`](https://www.npmjs.com/package/@fluxy-chat/config)

## License

MIT
