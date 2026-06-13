-- Video/Voice calls via managed provider (LiveKit/Daily.co)

CREATE TABLE IF NOT EXISTS call_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'livekit' CHECK (provider IN ('livekit', 'daily', 'custom')),
  provider_room_id TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
  started_by TEXT,
  started_at TEXT,
  ended_at TEXT,
  duration_ms INTEGER,
  recording_enabled INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  max_participants INTEGER DEFAULT 50,
  settings TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_room
  ON call_sessions (room_id, status);
CREATE INDEX IF NOT EXISTS idx_call_project
  ON call_sessions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS call_participants (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  duration_ms INTEGER,
  audio_enabled INTEGER NOT NULL DEFAULT 1,
  video_enabled INTEGER NOT NULL DEFAULT 1,
  screen_sharing INTEGER NOT NULL DEFAULT 0,
  role TEXT DEFAULT 'participant' CHECK (role IN ('host', 'moderator', 'participant')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_participant_call
  ON call_participants (call_id);

CREATE TABLE IF NOT EXISTS call_events (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave', 'mute', 'unmute', 'video_on', 'video_off', 'screen_share_start', 'screen_share_stop', 'recording_start', 'recording_stop', 'quality_change')),
  user_id TEXT,
  metadata TEXT,
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_event_project
  ON call_events (project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_event_call
  ON call_events (call_id, recorded_at DESC);
