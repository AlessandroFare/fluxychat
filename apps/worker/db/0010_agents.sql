-- Extend bots into richer agents
ALTER TABLE bots ADD COLUMN handle TEXT;
ALTER TABLE bots ADD COLUMN provider TEXT;
ALTER TABLE bots ADD COLUMN model TEXT;
ALTER TABLE bots ADD COLUMN capabilities TEXT; -- comma-separated list, e.g. "chat,suggest,image"
ALTER TABLE bots ADD COLUMN config TEXT;       -- JSON string for per-bot configuration

