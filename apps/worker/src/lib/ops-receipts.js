/**
 * I4: verifiable audit receipts.
 *
 * A receipt is self-contained: every record carries the hash of the chain up to
 * it, so anyone holding the exported file can prove offline that it was not
 * altered after export — no DB, no network, no trust in the exporter. The same
 * verifier also checks room-audit-chain exports (`exportRoomAuditChain`).
 *
 * This module imports nothing from the worker runtime on purpose: the offline
 * CLI (`scripts/verify-audit-export.mjs`) loads it directly in Node.
 */
import { AUDIT_CHAIN_GENESIS_HASH, sha256Hex } from "./audit-chain.js";
import { stableStringify } from "./canonical-payload-hash.js";

export const AUDIT_RECEIPT_FORMAT = "fluxy-audit-receipt.v1";

/**
 * Seal an ordered list of `{ kind, value }` records into chain entries.
 * Deterministic: sorted-key canonical JSON, `sha256(prev:record)`.
 */
export async function chainAuditRecords(records) {
  let prev = AUDIT_CHAIN_GENESIS_HASH;
  const sealed = [];
  for (let seq = 0; seq < records.length; seq++) {
    const record = records[seq] || {};
    const hash = await sha256Hex(`${prev}:${stableStringify({ kind: record.kind, value: record.value })}`);
    sealed.push({ seq, kind: record.kind, value: record.value, prevHash: prev, hash });
    prev = hash;
  }
  return { records: sealed, tipHash: prev };
}

function breakAt(records, seq) {
  return { ok: true, valid: false, count: records.length, firstBreakSeq: seq };
}

/** Verify a sealed ops receipt (`fluxy-audit-receipt.v1`) without any store. */
export async function verifyOpsReceipt(receipt) {
  if (!receipt || receipt.format !== AUDIT_RECEIPT_FORMAT || !Array.isArray(receipt.records)) {
    return { ok: false, error: "unsupported_format" };
  }
  const records = receipt.records;
  let prev = receipt.genesis || AUDIT_CHAIN_GENESIS_HASH;
  for (let seq = 0; seq < records.length; seq++) {
    const record = records[seq] || {};
    if (record.seq !== seq || record.prevHash !== prev) return breakAt(records, seq);
    const hash = await sha256Hex(`${prev}:${stableStringify({ kind: record.kind, value: record.value })}`);
    if (hash !== record.hash) return breakAt(records, seq);
    prev = hash;
  }
  const valid = prev === receipt.tipHash;
  return { ok: true, valid, count: records.length, firstBreakSeq: valid ? null : records.length, tipHash: prev };
}

/**
 * Verify an `exportRoomAuditChain` file: each row re-hashed offline with the
 * exact serialization the appender used (`{...event, createdAt}`).
 */
export async function verifyRoomChainExport(exported) {
  if (!Array.isArray(exported?.entries)) return { ok: false, error: "unsupported_format" };
  const entries = exported.entries;
  let prev = AUDIT_CHAIN_GENESIS_HASH;
  for (let seq = 0; seq < entries.length; seq++) {
    const entry = entries[seq] || {};
    if (entry.prevHash !== prev) return breakAt(entries, seq);
    // JSON.parse preserves key order, so this list is byte-identical to the
    // string the row was hashed from at append time.
    const eventJson = JSON.stringify({ ...(entry.event || {}), createdAt: entry.createdAt });
    const hash = await sha256Hex(`${entry.prevHash}:${eventJson}`);
    if (hash !== entry.eventHash) return breakAt(entries, seq);
    prev = entry.eventHash;
  }
  return { ok: true, valid: true, count: entries.length, firstBreakSeq: null, tipHash: prev };
}

/** Dispatch on any exported audit JSON: sealed receipt or room chain. */
export async function verifyAuditExport(parsed) {
  if (parsed?.format === AUDIT_RECEIPT_FORMAT) {
    return { kind: "ops_receipt", ...(await verifyOpsReceipt(parsed)) };
  }
  if (Array.isArray(parsed?.entries)) {
    return { kind: "room_chain", ...(await verifyRoomChainExport(parsed)) };
  }
  return { ok: false, error: "unsupported_format" };
}
