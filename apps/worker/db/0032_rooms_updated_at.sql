-- Room rename / PATCH support (dashboard /rooms editor)
ALTER TABLE rooms ADD COLUMN updated_at TEXT;
