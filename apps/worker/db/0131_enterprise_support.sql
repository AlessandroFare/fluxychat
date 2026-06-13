-- Enterprise Support

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ticket_number INTEGER,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal', 'critical', 'blocker')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed')),
  category TEXT,
  product_area TEXT,
  reported_by TEXT NOT NULL,
  assigned_to TEXT,
  assigned_group TEXT,
  channel TEXT DEFAULT 'web' CHECK (channel IN ('web', 'email', 'phone', 'chat', 'api', 'in_app')),
  sla_response_at TEXT,
  sla_resolve_at TEXT,
  first_response_at TEXT,
  resolved_at TEXT,
  closed_at TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_comment TEXT,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_project
  ON support_tickets (project_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_support_ticket_number
  ON support_tickets (project_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_ticket_assigned
  ON support_tickets (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_sla
  ON support_tickets (sla_response_at, sla_resolve_at, status);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'ai')),
  sender_id TEXT,
  content TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  attachments TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_msg_ticket
  ON support_ticket_messages (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_escalation_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL,
  actions TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_esc_project
  ON support_escalation_rules (project_id, enabled, priority DESC);

CREATE TABLE IF NOT EXISTS support_sla_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  priority TEXT NOT NULL,
  response_time_hours INTEGER NOT NULL,
  resolve_time_hours INTEGER NOT NULL,
  business_hours_only INTEGER NOT NULL DEFAULT 1,
  holiday_excluded INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_sla_project
  ON support_sla_policies (project_id, priority);

CREATE TABLE IF NOT EXISTS support_knowledge_base (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_kb_project
  ON support_knowledge_base (project_id, status, category);
CREATE INDEX IF NOT EXISTS idx_support_kb_search
  ON support_knowledge_base (title, tags);

CREATE TABLE IF NOT EXISTS support_satisfaction_surveys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  survey_type TEXT NOT NULL DEFAULT 'post_resolution' CHECK (survey_type IN ('post_resolution', 'post_interaction', 'nps', 'csat')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  feedback TEXT,
  responded_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_survey_project
  ON support_satisfaction_surveys (project_id, survey_type);
CREATE INDEX IF NOT EXISTS idx_support_survey_ticket
  ON support_satisfaction_surveys (ticket_id);
