# Public contract & changelog policy

Questa policy definisce come evolvono gli **endpoint pubblici** (`/agents`, `/stats/*`, SDK) senza rompere integrazioni.

## Ambito “public”

Consideriamo **public contract**:

- HTTP API:
  - `/auth/token`
  - `/messages`, `/rooms`, `/ws/room/*`
  - `/agents*`
  - `/stats/*`
- Webhook payload + headers (`X-Fluxy-*`)
- SDK (`@fluxychat/sdk`): API pubbliche exportate

## Versioning

- **SDK**: Semantic Versioning (SemVer) `MAJOR.MINOR.PATCH`
  - **PATCH**: bugfix, docs, performance, nessuna breaking change
  - **MINOR**: nuove feature compatibili, nuovi campi/endpoint opzionali
  - **MAJOR**: breaking changes (rimozioni, rename, cambi semantici)
- **HTTP API**: default “v1 compatibile”
  - Breaking changes solo con nuova base path (es. `/v2/...`) o dietro feature flag esplicito.

## Regole di compatibilità (HTTP)

Consentito senza bump major:

- aggiungere nuovi campi JSON
- aggiungere nuovi endpoint
- aggiungere nuovi valori opzionali per campi esistenti
- aggiungere nuove header non richieste

Breaking change (da evitare in v1):

- rimuovere/renominare campi o endpoint
- cambiare significato di un campo (semantica)
- rendere obbligatorio un campo prima opzionale
- cambiare codici HTTP di successo/errore in modo incompatibile

## Deprecation policy

Quando si depreca:

- mantenere la compatibilità per almeno **1 minor release (SDK)** o **30 giorni** (HTTP) prima di rimozione.
- documentare in `CHANGELOG.md`:
  - cosa è deprecato
  - alternativa
  - data target di rimozione

Esempio:

- `/bots/*` resta compatibile ma **deprecato** a favore di `/agents/*`.

## Error contract

Regole:

- risposte JSON di errore devono avere `error` stringa stabile quando possibile
- `401` = auth mancante/invalid/expired
- `403` = forbidden (role/membership)
- `429` = rate limited (sempre con `Retry-After`)

## Changelog

- ogni rilascio significativo aggiorna `CHANGELOG.md`
- includere:
  - Added / Changed / Fixed / Deprecated / Removed / Security
  - note migrazioni D1 (tag/migration id)

