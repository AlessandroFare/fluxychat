-- P18-B: Data Classification Labels
CREATE TABLE IF NOT EXISTS data_classification_labels (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classification_labels_project ON data_classification_labels(project_id);

-- Room classification (one active label per room)
CREATE TABLE IF NOT EXISTS room_classifications (
  room_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  classified_by TEXT NOT NULL,
  classified_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (label_id) REFERENCES data_classification_labels(id)
);

-- Message classification overrides
CREATE TABLE IF NOT EXISTS message_classifications (
  message_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  classified_by TEXT NOT NULL,
  classified_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, label_id),
  FOREIGN KEY (label_id) REFERENCES data_classification_labels(id)
);

-- P18-C: Retention Policies + Legal Hold
CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  room_id TEXT,
  retention_days INTEGER NOT NULL DEFAULT 365,
  auto_delete INTEGER NOT NULL DEFAULT 0,
  require_approval INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_project ON retention_policies(project_id);
CREATE INDEX IF NOT EXISTS idx_retention_policies_room ON retention_policies(room_id);

-- Legal holds (freeze messages from deletion)
CREATE TABLE IF NOT EXISTS legal_holds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  reason TEXT NOT NULL,
  placed_by TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  released_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_project ON legal_holds(project_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_room ON legal_holds(room_id);

-- Export snapshots (immutable compliance exports)
CREATE TABLE IF NOT EXISTS export_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  format TEXT NOT NULL DEFAULT 'json',
  filter_json TEXT NOT NULL DEFAULT '{}',
  file_path TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_export_snapshots_project ON export_snapshots(project_id);

-- P18-D: DLP + PII Redaction Pipeline
CREATE TABLE IF NOT EXISTS dlp_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'regex',
  pattern TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'redact',
  severity TEXT NOT NULL DEFAULT 'medium',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dlp_rules_project ON dlp_rules(project_id);

-- DLP scan results
CREATE TABLE IF NOT EXISTS dlp_scan_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  message_id TEXT,
  room_id TEXT,
  rule_id TEXT NOT NULL,
  matched_text TEXT,
  redacted_text TEXT,
  action_taken TEXT NOT NULL,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES dlp_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_dlp_scan_results_project ON dlp_scan_results(project_id);
CREATE INDEX IF NOT EXISTS idx_dlp_scan_results_message ON dlp_scan_results(message_id);

-- P18-E: AI Actions Policy Engine
CREATE TABLE IF NOT EXISTS ai_action_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  tool_name TEXT,
  allowed INTEGER NOT NULL DEFAULT 1,
  require_approval INTEGER NOT NULL DEFAULT 0,
  max_executions_per_hour INTEGER,
  allowed_user_roles TEXT NOT NULL DEFAULT '["owner","admin"]',
  conditions TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_action_policies_project ON ai_action_policies(project_id);

-- AI action policy violations
CREATE TABLE IF NOT EXISTS ai_policy_violations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  action_id TEXT,
  agent_id TEXT,
  user_id TEXT,
  violation_type TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (policy_id) REFERENCES ai_action_policies(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_policy_violations_project ON ai_policy_violations(project_id);
