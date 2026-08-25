-- F3: cross-org commitment settlements.
--
-- When both humans confirm (state -> 'committed'), a settlement record is
-- created through the pluggable provider interface in
-- lib/cross-org-settlement.js. The default "manual" provider records intent and
-- leaves execution to the parties; the schema carries provider + external_ref so
-- an x402 / on-chain executor can be attached later WITHOUT another migration.

CREATE TABLE IF NOT EXISTS cross_org_settlements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cross_org_room_id TEXT NOT NULL,
  commitment_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC,
  currency TEXT,
  external_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_org_settlements_room
  ON cross_org_settlements (cross_org_room_id, status);
