type TemplateFiles = Record<string, string>;

type FluxyTemplate = {
  id: string;
  label: string;
  description: string;
  icon: string;
  project: {
    title: string;
    description?: string;
    template: string;
    dependencies?: Record<string, string>;
    files: TemplateFiles;
  };
};

function tmpl(strings: TemplateStringsArray, ...values: unknown[]) {
  let r = "";
  for (let i = 0; i < strings.length; i++) {
    r += strings[i];
    if (i < values.length) r += String(values[i]);
  }
  return r;
}

const WC_BASE_URL = "https://api.fluxychat.com";

/** Keep in lockstep with published @fluxy-chat/* (publish sdk/react/protocol before relying on StackBlitz). */
const FLUXY_SDK = "^0.6.4";
const FLUXY_REACT = "^0.1.4";
const FLUXY_PROTOCOL = "^0.1.5";

export const STACKBLITZ_TEMPLATES: FluxyTemplate[] = [
  {
    id: "basic-connection",
    label: "Basic Connection",
    description: "Connect to FluxyChat, join a room, and send/receive messages",
    icon: "Zap",
    project: {
      title: "FluxyChat Basic Connection",
      description: "Connect to FluxyChat, join a room, send and receive messages",
      template: "javascript",
      dependencies: {
        "@fluxy-chat/sdk": FLUXY_SDK,
        "@fluxy-chat/protocol": FLUXY_PROTOCOL,
      },
      files: {
        "index.html": tmpl`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FluxyChat: Basic Connection</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="container">
    <header>
      <h1>FluxyChat</h1>
      <p class="subtitle">Basic connection demo</p>
    </header>
    <main>
      <div class="status-bar" id="status">
        <span class="dot offline"></span>
        <span id="statusText">Disconnected</span>
      </div>
      <div class="chat-box" id="chatBox">
        <div class="empty-state">
          <p>Connect to join the room and start chatting</p>
        </div>
      </div>
      <div class="composer">
        <input type="text" id="messageInput" placeholder="Type a message..." disabled />
        <button id="sendBtn" disabled>Send</button>
      </div>
      <button id="connectBtn" class="connect-btn">Connect to Room</button>
    </main>
  </div>
  <script type="module" src="index.js"></script>
</body>
</html>`,
        "style.css": tmpl`* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}
.container {
  max-width: 600px;
  width: 100%;
}
header { text-align: center; margin-bottom: 1.5rem; }
header h1 {
  font-size: 1.75rem;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.subtitle { color: #64748b; font-size: 0.875rem; margin-top: 0.25rem; }
.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #1e293b;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot.online { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
.dot.offline { background: #64748b; }
.dot.connecting { background: #eab308; animation: pulse 1s infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.chat-box {
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1rem;
  min-height: 300px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 0.875rem;
}
.message {
  padding: 0.625rem 0.875rem;
  border-radius: 1rem;
  max-width: 80%;
  font-size: 0.875rem;
  line-height: 1.4;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.message.mine {
  align-self: flex-end;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border-bottom-right-radius: 0.25rem;
}
.message.theirs {
  align-self: flex-start;
  background: #334155;
  color: #e2e8f0;
  border-bottom-left-radius: 0.25rem;
}
.message .author { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; opacity: 0.8; }
.message .time { font-size: 0.625rem; opacity: 0.5; margin-top: 0.25rem; text-align: right; }
.composer {
  display: flex;
  gap: 0.5rem;
}
.composer input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
}
.composer input:focus { border-color: #3b82f6; }
.composer input:disabled { opacity: 0.5; }
.composer button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.composer button:disabled { opacity: 0.4; cursor: not-allowed; }
.composer button:not(:disabled):hover { opacity: 0.9; }
.connect-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.875rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.connect-btn:hover { opacity: 0.9; }
.connect-btn:disabled { opacity: 0.4; cursor: not-allowed; }`,
        "index.js": tmpl`import { FluxyChatClient } from "@fluxy-chat/sdk";

// ── Configuration ────────────────────────────────────
// Replace with your own values or use the hosted demo endpoint.
const BASE_URL = "${WC_BASE_URL}";

// ── State ────────────────────────────────────────────
let client = null;
let currentRoomId = null;
let guestUserId = null;
let messages = [];
let isConnected = false;

// ── DOM refs ─────────────────────────────────────────
const chatBox = document.getElementById("chatBox");
const statusText = document.getElementById("statusText");
const statusDot = document.querySelector(".dot");
const connectBtn = document.getElementById("connectBtn");
const sendBtn = document.getElementById("sendBtn");
const messageInput = document.getElementById("messageInput");

// ── Helpers ──────────────────────────────────────────
function setStatus(text, type) {
  statusText.textContent = text;
  statusDot.className = "dot " + type;
}

function renderMessages() {
  if (messages.length === 0) {
    chatBox.innerHTML = '<div class="empty-state"><p>No messages yet. Send one!</p></div>';
    return;
  }
  chatBox.innerHTML = messages.map((m) => {
    const isMine = m.userId === guestUserId;
    const time = new Date(m.timestamp).toLocaleTimeString();
    return \`<div class="message \${isMine ? "mine" : "theirs"}">
      \${!isMine ? '<div class="author">' + m.userName + '</div>' : ""}
      <div>\${m.content}</div>
      <div class="time">\${time}</div>
    </div>\`;
  }).join("");
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function mintDemoSession() {
  const res = await fetch(BASE_URL + "/demo/session");
  if (!res.ok) {
    throw new Error(
      "Public demo unavailable. Enable DEMO_ENABLED on the Worker, or use POST /auth/token with your fc_ API key."
    );
  }
  const data = await res.json();
  if (!data.token) throw new Error("Demo session disabled on this deployment");
  return data;
}

// ── Connection ────────────────────────────────────────
async function connect() {
  connectBtn.disabled = true;
  connectBtn.textContent = "Connecting...";
  setStatus("Connecting...", "connecting");

  try {
    const session = await mintDemoSession();
    guestUserId = session.userId;
    currentRoomId = session.roomId;
    client = new FluxyChatClient({
      baseUrl: BASE_URL,
      userId: session.userId,
      token: session.token,
    });

    const room = client.joinRoom(currentRoomId);

    // Listen for messages
    room.onMessage((msg) => {
      messages.push({
        id: msg.id,
        userId: msg.userId,
        userName: msg.userName || msg.userId,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
      });
      renderMessages();
    });

    room.onPresence((event) => {
      console.log("Presence:", event);
    });

    setStatus("Connected to " + currentRoomId, "online");
    isConnected = true;
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
    connectBtn.textContent = "Connected ✓";
  } catch (err) {
    console.error("Connection error:", err);
    setStatus("Connection failed: " + err.message, "offline");
    connectBtn.disabled = false;
    connectBtn.textContent = "Retry Connection";
  }
}

// ── Send ─────────────────────────────────────────────
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !client || !currentRoomId) return;

  try {
    messageInput.value = "";
    await client.sendMessage(currentRoomId, text);
  } catch (err) {
    console.error("Send error:", err);
  }
}

// ── Event listeners ─────────────────────────────────
connectBtn.addEventListener("click", connect);
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

console.log("FluxyChat demo ready. Click Connect to start.");
console.log("FluxyChat StackBlitz: uses GET /demo/session guest JWT");`,
        "package.json": JSON.stringify(
          {
            name: "fluxychat-basic-connection",
            private: true,
            scripts: {
              start: "npx serve .",
            },
            dependencies: {
              "@fluxy-chat/sdk": FLUXY_SDK,
            },
            overrides: {
              "@fluxy-chat/protocol": FLUXY_PROTOCOL,
            },
          },
          null,
          2,
        ),
      },
    },
  },
  {
    id: "react-chat-ui",
    label: "React Chat UI",
    description: "Full React app with useChat hook, room list, and message history",
    icon: "Code2",
    project: {
      title: "FluxyChat React Chat",
      description: "React chat app using @fluxy-chat/sdk useChat hook",
      template: "create-react-app",
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-scripts": "5.0.1",
        "@fluxy-chat/sdk": FLUXY_SDK,
        "@fluxy-chat/react": FLUXY_REACT,
        "@fluxy-chat/protocol": FLUXY_PROTOCOL,
      },
      files: {
        "src/App.js": tmpl`import React, { useState, useEffect, useCallback } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";
import "./App.css";

const BASE_URL = "${WC_BASE_URL}";
const ROOMS = ["general", "random", "support"];

function Login({ onLogin, loading, error }) {
  const [name, setName] = useState("");

  return (
    <div className="login">
      <div className="login-card">
        <h1>FluxyChat</h1>
        <p className="subtitle">Enter your name to join</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onLogin(name.trim());
          }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Connecting..." : "Join Chat"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

function RoomList({ rooms, activeRoom, onJoin }) {
  return (
    <div className="room-list">
      <h3>Rooms</h3>
      {rooms.map((r) => (
        <button
          key={r}
          className={"room-item" + (r === activeRoom ? " active" : "")}
          onClick={() => onJoin(r)}
        >
          # {r}
        </button>
      ))}
    </div>
  );
}

function ChatRoom({ roomId, client, userId }) {
  const { messages, sendMessage, connectionState, stopAgentStream } = useChat({
    roomId,
    client,
    replay: "connect",
  });
  const [input, setInput] = useState("");
  const listRef = React.useRef(null);
  const isStreaming = messages.some((m) => m.streaming);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  }, [input, sendMessage]);

  return (
    <div className="chat-room">
      <div className="room-header">
        <h2># {roomId}</h2>
        <span className={"status " + connectionState.status}>
          {connectionState.status}
        </span>
        {isStreaming ? (
          <button type="button" onClick={() => stopAgentStream()}>Stop</button>
        ) : null}
      </div>
      <div className="messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">No messages yet. Say hello!</div>
        )}
        {messages.map((m, i) => {
          const isMe = m.userId === userId;
          return (
            <div
              key={m.id || i}
              className={"message" + (isMe ? " mine" : " theirs")}
            >
              {!isMe && <div className="author">{m.userName || m.userId}</div>}
              <div className="bubble">{m.content}</div>
              <div className="time">
                {m.timestamp
                  ? new Date(m.timestamp).toLocaleTimeString()
                  : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="composer">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button onClick={handleSend} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [activeRoom, setActiveRoom] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (name) => {
    setLoading(true);
    setError(null);
    const userId = name.toLowerCase().replace(/\\s+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
    try {
      const session = await mintDemoSession();
      const c = new FluxyChatClient({
        baseUrl: BASE_URL,
        userId: session.userId,
        token: session.token,
      });
      setUser(name || session.userId);
      setClient(c);
      setActiveRoom(session.roomId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Login onLogin={handleLogin} loading={loading} error={error} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="user-info">
          <div className="avatar">{user[0].toUpperCase()}</div>
          <span>{user}</span>
        </div>
        <RoomList rooms={ROOMS} activeRoom={activeRoom} onJoin={setActiveRoom} />
      </aside>
      <main className="main">
        <ChatRoom roomId={activeRoom} client={client} userId={user} />
      </main>
    </div>
  );
}`,
        "src/App.css": tmpl`* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
}
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.login-card {
  background: #1e293b;
  border-radius: 1rem;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
  text-align: center;
}
.login-card h1 {
  font-size: 2rem;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.subtitle { color: #64748b; margin: 0.5rem 0 1.5rem; }
.login-card form { display: flex; flex-direction: column; gap: 0.75rem; }
.login-card input {
  padding: 0.75rem 1rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  outline: none;
}
.login-card input:focus { border-color: #3b82f6; }
.login-card button {
  padding: 0.75rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 0.5rem;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.login-card button:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #ef4444; font-size: 0.8rem; }
.app { display: flex; height: 100vh; }
.sidebar {
  width: 220px;
  background: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #334155;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
}
.room-list h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}
.room-item {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: #94a3b8;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}
.room-item:hover { background: #334155; color: #e2e8f0; }
.room-item.active { background: #3b82f620; color: #60a5fa; }
.main { flex: 1; display: flex; flex-direction: column; }
.chat-room { flex: 1; display: flex; flex-direction: column; }
.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #334155;
}
.room-header h2 { font-size: 1.125rem; }
.status {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  text-transform: capitalize;
}
.status.connected { background: #22c55e20; color: #22c55e; }
.status.connecting { background: #eab30820; color: #eab308; }
.status.disconnected { background: #64748b20; color: #64748b; }
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
}
.message { max-width: 75%; }
.message.mine { align-self: flex-end; }
.message.theirs { align-self: flex-start; }
.author { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; color: #60a5fa; }
.bubble {
  padding: 0.5rem 0.875rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  line-height: 1.4;
}
.mine .bubble {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border-bottom-right-radius: 0.25rem;
}
.theirs .bubble {
  background: #334155;
  color: #e2e8f0;
  border-bottom-left-radius: 0.25rem;
}
.time { font-size: 0.625rem; opacity: 0.5; margin-top: 0.25rem; }
.composer {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #334155;
}
.composer input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  outline: none;
}
.composer input:focus { border-color: #3b82f6; }
.composer button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.composer button:disabled { opacity: 0.4; cursor: not-allowed; }`,
        "public/index.html": tmpl`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FluxyChat React Demo</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        "src/index.js": tmpl`import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        "package.json": JSON.stringify(
          {
            name: "fluxychat-react-chat",
            private: true,
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              "react-scripts": "5.0.1",
              "@fluxy-chat/sdk": FLUXY_SDK,
              "@fluxy-chat/protocol": FLUXY_PROTOCOL,
            },
            overrides: {
              "@fluxy-chat/protocol": FLUXY_PROTOCOL,
            },
            scripts: {
              start: "react-scripts start",
              build: "react-scripts build",
            },
          },
          null,
          2,
        ),
      },
    },
  },
  {
    id: "agent-chat",
    label: "AI Agent Chat",
    description: "Chat with an AI agent using streaming markdown and tool calls",
    icon: "Bot",
    project: {
      title: "FluxyChat AI Agent",
      description: "Chat with an AI agent using @fluxy-chat/sdk",
      template: "create-react-app",
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-scripts": "5.0.1",
        "@fluxy-chat/sdk": FLUXY_SDK,
        "@fluxy-chat/react": FLUXY_REACT,
        "@fluxy-chat/protocol": FLUXY_PROTOCOL,
      },
      files: {
        "src/App.js": tmpl`import React, { useState, useEffect, useRef, useCallback } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";
import "./App.css";

const BASE_URL = "${WC_BASE_URL}";

async function mintDemoSession() {
  const res = await fetch(BASE_URL + "/demo/session");
  if (!res.ok) throw new Error("Public demo unavailable on this Worker");
  const data = await res.json();
  if (!data.token) throw new Error("Demo disabled");
  return data;
}

export default function App() {
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [agentRoomId, setAgentRoomId] = useState("agent-demo");

  const [guestUserId, setGuestUserId] = useState(null);

  useEffect(() => {
    async function init() {
      setConnecting(true);
      try {
        const session = await mintDemoSession();
        setAgentRoomId(session.roomId);
        setGuestUserId(session.userId);
        const c = new FluxyChatClient({
          baseUrl: BASE_URL,
          userId: session.userId,
          token: session.token,
        });
        setClient(c);
        setConnected(true);
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setConnecting(false);
      }
    }
    init();
  }, []);

  if (!client) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>{connecting ? "Connecting to agent room..." : "Initializing..."}</p>
      </div>
    );
  }

  return <AgentChat client={client} roomId={agentRoomId} userId={guestUserId} />;
}

function AgentChat({ client, roomId, userId }) {
  const { messages, sendMessage, connectionState, stopAgentStream } = useChat({
    roomId,
    client,
    replay: "connect",
  });
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const isStreaming = messages.some((m) => m.streaming);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  }, [input, sendMessage]);

  const isAgentTyping = messages.length > 0 && messages[messages.length - 1]?.userId !== userId;

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <div className="logo">FluxyChat</div>
          <span className="badge">AI Agent</span>
        </div>
        <div className={"status-dot " + connectionState.status} />
        {isStreaming ? (
          <button type="button" onClick={() => stopAgentStream()}>Stop</button>
        ) : null}
      </header>
      <div className="messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="welcome">
            <div className="avatar-large">AI</div>
            <h2>Agent Demo Room</h2>
            <p>Ask me anything! I can answer questions, write code, and use tools.</p>
            <div className="suggestions">
              <button onClick={() => { sendMessage("What can you do?"); }}>
                What can you do?
              </button>
              <button onClick={() => { sendMessage("Write a hello world in Rust"); }}>
                Write Rust hello world
              </button>
              <button onClick={() => { sendMessage("Explain Durable Objects"); }}>
                Explain DOs
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isAgent = m.userId !== userId;
          const isStreaming = isAgent && i === messages.length - 1 && isAgentTyping;
          return (
            <div key={m.id || i} className={"msg" + (isAgent ? " agent" : " user")}>
              {isAgent && <div className="msg-avatar">AI</div>}
              <div className="msg-content">
                <div className={"bubble" + (isStreaming ? " streaming" : "")}>
                  {m.content}
                  {isStreaming && <span className="cursor">|</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="composer">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask the agent..."
        />
        <button onClick={handleSend} disabled={!input.trim()}>Send</button>
      </div>
    </div>
  );
}`,
        "src/App.css": tmpl`* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}
.loading-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #64748b;
}
.loader {
  width: 32px;
  height: 32px;
  border: 3px solid #334155;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #334155;
}
.header-left { display: flex; align-items: center; gap: 0.75rem; }
.logo {
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  background: #3b82f620;
  color: #60a5fa;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.connected { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
.status-dot.connecting { background: #eab308; animation: pulse 1s infinite; }
.status-dot.disconnected { background: #64748b; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  color: #64748b;
}
.avatar-large {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
}
.welcome h2 { color: #e2e8f0; }
.welcome p { max-width: 400px; }
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
  justify-content: center;
}
.suggestions button {
  padding: 0.5rem 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
  color: #94a3b8;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.suggestions button:hover { border-color: #3b82f6; color: #60a5fa; }
.msg { display: flex; gap: 0.75rem; max-width: 85%; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }
.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.msg-content { display: flex; flex-direction: column; gap: 0.25rem; }
.bubble {
  padding: 0.625rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
}
.agent .bubble {
  background: #1e293b;
  color: #e2e8f0;
  border-bottom-left-radius: 0.25rem;
}
.user .bubble {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border-bottom-right-radius: 0.25rem;
}
.streaming { border-left: 2px solid #3b82f6; }
.cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: #60a5fa;
}
@keyframes blink {
  50% { opacity: 0; }
}
.composer {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #334155;
}
.composer input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  outline: none;
}
.composer input:focus { border-color: #3b82f6; }
.composer button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.composer button:disabled { opacity: 0.4; cursor: not-allowed; }`,
        "public/index.html": tmpl`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FluxyChat AI Agent Demo</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        "src/index.js": tmpl`import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);`,
        "package.json": JSON.stringify(
          {
            name: "fluxychat-agent-chat",
            private: true,
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              "react-scripts": "5.0.1",
              "@fluxy-chat/sdk": FLUXY_SDK,
              "@fluxy-chat/protocol": FLUXY_PROTOCOL,
            },
            overrides: {
              "@fluxy-chat/protocol": FLUXY_PROTOCOL,
            },
            scripts: {
              start: "react-scripts start",
              build: "react-scripts build",
            },
          },
          null,
          2,
        ),
      },
    },
  },
  {
    id: "full-hosted",
    label: "Full stack (hosted demo)",
    description: "Vite-style React chat with @assistant invoke against the public demo session",
    icon: "Sparkles",
    project: {
      title: "FluxyChat Full Hosted",
      description: "Chat + agent using GET /demo/session — no wrangler",
      template: "create-react-app",
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-scripts": "5.0.1",
        "@fluxy-chat/sdk": FLUXY_SDK,
        "@fluxy-chat/react": FLUXY_REACT,
      },
      files: {
        "src/App.js": tmpl`import React, { useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";
import "./App.css";

const BASE_URL = "${WC_BASE_URL}";

function ChatRoom({ roomId, agentId, agentHandle, userId }) {
  const { messages, sendMessage, invokeAgent, connectionState, agentTyping, toolThreadEvents, stopAgentStream } = useChat({
    roomId,
    agentId: agentId || undefined,
    markReadLatest: true,
  });
  const [draft, setDraft] = useState("");
  const isStreaming = messages.some((m) => m.streaming);

  return (
    <section className="chat">
      <header>
        <strong>{roomId}</strong>
        <span>{connectionState.status}</span>
        {isStreaming ? (
          <button type="button" onClick={() => stopAgentStream()}>Stop</button>
        ) : null}
      </header>
      <ul>
        {messages.map((m) => (
          <li key={m.id || m.createdAt}>
            <small>{m.userId}</small>
            <div>{m.content}</div>
          </li>
        ))}
      </ul>
      {agentTyping ? <p className="hint">{agentHandle} is thinking…</p> : null}
      {toolThreadEvents.length > 0 ? (
        <p className="hint">Tools: {toolThreadEvents.length} event(s)</p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          sendMessage(text);
          setDraft("");
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" />
        <button type="submit">Send</button>
        <button
          type="button"
          onClick={() => {
            const text = draft.trim();
            if (!text || !agentId) return;
            invokeAgent(text.startsWith("@") ? text : agentHandle + " " + text, { agentId });
            setDraft("");
          }}
        >
          Ask agent
        </button>
      </form>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(BASE_URL + "/demo/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.token) throw new Error(data.error || "demo unavailable");
        setSession(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  const client = useMemo(() => {
    if (!session) return null;
    return new FluxyChatClient({
      baseUrl: BASE_URL,
      userId: session.userId,
      token: session.token,
    });
  }, [session]);

  if (error) return <main className="shell"><p>{error}</p></main>;
  if (!session || !client) return <main className="shell"><p>Connecting to hosted demo…</p></main>;

  return (
    <main className="shell">
      <h1>FluxyChat hosted demo</h1>
      <p>
        Guest session · <a href="https://fluxychat.com/onboarding?from=cli">Keep this project</a>
      </p>
      <FluxyRealtimeProvider client={client}>
        <ChatRoom
          roomId={session.roomId}
          agentId={session.agentId}
          agentHandle={session.agentHandle || "@assistant"}
          userId={session.userId}
        />
      </FluxyRealtimeProvider>
    </main>
  );
}
`,
        "src/App.css": tmpl`.shell { font-family: system-ui; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
.chat { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
header { display: flex; justify-content: space-between; padding: 0.75rem 1rem; background: #0f172a; color: #fff; }
ul { list-style: none; margin: 0; padding: 1rem; min-height: 280px; }
li { margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 8px; }
small { color: #64748b; }
form { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid #e2e8f0; }
input { flex: 1; padding: 0.5rem; }
button { background: #c2410c; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 0.75rem; cursor: pointer; }
.hint { padding: 0 1rem; font-size: 0.8rem; color: #64748b; }
a { color: #c2410c; }`,
        "public/index.html": tmpl`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FluxyChat Full Hosted</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        "src/index.js": tmpl`import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);`,
        "package.json": JSON.stringify(
          {
            name: "fluxychat-full-hosted",
            private: true,
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              "react-scripts": "5.0.1",
              "@fluxy-chat/sdk": FLUXY_SDK,
              "@fluxy-chat/react": FLUXY_REACT,
            },
            scripts: {
              start: "react-scripts start",
              build: "react-scripts build",
            },
          },
          null,
          2,
        ),
      },
    },
  },
];
