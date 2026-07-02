-- Per-project previous JWT secret for rotation (audit S-31).
-- Replaces the legacy global JWT_SECRET_PREVIOUS env variable with
-- nullable columns on project_secrets, keeping rotation scoped to
-- each tenant.

ALTER TABLE project_secrets ADD COLUMN jwt_secret_previous TEXT;
ALTER TABLE project_secrets ADD COLUMN jwt_secret_previous_expires_at TEXT;
