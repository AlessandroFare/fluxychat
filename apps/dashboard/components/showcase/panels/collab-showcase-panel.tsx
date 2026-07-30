"use client";

import React from "react";
import { Pen, Plus, StickyNote } from "lucide-react";
import { useChat } from "@fluxy-chat/react";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  authorId?: string;
}

const NOTE_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8"];

function parseNote(data: unknown): Note | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const id = String(d.id ?? "");
  const text = String(d.text ?? "");
  if (!id || !text) return null;
  return {
    id,
    text,
    x: Number(d.x) || 10,
    y: Number(d.y) || 10,
    color: String(d.color ?? NOTE_COLORS[0]),
    authorId: d.authorId ? String(d.authorId) : undefined,
  };
}

export function CollabShowcasePanel({ session }: { session: ShowcaseSession }) {
  const client = session.client!;
  const roomId = session.roomId!;
  const [notes, setNotes] = React.useState<Note[]>([
    { id: "seed-1", text: "Sprint goal: ship inbox v2", x: 12, y: 14, color: NOTE_COLORS[0]! },
  ]);
  const [draft, setDraft] = React.useState("");
  const [syncLive, setSyncLive] = React.useState(false);
  const [crdtSignals, setCrdtSignals] = React.useState(0);

  const { sendClientEvent, connectionStatus } = useChat({
    roomId,
    client,
    replay: "connect",
    onServerEvent: (ev) => {
      if (ev.name === "collab.crdt_update" || ev.name === "collab.awareness") {
        setCrdtSignals((n) => n + 1);
      }
    },
    onAnyEvent: (event) => {
      if (event.type !== "client_event" || event.eventName !== "collab.note") return;
      const note = parseNote(event.data);
      if (!note) return;
      setSyncLive(true);
      setNotes((prev) => {
        const without = prev.filter((n) => n.id !== note.id);
        return [...without, note];
      });
    },
  });

  function publishNote(note: Note) {
    void sendClientEvent("collab.note", {
      id: note.id,
      text: note.text,
      x: note.x,
      y: note.y,
      color: note.color,
      authorId: client.userId,
    });
  }

  function addNote() {
    const text = draft.trim() || "New note";
    const note: Note = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      x: 8 + Math.random() * 52,
      y: 10 + Math.random() * 45,
      color: NOTE_COLORS[notes.length % NOTE_COLORS.length]!,
      authorId: client.userId,
    };
    setNotes((prev) => [...prev, note]);
    publishNote(note);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Pen className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
          FluxyCollab board
        </div>
        <span className="text-[11px] text-muted-foreground">
          {connectionStatus === "connected" ? "live" : connectionStatus} · room · {roomId}
          {syncLive ? " · multi-user" : ""}
          {crdtSignals > 0 ? ` · Yjs ${crdtSignals}` : ""}
        </span>
      </div>

      <div className="relative min-h-56 flex-1 overflow-hidden bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] bg-muted/30 p-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className="absolute max-w-[9rem] rounded-lg border border-black/10 px-3 py-2 text-xs shadow-md"
            style={{ left: `${note.x}%`, top: `${note.y}%`, backgroundColor: note.color }}
          >
            <StickyNote className="mb-1 size-3 opacity-60" aria-hidden />
            {note.text}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a sticky note…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && addNote()}
        />
        <Button type="button" size="sm" onClick={addNote}>
          <Plus className="mr-1 size-3.5" aria-hidden />
          Add note
        </Button>
      </div>
      <p className="px-4 pb-4 text-[11px] leading-relaxed text-muted-foreground">
        Notes sync via room <span className="font-medium text-foreground">client_event</span> — same WebSocket as chat. Full Yjs CRDT boards available on{" "}
        <span className="font-medium text-foreground">/collab</span> (binary sync on the room DO).
      </p>
    </div>
  );
}
