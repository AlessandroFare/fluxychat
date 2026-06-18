// Direct node call, no shell, redirect to file via the child itself
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const out = fs.openSync("C:\\Users\\alefare\\Chat\\.mavis\\plans\\vitest-out.log", "w");
const err = fs.openSync("C:\\Users\\alefare\\Chat\\.mavis\\plans\\vitest-err.log", "w");
const vitest = path.join(
  "C:\\Users\\alefare\\Chat\\node_modules\\.pnpm\\vitest@4.1.5_@types+node@24_081ad78f4f0237f044cb4f9711e4079e\\node_modules\\vitest\\dist\\node.js",
);

const child = spawn(
  "C:\\Program Files\\nodejs\\node.exe",
  [vitest, "--version"],
  {
    cwd: "C:\\Users\\alefare\\Chat\\apps\\worker",
    stdio: ["ignore", out, err],
    detached: false,
    shell: false,
  },
);
child.on("exit", (code) => {
  fs.writeSync(out, `\n[exit code: ${code}]\n`);
  fs.closeSync(out);
  fs.closeSync(err);
  console.log("wrote vitest-out.log, exit code:", code);
});
child.on("error", (e) => {
  console.error("spawn error:", e);
});
