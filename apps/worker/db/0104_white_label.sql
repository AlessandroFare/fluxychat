-- P14-I: White-label SDK for Resellers
CREATE TABLE IF NOT EXISTS white_label_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  brand_name TEXT,
  brand_logo_url TEXT,
  brand_favicon_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#1f2937',
  font_family TEXT DEFAULT 'Inter, sans-serif',
  border_radius INTEGER DEFAULT 8,
  custom_css TEXT,
  custom_js TEXT,
  welcome_message TEXT,
  input_placeholder TEXT,
  show_branding INTEGER DEFAULT 1,
  show_powered_by INTEGER DEFAULT 1,
  allowed_origins TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS white_label_resellers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  reseller_name TEXT NOT NULL,
  reseller_email TEXT NOT NULL,
  reseller_domain TEXT,
  commission_percent REAL DEFAULT 0,
  max_projects INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wl_config_project ON white_label_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_wl_reseller_project ON white_label_resellers(project_id);
