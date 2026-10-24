-- Audit F-32: track the last accepted TOTP time step so codes are single-use.
ALTER TABLE admin_totp_secrets ADD COLUMN last_used_step INTEGER;
