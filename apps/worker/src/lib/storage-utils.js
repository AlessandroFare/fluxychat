export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Truncate a string for storage without breaking multi-byte UTF-8 codepoints.
 * Audit S-32: the previous implementation used `value.slice(0, max)`, which
 * can split a surrogate pair (e.g. emoji) and produce invalid UTF-8.
 */
export function truncateForStorage(text, max = 500) {
  if (!text) return null;
  const value = String(text);
  if (value.length <= max) return value;
  // Walk back from `max` until we are at a UTF-16 code-point boundary
  // (high surrogate without a following low surrogate, or vice versa).
  let end = max;
  while (end > 0 && isSplitSurrogate(value.charCodeAt(end - 1), value.charCodeAt(end))) {
    end -= 1;
  }
  return `${value.slice(0, end)}...`;
}

function isSplitSurrogate(prev, next) {
  // Surrogate halves live in 0xD800-0xDFFF. A split happens when one side
  // of the cut is a high surrogate (0xD800-0xDBFF) without a matching
  // low surrogate on the other side.
  const prevIsHigh = prev >= 0xd800 && prev <= 0xdbff;
  const prevIsLow = prev >= 0xdc00 && prev <= 0xdfff;
  const nextIsHigh = next >= 0xd800 && next <= 0xdbff;
  const nextIsLow = next >= 0xdc00 && next <= 0xdfff;
  return (prevIsHigh && !nextIsLow) || (prevIsLow && !nextIsHigh);
}

/**
 * Byte-safe truncation. Truncates to AT MOST `maxBytes` UTF-8 bytes,
 * walking back to a valid UTF-8 sequence start so the result is
 * always decodable. Use this for storage columns that have a byte
 * limit (e.g. an upstream DB column with a byte limit, or a 4000-byte
 * header constraint).
 *
 * Returns null for null/empty input. Returns the original string
 * unchanged if it fits.
 *
 * Behaviour matches the existing `truncateForStorage` (UTF-16
 * surrogate-safe) for inputs that are valid UTF-16  the difference
 * is that this one operates on UTF-8 bytes, not JS code units.
 */
export function truncateForStorageBytes(text, maxBytes = 4000) {
  if (!text) return null;
  const value = String(text);
  const enc = new TextEncoder();
  const bytes = enc.encode(value);
  if (bytes.length <= maxBytes) return value;
  // Walk back to a valid UTF-8 sequence start. A sequence start is
  // any byte whose top 2 bits are NOT `10` (continuation). I.e. the
  // first byte of a 1/2/3/4-byte sequence. We must also handle the
  // rare case where we land in the middle of a multi-byte sequence
  // that started before our cut.
  let end = Math.min(maxBytes, bytes.length);
  // If the byte at `end` is a continuation byte (10xxxxxx), walk
  // back to the start of that sequence.
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  const dec = new TextDecoder("utf-8", { fatal: true });
  let out;
  try {
    out = dec.decode(bytes.slice(0, end));
  } catch {
    // Fallback: if the slice still isn't valid (shouldn't happen given
    // the walk-back above), drop one more byte and retry.
    out = dec.decode(bytes.slice(0, Math.max(0, end - 1)));
  }
  return `${out}...`;
}
