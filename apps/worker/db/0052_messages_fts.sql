-- P12-E: Full-text search on messages (D1 FTS5)
-- D1 remote: CREATE TRIGGER must be a single line; BEGIN/END uppercase (wrangler splitter).

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN INSERT INTO messages_fts(rowid, content) VALUES (new.id, coalesce(new.content, '')); END;

CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, coalesce(old.content, '')); END;

CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE OF content, deleted_at ON messages BEGIN INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, coalesce(old.content, '')); INSERT INTO messages_fts(rowid, content) SELECT new.id, coalesce(new.content, '') WHERE new.deleted_at IS NULL; END;

INSERT INTO messages_fts(messages_fts) VALUES ('rebuild');
