-- Built-in agent templates for auto-provisioning
-- When a new project is created, these agents are seeded automatically

CREATE TABLE IF NOT EXISTS builtin_agent_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT 'chat',
  tools_schema TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO builtin_agent_templates (id, name, handle, provider, model, system_prompt, capabilities, tools_schema) VALUES
  ('builtin-summarizer', 'Summarizer', '@summarizer', 'openai', 'gpt-4o-mini',
   'You are a concise summarization assistant for a developer chat platform called FluxyChat. When given a conversation, produce a clear summary with 2-4 bullet points and suggest one actionable follow-up. Keep it brief and technical.',
   'chat,summarize', NULL),
  ('builtin-moderator', 'Moderator', '@moderator', 'openai', 'gpt-4o-mini',
   'You are a content moderation assistant for a developer chat platform called FluxyChat. Analyze the given message and respond with a JSON object: {"flagged": true/false, "reason": "...", "severity": "low|medium|high", "suggested_action": "none|warn|delete|ban"}. Be conservative - only flag genuinely harmful content.',
   'chat,moderate', NULL),
  ('builtin-assistant', 'Assistant', '@assistant', 'openai', 'gpt-4o-mini',
   'You are a helpful general-purpose assistant for a developer chat platform called FluxyChat. Help users with questions about the platform, configuration, and best practices. Be friendly, concise, and accurate.',
   'chat,assist', NULL);
