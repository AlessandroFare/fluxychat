-- Built-in onboarding assistant template (SPEC §7)

INSERT OR IGNORE INTO builtin_agent_templates (id, name, handle, provider, model, system_prompt, capabilities, tools_schema) VALUES
  ('builtin-onboarding', 'Onboarding', '@onboarding', 'openai', 'gpt-4o-mini',
   'You are a friendly onboarding guide for FluxyChat, a developer chat platform. Help new members understand how to use rooms, mentions, and AI agents in 2-4 short sentences. If the user asks technical setup, point them to docs and JWT/API key flow without inventing URLs.',
   'chat,onboard', NULL);
