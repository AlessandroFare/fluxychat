-- Replay / Time-travel debugging
-- P15-K (0084) created simpler replay_snapshots / replay_bookmarks; rename before expanded schema.

ALTER TABLE replay_snapshots RENAME TO replay_mode_snapshots;
ALTER TABLE replay_bookmarks RENAME TO replay_mode_bookmarks;

CREATE TABLE IF NOT EXISTS replay_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'paused', 'stopped', 'archived')),
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_session_project
  ON replay_sessions (project_id, status);
CREATE INDEX IF NOT EXISTS idx_replay_session_room
  ON replay_sessions (room_id, status);

CREATE TABLE IF NOT EXISTS replay_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('full', 'incremental', 'manual', 'auto')),
  state_hash TEXT,
  members TEXT,
  room_config TEXT,
  pinned_messages TEXT,
  metadata TEXT,
  sequence_number INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_snapshot_session
  ON replay_snapshots (session_id, sequence_number ASC);
CREATE INDEX IF NOT EXISTS idx_replay_snapshot_room
  ON replay_snapshots (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_snapshot_project
  ON replay_snapshots (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replay_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,
  actor_id TEXT,
  actor_type TEXT,
  sequence_number INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_event_session
  ON replay_events (session_id, sequence_number ASC);
CREATE INDEX IF NOT EXISTS idx_replay_event_room
  ON replay_events (room_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_event_project
  ON replay_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replay_bookmarks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  snapshot_id TEXT,
  sequence_number INTEGER NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_bookmark_session
  ON replay_bookmarks (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_replay_bookmark_project
  ON replay_bookmarks (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replay_diffs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  from_snapshot_id TEXT NOT NULL,
  to_snapshot_id TEXT NOT NULL,
  from_sequence INTEGER NOT NULL,
  to_sequence INTEGER NOT NULL,
  added_messages INTEGER NOT NULL DEFAULT 0,
  removed_messages INTEGER NOT NULL DEFAULT 0,
  added_members INTEGER NOT NULL DEFAULT 0,
  removed_members INTEGER NOT NULL DEFAULT 0,
  config_changes TEXT,
  state_delta TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_diff_session
  ON replay_diffs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_diff_project
  ON replay_diffs (project_id, created_at DESC);
