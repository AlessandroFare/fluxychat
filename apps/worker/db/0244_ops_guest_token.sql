CREATE INDEX IF NOT EXISTS idx_ops_guests_token
  ON ops_guests (project_id, token_hash);
