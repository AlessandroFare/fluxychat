-- P17-A: Queue Management + Workload Balancing
-- Intelligent chat-agent assignment with routing strategies and capacity tracking.

-- Routing rules per project
CREATE TABLE IF NOT EXISTS queue_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  strategy TEXT NOT NULL DEFAULT 'first_responder'
    CHECK(strategy IN ('first_responder', 'round_robin', 'skill_based', 'least_busy', 'manual')),
  priority INTEGER NOT NULL DEFAULT 0,
  sla_minutes INTEGER NOT NULL DEFAULT 15,
  escalation_sla_minutes INTEGER NOT NULL DEFAULT 30,
  required_capabilities TEXT,           -- JSON array: ["billing", "technical", "sales"]
  fallback_strategy TEXT CHECK(fallback_strategy IN ('first_responder', 'round_robin', 'skill_based', 'least_busy', 'manual')),
  fallback_agent_user_id TEXT,          -- last-resort human agent
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_rules_project ON queue_rules(project_id, enabled);

-- Per-agent capacity and routing state
CREATE TABLE IF NOT EXISTS agent_capacity (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  current_load INTEGER NOT NULL DEFAULT 0,
  capabilities TEXT,                    -- JSON array: ["billing", "technical", "sales"]
  is_available INTEGER NOT NULL DEFAULT 1,
  round_robin_index INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_capacity_project ON agent_capacity(project_id, is_available);

-- Assignment audit trail
CREATE TABLE IF NOT EXISTS conversation_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  task_id TEXT,
  agent_task_id TEXT,                   -- FK to agent_tasks.id
  assigned_to_user_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,            -- 'system' | 'manual' | 'escalation'
  strategy_used TEXT NOT NULL,
  sla_due_at TEXT,
  escalated_at TEXT,
  escalated_to_user_id TEXT,
  escalation_reason TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_assignments_project_room ON conversation_assignments(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_conv_assignments_agent ON conversation_assignments(project_id, assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_conv_assignments_active ON conversation_assignments(project_id, resolved_at) WHERE resolved_at IS NULL;
