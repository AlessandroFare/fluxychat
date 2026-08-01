#!/usr/bin/env node
/** Minimal stdio MCP stub — PG-ZB-6 marketplace catalog notion-mcp. */
import readline from "node:readline";

const tools = [
  { name: "search_pages", description: "Search Notion pages" },
  { name: "append_block", description: "Append a block to a page" },
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
      serverInfo: { name: "fluxy-notion-mcp", version: "0.1.0" },
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
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      reply(msg.id, { content: [{ type: "text", text: "Set NOTION_TOKEN" }], isError: true });
      return;
    }
    reply(msg.id, { content: [{ type: "text", text: `Stub OK: ${msg.params?.name}` }] });
  }
});
