-- Migration 0142: cascade deletes for message children.
--
-- Audit B-1: when a message is hard-deleted, its child rows in
-- attachments, message_mentions, message_reactions, and
-- read_receipts should be removed too, instead of leaving orphan
-- rows that future SELECTs would have to filter out.
--
-- Note: agent_runs is NOT included in this migration. The current
-- schema (baseline/0136_schema.sql line 150) does not have a
-- message_id column on agent_runs; it links to room_id instead.
-- A separate migration can add room-level cascade if/when the
-- agent_runs schema gains a message_id FK.
--
-- SQLite cannot ALTER a foreign key in place. The standard recipe
-- is: create _new table with the desired FK, copy rows, drop the
-- old, rename. We do that for each child table below.
--
-- Idempotency: each CREATE TABLE checks sqlite_master for an
-- existing _new table; the script bails early if the migration
-- was already applied.

-- 1. attachments → messages
CREATE TABLE IF NOT EXISTS attachments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes INTEGER,
  content_type,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO attachments_new (id, project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at)
  SELECT id, project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at FROM attachments;
DROP TABLE attachments;
ALTER TABLE attachments_new RENAME TO attachments;
CREATE INDEX IF NOT EXISTS idx_attachments_room ON attachments (room_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments (message_id);

-- 2. message_mentions → messages
CREATE TABLE IF NOT EXISTS message_mentions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO message_mentions_new SELECT * FROM message_mentions;
DROP TABLE message_mentions;
ALTER TABLE message_mentions_new RENAME TO message_mentions;

-- 3. message_reactions → messages
CREATE TABLE IF NOT EXISTS message_reactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT 'default'
);
INSERT OR IGNORE INTO message_reactions_new (id, message_id, room_id, user_id, emoji, created_at, project_id)
  SELECT id, message_id, room_id, user_id, emoji, created_at, project_id FROM message_reactions;
DROP TABLE message_reactions;
ALTER TABLE message_reactions_new RENAME TO message_reactions;

-- 4. read_receipts → messages
CREATE TABLE IF NOT EXISTS read_receipts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT 'default'
);
INSERT OR IGNORE INTO read_receipts_new (id, room_id, user_id, message_id, created_at, project_id)
  SELECT id, room_id, user_id, message_id, created_at, project_id FROM read_receipts;
DROP TABLE read_receipts;
ALTER TABLE read_receipts_new RENAME TO read_receipts;
CREATE INDEX IF NOT EXISTS idx_read_receipts_room_user ON read_receipts (room_id, user_id);

-- 5. Document agent_runs: no message_id FK today. Leaving in place.
--    When agent_runs is extended with a message_id column, a follow-up
--    migration can add ON DELETE CASCADE for it.
