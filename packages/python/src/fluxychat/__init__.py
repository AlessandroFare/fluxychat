"""FluxyChat Python client (join, token stream, tool events). Not a LangGraph host."""

from __future__ import annotations

from urllib.parse import urljoin
from urllib.request import Request, urlopen
import json

from .room import connect_room_ws

__all__ = ["FluxyChatClient", "connect_room_ws"]


class FluxyChatClient:
    def __init__(self, base_url: str, token: str, user_id: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.user_id = user_id

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def invoke_agent(self, agent_id: str, room_id: str, content: str) -> dict:
        url = urljoin(self.base_url + "/", f"agents/{agent_id}/invoke")
        body = json.dumps({"roomId": room_id, "content": content}).encode()
        req = Request(url, data=body, headers=self._headers(), method="POST")
        with urlopen(req) as res:
            return json.loads(res.read().decode())

    def list_active_streams(self, room_id: str | None = None) -> list:
        url = urljoin(self.base_url + "/", "ai/streams/active")
        if room_id:
            url = f"{url}?roomId={room_id}"
        req = Request(url, headers=self._headers(), method="GET")
        with urlopen(req) as res:
            payload = json.loads(res.read().decode())
        streams = payload.get("streams")
        return streams if isinstance(streams, list) else []

    def join_ag_ui(self, room_id: str) -> dict:
        url = urljoin(self.base_url + "/", "ag-ui/join")
        body = json.dumps({"roomId": room_id}).encode()
        req = Request(url, data=body, headers=self._headers(), method="POST")
        with urlopen(req) as res:
            return json.loads(res.read().decode())

    def ag_ui_events(self, room_id: str) -> dict:
        url = urljoin(self.base_url + "/", f"ag-ui/events?roomId={room_id}")
        req = Request(url, headers=self._headers(), method="GET")
        with urlopen(req) as res:
            return json.loads(res.read().decode())
