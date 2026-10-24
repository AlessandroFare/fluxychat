-- Audit F-88: Ops guest invites are single-use — track when an invite was redeemed.
ALTER TABLE ops_guests ADD COLUMN redeemed_at TEXT;
