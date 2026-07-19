# Category G: Integration & Ecosystem

14 moduli per integrazione con piattaforme esterne, routing intelligente e testing.

---

## G-1: App Marketplace (`app-marketplace.ts`)
Marketplace per bot/app con manifest firmato, grants (8 scope), review workflow (approve/reject/changes_requested), install/uninstall/revoke, quota tracking per tenant.

```ts
const mp = createAppMarketplace();
mp.publish({ id: "my-bot", name: "My Bot", version: "1.0.0", grants: ["chat:write", "users:read"] });
const result = mp.review("my-bot", "approved");
mp.install("my-bot", "tenant-1");
```

## G-2: CRM/Helpdesk Integration (`crm-integration.ts`)
Integrazione con Salesforce/Zendesk/HubSpot/Intercom. Lookup/create contatti, create/update ticket, sync direction (in/out/bidirectional), sync history.

```ts
const crm = createCrmIntegration({ provider: "salesforce", apiKey: "sk-..." });
const contact = await crm.lookupContact("user@example.com");
const ticket = await crm.createTicket({ subject: "Bug", description: "..." });
```

## G-3: Custom Chatbot Builder (`chatbot-builder.ts`)
Trigger-action rule engine per chatbot. 6 event types (message_received, user_joined, user_left, reaction_added, ticket_created, schedule), 7 action types, condition eval, priority ordering, execution history.

```ts
const cb = createChatbotBuilder();
cb.addRule({
  name: "Greet new users", priority: 10,
  trigger: { event: "user_joined" },
  conditions: [{ field: "channel", operator: "eq", value: "welcome" }],
  actions: [{ type: "send_message", config: { text: "Welcome!" } }],
});
```

## G-4: Knowledge Base Integration (`knowledge-base.ts`)
Source connectors (Confluence/Notion/SharePoint/Google Drive), document ingest con chunking, semantic search (cosine similarity stub), RAG context builder, source management.

```ts
const kb = createKnowledgeBase();
kb.addSource({ type: "confluence", name: "Wiki", config: { spaceKey: "ENG" } });
await kb.ingestDocuments("src-1");
const results = await kb.search("How to deploy?", { topK: 5 });
```

## G-5: Custom Workflows/Automations (`automation-engine.ts`)
IF-THEN trigger-action engine. 9 trigger event types, 7 action types, cooldown per rule, priority ordering, execution history.

```ts
const ae = createAutomationEngine();
ae.addRule({
  name: "Escalate urgent tickets", trigger: { event: "ticket.created", conditions: [{ field: "priority", operator: "eq", value: "urgent" }] },
  actions: [{ type: "notify.slack", config: { channel: "#urgent" } }],
  cooldownMs: 60000,
});
```

## G-6: Agent Marketplace (`agent-marketplace.ts`)
Publish/search/install agent skills. 5 categories (customer-support, sales, productivity, analytics, custom), config templating, top-rated ranking.

```ts
const am = createAgentMarketplace();
am.publish({ id: "refund-agent", name: "Refund Handler", category: "customer-support", version: "1.0.0", author: "acme" });
const results = am.search({ category: "customer-support", query: "refund" });
am.install("refund-agent", "tenant-1");
```

## G-7: AI Provider Marketplace (`provider-marketplace.ts`)
Multi-LLM provider/models registry. BYO key management, active key toggle, per-key quota.

```ts
const pm = createProviderMarketplace();
pm.registerProvider({ id: "openai", name: "OpenAI", models: ["gpt-4", "gpt-3.5-turbo"] });
pm.addKey("openai", { key: "sk-...", model: "gpt-4" });
const model = pm.getActiveModel("openai", "gpt-4");
```

## G-8: Webhook Event Catalog (`webhook-catalog.ts`)
17 event types, retry config, batch delivery, HMAC-like signature, delivery log/history.

```ts
const wc = createWebhookEventCatalog();
wc.subscribe({ url: "https://example.com/hooks", events: ["message.sent", "user.joined"], retry: { maxAttempts: 3, backoffMs: 1000 } });
wc.deliver("message.sent", { text: "Hello" });
```

## G-9: Cross-Channel Continuity (`cross-channel.ts`)
Sessione utente unificata attraverso canali (web, mobile, voice, bot, email, sms). Link/unlink identità multi-canale, switch attivo, condivisione context tra sessioni, indicizzazione per lookup.

```ts
const ccc = createCrossChannelContinuity();
const session = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
ccc.linkIdentity(session.id, { channel: "mobile", externalId: "mobile-1" });
ccc.shareContext(session.id, otherSessionId);
```

## G-10: Customer Journey Mapping (`journey-mapping.ts`)
Tracciamento step del customer journey multi-canale. Pathway analysis con transition count/durata media, channel sequence detection, average steps per journey.

```ts
const jm = createJourneyMapping();
jm.recordStep("user-1", { channel: "web", action: "view", timestamp: Date.now(), durationMs: 500 });
jm.recordStep("user-1", { channel: "mobile", action: "purchase", timestamp: Date.now() + 10000 });
const paths = jm.getPaths(/*minTransitions=*/ 1);
```

## G-11: Expert Routing (`expert-router.ts`)
Skill-based agent routing con SLA policies. Scoring basato su skill match, carico, lingua, priorità. Weighted random assignment.

```ts
const er = createExpertRouter();
er.registerAgent({ id: "agent-1", name: "Alice", skills: ["billing"], skillLevels: { billing: "expert" }, maxConcurrentChats: 5, activeChats: 0, isAvailable: true, languages: ["en"] });
const result = er.findBestAgent({ userId: "user-1", requiredSkills: ["billing"], priority: "urgent" });
```

## G-12: A/B Testing Engine (`ab-testing.ts`)
Test engine con varianti multiple, weighted traffic split, exposure/conversion tracking, risultati con p-value stimato.

```ts
const ab = createAbTestingEngine();
const test = ab.createTest({
  name: "Theme Test",
  variants: [
    { id: "a", name: "Light", config: { theme: "light" }, trafficPercent: 50 },
    { id: "b", name: "Dark", config: { theme: "dark" }, trafficPercent: 50 },
  ],
  metric: "click_rate", minSampleSize: 100,
});
ab.startTest(test.id);
const variant = ab.assignVariant(test.id);
ab.recordExposure(test.id, variant.id);
```

## G-13: MCP Apps (`mcp-apps.ts`)
Model Context Protocol App support: tool meta inspection, visibility splitting (model vs app), resource reading da `ui://` URIs, sandboxed renderer.

```ts
const mgr = createMCPAppManager();
const isApp = mgr.isMCPAppTool(someTool);
const { modelVisible, appVisible } = mgr.splitTools(toolList);
```

## G-14: Resource Links (`resource-links.ts`)
URI validation con policy configurabile (allowed schemes, blocked domains, max redirects, content length). Resource link content type, lazy fetch con caching.

```ts
const rlm = createResourceLinkManager({ allowedSchemes: ["https"] });
const link = rlm.createLink({ uri: "https://example.com/doc", name: "Doc" });
const content = await rlm.fetchResource(link.uri);
```
