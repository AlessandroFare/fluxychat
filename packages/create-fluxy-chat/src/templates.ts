import type { AdapterType, Language, PackageManager, ProjectConfig } from "./utils.js";
import { devCommand, installCommand } from "./utils.js";

/**
 * Generate the project package.json for a given adapter.
 */
export function generatePackageJson(
  config: ProjectConfig,
): Record<string, unknown> {
  const deps: Record<string, string> = {
    "@fluxy-chat/sdk": "latest",
  };

  const devDeps: Record<string, string> = {
    typescript: "^5.6.0",
    "@cloudflare/workers-types": "^4.0.0",
    wrangler: "^3.0.0",
  };

  // Adapter-specific dependencies
  switch (config.adapter) {
    case "slack":
      deps["@slack/web-api"] = "^7.0.0";
      deps["@slack/bolt"] = "^4.0.0";
      break;
    case "telegram":
      deps["node-telegram-bot-api"] = "^0.66.0";
      break;
    case "discord":
      deps["discord.js"] = "^14.0.0";
      break;
    case "web":
      // Web chat uses the SDK directly over HTTP
      break;
  }

  const scripts: Record<string, string> = {
    dev: "wrangler dev",
    deploy: "wrangler deploy",
    "type-check": "tsc --noEmit",
  };

  return {
    name: config.name,
    version: "0.1.0",
    type: "module",
    private: true,
    scripts,
    dependencies: sortRecord(deps),
    devDependencies: sortRecord(devDeps),
  };
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Generate the tsconfig.json for the scaffolded project.
 */
export function generateTsConfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ES2022"],
      types: ["@cloudflare/workers-types"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      noEmit: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
}

/**
 * Generate the wrangler.toml for Cloudflare Workers deployment.
 */
export function generateWranglerToml(config: ProjectConfig): string {
  return `name = "${config.name}"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
FLUXY_BASE_URL = "https://your-fluxychat-worker.example.com"

# Set these via \`wrangler secret put\` for production
# wrangler secret put FLUXY_API_KEY
`;
}

/**
 * Generate the .dev.vars example file.
 */
export function generateDevVars(): string {
  return `# Local development environment variables
# Copy this file to .dev.vars and fill in your values

FLUXY_API_KEY=your-api-key-here
FLUXY_BASE_URL=http://localhost:8787
`;
}

/**
 * Generate the .gitignore file.
 */
export function generateGitignore(): string {
  return `node_modules/
dist/
.dev.vars
.wrangler/
*.log
.DS_Store
.env
.env.local
`;
}

/**
 * Generate the env example file.
 */
export function generateEnvExample(config: ProjectConfig): string {
  const lines: string[] = [
    "# Bot Configuration",
    `FLUXY_BASE_URL=https://your-fluxychat-worker.example.com`,
    "FLUXY_API_KEY=your-api-key-here",
    "",
  ];

  switch (config.adapter) {
    case "slack":
      lines.push(
        "# Slack Configuration",
        "SLACK_BOT_TOKEN=xoxb-your-bot-token",
        "SLACK_SIGNING_SECRET=your-signing-secret",
        "SLACK_PORT=3000",
        "",
      );
      break;
    case "telegram":
      lines.push(
        "# Telegram Configuration",
        "TELEGRAM_BOT_TOKEN=your-telegram-bot-token",
        "TELEGRAM_WEBHOOK_URL=https://your-worker.example.com/telegram/webhook",
        "",
      );
      break;
    case "discord":
      lines.push(
        "# Discord Configuration",
        "DISCORD_BOT_TOKEN=your-discord-bot-token",
        "DISCORD_APPLICATION_ID=your-application-id",
        "DISCORD_PUBLIC_KEY=your-public-key",
        "",
      );
      break;
    case "web":
      lines.push(
        "# Web Chat Configuration",
        "# The web adapter uses FluxyChat SDK directly, no extra secrets needed",
        "",
      );
      break;
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Generate the project README.
 */
export function generateReadme(config: ProjectConfig): string {
  const adapterTitle = config.adapter.charAt(0).toUpperCase() + config.adapter.slice(1);
  const pm = config.packageManager;

  const endpoints: string[] = [];
  if (config.adapter === "basic") {
    endpoints.push("- Health check: `/`");
    endpoints.push("- Webhook: `/webhook`");
  } else if (config.adapter === "slack") {
    endpoints.push("- Slack Events API: `/slack/events`");
    endpoints.push("- Slack Interactive: `/slack/interactive`");
  } else if (config.adapter === "telegram") {
    endpoints.push("- Telegram Webhook: `/telegram/webhook`");
  } else if (config.adapter === "discord") {
    endpoints.push("- Discord Interactions: `/discord/interactions`");
  } else if (config.adapter === "web") {
    endpoints.push("- Chat API: `/api/chat`");
    endpoints.push("- Health: `/`");
  }

  return `# ${config.name}

A ${adapterTitle} bot built with [FluxyChat](https://github.com/AlessandroFare/fluxychat) and deployed on Cloudflare Workers.

## Getting Started

1. Copy the example environment file and fill in your credentials:

\`\`\`bash
cp .env.example .dev.vars
\`\`\`

2. Start the dev server:

\`\`\`bash
${devCommand(pm)}
\`\`\`

3. Deploy to Cloudflare Workers:

\`\`\`bash
${pm} run deploy
\`\`\`

## Endpoints

${endpoints.join("\n")}

## Project Structure

\`\`\`
src/
  index.ts    Worker entry point
  bot.ts      Bot handler with ${adapterTitle} adapter
.dev.vars     Local development environment variables
wrangler.toml Cloudflare Workers configuration
\`\`\`

## Scripts

| Command | Description |
| --- | --- |
| \`${devCommand(pm)}\` | Start the development server |
| \`${pm} run deploy\` | Deploy to Cloudflare Workers |
| \`${pm} run type-check\` | Type-check the project |

## Environment Variables

See \`.env.example\` for all required environment variables.

## Learn More

- [FluxyChat SDK Documentation](https://github.com/AlessandroFare/fluxychat/tree/main/packages/sdk)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## License

MIT
`;
}

// ===== Worker entry point templates =====

export function generateWorkerIndex(config: ProjectConfig): string {
  switch (config.adapter) {
    case "slack":
      return `import { handleSlackRequest, createSlackBot } from "./bot.js";

const bot = createSlackBot();

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/slack/events" || url.pathname === "/slack/interactive") {
      return handleSlackRequest(request, env, bot);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Slack bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
    case "telegram":
      return `import { handleTelegramUpdate } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const update = await request.json();
      return handleTelegramUpdate(update, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Telegram bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
    case "discord":
      return `import { handleDiscordInteraction } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/discord/interactions" && request.method === "POST") {
      return handleDiscordInteraction(request, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Discord bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
    case "web":
      return `import { handleWebChat } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleWebChat(request, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat Web bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
    default:
      return `import { handleWebhook } from "./bot.js";

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    if (url.pathname === "/") {
      return new Response("FluxyChat bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
  }
}

// ===== Bot handler templates =====

export function generateBotHandler(config: ProjectConfig): string {
  switch (config.adapter) {
    case "slack":
      return `import { FluxyChatClient } from "@fluxy-chat/sdk";

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

  // Initialize FluxyChat client
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
        // Forward message to FluxyChat
        const roomId = \`slack-\${event.channel}\`;
        await client.createMessage(roomId, event.text || "");
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Slack event error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
`;
    case "telegram":
      return `import { FluxyChatClient } from "@fluxy-chat/sdk";

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
      const roomId = \`telegram-\${message.chat.id}\`;

      // Forward to FluxyChat
      await client.createMessage(roomId, message.text);

      // Send reply back to Telegram
      const telegramApiUrl = \`https://api.telegram.org/bot\${env.TELEGRAM_BOT_TOKEN}/sendMessage\`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: \`Hi \${message.from?.first_name ?? "there"}! Message received.\`,
        }),
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Telegram update error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
`;
    case "discord":
      return `import { FluxyChatClient } from "@fluxy-chat/sdk";

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
        const roomId = \`discord-\${interaction.channel_id}\`;
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
`;
    case "web":
      return `import { FluxyChatClient } from "@fluxy-chat/sdk";

interface BotEnv {
  FLUXY_BASE_URL: string;
  FLUXY_API_KEY: string;
}

export async function handleWebChat(
  request: Request,
  env: BotEnv,
): Promise<Response> {
  const body = await request.json() as {
    roomId?: string;
    message?: string;
    userId?: string;
  };

  if (!body.roomId || !body.message) {
    return new Response(
      JSON.stringify({ error: "Missing roomId or message" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = new FluxyChatClient({
    baseUrl: env.FLUXY_BASE_URL,
    userId: body.userId ?? "web-user",
    apiKey: env.FLUXY_API_KEY,
  });

  try {
    // Send user message to FluxyChat
    await client.createMessage(body.roomId, body.message);

    // Return a simple echo response
    return new Response(
      JSON.stringify({
        ok: true,
        reply: \`You said: \${body.message}\`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Web chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process message" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
`;
    default:
      return `import { FluxyChatClient } from "@fluxy-chat/sdk";

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
`;
  }
}
