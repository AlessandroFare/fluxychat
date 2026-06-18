const { spawn } = require("node:child_process");
const path = require("node:path");

const vitest = path.join(
  "C:\\Users\\alefare\\Chat\\node_modules\\.pnpm",
  "vitest@4.1.5_@types+node@24_081ad78f4f0237f044cb4f9711e4079e",
  "node_modules",
  "vitest",
  "vitest.mjs",
);

const target = process.argv[2] || "src/lib/sso-saml.test.js";
const cwd = "C:\\Users\\alefare\\Chat\\apps\\worker";

const child = spawn("C:\\Program Files\\nodejs\\node.exe", [vitest, "run", target], {
  cwd,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_OPTIONS: "--no-warnings" },
});
child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));
child.on("exit", (code) => {
  console.log(`\n[exit ${code}]`);
  process.exit(code ?? 0);
});
child.on("error", (e) => {
  console.error("[spawn error]", e);
  process.exit(2);
});
