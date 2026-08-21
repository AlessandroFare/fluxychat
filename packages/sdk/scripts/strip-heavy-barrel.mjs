/**
 * Strip heavy markdown/yjs re-exports from the main SDK barrel.
 * Subpaths: @fluxy-chat/sdk/markdown, @fluxy-chat/sdk/yjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const indexPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.ts");
let src = readFileSync(indexPath, "utf8");

const blocks = [
  /export type \{\s*StreamingMarkdownRenderer,[\s\S]*?\} from "\.\/streaming-markdown";\n*/,
  /export \{\s*text,\s*strong,[\s\S]*?\} from "\.\/markdown";\n*/,
  /export \{\s*FLUXY_MESSAGES_MAP_KEY,[\s\S]*?\} from "\.\/message-crdt-yjs";\n*/,
  /export \{\s*createYjsCollabPort,[\s\S]*?\} from "\.\/yjs-collab";\n*/,
];

for (const re of blocks) {
  if (!re.test(src)) {
    console.warn("block not found:", re.source.slice(0, 40));
    continue;
  }
  src = src.replace(re, "");
}

const note = `/** Markdown → \`@fluxy-chat/sdk/markdown\`; Yjs CRDT → \`@fluxy-chat/sdk/yjs\`. */\n`;
if (!src.includes("@fluxy-chat/sdk/markdown")) {
  src = src.replace(
    'export * from "./fluxy-chat-client";',
    `${note}\nexport * from "./fluxy-chat-client";`,
  );
}

writeFileSync(indexPath, src);
console.log("Stripped markdown/yjs from index.ts");
