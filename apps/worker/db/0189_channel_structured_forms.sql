-- WhatsApp / RCS structured forms (#43)

CREATE TABLE IF NOT EXISTS channel_form_deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  form_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'rcs')),
  recipient_e164 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  schema_json TEXT NOT NULL,
  responses_json TEXT,
  current_field_index INTEGER NOT NULL DEFAULT 0,
  provider_payload_json TEXT,
  external_message_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_channel_form_deliveries_project
  ON channel_form_deliveries (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_form_deliveries_recipient
  ON channel_form_deliveries (project_id, recipient_e164, status);
