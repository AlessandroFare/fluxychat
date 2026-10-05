-- Native push provider (expo / fcm-v1 / apns) on device_registrations.
-- HITL payloads stay generic; button actions POST a one-time token.

ALTER TABLE device_registrations ADD COLUMN push_backend TEXT;
