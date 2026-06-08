-- P10: Sent.dm contact mirror, SMS OTP, optional room DO sharding

CREATE TABLE IF NOT EXISTS sent_dm_contacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT,
  e164 TEXT NOT NULL,
  sent_contact_id TEXT,
  opt_out INTEGER NOT NULL DEFAULT 0,
  default_channel TEXT,
  synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_dm_contacts_project_e164
  ON sent_dm_contacts (project_id, e164);

CREATE INDEX IF NOT EXISTS idx_sent_dm_contacts_project_user
  ON sent_dm_contacts (project_id, user_id);

CREATE TABLE IF NOT EXISTS sms_otp_codes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_otp_project_user_e164
  ON sms_otp_codes (project_id, user_id, e164, created_at DESC);

ALTER TABLE rooms ADD COLUMN shard_count INTEGER NOT NULL DEFAULT 1;
