-- C3: Enterprise-Managed Authorization (EMA / cross-app access, ID-JAG).
-- A server registered with auth='enterprise' signs the user in at the
-- enterprise IdP and obtains an access token from the Resource Authorization
-- Server through an ID-JAG, instead of an authorization code at the AS.
--
-- Reused config columns keep their OAuth meaning:
--   oauth_authorize_url  -> IdP authorization endpoint
--   oauth_client_id/secret -> client registered at the IdP
--   oauth_token_url      -> Resource Authorization Server token endpoint
--   oauth_scopes         -> scopes requested at the Resource Server
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_idp_token_url TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_issuer TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_audience TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_jwks_url TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_resource_client_id TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_resource_client_secret_ciphertext TEXT;
ALTER TABLE ops_mcp_servers ADD COLUMN enterprise_resource_client_secret_iv TEXT;

-- The connect attempt remembers which flow minted it: the code comes from the
-- IdP in enterprise mode, from the AS in plain OAuth mode.
ALTER TABLE ops_mcp_oauth_states ADD COLUMN mode TEXT NOT NULL DEFAULT 'oauth';
