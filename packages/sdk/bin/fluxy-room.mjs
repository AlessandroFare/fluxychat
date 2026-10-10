#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distCli = pathToFileURL(join(here, "../dist/fluxy-room-cli.js")).href;
const distIndex = pathToFileURL(join(here, "../dist/index.js")).href;

async function load() {
  try {
    return {
      cli: await import(distCli),
      sdk: await import(distIndex),
    };
  } catch {
    process.stderr.write(
      "fluxy-room needs a built SDK. From the repo: pnpm --filter @fluxy-chat/sdk build\n",
    );
    process.exit(2);
  }
}

async function main() {
  const { cli, sdk } = await load();
  const parsed = cli.parseFluxyRoomArgs(process.argv.slice(2));
  if (parsed.kind === "help") {
    process.stdout.write(cli.fluxyRoomCliHelp());
    process.exit(0);
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    process.stdout.write(cli.fluxyRoomCliHelp());
    process.exit(2);
  }
  if (parsed.kind === "version") {
    process.stdout.write(`${cli.fluxyRoomVersion()}\n`);
    process.exit(0);
  }
  if (parsed.kind === "health") {
    try {
      process.stdout.write(`${await cli.runHealth(parsed.worker)}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "occupancy") {
    try {
      process.stdout.write(`${await cli.runOccupancy(parsed.worker, parsed.token, parsed.room)}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "exists") {
    try {
      process.stdout.write(`${await cli.runExists(parsed.worker, parsed.token, parsed.room)}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "history") {
    try {
      process.stdout.write(
        `${await cli.runHistory(parsed.worker, parsed.token, parsed.room, {
          limit: parsed.limit,
          before: parsed.before,
        })}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "presence") {
    try {
      process.stdout.write(`${await cli.runPresence(parsed.worker, parsed.token, parsed.room)}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "update") {
    try {
      process.stdout.write(
        `${await cli.runUpdate(parsed.worker, parsed.token, parsed.messageId, parsed.text, {
          description: parsed.description,
          metadata: parsed.metadata,
          headers: parsed.headers,
        })}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "delete") {
    try {
      process.stdout.write(
        `${await cli.runDelete(parsed.worker, parsed.token, parsed.messageId, {
          description: parsed.description,
        })}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "get") {
    try {
      process.stdout.write(`${await cli.runGet(parsed.worker, parsed.token, parsed.messageId)}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "react") {
    try {
      process.stdout.write(
        `${await cli.runReact(parsed.worker, parsed.token, parsed.messageId, parsed.emoji)}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "unreact") {
    try {
      process.stdout.write(
        `${await cli.runUnreact(parsed.worker, parsed.token, parsed.messageId, parsed.emoji)}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "reactions") {
    try {
      process.stdout.write(
        `${await cli.runReactionSummary(parsed.worker, parsed.token, parsed.messageId)}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "versions") {
    try {
      process.stdout.write(`${await cli.runVersions(parsed.worker, parsed.token, parsed.messageId)}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
  if (parsed.kind === "send") {
    const client = new sdk.FluxyChatClient({
      baseUrl: parsed.worker,
      userId: parsed.userId,
      token: parsed.token,
    });
    try {
      const msg = await client.createMessage(
        parsed.room,
        parsed.text,
        parsed.replyTo ?? null,
        undefined,
        undefined,
        {
          ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
          ...(parsed.headers ? { headers: parsed.headers } : {}),
        },
      );
      process.stdout.write(`${JSON.stringify(msg ?? { ok: false }, null, 2)}\n`);
      process.exit(msg ? 0 : 1);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }

  const client = new sdk.FluxyChatClient({
    baseUrl: parsed.worker,
    userId: parsed.userId,
    token: parsed.token,
  });
  const room = client.room(parsed.room, { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
  room.connection.onAnyEvent((event) => {
    process.stdout.write(`${cli.formatRoomEventLine(event)}\n`);
  });
  void room.attach();
  process.stdout.write(`tail ${parsed.room} (ctrl+c to stop)\n`);
  const stop = () => {
    client.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main();
