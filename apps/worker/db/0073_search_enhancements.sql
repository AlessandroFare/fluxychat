-- P17-I: Searchable History Improved
-- Saved searches, search folders, and entity search

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  filters_json TEXT,
  is_shared INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_project_user ON saved_searches(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_project_shared ON saved_searches(project_id, is_shared) WHERE is_shared = 1;

CREATE TABLE IF NOT EXISTS search_folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_search_folders_project_user ON search_folders(project_id, user_id);

CREATE TABLE IF NOT EXISTS search_folder_items (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES search_folders(id) ON DELETE CASCADE,
  search_id TEXT NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(folder_id, search_id)
);

CREATE INDEX IF NOT EXISTS idx_search_folder_items_folder ON search_folder_items(folder_id);
