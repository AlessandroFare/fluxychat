"""Hand-written room WebSocket. OpenAPI Generator cannot emit this."""

from __future__ import annotations


def connect_room_ws(worker_url: str, token: str, room_id: str):
    """Join `/ws/room/:id`. Requires extra `websockets`.

    Token stream and tool events still come as JSON frames on this socket.
    Generated REST clients (see scripts/generate-rest-sdks.md) do not replace this.
    """
    try:
        import websockets
    except ImportError as exc:
        raise RuntimeError("pip install websockets  (not generated from OpenAPI)") from exc

    base = worker_url.replace("https://", "wss://").replace("http://", "ws://").rstrip("/")
    url = f"{base}/ws/room/{room_id}?token={token}"
    return websockets.connect(url)
