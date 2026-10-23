-- Per-document knowledge feedback (Onyx-style boost/hide): editors correct the
-- ranking of a specific document without re-ingesting it. Search normalization
-- drops hidden docs and moves boosted docs to the front after retrieval.
CREATE TABLE IF NOT EXISTS kb_doc_feedback (
  project_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('boost', 'hide')),
  actor TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, doc_id)
);
