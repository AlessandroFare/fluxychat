import fs from "node:fs";
import path from "node:path";

const root = path.resolve("content/docs");
let strippedH1 = 0;
let strippedDesc = 0;
let strippedBom = 0;

function parseFrontmatterField(fm, field) {
  const line = fm.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
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

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function stripLeadingIntro(body, description) {
  let next = body;

  if (description) {
    const descNorm = normalize(description);
    const para = next.match(/^([^\n#].+\r?\n)\r?\n/);
    if (para && normalize(para[1]) === descNorm) {
      next = next.slice(para[0].length);
      strippedDesc++;
    }
  }

  const rule = next.match(/^---\r?\n\r?\n/);
  if (rule) {
    next = next.slice(rule[0].length);
  }

  return next;
}

function splitFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  const hadBom = normalized.length !== text.length;
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;

  const prefixLength = text.length - normalized.length + match[0].length;
  const body = text.slice(prefixLength).replace(/^\r?\n/, "");

  return {
    frontmatter: match[1],
    prefix: text.slice(0, prefixLength),
    body,
    hadBom,
  };
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".mdx")) {
      const original = fs.readFileSync(p, "utf8");
      const parts = splitFrontmatter(original);
      if (!parts) continue;

      const title = parseFrontmatterField(parts.frontmatter, "title");
      if (!title) continue;

      const description = parseFrontmatterField(parts.frontmatter, "description");
      const h1 = parts.body.match(/^#\s+(.+)\r?\n\r?\n/);
      if (!h1) continue;
      if (h1[1].trim() !== title) continue;

      let body = parts.body.slice(h1[0].length);
      body = stripLeadingIntro(body, description);

      let output = parts.prefix + body;
      if (parts.hadBom) {
        output = output.replace(/^\uFEFF/, "");
        strippedBom++;
      }

      fs.writeFileSync(p, output);
      strippedH1++;
    }
  }
}

walk(root);
console.log(
  `Stripped duplicate h1 from ${strippedH1} files (${strippedDesc} duplicate descriptions, ${strippedBom} BOM removed)`,
);
