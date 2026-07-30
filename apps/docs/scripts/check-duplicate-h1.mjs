import fs from "node:fs";
import path from "node:path";

const root = path.resolve("content/docs");
const remaining = [];

function parseTitle(fm) {
  const line = fm.match(/^title:\s*(.+)$/m);
  if (!line) return null;
  let value = line[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".mdx")) {
      const text = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
      const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      if (!m) continue;
      const title = parseTitle(m[1]);
      const body = text.slice(m[0].length).replace(/^\r?\n/, "");
      const h1 = body.match(/^#\s+(.+)\r?\n/);
      if (title && h1 && h1[1].trim() === title) {
        remaining.push(path.relative(root, p));
      }
    }
  }
}

walk(root);
console.log(`Remaining duplicate h1: ${remaining.length}`);
for (const file of remaining) console.log(file);
