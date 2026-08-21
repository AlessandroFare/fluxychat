import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const indexPath = join(srcDir, "index.ts");
const lines = readFileSync(indexPath, "utf8").split(/\n/);

// Lines 914–4889 (1-based) = client imports + types + FluxyChatClient class
const head = lines.slice(0, 913);
const client = lines.slice(913, 4889);
const tail = lines.slice(4889);

if (!client[0]?.includes("import { FluxyChatRoomConnection")) {
  throw new Error(`Unexpected client start: ${client[0]}`);
}
if (!client.at(-1)?.trim().endsWith("}") && !client.some((l) => l === "}")) {
  // last line of class should be closing brace
}
const lastClient = client[client.length - 1];
if (lastClient.trim() !== "}") {
  throw new Error(`Unexpected client end: ${JSON.stringify(lastClient)}`);
}

writeFileSync(join(srcDir, "fluxy-chat-client.ts"), `${client.join("\n")}\n`);
writeFileSync(
  indexPath,
  `${head.join("\n")}\n\nexport * from "./fluxy-chat-client";\n\n${tail.join("\n")}`,
);
console.log(`Extracted ${client.length} lines to fluxy-chat-client.ts`);
