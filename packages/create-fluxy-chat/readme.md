# create-fluxy-chat

Scaffold a FluxyChat Vite app or bot worker.

## Quick start

```bash
# Hosted — Clerk, no wrangler
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y
cd my-app && pnpm setup:hosted && pnpm dev

# Your Worker
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode self-host
cd my-app && pnpm setup:local && pnpm dev

# Minimal widget
npx @fluxy-chat/create-fluxy-chat@latest my-chat --minimal
```

Always use `@fluxy-chat/create-fluxy-chat`. Bare `npx create-fluxy-chat` is not this package.

Self-host writes `.fluxy/worker.dev.vars` (Worker URL, Groq key, signing key). Merge that into `apps/worker/.dev.vars` after `pnpm run self-host` in the FluxyChat repo.

## Non-interactive usage

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y
npx @fluxy-chat/create-fluxy-chat@latest my-app --full -y
npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors
npx @fluxy-chat/create-fluxy-chat@latest my-doc --example tiptap-room
npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room
npx @fluxy-chat/create-fluxy-chat@latest my-iot --example iot-panel
npx @fluxy-chat/create-fluxy-chat@latest my-draw --example draw
npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room
npx @fluxy-chat/create-fluxy-chat@latest my-fleet --example fleet-panel
npx @fluxy-chat/create-fluxy-chat@latest my-game --example game-tick
npx @fluxy-chat/create-fluxy-chat@latest my-stage --example voice-stage
npx @fluxy-chat/create-fluxy-chat@latest my-comments --example comments-board
npx @fluxy-chat/create-fluxy-chat@latest my-polls --example polls
npx @fluxy-chat/create-fluxy-chat@latest my-chat --template react -y
npx @fluxy-chat/create-fluxy-chat@latest my-bot --adapter slack --pm pnpm
```

## Options

| Flag | Short | Description |
| --- | --- | --- |
| `--adapter <type>` | `-a` | Adapter: `full`, `react`, `basic`, `slack`, `telegram`, `discord`, `web`, `hr-feedback` |
| `--template <type>` | `-t` | Alias for `--adapter (e.g. full, react)` |
| `--pm <manager>` | | Package manager: `npm`, `pnpm`, `yarn` |
| `--language <lang>` | `-l` | Language: `typescript` (default) or `javascript` |
| `--yes` | `-y` | Skip prompts and accept defaults |
| `--full` | | Full stack template: chat + `@assistant` + `pnpm setup` / `pnpm dev` |
| `--minimal` | | Chat-only widget (`@fluxy-chat/ui-kit`), no platform modules |
| `--example <name>` | | Gallery: `live-cursors`, `live-cursors-chat`, `javascript-live-cursors`, `tiptap-room`, `war-room`, `iot-panel`, `draw`, `deal-room`, `fleet-panel`, `game-tick`, `voice-stage`, `comments-board`, `polls`, `whiteboard` |
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

- **`src/index.ts`**: Cloudflare Workers entry point with route handling
- **`src/bot.ts`**: Bot handler using `@fluxy-chat/sdk`
- **`fluxy.config.ts`**: Room authz and publish middleware (basic template)
- **`wrangler.toml`**: Cloudflare Workers deployment config
- **`.dev.vars`**: Local development environment variables
- **`.env.example`**: Example environment variables for your adapter
- **`tsconfig.json`**: TypeScript configuration (for TS projects)
- **`README.md`**: Project-specific setup instructions

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
