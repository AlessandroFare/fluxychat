#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distUrl = pathToFileURL(join(here, "../dist/fluxy-eval.js")).href;

async function loadScorer() {
  try {
    return await import(distUrl);
  } catch {
    process.stderr.write(
      "fluxy-eval needs a built SDK. From the repo: pnpm --filter @fluxy-chat/sdk build\n",
    );
    process.exit(2);
  }
}

function printHelp() {
  process.stdout.write(`fluxy-eval — score an exported agent transcript, or replay one prompt live.

Usage:
  fluxy-eval <transcript.json>
  fluxy-eval replay <transcript.json> --worker <url> --token <jwt> --room <id> --agent <id> [--prompt <text>]

Offline: no Worker call. Live replay: POST /agents/:id/invoke with stream:false, then tool/cost diff vs runs[0].
Env fallbacks: FLUXY_WORKER_URL, FLUXY_MEMBER_JWT, FLUXY_ROOM_ID, FLUXY_AGENT_ID, FLUXY_PROMPT.

JSON may include "prompt", "agentId", "roomId" for replay. This bills a real model turn. Hosted is beta.
`);
}

function argValue(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx === argv.length - 1) return "";
  return String(argv[idx + 1] || "").trim();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv[0] || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    process.exit(argv[0] ? 0 : 2);
  }
  const replay = argv[0] === "replay";
  const filePath = replay ? argv[1] : argv[0];
  if (!filePath) {
    printHelp();
    process.exit(2);
  }
  const scorer = await loadScorer();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    process.stderr.write(`Could not read JSON: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
  if (!replay) {
    const report = scorer.scoreTranscriptEvalFile(parsed);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.ok ? 0 : 1);
  }

  const worker = argValue(argv, "--worker") || process.env.FLUXY_WORKER_URL || "";
  const token = argValue(argv, "--token") || process.env.FLUXY_MEMBER_JWT || "";
  const room = argValue(argv, "--room") || parsed.roomId || process.env.FLUXY_ROOM_ID || "";
  const agent = argValue(argv, "--agent") || parsed.agentId || process.env.FLUXY_AGENT_ID || "";
  const prompt = argValue(argv, "--prompt") || parsed.prompt || process.env.FLUXY_PROMPT || "";
  if (!worker || !token || !room || !agent || !prompt) {
    process.stderr.write(
      "replay needs --worker --token --room --agent --prompt (or JSON/env equivalents).\n",
    );
    process.exit(2);
  }
  let liveRaw;
  try {
    liveRaw = await scorer.invokeAgentForEval({
      workerUrl: worker,
      token,
      agentId: agent,
      roomId: room,
      prompt,
    });
  } catch (err) {
    process.stderr.write(`Live invoke failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
  const live = scorer.transcriptRunFromLiveInvoke(liveRaw);
  const report = scorer.scoreLiveReplay(parsed, live);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

void main();
