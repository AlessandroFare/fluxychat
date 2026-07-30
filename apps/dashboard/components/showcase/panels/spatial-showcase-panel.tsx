"use client";

import React from "react";
import { Boxes, Loader2, Plus } from "lucide-react";
import { createWorkerDigitalTwinClient } from "@fluxy-chat/sdk";
import { useServerEvents } from "@fluxy-chat/react";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

interface EntityRow {
  id: string;
  name: string;
  kind: string;
}

export function SpatialShowcasePanel({ session }: { session: ShowcaseSession }) {
  const client = session.client!;
  const roomId = session.roomId!;
  const [entities, setEntities] = React.useState<EntityRow[]>([]);
  const [sceneId, setSceneId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [wsLive, setWsLive] = React.useState(false);

  const { lastEvent, connected } = useServerEvents({
    client,
    roomId,
    filter: (name) => name.startsWith("spatial."),
  });

  React.useEffect(() => {
    if (!lastEvent) return;
    setWsLive(true);
    if (lastEvent.name === "spatial.scene_created") {
      setSceneId(String(lastEvent.data.sceneId ?? sceneId));
    }
    if (lastEvent.name === "spatial.entity_added") {
      const entityId = String(lastEvent.data.entityId ?? "");
      const props = lastEvent.data.properties as Record<string, unknown> | undefined;
      const name = String(props?.name ?? lastEvent.data.type ?? "Entity");
      const kind = String(lastEvent.data.type ?? "object");
      if (!entityId) return;
      setEntities((prev) => {
        if (prev.some((e) => e.id === entityId)) return prev;
        return [...prev, { id: entityId, name, kind }];
      });
    }
  }, [lastEvent, sceneId]);

  async function addEntity() {
    setBusy(true);
    const name = `Asset ${entities.length + 1}`;
    try {
      const twin = createWorkerDigitalTwinClient(client);
      let sid = sceneId;
      if (!sid) {
        const scene = await twin.createScene({
          name: "Plant floor",
          roomId,
        });
        sid = scene.id;
        setSceneId(sid);
      }
      const entity = await twin.addEntity(sid, {
        type: "equipment",
        position: { x: Math.random(), y: 0, z: Math.random() },
        properties: { name },
      });
      setEntities((prev) => {
        if (prev.some((e) => e.id === entity.id)) return prev;
        return [...prev, { id: entity.id, name: String(entity.properties.name ?? name), kind: entity.type }];
      });
    } catch {
      setEntities((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, name, kind: "equipment" },
      ]);
      if (!sceneId) setSceneId("demo-scene");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[26rem] flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
          <Boxes className="size-5" aria-hidden />
        </span>
        <div>
          <h4 className="font-semibold text-foreground">Spatial / digital twin</h4>
          <p className="text-xs text-muted-foreground">
            Scene {sceneId ?? "—"} · room {roomId}
            {connected && wsLive ? " · WS live" : connected ? " · connected" : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
        {entities.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">Add an entity to populate the twin scene.</p>
        ) : null}
        {entities.map((entity) => (
          <div
            key={entity.id}
            className="flex flex-col justify-end rounded-xl border border-border bg-gradient-to-b from-muted/20 to-muted/60 p-3"
          >
            <div className="mb-8 h-16 rounded-lg border border-dashed border-border/80 bg-background/50" />
            <p className="text-sm font-medium text-foreground">{entity.name}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{entity.kind}</p>
          </div>
        ))}
      </div>

      <Button type="button" className="mt-4" onClick={() => void addEntity()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Plus className="mr-2 size-4" aria-hidden />}
        Add twin entity
      </Button>
    </div>
  );
}
