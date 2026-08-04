-- EU AI Act compliance (Regulation 2024/1689) — project settings, agent profiles, audit log

CREATE TABLE IF NOT EXISTS project_eu_ai_act_settings (
  project_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  provider_legal_name TEXT,
  provider_contact TEXT,
  enforce_ai_disclosure INTEGER NOT NULL DEFAULT 1,
  enforce_hitl_high_risk INTEGER NOT NULL DEFAULT 1,
  record_retention_days INTEGER NOT NULL DEFAULT 365,
  require_conformity_for_high_risk INTEGER NOT NULL DEFAULT 1,
  block_unacceptable_risk INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_eu_ai_act_profiles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  intended_purpose TEXT NOT NULL,
  eu_risk_category TEXT NOT NULL DEFAULT 'minimal'
    CHECK (eu_risk_category IN ('minimal', 'limited', 'high', 'unacceptable')),
  annex_iii_category TEXT,
  human_oversight_level TEXT NOT NULL DEFAULT 'human_in_loop'
    CHECK (human_oversight_level IN ('human_in_loop', 'human_on_loop', 'human_in_command')),
  hitl_mode TEXT NOT NULL DEFAULT 'side_effect'
    CHECK (hitl_mode IN ('none', 'side_effect', 'all_tools')),
  requires_disclosure INTEGER NOT NULL DEFAULT 1,
  data_categories_json TEXT,
  prohibited_use_confirmed INTEGER NOT NULL DEFAULT 1,
  conformity_assessed INTEGER NOT NULL DEFAULT 0,
  conformity_assessed_at TEXT,
  conformity_assessed_by TEXT,
  technical_doc_version TEXT NOT NULL DEFAULT '1.0',
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_eu_ai_act_profiles_project
  ON agent_eu_ai_act_profiles (project_id, eu_risk_category);

CREATE TABLE IF NOT EXISTS eu_ai_act_audit_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_id TEXT,
  room_id TEXT,
  event_type TEXT NOT NULL,
  eu_risk_category TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eu_ai_act_audit_project_created
  ON eu_ai_act_audit_log (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eu_ai_act_audit_agent
  ON eu_ai_act_audit_log (project_id, agent_id, created_at DESC);
