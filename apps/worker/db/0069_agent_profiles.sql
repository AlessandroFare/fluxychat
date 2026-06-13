-- P17-F: Custom Agent Behavior Profiles
-- Configurable tone, verbosity, policy constraints, and A/B testing.

-- Profile definitions per project
CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Tone & style
  tone TEXT NOT NULL DEFAULT 'professional'
    CHECK(tone IN ('professional', 'friendly', 'formal', 'casual', 'empathetic', 'technical')),
  verbosity TEXT NOT NULL DEFAULT 'balanced'
    CHECK(verbosity IN ('concise', 'balanced', 'detailed')),
  -- Behavior
  follow_up_style TEXT NOT NULL DEFAULT 'proactive'
    CHECK(follow_up_style IN ('proactive', 'reactive', 'minimal')),
  escalation_threshold TEXT NOT NULL DEFAULT 'medium'
    CHECK(escalation_threshold IN ('low', 'medium', 'high', 'never')),
  -- Policy constraints (JSON)
  policy_constraints TEXT,  -- { "max_response_length": 500, "allowed_topics": [...], "blocked_topics": [...], "require_human_for": [...] }
  -- Business objectives (JSON)
  business_objectives TEXT, -- { "priority": "resolution_speed" | "satisfaction" | "upsell", "kpi_targets": {...} }
  -- Prompt customizations
  system_prompt_addendum TEXT, -- extra instructions appended to system prompt
  -- A/B testing
  ab_test_weight INTEGER NOT NULL DEFAULT 100, -- percentage allocation (0-100)
  -- Metadata
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_project ON agent_profiles(project_id, enabled);

-- Per-room profile assignment
CREATE TABLE IF NOT EXISTS room_profile_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,           -- FK to agent_profiles.id
  assigned_by TEXT NOT NULL,          -- 'manual' | 'auto' | 'ab_test'
  ab_test_group TEXT,                 -- 'A' | 'B' | null
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_profile_project ON room_profile_assignments(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_room_profile_id ON room_profile_assignments(profile_id);
