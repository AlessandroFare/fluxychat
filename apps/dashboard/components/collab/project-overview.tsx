"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Target, DollarSign, Calendar, Clock, CheckCircle2, Circle, AlertCircle,
  Users, MessageSquare, FileText, Columns3, Folder,
} from "lucide-react";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { useYjs } from "./yjs-provider";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

interface ProjectMeta {
  project_goal: string | null;
  project_budget: number;
  project_timeline_start: string | null;
  project_timeline_end: string | null;
  project_status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  planning: { label: "Planning", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: Circle },
  active: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300", icon: CheckCircle2 },
  review: { label: "Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", icon: AlertCircle },
};

export default function ProjectOverview({ roomId }: { roomId: string }) {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const { connected, ymap } = useYjs();
  const [meta, setMeta] = useState<ProjectMeta>({
    project_goal: null, project_budget: 0,
    project_timeline_start: null, project_timeline_end: null,
    project_status: "planning",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadMeta = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${WORKER_URL}/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.room) {
        const r = data.room;
        setMeta({
          project_goal: r.project_goal || null,
          project_budget: r.project_budget || 0,
          project_timeline_start: r.project_timeline_start || null,
          project_timeline_end: r.project_timeline_end || null,
          project_status: r.project_status || "planning",
        });
      }
    } catch { /* ignore */ }
  }, [roomId, token]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const updateMeta = async (key: string, value: any) => {
    if (!token) return;
    try {
      await fetch(`${WORKER_URL}/rooms/${roomId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      setMeta((prev) => ({ ...prev, [key]: value }));
    } catch { /* ignore */ }
  };

  const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) => (
    <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
        <div className={cn("rounded-lg p-2", color)}><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );

  const status = STATUS_CONFIG[meta.project_status] || STATUS_CONFIG.planning;
  const StatusIcon = status.icon;
  const now = new Date();
  const startDate = meta.project_timeline_start ? new Date(meta.project_timeline_start) : null;
  const endDate = meta.project_timeline_end ? new Date(meta.project_timeline_end) : null;
  const totalDays = startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000) : 0;
  const elapsedDays = startDate ? Math.round((now.getTime() - startDate.getTime()) / 86400000) : 0;
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950">
      {/* Status + Connection */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", status.color)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-green-500" : "bg-yellow-500")} />
          {connected ? "Synced" : "Offline"}
          <button
            onClick={() => {
              const statuses = Object.keys(STATUS_CONFIG);
              const idx = statuses.indexOf(meta.project_status);
              const next = statuses[(idx + 1) % statuses.length];
              updateMeta("project_status", next);
            }}
            className="rounded-md px-2 py-0.5 text-[10px] hover:bg-muted"
          >
            Advance &rarr;
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Goal" value={meta.project_goal || "Set a goal..."} icon={Target} color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300" />
        <StatCard label="Budget" value={meta.project_budget ? `$${meta.project_budget.toLocaleString()}` : "Not set"} icon={DollarSign} color="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300" />
        <StatCard label="Timeline" value={startDate && endDate ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` : "Not set"} icon={Calendar} color="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" />
        <StatCard label="Duration" value={totalDays > 0 ? `${totalDays} days (${progressPct}%)` : "Not set"} icon={Clock} color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300" />
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold">Project Progress</span>
          <span className="text-muted-foreground">{elapsedDays}d elapsed / {totalDays}d total</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
      </div>

      {/* Goal editor */}
      <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><Target className="h-4 w-4 text-indigo-500" /> Project Goal</h3>
        {editing === "goal" ? (
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 rounded border px-3 py-2 text-sm outline-none focus:border-primary"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { updateMeta("project_goal", editValue); setEditing(null); } }}
              onBlur={() => { updateMeta("project_goal", editValue); setEditing(null); }}
            />
          </div>
        ) : (
          <p
            className="cursor-pointer text-sm leading-relaxed text-muted-foreground hover:text-foreground"
            onClick={() => { setEditValue(meta.project_goal || ""); setEditing("goal"); }}
          >
            {meta.project_goal || "Click to set your project goal..."}
          </p>
        )}
      </div>

      {/* Budget + Timeline */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><DollarSign className="h-4 w-4 text-green-500" /> Budget</h3>
          {editing === "budget" ? (
            <input
              autoFocus
              type="number"
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-primary"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => { updateMeta("project_budget", Number(editValue) || 0); setEditing(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { updateMeta("project_budget", Number(editValue) || 0); setEditing(null); } }}
            />
          ) : (
            <p
              className="cursor-pointer text-2xl font-bold hover:text-primary"
              onClick={() => { setEditValue(String(meta.project_budget)); setEditing("budget"); }}
            >
              ${meta.project_budget.toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><Calendar className="h-4 w-4 text-blue-500" /> Timeline</h3>
          <div className="flex gap-2 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Start</p>
              <input type="date" className="rounded border px-2 py-1 text-sm outline-none" value={meta.project_timeline_start?.split("T")[0] || ""} onChange={(e) => updateMeta("project_timeline_start", e.target.value + "T00:00:00.000Z")} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">End</p>
              <input type="date" className="rounded border px-2 py-1 text-sm outline-none" value={meta.project_timeline_end?.split("T")[0] || ""} onChange={(e) => updateMeta("project_timeline_end", e.target.value + "T23:59:59.999Z")} />
            </div>
          </div>
        </div>
      </div>

      {/* Project tools quick links */}
      <div className="rounded-xl border bg-white p-4 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold">Quick Access</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Chat", icon: MessageSquare, desc: "Team discussion" },
            { label: "Tasks", icon: Columns3, desc: "Kanban board" },
            { label: "Files", icon: Folder, desc: "Shared storage" },
            { label: "Notes", icon: FileText, desc: "Documentation" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg border p-3 text-xs hover:bg-muted/50 cursor-pointer">
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
