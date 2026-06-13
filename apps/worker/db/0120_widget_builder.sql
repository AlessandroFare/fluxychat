-- AI Widget Builder: create AI-powered widgets for websites

CREATE TABLE IF NOT EXISTS widget_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  agent_id TEXT,
  type TEXT NOT NULL DEFAULT 'chat' CHECK (type IN ('chat', 'popup', 'inline', 'sidebar', 'floating')),
  theme TEXT,
  position TEXT DEFAULT 'bottom-right',
  greeting TEXT,
  fallback_message TEXT,
  allowed_origins TEXT,
  embed_code TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_widget_project
  ON widget_configs (project_id, enabled);
CREATE UNIQUE INDEX IF NOT EXISTS idx_widget_slug
  ON widget_configs (project_id, slug);

CREATE TABLE IF NOT EXISTS widget_flows (
  id TEXT PRIMARY KEY,
  widget_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'greeting' CHECK (trigger_type IN ('greeting', 'keyword', 'button', 'page_url', 'idle')),
  trigger_value TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_widget_flow_widget
  ON widget_flows (widget_id, sort_order);

CREATE TABLE IF NOT EXISTS widget_themes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#0066ff',
  secondary_color TEXT DEFAULT '#f5f5f5',
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#333333',
  font_family TEXT DEFAULT 'Inter, sans-serif',
  border_radius INTEGER DEFAULT 12,
  bubble_size INTEGER DEFAULT 60,
  custom_css TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_widget_theme_project
  ON widget_themes (project_id, is_system);

CREATE TABLE IF NOT EXISTS widget_analytics (
  id TEXT PRIMARY KEY,
  widget_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'open', 'message', 'close', 'resolution', 'redirect')),
  session_id TEXT,
  metadata TEXT,
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_widget_analytics_project
  ON widget_analytics (project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_widget_analytics_widget
  ON widget_analytics (widget_id, event_type, recorded_at DESC);
