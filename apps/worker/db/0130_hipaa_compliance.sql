-- HIPAA Compliance

CREATE TABLE IF NOT EXISTS hipaa_baa (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('covered_entity', 'business_associate', 'subcontractor')),
  contact_name TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'active', 'expired', 'terminated')),
  effective_date TEXT,
  expiration_date TEXT,
  signed_at TEXT,
  signed_by TEXT,
  document_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_baa_project
  ON hipaa_baa (project_id, status);
CREATE INDEX IF NOT EXISTS idx_hipaa_baa_status
  ON hipaa_baa (status, expiration_date);

CREATE TABLE IF NOT EXISTS hipaa_phi_access_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  phi_type TEXT NOT NULL CHECK (phi_type IN ('demographic', 'medical', 'financial', 'biometric', 'mental_health', 'substance_abuse', 'hiv', 'genetic', 'payment')),
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'export', 'share')),
  purpose TEXT NOT NULL CHECK (purpose IN ('treatment', 'payment', 'healthcare_operation', 'research', 'patient_request', 'legal')),
  minimum_necessary INTEGER NOT NULL DEFAULT 1,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_phi_user
  ON hipaa_phi_access_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_phi_project
  ON hipaa_phi_access_log (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_phi_resource
  ON hipaa_phi_access_log (resource_type, resource_id);

CREATE TABLE IF NOT EXISTS hipaa_phi_detection (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT,
  message_id TEXT,
  detected_type TEXT NOT NULL CHECK (detected_type IN ('ssn', 'mrn', 'dob', 'name_phi', 'diagnosis', 'medication', 'procedure', 'insurance_id', 'account_number', 'face_photo')),
  confidence REAL NOT NULL,
  original_text TEXT,
  masked_text TEXT,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('flagged', 'masked', 'redacted', 'blocked', 'allowed')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_detect_project
  ON hipaa_phi_detection (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_detect_room
  ON hipaa_phi_detection (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_detect_type
  ON hipaa_phi_detection (detected_type, action_taken);

CREATE TABLE IF NOT EXISTS hipaa_breach_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  phi_types_affected TEXT NOT NULL,
  individuals_affected INTEGER NOT NULL DEFAULT 0,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'investigating', 'contained', 'notified', 'resolved', 'closed')),
  discovered_at TEXT NOT NULL,
  contained_at TEXT,
  hhs_notified_at TEXT,
  individuals_notified_at TEXT,
  root_cause TEXT,
  remediation TEXT,
  reported_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_breach_project
  ON hipaa_breach_log (project_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_hipaa_breach_status
  ON hipaa_breach_log (status, discovered_at DESC);

CREATE TABLE IF NOT EXISTS hipaa_training (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('initial', 'annual', 'role_change', 'breach_response', 'phi_handling', 'security_awareness')),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue', 'expired')),
  assigned_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  score INTEGER,
  certificate_url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_training_user
  ON hipaa_training (user_id, status);
CREATE INDEX IF NOT EXISTS idx_hipaa_training_project
  ON hipaa_training (project_id, status, expires_at);

CREATE TABLE IF NOT EXISTS hipaa_encryption (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('at_rest', 'in_transit', 'backup', 'log', 'phi_field')),
  algorithm TEXT NOT NULL DEFAULT 'AES-256',
  key_management TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotating', 'expired', 'compromised')),
  last_rotated_at TEXT,
  next_rotation_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_enc_project
  ON hipaa_encryption (project_id, data_type);

CREATE TABLE IF NOT EXISTS hipaa_audit_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('phi_access', 'phi_export', 'phi_share', 'phi_delete', 'user_login', 'user_logout', 'permission_change', 'config_change', 'breach_detected', 'training_completed')),
  user_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hipaa_audit_project
  ON hipaa_audit_log (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_event
  ON hipaa_audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_user
  ON hipaa_audit_log (user_id, created_at DESC);
