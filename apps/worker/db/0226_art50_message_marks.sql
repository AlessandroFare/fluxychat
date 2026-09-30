-- Art. 50 (Reg. 2024/1689): machine-readable AI marks on chat messages.
-- Disclosure duties apply from 2 Aug 2026 (no grace). Art. 50(2) marking grace
-- for pre-existing systems runs to 2 Dec 2026. Tools are not a legal guarantee.

ALTER TABLE messages ADD COLUMN participant_type TEXT;
ALTER TABLE messages ADD COLUMN metadata_json TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_room_participant
  ON messages (project_id, room_id, participant_type);

ALTER TABLE project_eu_ai_act_settings
  ADD COLUMN first_contact_disclosure INTEGER NOT NULL DEFAULT 1;
