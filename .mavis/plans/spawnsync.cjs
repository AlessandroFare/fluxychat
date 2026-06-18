const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const vitest = path.join(
  "C:\\Users\\alefare\\Chat\\node_modules\\.pnpm\\vitest@4.1.5_@types+node@24_081ad78f4f0237f044cb4f9711e4079e\\node_modules\\vitest\\dist\\node.js",
);

// Try with NODE_OPTIONS to force output flushing
const env = {
  ...process.env,
  NODE_NO_WARNINGS: "1",
  NODE_OPTIONS: "--no-warnings",
  CI: "true",
};

const result = spawnSync(
  "C:\\Program Files\\nodejs\\node.exe",
  [vitest, "run", "--reporter=basic", "src/lib/activity-feed.test.js"],
  {
    cwd: "C:\\Users\\alefare\\Chat\\apps\\worker",
    env,
    encoding: "utf8",
    timeout: 60_000,
  },
);
fs.writeFileSync(
  "C:\\Users\\alefare\\Chat\\.mavis\\plans\\spawnsync-out.log",
  `STDOUT:\n${result.stdout || "(empty)"}\n\nSTDERR:\n${result.stderr || "(empty)"}\n\nSTATUS: ${result.status}\nSIGNAL: ${result.signal}\nERROR: ${result.error?.message || "none"}\n`,
);
console.log("status:", result.status, "signal:", result.signal);
console.log("stdout len:", (result.stdout || "").length);
console.log("stderr len:", (result.stderr || "").length);
