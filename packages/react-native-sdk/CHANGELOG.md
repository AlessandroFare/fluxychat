# @fluxy-chat/react-native-sdk

## 1.1.4 (2026-10-23)

### Fixed

- URL-encode room, message, poll and WebSocket path/query values so IDs or tokens containing `/`, `?`, `#`, `&`, `+` or `=` cannot address a different endpoint (audit F-92).

## 1.1.3 (2026-10-11)

### Changed

- Typed connection errors (`FluxyAuthError`, `FluxyConnectionError`, `FluxySendError`). Reconnect backoff matches the JS SDK (equal jitter).
