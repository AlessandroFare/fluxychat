-- Voice Translation

CREATE TABLE IF NOT EXISTS voice_translation_profiles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  preferred_source_lang TEXT NOT NULL DEFAULT 'auto',
  preferred_target_lang TEXT NOT NULL DEFAULT 'en',
  auto_translate INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vt_profile_unique
  ON voice_translation_profiles (project_id, user_id);

CREATE TABLE IF NOT EXISTS voice_translation_rooms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  default_source_lang TEXT NOT NULL DEFAULT 'auto',
  default_target_lang TEXT NOT NULL DEFAULT 'en',
  translate_on_join INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vt_room_unique
  ON voice_translation_rooms (project_id, room_id);

CREATE TABLE IF NOT EXISTS voice_translation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT,
  source_lang TEXT,
  target_lang TEXT NOT NULL,
  source_text TEXT,
  translated_text TEXT,
  confidence REAL,
  provider TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_vt_job_room
  ON voice_translation_jobs (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vt_job_project
  ON voice_translation_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vt_job_status
  ON voice_translation_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS voice_translation_feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  correction TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vt_feedback_job
  ON voice_translation_feedback (job_id);
CREATE INDEX IF NOT EXISTS idx_vt_feedback_project
  ON voice_translation_feedback (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS voice_translation_cache (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vt_cache_unique
  ON voice_translation_cache (project_id, source_lang, target_lang, source_hash);
CREATE INDEX IF NOT EXISTS idx_vt_cache_project
  ON voice_translation_cache (project_id, hit_count DESC);
