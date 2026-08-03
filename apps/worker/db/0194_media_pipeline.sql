-- #56 Media pipeline — tenant upload limits + async AV/thumbnail job tracking
CREATE TABLE IF NOT EXISTS project_media_settings (
  project_id TEXT PRIMARY KEY,
  max_file_size_bytes INTEGER NOT NULL DEFAULT 10485760,
  max_attachments_per_message INTEGER NOT NULL DEFAULT 10,
  allowed_mime_types_json TEXT,
  av_scan_enabled INTEGER NOT NULL DEFAULT 1,
  thumbnail_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachment_media_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_key TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_detail TEXT,
  thumbnail_url TEXT,
  thumbnail_status TEXT NOT NULL DEFAULT 'pending',
  content_type TEXT,
  size_bytes INTEGER,
  scanned_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, file_key)
);

CREATE INDEX IF NOT EXISTS idx_attachment_media_jobs_project
  ON attachment_media_jobs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attachment_media_jobs_status
  ON attachment_media_jobs(project_id, scan_status);
