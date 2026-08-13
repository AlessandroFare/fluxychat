"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Box, Boxes, Eye, Plus, Trash2, Maximize2, Users, MapPin, Volume2 } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleProjectRoomBar } from "../components/console-project-room-bar";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { createDigitalTwinRoom, createDigitalTwinMcpRegistry, createWorkerDigitalTwinClient } from "@fluxy-chat/sdk";
import { createAROverlayManager } from "@fluxy-chat/sdk";
import { useWorkerChatClient } from "@/lib/use-worker-chat-client";
import { WorkerBackendBadge } from "@/app/components/worker-backend-badge";

/* ─── Digital Twin Room ─── */

const SEED_ENTITIES = [
  { type: "desk", x: 1, z: 1, props: { color: "brown" } },
  { type: "chair", x: 1, z: 2, props: { color: "gray" } },
  { type: "desk", x: 5, z: 1, props: { color: "brown" } },
  { type: "chair", x: 5, z: 2, props: { color: "gray" } },
  { type: "conference_table", x: 3, z: 6, props: { color: "brown" } },
  { type: "whiteboard", x: 3, z: 8, props: { color: "white" } },
  { type: "plant", x: 8, z: 7, props: { color: "green" } },
  { type: "display", x: 8, z: 2, props: { color: "black" } },
  { type: "server_rack", x: 8, z: 1, props: { color: "silver" } },
  { type: "plant", x: 1, z: 7, props: { color: "green" } },
];

function DigitalTwinTab() {
  const chatClient = useWorkerChatClient("spatial-demo");
  const workerTwin = useMemo(
    () => (chatClient ? createWorkerDigitalTwinClient(chatClient) : null),
    [chatClient],
  );
  const dtr = useMemo(() => createDigitalTwinRoom(), []);
  const mcp = useMemo(() => createDigitalTwinMcpRegistry(dtr), [dtr]);
  const [scenes, setScenes] = useState<Array<{ id: string; floor: number }>>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Array<{ id: string; type: string; x: number; y: number; z: number; props: Record<string, unknown> }>>([]);
  const [log, setLog] = useState<string[]>([]);
  const [workerBusy, setWorkerBusy] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const scene = dtr.createScene("Office-Demo", { floor: 1, name: "Open Space Office" });
    setScenes([{ id: scene.id, floor: 1 }]);
    setSelectedSceneId(scene.id);
    for (const ent of SEED_ENTITIES) {
      dtr.addEntity(scene.id, {
        type: ent.type,
        position: { x: ent.x, y: 0, z: ent.z },
        properties: ent.props,
      });
    }
    const s = dtr.getScene(scene.id);
    if (s) {
      setEntities(s.entities.map((e) => ({
        id: e.id, type: e.type,
        x: e.position.x, y: e.position.y, z: e.position.z,
        props: e.properties,
      })));
    }
    addLog("Demo office scene seeded with 10 entities");
  }, [dtr]);

  useEffect(() => {
    if (!workerTwin) return;
    void workerTwin.listScenes().then((rows) => {
      if (rows.length === 0) return;
      setScenes(rows.map((s, index) => ({ id: s.id, floor: index + 1 })));
      if (!selectedSceneId) setSelectedSceneId(rows[0].id);
    }).catch(() => undefined);
  }, [workerTwin, selectedSceneId]);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 29)]); }

  async function refreshScene() {
    if (!selectedSceneId) return;
    if (workerTwin && selectedSceneId.startsWith("scene_")) {
      const s = await workerTwin.getScene(selectedSceneId);
      if (s) {
        setEntities(s.entities.map((e) => ({
          id: e.id, type: e.type,
          x: e.position.x, y: e.position.y, z: e.position.z,
          props: e.properties,
        })));
        return;
      }
    }
    const s = dtr.getScene(selectedSceneId);
    if (s) setEntities(s.entities.map((e) => ({
      id: e.id, type: e.type,
      x: e.position.x, y: e.position.y, z: e.position.z,
      props: e.properties,
    })));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">Create shared 3D scenes with entities and agent access grants.</p>
        <WorkerBackendBadge connected={Boolean(workerTwin)} label="Digital Twin" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => {
          void (async () => {
            if (workerTwin) {
              setWorkerBusy(true);
              try {
                const scene = await workerTwin.createScene({ name: `Office-${Date.now()}`, metadata: { floor: scenes.length + 1 } });
                setScenes((p) => [{ id: scene.id, floor: p.length + 1 }, ...p]);
                setSelectedSceneId(scene.id);
                addLog(`Worker scene "${scene.id}" created`);
                await refreshScene();
              } finally {
                setWorkerBusy(false);
              }
              return;
            }
            const scene = dtr.createScene(`Office-${Date.now()}`, { floor: scenes.length + 1 });
            setScenes((p) => [{ id: scene.id, floor: scenes.length + 1 }, ...p]);
            setSelectedSceneId(scene.id);
            addLog(`Scene "${scene.id}" created (floor ${scenes.length + 1})`);
          })();
        }} disabled={workerBusy}><Plus className="h-3.5 w-3.5 mr-1" /> New scene{workerTwin ? " · Worker" : ""}</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          const result = await mcp.callTool("twin.create_scene", { name: `MCP-${Date.now()}` });
          const scene = JSON.parse(String(result.content[0]?.text ?? "{}")) as { id: string };
          if (scene.id) {
            setScenes((p) => [{ id: scene.id, floor: p.length + 1 }, ...p]);
            setSelectedSceneId(scene.id);
            addLog(`MCP created scene ${scene.id}`);
          }
        }}>MCP create scene</Button>
        <Button size="sm" variant="outline" onClick={() => {
          if (!selectedSceneId) { addLog("Select or create a scene first"); return; }
          void (async () => {
            const types = ["desk", "chair", "whiteboard", "plant", "display", "server_rack", "conference_table"];
            const type = types[Math.floor(Math.random() * types.length)];
            if (workerTwin && selectedSceneId.startsWith("scene_")) {
              const e = await workerTwin.addEntity(selectedSceneId, {
                type,
                position: { x: Math.round(Math.random() * 9), y: 0, z: Math.round(Math.random() * 9) },
                properties: { color: ["brown", "gray", "white", "green", "black", "silver"][Math.floor(Math.random() * 6)] },
              });
              addLog(`+ Worker ${type} at (${e.position.x}, ${e.position.z})`);
              await refreshScene();
              return;
            }
            const e = dtr.addEntity(selectedSceneId, {
              type,
              position: { x: Math.round(Math.random() * 9), y: 0, z: Math.round(Math.random() * 9) },
              properties: { color: ["brown", "gray", "white", "green", "black", "silver"][Math.floor(Math.random() * 6)] },
            });
            addLog(`+ ${type} at (${e.position.x}, ${e.position.z})`);
            refreshScene();
          })();
        }}><Plus className="h-3.5 w-3.5 mr-1" /> Add entity</Button>
        <Button size="sm" variant="outline" onClick={() => {
          if (!selectedSceneId) return;
          void (async () => {
            if (workerTwin && selectedSceneId.startsWith("scene_")) {
              await workerTwin.grantAgent(selectedSceneId, { agentId: "bot-1", grants: ["view", "interact"] });
              addLog("Worker: granted view+interact to bot-1");
              return;
            }
            dtr.grantAgentAccess(selectedSceneId, { agentId: "bot-1", grants: ["view", "interact"] });
            addLog("Granted view+interact to bot-1");
          })();
        }}><Users className="h-3.5 w-3.5 mr-1" /> Grant access</Button>
        <Button size="sm" variant="outline" onClick={() => {
          setEntities([]); setLog([]);
          addLog("State cleared");
        }}><Trash2 className="h-3.5 w-3.5 mr-1" /> Clear</Button>
      </div>

      {/* Scene selector */}
      {scenes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {scenes.map((s) => (
            <Badge key={s.id} variant={s.id === selectedSceneId ? "default" : "outline"}
              className="cursor-pointer" onClick={() => { setSelectedSceneId(s.id); void refreshScene(); }}>
              Floor {s.floor}
            </Badge>
          ))}
        </div>
      )}

      {/* 2D Room Visualization */}
      {entities.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <RoomCanvas entities={entities} />
          <EntityList entities={entities} onRemove={(id) => {
            setEntities((p) => p.filter((e) => e.id !== id));
            addLog(`Entity ${id} removed`);
          }} />
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border flex items-center justify-center h-64 bg-muted/10">
          <p className="text-sm text-muted-foreground">Add entities to see the room visualization</p>
        </div>
      )}

      {/* Log */}
      <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
        {log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </div>
  );
}

/* 2D top-down room view */
function RoomCanvas({ entities }: { entities: Array<{ id: string; type: string; x: number; y: number; z: number; props: Record<string, unknown> }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef(0);
  const GRID = 10;
  const CELL = 50;
  const PADDING = 30;
  const SIZE = PADDING * 2 + GRID * CELL;
  const ENTITY_COLORS: Record<string, string> = {
    desk: "#8B7355", chair: "#4A90D9", whiteboard: "#F5F5F5",
    plant: "#4CAF50", display: "#333", server_rack: "#607D8B",
    conference_table: "#795548",
  };
  const ENTITY_LABELS: Record<string, string> = {
    desk: "🪑", chair: "💺", whiteboard: "📋", plant: "🪴",
    display: "🖥️", server_rack: "🗄️", conference_table: "👥",
  };

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animId: number;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const pulse = reduce ? 1 : 1 + Math.sin(pulseRef.current * 0.035) * 0.08;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID; i++) {
        const pos = PADDING + i * CELL;
        ctx.beginPath(); ctx.moveTo(pos, PADDING); ctx.lineTo(pos, PADDING + GRID * CELL); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PADDING, pos); ctx.lineTo(PADDING + GRID * CELL, pos); ctx.stroke();
      }

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 4;
      ctx.strokeRect(PADDING, PADDING, GRID * CELL, GRID * CELL);

      entities.forEach((e) => {
        const cx = PADDING + e.x * CELL + CELL / 2;
        const cy = PADDING + (GRID - e.z) * CELL + CELL / 2;
        const r = 18 * pulse;

        if (!reduce) {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = ENTITY_COLORS[e.type] ? ENTITY_COLORS[e.type] + "15" : "#94a3b815";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = ENTITY_COLORS[e.type] || "#94a3b8";
        ctx.fill();
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (!reduce && e.type === "plant") {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
          ctx.strokeStyle = "#4CAF5040";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1e293b";
        ctx.fillText(ENTITY_LABELS[e.type] || "▪", cx, cy);
      });

      pulseRef.current++;
      if (!reduce) animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [entities]);

  return (
    <div className="rounded-2xl border border-border bg-background p-2 overflow-auto">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="max-w-full h-auto" />
    </div>
  );
}

function EntityList({ entities, onRemove }: { entities: Array<{ id: string; type: string; x: number; z: number; props: Record<string, unknown> }>; onRemove: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-4 max-h-[560px] overflow-y-auto">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Box className="h-4 w-4" /> Entities ({entities.length})</h4>
      <div className="space-y-1.5">
        {entities.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
            <div>
              <p className="text-xs font-medium capitalize">{e.type}</p>
              <p className="text-[10px] text-muted-foreground">({e.x}, {e.z}) · {String(e.props.color || "")}</p>
            </div>
            <button onClick={() => onRemove(e.id)} className="text-muted-foreground hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AR Overlay ─── */

const SEED_PRESENCES = [
  { id: "user-alice", avatar: "🤖", status: "online" as const, position: { x: 2, z: 3 } },
  { id: "user-bob", avatar: "👤", status: "online" as const, position: { x: 7, z: 5 } },
  { id: "user-charlie", avatar: "👻", status: "away" as const, position: { x: 4, z: 8 } },
];

function ArOverlayTab() {
  const ar = useMemo(() => createAROverlayManager(), []);
  const [presences, setPresences] = useState<Array<{ id: string; avatar: string; status: string; position: { x: number; z: number } }>>([]);
  const [canvasObjects, setCanvasObjects] = useState<Array<{ id?: string; type: string; data: Record<string, unknown> }>>([]);
  const [audioSources, setAudioSources] = useState<Array<{ id: string; position: { x: number; z: number } }>>([]);
  const [log, setLog] = useState<string[]>([]);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (const p of SEED_PRESENCES) {
      ar.setPresence(p.id, { position: { x: p.position.x, y: 0, z: p.position.z }, avatar: p.avatar, status: p.status, lastSeen: Date.now() });
    }
    setPresences(SEED_PRESENCES);
    addLog("Demo AR scene seeded with 3 presences");
  }, [ar]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = setInterval(() => {
      setPresences((prev) => prev.map((p) => ({
        ...p,
        position: {
          x: Math.max(0, Math.min(9, p.position.x + (Math.random() - 0.5) * 1.5)),
          z: Math.max(0, Math.min(9, p.position.z + (Math.random() - 0.5) * 1.5)),
        },
      })));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 29)]); }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Spatial audio, 3D presence, and shared AR canvas.</p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => {
          ar.setSpatialAudio("user-1", { userId: "user-1", position: { x: Math.random() * 5, y: 1, z: Math.random() * 5 }, volume: 0.8, isSpeaking: true });
          setAudioSources((p) => [...p, { id: "user-1", position: { x: Math.round(Math.random() * 5), z: Math.round(Math.random() * 5) } }]);
          addLog("Spatial audio source placed for user-1");
        }}><Volume2 className="h-3.5 w-3.5 mr-1" /> Spatial audio</Button>
        <Button size="sm" variant="outline" onClick={() => {
          const id = `user-${Date.now()}`;
          ar.setPresence(id, { position: { x: Math.random() * 10, y: 0, z: Math.random() * 10 }, avatar: ["robot", "human", "ghost"][Math.floor(Math.random() * 3)], status: "online", lastSeen: Date.now() });
          setPresences((p) => [...p, { id, avatar: "🤖", status: "online", position: { x: Math.round(Math.random() * 9), z: Math.round(Math.random() * 9) } }]);
          addLog(`Presence added: ${id}`);
        }}><Users className="h-3.5 w-3.5 mr-1" /> Add presence</Button>
        <Button size="sm" variant="outline" onClick={() => {
          const types = ["text", "shape", "image", "drawing"] as const;
          const type = types[Math.floor(Math.random() * types.length)];
          ar.addCanvasObject({ type, position: { x: Math.random() * 10, y: 1, z: Math.random() * 10 }, data: { content: `AR ${type}`, color: "#3b82f6" }, createdBy: "user-1" });
          setCanvasObjects((p) => [...p, { type, data: { content: `AR ${type}` } }]);
          addLog(`+ ${type} canvas object`);
        }}><MapPin className="h-3.5 w-3.5 mr-1" /> Canvas object</Button>
        <Button size="sm" variant="outline" onClick={() => {
          addLog(`${presences.length} presences, ${canvasObjects.length} canvas objects, ${audioSources.length} audio sources`);
        }}>Show summary</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Presences */}
        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-500" /> Presence ({presences.length})</h4>
          {presences.length === 0 ? <p className="text-xs text-muted-foreground">No presences yet</p> : (
            <div className="space-y-1.5">
              {presences.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 transition-all duration-700">
                  <span className="text-xs">{p.avatar} <span className="text-muted-foreground">({p.position.x.toFixed(1)},{p.position.z.toFixed(1)})</span></span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-500" /> Canvas ({canvasObjects.length})</h4>
          {canvasObjects.length === 0 ? <p className="text-xs text-muted-foreground">No objects yet</p> : (
            <div className="space-y-1.5">
              {canvasObjects.map((o, i) => (
                <div key={i} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs capitalize">{o.type}</p>
                  <p className="text-[10px] text-muted-foreground">{String(o.data.content || "")}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio */}
        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Volume2 className="h-4 w-4 text-purple-500" /> Audio ({audioSources.length})</h4>
          {audioSources.length === 0 ? <p className="text-xs text-muted-foreground">No sources yet</p> : (
            <div className="space-y-1.5">
              {audioSources.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  ({a.position.x},{a.position.z}) · vol 0.8
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log */}
      <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
        {log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function SpatialPage() {
  const [tab, setTab] = useState<"digital-twin" | "ar">("digital-twin");

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Spatial & AR/VR"
        description="Digital-twin rooms with live 2D visualization, 3D entity management, spatial audio, and shared AR canvas. Interactive SDK demos."
      />

      <ConsoleProjectRoomBar
        requireProject
        hint="Digital-twin scenes persist to Worker when authenticated; AR overlay runs client-side against the same SDK."
      />

      <div role="tablist" className="mt-6 flex gap-1 border-b border-border">
        {(["digital-twin", "ar"] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ borderColor: tab === t ? "var(--fluxy-cta-color)" : "transparent", color: tab === t ? "var(--foreground)" : "var(--muted-foreground)" }}>
            {t === "digital-twin" ? <Boxes className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {t === "digital-twin" ? "Digital Twin Room" : "AR Overlay"}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === "digital-twin" ? <DigitalTwinTab /> : <ArOverlayTab />}
      </div>
    </ConsoleShell>
  );
}
