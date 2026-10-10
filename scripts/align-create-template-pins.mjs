import fs from "node:fs";
import path from "node:path";

const root = path.join("packages", "create-fluxy-chat", "templates");

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (name !== "package.json" && name !== "README.md") continue;
    const s = fs.readFileSync(p, "utf8");
    const next = s
      .replaceAll('"@fluxy-chat/ui-kit": "^0.1.8"', '"@fluxy-chat/ui-kit": "^0.1.9"')
      .replaceAll('"@fluxy-chat/ui": "^0.1.7"', '"@fluxy-chat/ui": "^0.1.8"')
      .replaceAll('"@fluxy-chat/react": "^0.1.8"', '"@fluxy-chat/react": "^0.1.9"')
      .replaceAll('"@fluxy-chat/sdk": "^0.6.14"', '"@fluxy-chat/sdk": "^0.6.15"')
      .replaceAll("@fluxy-chat/sdk@0.6.14", "@fluxy-chat/sdk@0.6.15")
      .replaceAll("@fluxy-chat/react@0.1.8", "@fluxy-chat/react@0.1.9")
      .replaceAll("@fluxy-chat/ui@0.1.7", "@fluxy-chat/ui@0.1.8")
      .replaceAll("@fluxy-chat/ui-kit@0.1.8", "@fluxy-chat/ui-kit@0.1.9");
    if (next !== s) {
      fs.writeFileSync(p, next);
      console.log("updated", p);
    }
  }
}

walk(root);
