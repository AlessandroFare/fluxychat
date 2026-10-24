-- Per-user OAuth passthrough for the ops MCP gateway. A server registered with
-- auth='oauth' is called with the run actor's own access token instead of a
-- shared bearer secret, so the upstream enforces that user's permissions.
-- Access/refresh tokens and the PKCE verifier are AES-GCM encrypted with
-- WEBHOOK_SECRET_ENCRYPTION_KEY; the OAuth state is stored only as a hash.
ALTER TABLE ops_mcp_servers ADD COLUMN auth TEXT NOT NULL DEFAULT 'secret';
ALTER TABLE ops_mcp_servers ADD COLUMN oauth_client_id TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN oauth_client_secret_ciphertext TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN oauth_client_secret_iv TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN oauth_authorize_url TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN oauth_token_url TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN oauth_scopes TEXT;

CREATE TABLE IF NOT EXISTS ops_mcp_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_ciphertext TEXT NOT NULL,
  access_iv TEXT NOT NULL,
  refresh_ciphertext TEXT,
  refresh_iv TEXT,
  scopes TEXT,
  token_type TEXT,
  token_url TEXT,
  client_id TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_mcp_connections_user
  ON ops_mcp_connections (project_id, server_id, user_id);

-- Connect attempts in flight. state_hash is SHA-256(state): a database copy
-- cannot be replayed against the callback.
CREATE TABLE IF NOT EXISTS ops_mcp_oauth_states (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL,
  project_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  verifier_ciphertext TEXT NOT NULL,
  verifier_iv TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  token_url TEXT NOT NULL,
  client_id TEXT,
  expire_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_mcp_oauth_states_hash
  ON ops_mcp_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS idx_ops_mcp_oauth_states_expire
  ON ops_mcp_oauth_states (expire_at);
