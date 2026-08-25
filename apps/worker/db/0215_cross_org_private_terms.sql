-- Cross-org negotiations: separate private reserve terms from shared terms.
--
-- WHY
-- ---
-- `cross_org_commitments.terms_json` was a single shared blob. Callers pass a
-- private negotiation floor inside it (`floorPrice` / `min_price` / `minPrice`,
-- documented in lib/cross-org-rooms.js as "Optional private floor"). Because the
-- whole blob was persisted, echoed into the cross-org audit log, and returned by
-- `getCommitment` / `listCommitments` to BOTH organisations in the room, the
-- counterparty could read the other side's walk-away price — the single most
-- confidential value in a negotiation.
--
-- Private terms now live in their own column, owned by the org that supplied
-- them, and are never merged into the shared view.

ALTER TABLE cross_org_commitments ADD COLUMN private_terms_json TEXT;
ALTER TABLE cross_org_commitments ADD COLUMN private_terms_org TEXT;

-- Existing rows may already carry a leaked floor inside terms_json. We cannot
-- reliably rewrite JSON in SQLite without JSON1 guarantees across environments,
-- so mark them for the application-level redaction path: the mapper strips
-- private keys from terms_json on read regardless of this column, which makes
-- old rows safe without a data migration.
CREATE INDEX IF NOT EXISTS idx_cross_org_commitments_private_org
  ON cross_org_commitments (cross_org_room_id, private_terms_org);
