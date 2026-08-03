# FluxyChat — Room Firmware, Merge-Conflict UI, Speculative Agent Warmup

> Complementare a roadmap e documenti FLUXYCHAT-* precedenti.
>
> Nota onestà: Room Firmware e Merge-Conflict UI sono composizioni
> originali. Speculative Warmup si basa su ricerca accademica 2025–2026
> (speculative agent execution) applicata al segnale "typing" edge-native.
>
> Vincolo: **zero budget**.

---

# 1. Room Firmware (`#47`)

## 1.1 Pitch

Modulo comportamento **sandboxato, versionato, portabile** per singola
room — intercetta/veta/modifica eventi **durante** il ciclo di vita, non
dopo come webhook.

## 1.2 vs Bot/Webhook

| | Bot/Webhook | Room Firmware |
|---|---|---|
| Timing | Dopo evento, async | Durante ciclo vita, sync |
| Scope | Tenant/servizio esterno | Allegato alla room |
| Portabilità | Si perde con export | Segue la room |
| Veto | No | Sì, pre fan-out |

## 1.3 Architettura

```
evento → Room DO → Firmware Sandbox (WASM, limiti CPU/mem/rete)
  → modified | vetoed | passed → fan-out
```

## 1.4 Sicurezza (non negoziabile)

- Nessun accesso rete dal WASM.
- Limiti CPU/mem/tempo — fail-open + log warning se timeout.
- Capability-based: dichiara letture/scritture esplicite.

## 1.5 Data model

```sql
CREATE TABLE room_firmware (
  room_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  wasm_module_hash TEXT NOT NULL,
  capabilities TEXT,
  created_by TEXT,
  created_at TEXT,
  enabled BOOLEAN DEFAULT true
);

CREATE TABLE room_firmware_audit (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  event_type TEXT,
  event_id TEXT,
  ts TEXT
);
```

Modulo WASM su R2; Room DO carica ed esegue in sandbox.

## 1.6 Esempi

- Compliance PII pre-invio.
- Rate limit NPC gaming.
- Max round negoziazione in Cross-Org Rooms (#32).

## 1.7 Fasi

| Fase | Contenuto | Effort |
|---|---|---|
| MVP | Read-only veto, 2–3 capability | 3–4 sett |
| V1 | Modifica evento + editor no-code regole comuni | 3 sett |
| V2 | Marketplace firmware condivisi | esplorativo |

**Priorità:** 🟢 Later · **Rischio:** superficie esecuzione codice — hardening obbligatorio

---

# 2. Merge-Conflict UI (`#48`)

## 2.1 Pitch

Quando CRDT/federazione produce conflitto **reale** (stesso slot logico,
contenuto diverso), UI esplicita stile git merge — non risoluzione
silenziosa per negoziazioni/compliance.

## 2.2 Architettura

```
Istanza A msg_x(v1) + Istanza B msg_x(v2)
  → Yjs merge → ConflictCandidate?
  → auto_resolvable=false → UI 2 colonne + "Tieni A" / "Tieni B" / "Unisci"
```

## 2.3 Rilevamento

```ts
interface ConflictCandidate {
  room_id: string;
  parent_message_id: string;
  version_a: { content: string; origin_instance: string; ts: string };
  version_b: { content: string; origin_instance: string; ts: string };
  auto_resolvable: boolean;
}
```

Solo conflitti "veri" — non ogni op CRDT commutativa.

## 2.4 Touchpoint

| Componente | Riuso |
|---|---|
| CRDT | `message-crdt-yjs.ts`, `yjs-message-list.js` |
| UI | stesso layout Counterfactual (#44) |
| Federazione | Matrix bridge (#16) |
| Audit | `audit-chain.js` |

## 2.5 Fasi

| Fase | Contenuto | Effort |
|---|---|---|
| MVP | Rilevamento + UI A/B | 2–3 sett |
| V1 | "Unisci entrambe" + storico | 1 sett |
| V2 | Soglie configurabili tenant | 1 sett |

**Priorità:** 🟡 Next

---

# 3. Typing-Triggered Speculative Agent Warmup (`#49`)

## 3.1 Pitch

Room DO specula tool/context **mentre l'utente digita** (throttled) —
al submit risposta quasi immediata se hit.

## 3.2 Base ricerca

Speculative Actions (2025–2026): 22–38% predizioni tool_call corrette;
contributo FluxyChat = trigger su **typing edge** (solo DO vicino utente).

## 3.3 Architettura

```
typing (500ms throttle) → Speculative Warmup
  → Vectorize retrieval pre-load (mai side-effect reali)
  → opzionale: tool selection su pattern noti
submit → hit: usa cache | miss: percorso normale
```

## 3.4 Data model

```ts
interface SpeculativeWarmup {
  room_id: string;
  user_id: string;
  partial_text: string;
  predicted_tool?: string;
  predicted_context_ids?: string[];
  speculation_started_at: string;
  outcome?: "hit" | "miss" | "discarded";
}
```

## 3.5 Guardrail

- Mai side-effect reali in speculazione.
- Non speculare se testo < 3–4 parole.
- Throttling obbligatorio.
- Telemetria hit/miss per disattivare se ROI basso.

## 3.6 Touchpoint

| Componente | Riuso |
|---|---|
| Typing WS | presence esistente |
| Retrieval | `message-embeddings.js`, Vectorize |
| Telemetria | `otel-export.js` |
| Agente reale | `WorkflowAgent` + contesto pre-caricato |

## 3.7 Fasi

| Fase | Contenuto | Effort |
|---|---|---|
| MVP | Solo Vectorize retrieval + hit/miss | 2–3 sett |
| V1 | Tool selection pattern noti | 1–2 sett |
| V2 | Auto-tuning soglie per tenant | esplorativo |

**Priorità:** 🟡 Next · **Rischio:** token sprecati — misurare hit rate

---

# Riepilogo

| Feature | ID | Priorità | Effort MVP | Rischio |
|---|---|---|---|---|
| Room Firmware | #47 | 🟢 Later | 3–4 sett | Sicurezza sandbox |
| Merge-Conflict UI | #48 | 🟡 Next | 2–3 sett | UX rumore se troppo sensibile |
| Speculative Warmup | #49 | ✅ MVP | 2–3 sett | Costo token |

---

*Aggiornato: 2026-08-03.*
