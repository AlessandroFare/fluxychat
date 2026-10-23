/**
 * Audit F-51: guard for regexes that come from configuration (ambient policy
 * triggers, DLP rules, embed triggers, omnichannel) — a catastrophic pattern
 * would stall the worker/DO with no way to interrupt it.
 *
 * The check is deliberately conservative: cap the length and reject the classic
 * ReDoS shapes (nested quantifiers, repeated alternation, stacked quantifiers).
 * Callers fall back to plain substring matching when a pattern is rejected.
 */

export const MAX_REGEX_PATTERN_LENGTH = 200;

// `( … + … )+` / `( … * … )*` / `( … | … )+` — the exponential shapes.
const NESTED_QUANTIFIER = /\([^()]*[+*|][^()]*\)\s*[+*{]/;
// `a*+`, `a++`, `a**`, `a*?+` — stacked quantifiers.
const STACKED_QUANTIFIER = /[+*?]\s*[+*{]/;
// `\1`-style backreferences can be abused to blow up matching too.
const BACKREFERENCE = /\\[1-9]/;

export function isSafeRegexPattern(pattern) {
  if (typeof pattern !== "string" || !pattern.trim()) return false;
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return false;
  if (NESTED_QUANTIFIER.test(pattern)) return false;
  if (STACKED_QUANTIFIER.test(pattern)) return false;
  if (BACKREFERENCE.test(pattern)) return false;
  return true;
}

/**
 * Compile a configured pattern. Returns null when the pattern is unsafe or
 * invalid so the caller can fall back to a literal comparison.
 * @returns {RegExp | null}
 */
export function compileSafeRegex(pattern, flags = "") {
  if (!isSafeRegexPattern(pattern)) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}
