"use client";

import React, { useState } from "react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { cn } from "@/lib/utils";
import { Code2, Rocket, MessageSquare, MapPin, Copy, ExternalLink, Loader2 } from "lucide-react";

interface TemplateDef {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  files: Record<string, string>;
  dependencies: Record<string, string>;
  mainFile: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "basic-connect",
    title: "Basic Chat Connection",
    description: "Connect to a FluxyChat room, send and receive messages in under 30 lines.",
    difficulty: "beginner",
    tags: ["sdk", "websocket", "rooms"],
    mainFile: "index.js",
    dependencies: { "@fluxy-chat/sdk": "latest" },
    files: {
      "index.js": `import { FluxyChatClient } from "@fluxy-chat/sdk";

// Create client — no signup needed for demo
const client = new FluxyChatClient({
  apiUrl: "https://demo.fluxychat.dev/api",
  websocketUrl: "wss://demo.fluxychat.dev/ws",
  token: "demo-guest-token",
});

// Join a public room
const room = await client.joinRoom("demo-room");

// Listen for messages
room.onMessage((msg) => {
  console.log(\`[\${msg.username}]: \${msg.content}\`);
});

// Send a message
await room.sendMessage("Hello FluxyChat! 🎉");

console.log("Connected! Type a message and press Enter to send.");
process.stdin.on("data", (data) => {
  room.sendMessage(data.toString().trim());
});
`,
    },
  },
  {
    id: "discord-clone",
    title: "Discord Clone (Channels + Roles)",
    description: "Multi-channel chat with role-based permissions, typing indicators, and presence.",
    difficulty: "intermediate",
    tags: ["channels", "roles", "presence", "typing"],
    mainFile: "index.js",
    dependencies: { "@fluxy-chat/sdk": "latest" },
    files: {
      "index.js": `import { FluxyChatClient } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  apiUrl: process.env.FLUXY_API_URL,
  websocketUrl: process.env.FLUXY_WS_URL,
  token: process.env.FLUXY_TOKEN,
});

// Create channels
const channels = ["general", "random", "dev", "announcements"];
for (const name of channels) {
  await client.createRoom({ name, type: "channel", visibility: "project" });
}

// Set up role-based permissions
const roles = {
  admin: { canDelete: true, canPin: true, canMute: true },
  moderator: { canDelete: true, canPin: true, canMute: false },
  member: { canDelete: false, canPin: false, canMute: false },
};

// Subscribe to all channels
for (const channel of channels) {
  const room = await client.joinRoom(channel);
  room.onMessage((msg) => {
    if (msg.metadata?.deleted) return;
    console.log(\`#\${channel} [\${msg.username}]: \${msg.content}\`);
  });
  room.onTyping((userId) => {
    process.stdout.write(\`\\r\${userId} is typing...  \\r\`);
  });
  room.onPresence((event) => {
    console.log(\`\${event.userId} is now \${event.status}\`);
  });
}

console.log("Discord clone ready! Channels:", channels.join(", "));
`,
    },
  },
  {
    id: "support-widget",
    title: "Support Widget Embed",
    description: "Drop-in chat widget for customer support with AI agent handoff.",
    difficulty: "beginner",
    tags: ["embed", "support", "ai-agent"],
    mainFile: "widget.js",
    dependencies: { "@fluxy-chat/sdk": "latest" },
    files: {
      "widget.js": `// Drop-in support widget — 15 lines
import { FluxyChatClient } from "@fluxy-chat/sdk";

export function mountSupportWidget(container, { projectId, theme = "light" }) {
  const client = new FluxyChatClient({
    apiUrl: "https://api.fluxychat.dev/api",
    websocketUrl: "wss://api.fluxychat.dev/ws",
    token: "guest-" + Math.random().toString(36).slice(2),
  });

  const room = await client.joinRoom(\`support-\${projectId}\`);

  // Auto-handoff to AI agent after 30s of no human response
  let humanResponded = false;
  room.onMessage((msg) => {
    if (msg.userId?.startsWith("agent_")) humanResponded = true;
    renderMessage(container, msg);
  });

  setTimeout(() => {
    if (!humanResponded) {
      room.invokeAgent("support-bot", "Customer waiting — please assist.");
    }
  }, 30000);

  // Render chat UI
  container.innerHTML = \`
    <div class="fluxy-widget fluxy-\${theme}">
      <div class="fluxy-messages" id="fluxy-msgs"></div>
      <input class="fluxy-input" placeholder="Type a message..." />
    </div>
  \`;

  container.querySelector(".fluxy-input").onkeydown = (e) => {
    if (e.key === "Enter") {
      room.sendMessage(e.target.value);
      e.target.value = "";
    }
  };
}
`,
    },
  },
  {
    id: "location-tracker",
    title: "Real-Time Location Tracker",
    description: "Track device GPS locations in real-time with geofencing alerts.",
    difficulty: "intermediate",
    tags: ["gps", "geofencing", "realtime", "maps"],
    mainFile: "index.js",
    dependencies: { "@fluxy-chat/sdk": "latest" },
    files: {
      "index.js": `import { FluxyChatClient, useLocation } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  apiUrl: process.env.FLUXY_API_URL,
  websocketUrl: process.env.FLUXY_WS_URL,
  token: process.env.FLUXY_TOKEN,
});

// Join fleet tracking room
const room = await client.joinRoom("fleet-001");

// Define geofence (1km radius around office)
const office = { lat: 45.4642, lng: 9.1900, radius: 1000 };

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Listen for GPS updates
room.onLocationUpdate((update) => {
  const dist = haversine(office.lat, office.lng, update.lat, update.lng);
  const inside = dist * 1000 <= office.radius;
  console.log(\`\${update.deviceId}: (\${update.lat.toFixed(4)}, \${update.lng.toFixed(4)}) — \${inside ? "✅ inside geofence" : "⚠️ outside"} (\${(dist*1000).toFixed(0)}m)\`);

  if (!inside) {
    room.sendMessage(\`⚠️ Device \${update.deviceId} left the geofence!\`);
  }
});

console.log("Location tracker running. Waiting for GPS updates...");
`,
    },
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600",
  intermediate: "bg-amber-500/15 text-amber-600",
  advanced: "bg-red-500/15 text-red-600",
};

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "basic-connect": <MessageSquare className="size-5" />,
  "discord-clone": <MessageSquare className="size-5" />,
  "support-widget": <Rocket className="size-5" />,
  "location-tracker": <MapPin className="size-5" />,
};

export default function TemplatesPage() {
  const [selected, setSelected] = useState<TemplateDef>(TEMPLATES[0]);
  const [launching, setLaunching] = useState(false);

  const handleOpenInStackBlitz = async () => {
    setLaunching(true);
    try {
      const stackblitz = (await import("@stackblitz/sdk")).default;
      stackblitz.openProject({
        title: `FluxyChat — ${selected.title}`,
        description: selected.description,
        template: "node",
        files: selected.files,
        dependencies: selected.dependencies,
      });
    } catch (err) {
      console.error("Failed to open StackBlitz:", err);
    }
    setLaunching(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selected.files[selected.mainFile]);
  };

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Code Templates"
        description="Runnable code snippets powered by StackBlitz. Open in browser, no setup required."
      />

      <div className="flex flex-1 gap-4 p-4 pt-2">
        {/* Template list */}
        <div className="w-72 shrink-0 space-y-2 max-lg:hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Templates ({TEMPLATES.length})
          </h3>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                selected.id === t.id ? "border-foreground bg-foreground/5" : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                selected.id === t.id ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground",
              )}>
                {TEMPLATE_ICONS[t.id]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-[10px] text-muted-foreground">{t.description.slice(0, 60)}...</div>
                <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", DIFFICULTY_COLORS[t.difficulty])}>
                  {t.difficulty}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Template detail */}
        <div className="flex-1 min-w-0">
          {/* Mobile template selector */}
          <div className="mb-3 lg:hidden">
            <select
              value={selected.id}
              onChange={(e) => setSelected(TEMPLATES.find((t) => t.id === e.target.value) || TEMPLATES[0])}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", DIFFICULTY_COLORS[selected.difficulty])}>
                  {selected.difficulty}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={handleOpenInStackBlitz}
              disabled={launching}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fluxy-cta-color)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {launching ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
              Open in StackBlitz
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Copy className="size-3.5" /> Copy code
            </button>
          </div>

          {/* Code preview */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <Code2 className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground">{selected.mainFile}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{selected.files[selected.mainFile].split("\n").length} lines</span>
            </div>
            <pre className="max-h-96 overflow-auto bg-gray-950 p-4 text-xs text-gray-100">
              <code>{selected.files[selected.mainFile]}</code>
            </pre>
          </div>

          {/* Dependencies */}
          <div className="mt-3 rounded-xl border border-border bg-card p-3">
            <h4 className="mb-1 text-xs font-semibold">Dependencies</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selected.dependencies).map(([pkg, ver]) => (
                <code key={pkg} className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono">
                  {pkg}@{ver}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
