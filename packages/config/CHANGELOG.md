# @fluxy-chat/config

## 0.1.5 (2026-10-05)

### Added

- Room and hosted overlay `makerChecker`.
- Agent `toolAutonomy` (`assist` | `recommend` | `act-with-approval` | `act-autonomous`). HITL still wins when `toolApproval` is `user-approval`.

## 0.1.4 (2026-09-30)

### Added

- `agents` / `FluxyAgentPolicy` (`toolApproval`, `opaUrl`, `toolAutonomy`, mention, tools, token cap).
- Room `makerChecker` (four-eyes; hosted overlay can carry the flag).
- `decisions` gates (System One).
- `jurisdiction: "eu"` hint for Wrangler DO limits.
