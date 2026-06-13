-- Co-browsing sessions (collaborative screen share + annotations)

CREATE TABLE IF NOT EXISTS cobrowsing_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  max_viewers INTEGER DEFAULT 25,
  annotations_enabled INTEGER NOT NULL DEFAULT 1,
  remote_control_enabled INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cobrowse_room
  ON cobrowsing_sessions (room_id, status);
CREATE INDEX IF NOT EXISTS idx_cobrowse_project
  ON cobrowsing_sessions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cobrowsing_viewers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  cursor_x REAL,
  cursor_y REAL,
  page_url TEXT,
  remote_control INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cobrowse_viewer_session
  ON cobrowsing_viewers (session_id);

CREATE TABLE IF NOT EXISTS cobrowsing_annotations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cursor', 'draw', 'text', 'highlight', 'arrow', 'rectangle', 'pointer')),
  payload TEXT NOT NULL,
  page_url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cobrowse_annotation_session
  ON cobrowsing_annotations (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cobrowse_annotation_project
  ON cobrowsing_annotations (project_id, created_at DESC);
