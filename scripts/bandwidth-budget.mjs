#!/usr/bin/env node
/**
 * Roadmap #29 — Bandwidth budgeting CI gate for FluxyGame / realtime bot load.
 *
 * Simulates N SDK bot clients posting representative payloads and measures
 * UTF-8 wire bytes + fan-out cost (bytes × room member count). Fails when
 * any scenario exceeds the checked-in baseline (regression guard).
 *
 * Usage: node scripts/bandwidth-budget.mjs [--baseline path] [--bots N] [--update-baseline]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseArgs(argv) {
  const args = { baseline: join(root, "scripts/bandwidth-budget.baseline.json"), bots: 8, updateBaseline: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--update-baseline") args.updateBaseline = true;
    else if (arg === "--baseline" && argv[i + 1]) {
      args.baseline = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--bots" && argv[i + 1]) {
      args.bots = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function utf8Bytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function buildScenarios(botCount) {
  const roomMembers = botCount;
  const clientMessageId = "cmid_budget_probe_00000001";

  const chatMessage = {
    type: "message",
    roomId: "game:proj_demo",
    content: "Bot probe message for bandwidth budget CI gate.",
    clientMessageId,
  };

  const gameTickInput = {
    playerId: "bot_001",
    actions: [{ type: "move", x: 12.5, y: 8.25, tick: 42 }],
  };

  const presenceHeartbeat = {
    type: "presence",
    roomId: "game:proj_demo",
    status: "online",
    lastSeen: new Date().toISOString(),
  };

  const npcInteract = {
    playerId: "player_human_1",
    message: "Hello merchant, do you remember our last trade?",
  };

  const scenarios = [
    { key: "chatMessage", outbound: chatMessage, fanOutMembers: roomMembers },
    { key: "gameTickInput", outbound: gameTickInput, fanOutMembers: roomMembers },
    { key: "presenceHeartbeat", outbound: presenceHeartbeat, fanOutMembers: roomMembers },
    { key: "npcInteract", outbound: npcInteract, fanOutMembers: Math.max(2, Math.floor(roomMembers / 2)) },
  ];

  return scenarios.map((scenario) => {
    const bytesPerBot = utf8Bytes(scenario.outbound);
    const fanOutBytesPerBot = bytesPerBot * scenario.fanOutMembers;
    return {
      key: scenario.key,
      bytesPerBot,
      fanOutBytesPerBot,
      fanOutMembers: scenario.fanOutMembers,
    };
  });
}

function loadBaseline(path) {
  if (!existsSync(path)) {
    console.error(`Missing baseline: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const botCount = Number.isFinite(args.bots) && args.bots > 0 ? args.bots : 8;
  const measured = buildScenarios(botCount);

  const totals = measured.reduce(
    (acc, row) => ({
      bytesPerBot: acc.bytesPerBot + row.bytesPerBot,
      fanOutBytesPerBot: acc.fanOutBytesPerBot + row.fanOutBytesPerBot,
    }),
    { bytesPerBot: 0, fanOutBytesPerBot: 0 },
  );

  const report = {
    generatedAt: new Date().toISOString(),
    botCount,
    scenarios: Object.fromEntries(measured.map((row) => [row.key, row])),
    totals: {
      bytesPerBotAllScenarios: totals.bytesPerBot,
      fanOutBytesPerBotAllScenarios: totals.fanOutBytesPerBot,
    },
  };

  if (args.updateBaseline) {
    const baseline = {
      name: "fluxy-game-bandwidth-v1",
      note: report.note ?? "Synthetic bot-load budgets — UTF-8 wire bytes per scenario.",
      botCount,
      scenarios: Object.fromEntries(
        measured.map((row) => [
          row.key,
          { maxBytesPerBot: row.bytesPerBot, maxFanOutBytesPerBot: row.fanOutBytesPerBot },
        ]),
      ),
      totals: {
        maxBytesPerBotAllScenarios: totals.bytesPerBot,
        maxFanOutBytesPerBotAllScenarios: totals.fanOutBytesPerBot,
      },
    };
    writeFileSync(args.baseline, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`Updated baseline → ${args.baseline}`);
    return;
  }

  const baseline = loadBaseline(args.baseline);
  const expectedBots = baseline.botCount ?? botCount;
  if (expectedBots !== botCount) {
    console.warn(`Warning: --bots ${botCount} differs from baseline botCount ${expectedBots}`);
  }

  let failed = false;
  const checks = [];

  for (const row of measured) {
    const budget = baseline.scenarios?.[row.key];
    if (!budget) {
      checks.push({ key: row.key, ok: false, reason: "missing_baseline_scenario" });
      failed = true;
      continue;
    }
    const bytesOk = row.bytesPerBot <= budget.maxBytesPerBot;
    const fanOutOk = row.fanOutBytesPerBot <= budget.maxFanOutBytesPerBot;
    checks.push({
      key: row.key,
      ok: bytesOk && fanOutOk,
      bytesPerBot: row.bytesPerBot,
      maxBytesPerBot: budget.maxBytesPerBot,
      fanOutBytesPerBot: row.fanOutBytesPerBot,
      maxFanOutBytesPerBot: budget.maxFanOutBytesPerBot,
    });
    if (!bytesOk || !fanOutOk) failed = true;
  }

  const totalBudget = baseline.totals ?? {};
  const totalBytesOk = totals.bytesPerBot <= (totalBudget.maxBytesPerBotAllScenarios ?? Infinity);
  const totalFanOutOk =
    totals.fanOutBytesPerBot <= (totalBudget.maxFanOutBytesPerBotAllScenarios ?? Infinity);
  if (!totalBytesOk || !totalFanOutOk) failed = true;

  console.log("\nBandwidth budget report (#29)\n");
  for (const check of checks) {
    const flag = check.ok ? "✓" : "✗";
    console.log(
      `  ${flag} ${check.key.padEnd(18)} ${check.bytesPerBot} B/bot (≤ ${check.maxBytesPerBot}) · fan-out ${check.fanOutBytesPerBot} B (≤ ${check.maxFanOutBytesPerBot})`,
    );
  }
  console.log(
    `\n  Totals: ${totals.bytesPerBot} B/bot (≤ ${totalBudget.maxBytesPerBotAllScenarios}) · fan-out ${totals.fanOutBytesPerBot} B (≤ ${totalBudget.maxFanOutBytesPerBotAllScenarios})`,
  );
  console.log(`\n  bots=${botCount} baseline=${baseline.name}\n`);

  const outPath = join(root, "bandwidth-budget-report.json");
  writeFileSync(outPath, `${JSON.stringify({ ...report, checks, passed: !failed }, null, 2)}\n`);
  console.log(`→ wrote ${outPath}\n`);

  if (failed) {
    console.error("Bandwidth budget regression detected. Run with --update-baseline only after intentional payload growth.");
    process.exit(1);
  }
}

main();
