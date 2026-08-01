#!/usr/bin/env node
/** Minimal stdio MCP stub — PG-ZB-6 marketplace catalog slack-mcp. */
import readline from "node:readline";

const tools = [
  { name: "post_message", description: "Post a message to a Slack channel" },
  { name: "list_channels", description: "List accessible channels" },
];

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.method === "initialize") {
    reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "fluxy-slack-mcp", version: "0.1.0" },
    });
    return;
  }
  if (msg.method === "tools/list") {
    reply(msg.id, {
      tools: tools.map((t) => ({ ...t, inputSchema: { type: "object", properties: {} } })),
    });
    return;
  }
  if (msg.method === "tools/call") {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      reply(msg.id, { content: [{ type: "text", text: "Set SLACK_BOT_TOKEN" }], isError: true });
      return;
    }
    reply(msg.id, { content: [{ type: "text", text: `Stub OK: ${msg.params?.name}` }] });
  }
});
