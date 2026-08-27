"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Pen, FileText, Columns3, Folder, Calendar, FileSpreadsheet, BookOpen, Bot, History,
  LayoutDashboard, Boxes, Glasses, Wifi, WifiOff, Undo2, Redo2,
} from "lucide-react";
import Link from "next/link";
import { useDashboardSession } from "../../components/dashboard-session";
import { cn } from "@/lib/utils";
import { YjsProvider, useYjs } from "@/components/collab/yjs-provider";

const CollabWhiteboard = dynamic(() => import("@/components/collab/collab-whiteboard"), { ssr: false });
const CollabNotes = dynamic(() => import("@/components/collab/collab-notes"), { ssr: false });
const CollabKanban = dynamic(() => import("@/components/collab/collab-kanban"), { ssr: false });
const CollabDocument = dynamic(() => import("@/components/collab/collab-document"), { ssr: false });
const CollabSpreadsheet = dynamic(() => import("@/components/collab/collab-spreadsheet"), { ssr: false });
const CollabFiles = dynamic(() => import("@/components/collab/collab-files"), { ssr: false });
const CollabCalendar = dynamic(() => import("@/components/collab/collab-calendar"), { ssr: false });
const CollabSummaries = dynamic(() => import("@/components/collab/collab-summaries"), { ssr: false });
const CollabVersions = dynamic(() => import("@/components/collab/collab-versions"), { ssr: false });
const ProjectOverview = dynamic(() => import("@/components/collab/project-overview"), { ssr: false });
const SpatialView = dynamic(() => import("@/components/collab/spatial-view"), { ssr: false });
const SpatialWhiteboard = dynamic(() => import("@/components/collab/spatial-whiteboard"), { ssr: false });

type CollabTab = "overview" | "whiteboard" | "notes" | "kanban" | "document" | "spreadsheet" | "files" | "calendar" | "summaries" | "versions" | "spatial" | "spatialBoard";

const ALL_TABS: { key: CollabTab; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "whiteboard", label: "Board", icon: Pen },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "document", label: "Doc", icon: BookOpen },
  { key: "spreadsheet", label: "Sheet", icon: FileSpreadsheet },
  { key: "files", label: "Files", icon: Folder },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "summaries", label: "AI", icon: Bot },
  { key: "versions", label: "History", icon: History },
  { key: "spatial", label: "Spatial", icon: Boxes },
  { key: "spatialBoard", label: "3D Board", icon: Glasses },
];

export default function CollabRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { adminJwt, memberJwt, clerkUserId } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const userId = clerkUserId || "anonymous";
  const [tab, setTab] = useState<CollabTab>("overview");

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Connect a project session to use Collaboration.</p>
      </div>
    );
  }

  return (
    <YjsProvider roomId={roomId} userId={userId} token={token} userName="User">
      <CollabLayout roomId={roomId} tab={tab} setTab={setTab} />
    </YjsProvider>
  );
}

function CollabLayout({ roomId, tab, setTab }: { roomId: string; tab: CollabTab; setTab: (t: CollabTab) => void }) {
  const { connected, undoManager } = useYjs();
  const shellRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    function fit() {
      const node = shellRef.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      node.style.height = `${Math.max(320, Math.floor(window.innerHeight - top))}px`;
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={shellRef} className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Link href="/collab" className="text-muted-foreground hover:text-foreground">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">Workspace #{roomId.slice(0, 8)}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tab !== "spatial" && tab !== "spatialBoard" && (
            <><button onClick={() => undoManager?.undo()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Undo"><Undo2 className="h-4 w-4" /></button>
            <button onClick={() => undoManager?.redo()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Redo"><Redo2 className="h-4 w-4" /></button></>
          )}
          <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", connected ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300")}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Offline"}
          </div>
        </div>
      </header>

      <div className="flex gap-0.5 overflow-x-auto border-b border-border bg-card px-2 scrollbar-none">
        {ALL_TABS.map((t) => {
          const TabIcon = t.icon;
          return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            {t.label}
          </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && <ProjectOverview roomId={roomId} />}
        {tab === "whiteboard" && <CollabWhiteboard />}
        {tab === "notes" && <CollabNotes />}
        {tab === "kanban" && <CollabKanban roomId={roomId} />}
        {tab === "document" && <CollabDocument />}
        {tab === "spreadsheet" && <CollabSpreadsheet />}
        {tab === "files" && <CollabFiles roomId={roomId} />}
        {tab === "calendar" && <CollabCalendar roomId={roomId} />}
        {tab === "summaries" && <CollabSummaries roomId={roomId} />}
        {tab === "versions" && <CollabVersions roomId={roomId} />}
        {tab === "spatial" && <SpatialView roomId={roomId} />}
        {tab === "spatialBoard" && <SpatialWhiteboard />}
      </div>
    </div>
  );
}
