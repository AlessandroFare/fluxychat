/**
 * Minimal chat shell for GET /embed/frame (iframe target).
 */

/**
 * @param {{
 *   primaryColor?: string,
 *   launcherTitle?: string,
 *   readOnly?: boolean,
 * }} options
 */
export function buildEmbedFrameHtml(options = {}) {
  const primaryColor = options.primaryColor || "#2563eb";
  const title = escapeHtml(options.launcherTitle || "Chat");
  const readOnly = Boolean(options.readOnly);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; height: 100vh; display: flex; flex-direction: column; }
    header { padding: 12px 16px; background: ${primaryColor}; color: #fff; font-weight: 600; font-size: 15px; }
    #status { padding: 8px 16px; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    #messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .msg { max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 14px; word-break: break-word; }
    .msg.them { align-self: flex-start; background: #fff; border: 1px solid #e2e8f0; }
    .msg.me { align-self: flex-end; background: ${primaryColor}; color: #fff; }
    .msg[data-streaming="1"] .msg-body::after { content: " ▍"; animation: blink 1s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .meta { font-size: 11px; opacity: 0.75; margin-bottom: 4px; }
    footer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e2e8f0; background: #fff; }
    footer input { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
    footer button { border: none; border-radius: 8px; padding: 10px 14px; background: ${primaryColor}; color: #fff; font-weight: 600; cursor: pointer; }
    footer button:disabled, footer input:disabled { opacity: 0.5; cursor: not-allowed; }
    #error { color: #b91c1c; padding: 8px 16px; font-size: 13px; display: none; }
  </style>
</head>
<body>
  <header>${title}</header>
  <div id="status">Connecting…</div>
  <div id="error"></div>
  <div id="messages" aria-live="polite"></div>
  <footer>
    <input id="input" type="text" placeholder="Type a message…" maxlength="4000" ${readOnly ? "disabled" : ""} />
    <button id="send" type="button" ${readOnly ? "disabled" : ""}>Send</button>
  </footer>
  <script>
(function () {
  var params = new URLSearchParams(location.search);
  var roomId = params.get("roomId") || "";
  var parentOrigin = params.get("parentOrigin") || "";
  var readOnly = ${readOnly ? "true" : "false"};
  var statusEl = document.getElementById("status");
  var errorEl = document.getElementById("error");
  var listEl = document.getElementById("messages");
  var inputEl = document.getElementById("input");
  var sendBtn = document.getElementById("send");
  var ws = null;
  var session = null;
  var seen = {};

  function setStatus(text) { statusEl.textContent = text; }
  function showError(text) {
    errorEl.style.display = "block";
    errorEl.textContent = text;
  }
  function appendMessage(msg, isMe) {
    if (!msg || !msg.content) return;
    var key = String(msg.id || msg.content + (msg.createdAt || ""));
    if (seen[key]) return;
    seen[key] = true;
    var wrap = document.createElement("div");
    wrap.className = "msg " + (isMe ? "me" : "them");
    if (msg.id != null) wrap.setAttribute("data-msg-id", String(msg.id));
    var meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = isMe ? "You" : (msg.userId || "Agent");
    var body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = msg.content;
    wrap.appendChild(meta);
    wrap.appendChild(body);
    listEl.appendChild(wrap);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function connectWs() {
    if (!session) return;
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    var url = proto + "//" + location.host + "/ws/room/" + encodeURIComponent(session.roomId) + "?token=" + encodeURIComponent(session.token) + "&replay=connect&historyLimit=40";
    ws = new WebSocket(url);
    ws.addEventListener("open", function () { setStatus("Connected"); });
    ws.addEventListener("close", function () { setStatus("Disconnected"); });
    ws.addEventListener("message", function (ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.type === "message") {
          appendMessage(data, data.userId === session.userId);
        } else if (data.type === "edit" && data.messageId != null) {
          var existing = listEl.querySelector('[data-msg-id="' + data.messageId + '"]');
          if (existing) {
            var bodyEl = existing.querySelector(".msg-body");
            if (bodyEl) bodyEl.textContent = data.content || bodyEl.textContent;
            if (data.streaming) existing.setAttribute("data-streaming", "1");
            else existing.removeAttribute("data-streaming");
          } else {
            appendMessage({ id: data.messageId, content: data.content || "…", userId: data.userId }, data.userId === session.userId);
            var created = listEl.querySelector('[data-msg-id="' + data.messageId + '"]');
            if (created && data.streaming) created.setAttribute("data-streaming", "1");
          }
          listEl.scrollTop = listEl.scrollHeight;
        } else if (data.type === "history" && Array.isArray(data.messages)) {
          data.messages.forEach(function (m) { appendMessage(m, m.userId === session.userId); });
        } else if (data.type === "replay" && Array.isArray(data.messages)) {
          data.messages.forEach(function (m) { appendMessage(m, m.userId === session.userId); });
        }
      } catch (e) {}
    });
  }

  function sendMessage() {
    if (readOnly || !ws || ws.readyState !== WebSocket.OPEN || !session) return;
    var text = (inputEl.value || "").trim();
    if (!text) return;
    inputEl.value = "";
    ws.send(JSON.stringify({
      type: "message",
      userId: session.userId,
      content: text,
      parentId: null,
      attachments: []
    }));
    appendMessage({ content: text, userId: session.userId }, true);
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage();
  });

  fetch("/public/embed-config")
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!roomId && cfg.defaultRoomId) roomId = cfg.defaultRoomId;
      if (!roomId) throw new Error("No room configured for embed");
      return fetch("/public/rooms/" + encodeURIComponent(roomId) + "/guest-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Guest",
          embedParentOrigin: parentOrigin || undefined
        })
      });
    })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || ("HTTP " + r.status)); });
      return r.json();
    })
    .then(function (body) {
      session = body;
      if (body.readOnly) {
        readOnly = true;
        inputEl.disabled = true;
        sendBtn.disabled = true;
      }
      connectWs();
    })
    .catch(function (err) {
      setStatus("Unable to connect");
      showError(err && err.message ? err.message : "Connection failed");
    });
})();
  </script>
</body>
</html>`;
}

/**
 * @param {string} raw
 */
function escapeHtml(raw) {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
