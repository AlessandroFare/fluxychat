import type { Op } from "./types.js";

/** The runtime form of one field's operators, erased of its value type. */
type AnyOp = Op<unknown>;

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const ordered = (a: unknown, b: unknown, cmp: (x: number, y: number) => boolean): boolean => {
  if (typeof a === "number" && typeof b === "number") return cmp(a, b);
  if (typeof a === "string" && typeof b === "string") return cmp(a < b ? -1 : a > b ? 1 : 0, 0);
  return false;
};

/** Whether a single value satisfies one field's operator set. */
function matchesOp(value: unknown, op: AnyOp): boolean {
  if (op.eq !== undefined && !toArray(op.eq).includes(value)) return false;
  if (op.neq !== undefined && toArray(op.neq).includes(value)) return false;
  if (op.in !== undefined && !op.in.includes(value)) return false;
  if (op.gt !== undefined && !ordered(value, op.gt, (x, y) => x > y)) return false;
  if (op.lt !== undefined && !ordered(value, op.lt, (x, y) => x < y)) return false;
  return true;
}

/**
 * Whether a flattened record satisfies a `where` clause (§6). Every named field's operator
 * set must match; an absent field on the record fails a present operator.
 *
 * This is the live matcher behind inbox views. (Channel `where` is a reserved surface and
 * throws before reaching any matcher.)
 */
export function matchesWhere(
  record: Record<string, unknown>,
  where: Record<string, AnyOp | undefined>,
): boolean {
  for (const [field, op] of Object.entries(where)) {
    if (op === undefined) continue;
    if (!matchesOp(record[field], op)) return false;
  }
  return true;
}
