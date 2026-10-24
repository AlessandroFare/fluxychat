-- Audit #20: bound SMS OTP brute-force attempts per code row.
ALTER TABLE sms_otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
