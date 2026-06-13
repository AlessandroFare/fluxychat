-- P19-H: Room Templates per Vertical
CREATE TABLE IF NOT EXISTS room_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('support', 'events', 'community', 'auctions', 'ops', 'incident', 'onboarding', 'custom')),
  config TEXT NOT NULL DEFAULT '{}',
  is_system INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_room_template_category ON room_templates(category);
CREATE INDEX IF NOT EXISTS idx_room_template_project ON room_templates(project_id);
