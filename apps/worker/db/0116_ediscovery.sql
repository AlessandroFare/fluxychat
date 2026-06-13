-- eDiscovery case management and evidence collection

CREATE TABLE IF NOT EXISTS ediscovery_cases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  matter TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'review', 'production', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  assigned_to TEXT,
  created_by TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ediscovery_project
  ON ediscovery_cases (project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ediscovery_case_number
  ON ediscovery_cases (project_id, case_number);

CREATE TABLE IF NOT EXISTS ediscovery_custodians (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'custodian',
  preserved_at TEXT,
  released_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custodian_case
  ON ediscovery_custodians (case_id);

CREATE TABLE IF NOT EXISTS ediscovery_preservation (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT,
  user_id TEXT,
  data_types TEXT NOT NULL DEFAULT 'messages',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'released')),
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preservation_case
  ON ediscovery_preservation (case_id, status);

CREATE TABLE IF NOT EXISTS ediscovery_evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('message', 'file', 'metadata', 'audit_event')),
  item_id TEXT NOT NULL,
  room_id TEXT,
  collected_by TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  hash TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_evidence_case
  ON ediscovery_evidence (case_id, item_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_unique
  ON ediscovery_evidence (case_id, item_type, item_id);

CREATE TABLE IF NOT EXISTS ediscovery_chain_of_custody (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coc_evidence
  ON ediscovery_chain_of_custody (evidence_id, timestamp);
