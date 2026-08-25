import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const nestedSdk = join(
  process.cwd(),
  "node_modules",
  "@fluxy-chat",
  "react",
  "node_modules",
  "@fluxy-chat",
  "sdk",
);

if (existsSync(nestedSdk)) {
  rmSync(nestedSdk, { recursive: true, force: true });
  console.log("[fluxy] removed nested @fluxy-chat/sdk so Vite uses the hoisted complete package");
}
