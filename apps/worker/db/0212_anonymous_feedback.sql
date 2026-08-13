-- Anonymous HR feedback: classification + privacy-safe audit (no content/identity).

CREATE TABLE IF NOT EXISTS anonymous_feedback_submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  category TEXT NOT NULL,
  confidence REAL NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('aggregated_summary', 'hr_escalation')),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'summarized', 'escalated', 'closed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anonymous_feedback_audit (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence REAL NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES anonymous_feedback_submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_anonymous_feedback_audit_project
  ON anonymous_feedback_audit (project_id, created_at DESC);
