# @fluxy-chat/protocol

## 0.1.7 (2026-10-10)

### Added

- Error catalog helpers used by the SDK (`error-codes`).
- Occupancy / lock / resume-related inbound names already on the Room DO.

Publish this **before** `@fluxy-chat/sdk@0.6.15`.

## 0.1.6 (2026-09-30)

### Added

- Inbound `derived`, outbound `derived_set` in `protocol-events.json` (Room DO already used these names).

Publish this **before** `@fluxy-chat/sdk@0.6.13`.

## 0.1.5 (2026-08-27)

### Added

- Inbound event aliases used by the Room DO (`message_updated`, `message_deleted`, `derived`, stream resume types).
- Tighter inbound frame parsing for those events.

Publish this **before** `@fluxy-chat/sdk@0.6.5`.
