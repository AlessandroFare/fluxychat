import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../content/docs");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".mdx")) out.push(p);
  }
  return out;
}

/** Fumadocs MDX components we must not wrap */
const JSX_COMPONENT = /^(\s*)<(Card|Cards|Tab|Tabs|Banner|Steps|Step|Callout|Files|File|Folder|Accordion|Accordions|InlineTOC|TypeTable|Mermaid|Include|Zoom|ImageZoom)\b/;

function fixProseAngleBrackets(text) {
  const lines = text.split("\n");
  let inFence = false;
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Skip JSX blocks / component lines
    if (JSX_COMPONENT.test(line)) continue;
    if (/^\s*<\//.test(line)) continue;
    if (/^\s*<[a-z]+\s/.test(line) && (line.includes("className") || line.includes("onClick"))) continue;
    if (/^\s*<[A-Z][A-Za-z0-9]*[\s/>]/.test(line)) continue;
    if (/^\s*<[a-z]+>/.test(line) && !trimmed.startsWith("-")) continue;

    let next = line;

    // Wrap bare <placeholder> or <Component /> in backticks (MDX-safe)
    next = next.replace(/(?<!`)(<[A-Za-z@][^>\n]*>)(?!`)/g, (match) => {
      if (match.startsWith("<http") || match.includes(" ")) return match;
      return `\`${match}\``;
    });

    // Fix doubled backticks from adjacent replacements
    next = next.replace(/``+/g, "`");

    if (next !== line) {
      lines[i] = next;
      changed = true;
    }
  }

  return changed ? lines.join("\n") : text;
}

function fixMarkdown(text) {
  let out = text;
  out = out.replace(/\*\*`([^`]+)`\*\*/g, "`$1`");
  out = fixProseAngleBrackets(out);
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const before = fs.readFileSync(file, "utf8");
  const after = fixMarkdown(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log("fixed:", path.relative(root, file));
  }
}
console.log(`\nMDX-safe markdown cleanup: ${changed} file(s) updated.`);
