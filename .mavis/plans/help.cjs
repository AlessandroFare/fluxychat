const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const vitest = "C:\\Users\\alefare\\Chat\\node_modules\\.pnpm\\vitest@4.1.5_@types+node@24_081ad78f4f0237f044cb4f9711e4079e\\node_modules\\vitest\\dist\\node.js";

const result = spawnSync(
  "C:\\Program Files\\nodejs\\node.exe",
  [vitest, "--help"],
  {
    cwd: "C:\\Users\\alefare\\Chat\\apps\\worker",
    encoding: "utf8",
    timeout: 30_000,
  },
);
fs.writeFileSync(
  "C:\\Users\\alefare\\Chat\\.mavis\\plans\\help-out.log",
  `STDOUT:\n${result.stdout || "(empty)"}\n\nSTDERR:\n${result.stderr || "(empty)"}\n\nSTATUS: ${result.status}\n`,
);
console.log("status:", result.status);
console.log("stdout len:", (result.stdout || "").length);
