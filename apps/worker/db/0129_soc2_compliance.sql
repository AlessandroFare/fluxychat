-- SOC 2 Compliance

CREATE TABLE IF NOT EXISTS soc2_controls (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trust_service TEXT NOT NULL CHECK (trust_service IN ('security', 'availability', 'processing_integrity', 'confidentiality', 'privacy')),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'implemented', 'verified', 'failed')),
  owner TEXT,
  due_date TEXT,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_control_project
  ON soc2_controls (project_id, trust_service);
CREATE UNIQUE INDEX IF NOT EXISTS idx_soc2_control_id
  ON soc2_controls (project_id, control_id);

CREATE TABLE IF NOT EXISTS soc2_evidence (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('document', 'screenshot', 'log', 'config', 'certificate', 'report', 'attestation')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_hash TEXT,
  collected_by TEXT,
  collected_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_evidence_control
  ON soc2_evidence (control_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc2_evidence_project
  ON soc2_evidence (project_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS soc2_risk_assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  likelihood TEXT NOT NULL CHECK (likelihood IN ('unlikely', 'possible', 'likely', 'almost_certain')),
  impact TEXT NOT NULL CHECK (impact IN ('negligible', 'minor', 'moderate', 'major', 'catastrophic')),
  mitigation TEXT,
  residual_risk TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'accepted', 'closed')),
  identified_at TEXT NOT NULL,
  reviewed_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_risk_project
  ON soc2_risk_assessments (project_id, risk_level, status);
CREATE INDEX IF NOT EXISTS idx_soc2_risk_status
  ON soc2_risk_assessments (status, risk_level);

CREATE TABLE IF NOT EXISTS soc2_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('security', 'acceptable_use', 'data_handling', 'incident_response', 'access_control', 'change_management', 'backup_recovery', 'vendor_management')),
  version TEXT NOT NULL DEFAULT '1.0',
  content TEXT,
  effective_date TEXT,
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'under_review')),
  owner TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_policy_project
  ON soc2_policies (project_id, policy_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_soc2_policy_name
  ON soc2_policies (project_id, name);

CREATE TABLE IF NOT EXISTS soc2_policy_acknowledgments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_ack_policy
  ON soc2_policy_acknowledgments (policy_id, user_id);
CREATE INDEX IF NOT EXISTS idx_soc2_ack_project
  ON soc2_policy_acknowledgments (project_id, acknowledged_at DESC);

CREATE TABLE IF NOT EXISTS soc2_incidents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
  detected_at TEXT NOT NULL,
  reported_by TEXT,
  assigned_to TEXT,
  resolved_at TEXT,
  root_cause TEXT,
  remediation TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_incident_project
  ON soc2_incidents (project_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_soc2_incident_severity
  ON soc2_incidents (severity, status);

CREATE TABLE IF NOT EXISTS soc2_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('compliance', 'risk', 'incident', 'audit', 'readiness')),
  title TEXT NOT NULL,
  content TEXT,
  generated_by TEXT,
  period_start TEXT,
  period_end TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soc2_report_project
  ON soc2_reports (project_id, report_type, created_at DESC);
