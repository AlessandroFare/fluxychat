/**
 * Restricted JSONLogic (no eval, no function constructors).
 * Inspired by process-engine needs, not a full json-logic-js port.
 */

const OPS = new Set([
  "var",
  "==",
  "===",
  "!=",
  "!==",
  ">",
  ">=",
  "<",
  "<=",
  "and",
  "or",
  "!",
  "if",
  "in",
  "length",
  "+",
  "-",
]);

function isLogic(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPath(data, path) {
  if (path == null || path === "") return data;
  const parts = String(path).split(".");
  let cur = data;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[part];
  }
  return cur;
}

function asList(value) {
  return Array.isArray(value) ? value : [value];
}

/**
 * @param {*} rule
 * @param {Record<string, unknown>} data
 */
export function evalJsonLogic(rule, data) {
  if (!isLogic(rule)) return rule;
  const keys = Object.keys(rule);
  if (keys.length !== 1) throw new Error("jsonlogic_invalid");
  const op = keys[0];
  if (!OPS.has(op)) throw new Error(`jsonlogic_forbidden:${op}`);
  const raw = rule[op];
  if (op === "var") return getPath(data, raw);
  if (op === "!") return !evalJsonLogic(raw, data);
  if (op === "if") {
    const parts = asList(raw);
    const cond = evalJsonLogic(parts[0], data);
    return cond ? evalJsonLogic(parts[1], data) : evalJsonLogic(parts[2], data);
  }
  if (op === "and") return asList(raw).every((item) => Boolean(evalJsonLogic(item, data)));
  if (op === "or") return asList(raw).some((item) => Boolean(evalJsonLogic(item, data)));
  if (op === "length") {
    const v = evalJsonLogic(raw, data);
    return Array.isArray(v) || typeof v === "string" ? v.length : 0;
  }
  const args = asList(raw).map((item) => evalJsonLogic(item, data));
  const a = args[0];
  const b = args[1];
  if (op === "==" || op === "===") return a === b;
  if (op === "!=" || op === "!==") return a !== b;
  if (op === ">") return Number(a) > Number(b);
  if (op === ">=") return Number(a) >= Number(b);
  if (op === "<") return Number(a) < Number(b);
  if (op === "<=") return Number(a) <= Number(b);
  if (op === "in") {
    if (typeof b === "string") return b.includes(String(a));
    return Array.isArray(b) && b.includes(a);
  }
  if (op === "+") return args.reduce((sum, n) => sum + Number(n), 0);
  if (op === "-") return Number(a) - Number(b);
  throw new Error(`jsonlogic_forbidden:${op}`);
}

export function isJsonLogicRule(value) {
  return isLogic(value) && Object.keys(value).length === 1 && OPS.has(Object.keys(value)[0]);
}
