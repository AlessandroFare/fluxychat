/**
 * Minimal server-side agent using @fluxychat/agent.
 *
 * Env:
 *   FLUXY_API_KEY      — project API key (fc_…)
 *   FLUXY_AGENT_ID     — agent id registered in Worker
 *   FLUXY_ROOM_ID      — room to join
 *   FLUXY_WORKER_URL   — default http://127.0.0.1:8787
 */
import { createFluxyAgent } from "@fluxychat/agent";

const apiKey = process.env.FLUXY_API_KEY?.trim();
const agentId = process.env.FLUXY_AGENT_ID?.trim() || "demo-agent";
const roomId = process.env.FLUXY_ROOM_ID?.trim();
const baseUrl = (process.env.FLUXY_WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

if (!apiKey) {
  console.error("Set FLUXY_API_KEY");
  process.exit(1);
}
if (!roomId) {
  console.error("Set FLUXY_ROOM_ID");
  process.exit(1);
}

const agent = await createFluxyAgent({
  id: agentId,
  name: "Demo Agent",
  apiKey,
  baseUrl,
});

const room = agent.room(roomId);
await agent.join(room, { ensureMembership: true });

agent.on(room, (msg) => {
  if (msg.userId === agentId) return;
  console.log(`[${msg.userId}] ${msg.content}`);
});

console.log(`Agent ${agentId} joined ${roomId}. Type a line to stream a reply (empty line to quit).`);

const decoder = new TextDecoder();
for await (const chunk of process.stdin) {
  const line = decoder.decode(chunk).trim();
  if (!line) break;

  const stream = agent.createStream(room);
  for (const word of line.split(/\s+/)) {
    stream.push(`${word} `);
    await new Promise((r) => setTimeout(r, 80));
  }
  stream.end();
}

agent.disconnect();
console.log("Bye.");
