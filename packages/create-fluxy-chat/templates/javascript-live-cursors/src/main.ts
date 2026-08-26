import {
  FluxyChatClient,
  buildCursorOutbound,
  parseLiveCursorEvent,
} from "@fluxy-chat/sdk";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const publicRoomId = import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim();
const configuredRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "demo";

const statusEl = document.getElementById("status")!;
const canvas = document.getElementById("canvas")!;
const peers = new Map<string, HTMLDivElement>();

function renderCursor(userId: string, x: number, y: number, color?: string, label?: string) {
  let el = peers.get(userId);
  if (!el) {
    el = document.createElement("div");
    el.className = "peer-cursor";
    el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M5.5 3.2 19 12.4l-6.2 1.4 2.6 6.6-2.8 1.1-2.6-6.6L5.5 3.2Z" fill="currentColor"/></svg><span></span>`;
    canvas.appendChild(el);
    peers.set(userId, el);
  }
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color || "#2563eb";
  const span = el.querySelector("span");
  if (span) span.textContent = label || userId;
}

async function boot() {
  if (!workerUrl) {
    statusEl.textContent = "Set VITE_FLUXYCHAT_WORKER_URL";
    return;
  }

  let token = memberJwt;
  let userId = "demo-user";
  let roomId = configuredRoomId;

  if (!token && publicRoomId) {
    const guest = await FluxyChatClient.joinPublicRoomAsGuest(workerUrl, publicRoomId, {
      displayName: "Guest",
    });
    token = guest.token;
    userId = guest.userId;
    roomId = guest.roomId;
  }

  if (!token) {
    statusEl.textContent = "Set MEMBER_JWT or PUBLIC_ROOM_ID";
    return;
  }

  const client = new FluxyChatClient({ baseUrl: workerUrl, userId, token });
  const ws = client.connect(roomId, { replay: "off" });
  statusEl.textContent = `${roomId} · vanilla · two tabs`;

  ws.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }
    const cursor = parseLiveCursorEvent(parsed);
    if (!cursor || cursor.userId === userId) return;
    renderCursor(cursor.userId, cursor.x, cursor.y, cursor.color, cursor.label);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const rect = canvas.getBoundingClientRect();
    ws.send(
      JSON.stringify(
        buildCursorOutbound({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          color: "#2563eb",
          label: userId.slice(0, 12),
        }),
      ),
    );
  });
}

void boot();
