"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { closestCenter, DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, X, Edit3 } from "lucide-react";
import { useYjs } from "./yjs-provider";
import * as Y from "yjs";

interface KanbanItem {
  id: string; title: string; status: string; description?: string; assignee?: string;
}

const COLUMNS = [
  { key: "todo", label: "To Do", accent: "border-l-muted-foreground/40" },
  { key: "in_progress", label: "In Progress", accent: "border-l-sky-500" },
  { key: "review", label: "Review", accent: "border-l-amber-500" },
  { key: "done", label: "Done", accent: "border-l-emerald-500" },
];

function KanbanCard({ item, onDelete }: { item: KanbanItem; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg bg-card p-3 text-xs text-foreground ${isDragging ? "shadow-lg" : "shadow-sm"}`}>
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="mt-0.5 shrink-0 cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-3 w-3" />
        </button>
        <div className="flex-1">
          <p className="font-medium">{item.title}</p>
          {item.description && <p className="mt-0.5 text-muted-foreground">{item.description}</p>}
          {item.assignee && <p className="mt-1 text-[10px] text-muted-foreground">@{item.assignee}</p>}
        </div>
        <button onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-red-500"><X className="h-3 w-3" /></button>
      </div>
    </div>
  );
}

function KanbanColumn({ status, label, accent, items, onAdd }: { status: string; label: string; accent: string; items: KanbanItem[]; onAdd: () => void }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <div className={`flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-muted/40 p-3 border-l-4 ${accent}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-xs">{label} <span className="ml-1 text-muted-foreground font-normal">({items.length})</span></h3>
        <button onClick={onAdd} className="rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-[200px]">
          {items.map((item) => (
            <KanbanCard key={item.id} item={item} onDelete={() => {}} />
          ))}
          {items.length === 0 && <p className="py-4 text-center text-[10px] text-muted-foreground">Drop items here</p>}
        </div>
      </SortableContext>
    </div>
  );
}

export default function CollabKanban({ roomId }: { roomId: string }) {
  const { doc, yarray } = useYjs();
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newItemStatus, setNewItemStatus] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!yarray) return;
    const current = yarray.toJSON() as KanbanItem[];
    setItems(current);

    const observer = () => { setItems(yarray.toJSON() as KanbanItem[]); };
    yarray.observe(observer);
    return () => yarray.unobserve(observer);
  }, [yarray]);

  const syncItems = useCallback((newItems: KanbanItem[]) => {
    if (!yarray || !doc) return;
    doc.transact(() => {
      yarray.delete(0, yarray.length);
      yarray.push(newItems);
    });
  }, [yarray, doc]);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeItem = items.find((i) => i.id === active.id);
    if (!activeItem) return;
    const overItem = items.find((i) => i.id === over.id);
    if (!overItem) return;
    const newItems = items.map((i) => i.id === active.id ? { ...i, status: overItem.status } : i);
    syncItems(newItems);
  };

  const addItem = (status: string) => {
    if (!newTitle.trim()) return;
    const newItem: KanbanItem = {
      id: `k-${Date.now()}`,
      title: newTitle.trim(),
      status,
    };
    syncItems([...items, newItem]);
    setNewTitle("");
    setNewItemStatus(null);
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              status={col.key}
              label={col.label}
              accent={col.accent}
              items={items.filter((i) => i.status === col.key)}
              onAdd={() => setNewItemStatus(col.key)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem && <div className="rounded-lg bg-card p-3 text-xs text-foreground shadow-xl"><p className="font-semibold">{activeItem.title}</p></div>}
        </DragOverlay>
      </DndContext>

      {newItemStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setNewItemStatus(null)}>
          <div className="w-72 rounded-xl bg-card p-4 text-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold text-sm">Add card to {COLUMNS.find((c) => c.key === newItemStatus)?.label}</h3>
            <input
              autoFocus
              className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Card title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(newItemStatus); }}
            />
            <div className="flex justify-end gap-2">
              <button className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted" onClick={() => { setNewItemStatus(null); setNewTitle(""); }}>Cancel</button>
              <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground" onClick={() => addItem(newItemStatus)} disabled={!newTitle.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
