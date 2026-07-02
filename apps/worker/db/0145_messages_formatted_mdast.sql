-- P22-E1: Add mdast AST as canonical message format.
-- Adds `formatted_json` column to store mdast Root node for structured messages.
-- Enables cross-platform rendering, semantic search on AST nodes, and
-- programmatic message manipulation.

ALTER TABLE messages ADD COLUMN formatted_json TEXT;
