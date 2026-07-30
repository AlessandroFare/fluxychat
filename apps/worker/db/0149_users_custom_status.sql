-- Custom user status (emoji + text + expiration)
ALTER TABLE users ADD COLUMN status_emoji TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN status_text TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN status_expiration INTEGER DEFAULT NULL;
