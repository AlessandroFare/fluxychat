"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Loader2, LogOut, DoorOpen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface BreakoutData {
  id: string;
  name: string;
  createdBy: string;
  memberCount: number;
  status: string;
  autoCloseAt: string;
  createdAt: string;
}

interface BreakoutPanelProps {
  breakouts: BreakoutData[];
  onCreate: (name: string) => Promise<void>;
  onClose: (breakoutId: string) => Promise<void>;
  canManage?: boolean;
}

export function BreakoutPanel({ breakouts, onCreate, onClose, canManage }: BreakoutPanelProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [closing, setClosing] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try { await onCreate(name.trim()); setName(""); } finally { setCreating(false); }
  };

  const handleClose = async (breakoutId: string) => {
    setClosing(breakoutId);
    try { await onClose(breakoutId); } finally { setClosing(null); }
  };

  if (!breakouts.length && !canManage) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
          <Users className="h-3.5 w-3.5" />
          Breakout rooms
        </h4>
        <span className="text-[10px] text-muted-foreground">{breakouts.length} active</span>
      </div>

      {breakouts.length > 0 && (
        <div className="mb-2 space-y-1">
          {breakouts.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
              <DoorOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{b.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{b.memberCount} members</span>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 shrink-0"
                  onClick={() => handleClose(b.id)}
                  disabled={closing === b.id}
                  title="Close breakout"
                >
                  {closing === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Breakout name..."
            className="flex-1 text-xs h-7"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>
      )}
    </div>
  );
}

export function useBreakouts(fluxyClient: any, roomId: string | null) {
  const [breakouts, setBreakouts] = useState<BreakoutData[]>([]);

  const fetchBreakouts = async () => {
    if (!fluxyClient || !roomId) { setBreakouts([]); return; }
    try {
      const res = await fluxyClient.listBreakouts(roomId);
      setBreakouts(res.breakouts ?? []);
    } catch { setBreakouts([]); }
  };

  useEffect(() => {
    fetchBreakouts();
    const interval = setInterval(fetchBreakouts, 30000);
    return () => clearInterval(interval);
  }, [fluxyClient, roomId]);

  return { breakouts, fetchBreakouts };
}
