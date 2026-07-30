# Vertical platform expansion

**Status:** Living document — branch `fluxy` (July 2026)  
**Scope:** ROADMAP §5.3–5.4 — FluxyHealth, FluxyEdu, FluxyEvent, FluxyFinance, Cross-Reality Continuity  
**Binding decisions:** [ROADMAP.md — Architectural Decisions Log](../../ROADMAP.md#architectural-decisions-log)  
**Expansion layer detail:** [platform-expansion-layer.md](./platform-expansion-layer.md)

---

## Executive summary

Fluxy is repositioned from “chat SDK” to a **realtime interaction platform** where the **room** remains the central primitive. Chat, video, collaboration, streaming, game backends, IoT, and industry verticals are **composable capabilities** registered on a shared room kernel—not separate products with duplicated auth or event models.

This document records:

1. An **audit matrix** (claim → code → UI → readiness).
2. **Current vs target architecture** and capability/event contracts.
3. **Vertical blueprints** (Edu first, then Health, Event, Finance, Continuity).
4. **Console IA** and **landing narrative** migration.
5. A **prioritized backlog** with acceptance criteria and honesty gates.

**Golden rule:** Nothing is labeled production unless persistence, authorization, tenancy, and tests exist. Client-only in-memory engines are **prototype** or **demo**, never implied backend.

---

## Positioning

| Before | After |
|--------|--------|
| Primary story: in-app chat + AI | Primary story: **one room**, many realtime outcomes |
| Dashboard = chat ops console | Dashboard = **multi-product console** (Build / Products / Industries / Labs) |
| New modules = large SDK files | New modules = **capability layer** + vertical workflows + Worker adapters (later) |

Chat stays the **fulcrum** (membership, messages, agents, webhooks). Verticals add domain events (attendance, consent, tickets, market alerts) on the same envelope.

---

## Audit matrix (summary)

Severity: **P0** security/correctness, **P1** misleading UX or data integrity, **P2** quality/gaps, **P3** polish.

| Area | Claim / surface | Code reality | Dashboard | Readiness | Severity | Remediation |
|------|-----------------|--------------|-----------|-----------|----------|-------------|
| **Room kernel** | Versioned events, idempotent publish | `createVerticalPlatform` client + Worker `POST/GET /rooms/:id/capabilities/events` | Vertical studios (sync badge) | **Beta (client + Worker audit)** | P2 | DO fan-out for live updates |
| **Polls** | Idempotent vote, close | Fixed in kernel + Stream/Game fixes | `/edu`, `/events`, stream demo | **Beta (client)** | — | Wire to room DO |
| **CRDT / whiteboard** | Yjs + Excalidraw collaboration | Yjs via `yjs-provider.tsx` + Worker `yjs-sync.js`; Excalidraw lazy-loaded (`collab-whiteboard.tsx`); mermaid→Excalidraw stubbed for build | `/collab` | **Beta** | P2 | Property tests on concurrent strokes |
| **FluxyStream** | Live polls, sentiment | In-memory `fluxy-stream.ts` | `/stream`, demo | **Prototype** | P1 | Poll close/vote fixes applied; backend TBD |
| **FluxyGame** | Authoritative tick, anti-cheat | In-memory `fluxy-game.ts` | `/game` interactive | **Prototype** | P1 | Duration/sequence/bounds fixes applied |
| **FluxyIoT** | Rule actions, device shadow | Rule actions execute; credentials stripped via `toPublicDevice()` | `/iot` | **Beta (demo)** | P2 | Worker device-shadow adapter |
| **FluxyEdu** | Class + attendance + grading | `vertical-workflows.ts` + studio | `/edu` live SDK demo | **Beta (demo)** | — | SFU + Yjs + Worker persistence |
| **FluxyHealth** | HIPAA | Synthetic demo only; explicit non-claim | `/health` | **Preview** | — | BAA gate before any HIPAA copy |
| **FluxyEvent** | Tickets, Q&A | Workflow + ticket verify (demo sig) | `/events` | **Beta (demo)** | — | Signed ticket adapter |
| **FluxyFinance** | Market + invoices | Decimal-safe drafts; no PAN | `/finance` | **Preview** | — | Provider adapters only |
| **Continuity** | Cross-device handoff | Checkpoints in kernel/workflow | `/continuity` | **Prototype** | P2 | DO canonical cursor + resume tokens |
| **SDK build** | `@fluxy-chat/sdk` compiles | `tsc` clean after export fixes | N/A | **Production (tooling)** | — | Maintain export hygiene |
| **Dashboard build** | Next.js production build | `next build` passes; Excalidraw kept; `@excalidraw/mermaid-to-excalidraw` pnpm stub (paste-Mermaid disabled) | All routes | **Production (tooling)** | — | Re-enable Mermaid import when d3/mermaid chain stabilizes |
| **Landing** | Platform not chat-only | Hero + `#platform` section | Marketing | **Beta** | P2 | Core Web Vitals + reduced motion pass |

Evidence paths:

- Kernel: `packages/sdk/src/vertical-platform.ts`, `vertical-workflows.ts`
- Tests: `vertical-platform.test.ts`, `vertical-workflows.test.ts`
- Console IA: `apps/dashboard/app/components/console-nav.ts`
- Studios: `apps/dashboard/app/components/vertical-studio.tsx`
- Products: `apps/dashboard/app/game`, `iot`, `stream/demo`

---

## Current vs target architecture

### Current (branch `fluxy`)

```mermaid
flowchart TB
  subgraph Client
    UI[Dashboard vertical studios]
    SDK[@fluxy-chat/sdk]
    VP[vertical-platform + workflows]
    Mod[fluxy-game / stream / iot / crdt]
  end
  UI --> SDK
  SDK --> VP
  SDK --> Mod
  Mod -.->|in-memory| VP
  Worker[apps/worker DO + D1] -->|chat core| SDK
```

### Target

```mermaid
flowchart TB
  subgraph Edge
    DO[Room DO - authority]
    Policy[Policy engine RBAC/ABAC]
    D1[(D1 audit / retention)]
    Adapters[SFU FHIR Ticketing Market IoT]
  end
  subgraph Client
    SDK[@fluxy-chat/sdk ports]
    UI[Console + vertical studios]
  end
  UI --> SDK
  SDK -->|versioned events| DO
  DO --> Policy
  DO --> D1
  DO --> Adapters
```

### Capability model

Capabilities are registered on `RoomKernelConfig` with `CapabilityDefinition`: `id`, `readiness`, `policy` (roles, retention, consent).

| CapabilityId | Typical verticals | Notes |
|--------------|-------------------|--------|
| chat, presence | All | Existing room core |
| video | Edu, Health, Event | SFU adapter (Metered.ca / configurable) |
| whiteboard | Edu, Collab | **Yjs** + snapshot every 1000 ops / 1h (ADL) |
| poll | Edu, Event, Stream | Shared idempotent poll primitive |
| attendance | Edu | Heartbeat events |
| clinical-data | Health | FHIR adapter; no PHI in message body |
| ticket | Event | Signed lifecycle; anti-replay |
| market-data | Finance | Sequence + stale handling |
| spatial, device-shadow | Continuity, IoT | Event-based critical; batch telemetry |

### Event envelope (v1)

All vertical workflow publishes use:

- `eventId`, `workspaceId`, `roomId`, `type`, `actor`, `occurredAt`, `schemaVersion: 1`, `idempotencyKey`, `payload`

Tenant mismatch throws; duplicate `idempotencyKey` returns existing event.

---

## Vertical blueprints

### FluxyEdu (priority 1 — MVP path)

**Journey:** Create class → live session → knowledge check → breakouts → session report (with human-approved grades).

**SDK:** `createVerticalWorkflow(VERTICAL_DEMO_SEEDS.edu)` — attendance, polls, breakouts, grade suggest/approve.

**Gates before “production”:**

- [ ] Yjs whiteboard adapter + snapshot policy
- [ ] SFU port for multiparty media (no hard-coded vendor)
- [ ] Attendance + poll events persisted on Worker
- [ ] AI grading: rubric + provenance; **no auto-publish** without educator approve (implemented in workflow)
- [ ] FERPA/COPPA configurable retention/consent/export

**Dashboard:** `/edu` — interactive studio drives real SDK events.

### FluxyHealth (preview)

**Journey:** Consent → care room → telehealth session → FHIR context → audit seal.

**Compliance boundary:** No “HIPAA compliant” marketing until BAA, risk assessment, and vendor chain are complete. Synthetic data only in UI.

### FluxyEvent (beta demo)

**Journey:** Ticket verify → lobby → stage live → moderated Q&A → recap.

Reuse corrected Stream/poll primitives; ticket provider as adapter.

### FluxyFinance (preview)

**Journey:** Market room → provider snapshot → risk alert → invoice approval → audit export.

No PAN storage; no auto-trade; “not financial advice” copy required.

### Cross-Reality Continuity (prototype)

**Journey:** Capability handshake → checkpoint → handoff → viewport resolve → canonical cursor.

Simulator validates protocol without XR headset; WebXR lazy-loaded when available.

---

## Console information architecture

Single console (no duplicate auth shells). Groups in `console-nav.ts`:

| Group | Purpose |
|-------|---------|
| **Build** | Overview, projects, rooms, inbox, agents, billing |
| **Products & tools** | Chat features, collab, stream, game, IoT, fleet, … |
| **Industries** | `/edu`, `/health`, `/events`, `/finance` |
| **Labs** | `/continuity`, spatial, transport |

Each industry route: overview studio, readiness badges, link to `/security` and docs.

**Follow-ups:** command palette entries, breadcrumb labels, overview shortcuts to Industries (see backlog).

---

## Landing & marketing

**Narrative:** “One room for chat and every realtime product.”

Implemented:

- Updated hero copy (`lib/marketing-landing.ts`)
- Product switcher in hero (`landing-hero-client.tsx`)
- `#platform` section — primitives, product suite, industry solutions with readiness chips (`landing-platform-section.tsx`)

**Follow-ups:** Hero mode animation (chat → classroom → event) with `prefers-reduced-motion`; structured data update; feature comparison rows for verticals.

---

## Compliance & claim policy

| Vertical | Allowed today | Forbidden until gated |
|----------|---------------|------------------------|
| Health | “Secure care preview”, synthetic data | “HIPAA compliant” |
| Finance | Educational preview, human approval flows | “PCI certified”, auto trading |
| Edu | Beta demo, FERPA/COPPA **configure before prod** | Implied school certification |
| Event | Demo ticketing | Production anti-scalp without signed adapter |

---

## Prioritized backlog

### Done (this expansion pass)

- [x] `vertical-platform` kernel + tests
- [x] `vertical-workflows` + demo seeds + tests
- [x] Interactive vertical studios wired to SDK + optional Worker sync
- [x] **Worker capability router** — `POST/GET /rooms/:id/capabilities/events`, D1 persistence, idempotency, policy gates (`capability-platform.js`)
- [x] SDK `createCapabilityClient` + `syncWorkflowEventsToWorker`
- [x] Provider adapter ports (`vertical-adapters.ts`) + demo adapters
- [x] Yjs collab port contract + snapshot policy (`yjs-collab.ts`); dashboard uses Yjs via `yjs-provider.tsx`
- [x] FluxyIoT rule action execution + credential redaction from public device model
- [x] Excalidraw whiteboard lazy-loaded; pnpm stub for `@excalidraw/mermaid-to-excalidraw` (build green; Mermaid paste disabled)
- [x] Dashboard `next build` passes (Turbopack)
- [x] `PLATFORM_READINESS` wired to landing `#platform` and console overview badges
- [x] Console **Operate** nav group + command palette Industries/Labs/Operate sections
- [x] Breadcrumbs show nav group (Build / Industries / Operate / …)
- [x] Landing hero **room mode strip** (chat → classroom → event → game → devices) with reduced-motion
- [x] SDK subpath exports: `@fluxy-chat/sdk/edu`, `/health`, `/event`, `/finance`, `/continuity`
- [x] FluxyEdu SFU demo adapter panel + related console links on all vertical studios
- [x] Console nav groups (Build / Products / Industries / Labs)
- [x] Landing platform section + hero repositioning
- [x] SDK `tsc` clean
- [x] DB migration `0156_room_capability_events.sql`
- [x] Capability DO fan-out + WS `capability_event`
- [x] Customer Memory Graph client (CDP + knowledge graph)
- [x] Moderation Labels API + rule builder (SDK)
- [x] Autonomous agent task bus (D1 `0157` + REST)
- [x] Digital Twin MCP tool registry

### Next — foundation (remaining for production)

1. ~~**DO fan-out for capability events**~~ — **Done:** `publishCapabilityEvent` → `fanoutRoomInternal` + WS `capability_event` in Room DO

### Platform expansion layer (July 2026)

| Layer | SDK | Worker | Status |
|-------|-----|--------|--------|
| Capability realtime | `onCapabilityEvent`, `isCapabilityRealtimeEvent` | `capability_event` broadcast | **Beta** |
| Customer Memory Graph | `createCustomerMemoryClient` (CDP + KG merge) | CDP `/api/cdp/*`, KG `/rooms/:id/kg` | **Beta** |
| Moderation Labels API | `createModerationLabelsClient`, `evaluateModerationRules` | `POST /moderation/labels` | **Beta** |
| Long-horizon agent tasks | `createWorkerAgentTaskClient` | `POST/PATCH /agents/tasks` + D1 `0157` | **Beta** |
| Digital Twin MCP | `createDigitalTwinMcpRegistry` | — (client twin; Worker persistence TBD) | **Preview** |

### Vertical production gates

| ID | Item | Depends on |
|----|------|------------|
| V-EDU-1 | Persist attendance + polls on Worker | Foundation #1 |
| V-EDU-2 | SFU adapter + captions hook | TURN/SFU vendor config |
| V-HEALTH-1 | Consent + audit export | Foundation #1, #2 |
| V-EVENT-1 | Ticket adapter + Q&A moderation queue | Foundation #1 |
| V-FIN-1 | Market data adapter + stale banner | External provider |
| V-CONT-1 | Resume token + checkpoint TTL on DO | Foundation #1 |

### IA & docs

- [x] `docs/guides/fluxy-edu-quickstart.md`
- [x] Overview page industry cards linking to `/edu` … `/continuity`
- [x] ROADMAP §5.3 status table (link here)

---

## Migration strategy

1. **No breaking SDK renames** for chat exports; vertical types added alongside.  
2. **Alias legacy exports** where renamed (`LlmProvider` → `AiProvider`, etc.).  
3. **Route compatibility** — existing `/collab`, `/stream` URLs unchanged.  
4. **Gradual Worker rollout** — feature flag per workspace capability.  
5. **Deprecate** custom CRDT for collaboration docs once Yjs path ships (document in CHANGELOG).

---

## References (2026 best practice)

- **Portal SDK** — competitive patterns adopted: [portal-sdk-comparison.md](../research/portal-sdk-comparison.md)
- **Yjs** — CRDT docs + snapshot truncation (ADL aligned)
- **SMART on FHIR** — clinical context by reference, not payload embedding
- **Cloudflare DO** — single-room authority; fan-out for scale (ADL)
- **Device shadow** — desired vs reported; vector clock for conflicts (ADL)
- **WCAG 2.2** — captions, keyboard, focus for Edu/Health surfaces

---

## Document maintenance

Update this file when:

- A vertical moves readiness tier (prototype → beta → production).
- Worker persistence lands for a capability.
- Audit finds new P0/P1 issues.

Short link in **ROADMAP.md §5.3** only — do not duplicate full content there.
