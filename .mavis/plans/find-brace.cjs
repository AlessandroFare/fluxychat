// Count braces in room-do.js, ignoring comments and strings.
// Walk the file and find the first unmatched `} catch`.
const fs = require("node:fs");
const path = "C:\\Users\\alefare\\Chat\\apps\\worker\\src\\durable-objects\\room-do.js";
const src = fs.readFileSync(path, "utf8");
const lines = src.split(/\r?\n/);

// Strip comments and strings to count braces properly.
let clean = "";
let i = 0;
let inStr = null; // ", ', or `
let inLineComment = false;
let inBlockComment = false;
while (i < src.length) {
  const c = src[i];
  const next = src[i + 1];
  if (inLineComment) {
    if (c === "\n") inLineComment = false;
    clean += c;
    i++;
    continue;
  }
  if (inBlockComment) {
    if (c === "*" && next === "/") {
      inBlockComment = false;
      clean += "  ";
      i += 2;
      continue;
    }
    clean += c === "\n" ? "\n" : " ";
    i++;
    continue;
  }
  if (inStr) {
    if (c === "\\" && next) {
      clean += "  ";
      i += 2;
      continue;
    }
    if (c === inStr) {
      inStr = null;
    }
    clean += c === "\n" ? "\n" : " ";
    i++;
    continue;
  }
  if (c === "/" && next === "/") {
    inLineComment = true;
    clean += "  ";
    i += 2;
    continue;
  }
  if (c === "/" && next === "*") {
    inBlockComment = true;
    clean += "  ";
    i += 2;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") {
    inStr = c;
    clean += " ";
    i++;
    continue;
  }
  clean += c;
  i++;
}

// Now find try/catch mismatches.
let depth = 0;
let lastTryLine = -1;
let tryDepthStack = []; // stack of {line, depth} for try {
const lineStarts = [0];
for (let j = 0; j < clean.length; j++) {
  if (clean[j] === "\n") lineStarts.push(j + 1);
}
function lineOf(pos) {
  let lo = 0, hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

let pendingCatches = [];
for (let j = 0; j < clean.length - 1; j++) {
  // try {
  if (clean.slice(j, j + 5) === "try {") {
    tryDepthStack.push({ line: lineOf(j), depth });
    depth++;
    j += 4;
    continue;
  }
  // } catch
  if (clean[j] === "}" && clean.slice(j, j + 8).match(/^\}\s*catch/)) {
    if (tryDepthStack.length === 0) {
      console.log(`ORPHAN catch at line ${lineOf(j)} (depth was ${depth})`);
    } else {
      const t = tryDepthStack.pop();
      depth--;
    }
    // skip past "} catch"
    while (j < clean.length && clean[j] !== "{") j++;
    continue;
  }
  if (clean[j] === "{") depth++;
  if (clean[j] === "}") depth--;
}
console.log(`final depth: ${depth}`);
console.log(`unclosed try: ${tryDepthStack.map(t => `line ${t.line}`).join(", ")}`);
