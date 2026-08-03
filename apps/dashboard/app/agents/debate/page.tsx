"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Plus, Scale, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createDebateRole,
  deleteDebateRole,
  listDebateRoles,
  listDebateSessions,
  runAgentDebate,
  seedDebateRoles,
  type DebateRole,
  type DebateSession,
} from "@/lib/agent-debate-client";

export default function AgentDebatePage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [roles, setRoles] = useState<DebateRole[]>([]);
  const [sessions, setSessions] = useState<DebateSession[]>([]);
  const [roomId, setRoomId] = useState("");
  const [prompt, setPrompt] = useState("Should we adopt a microservices architecture for our chat platform?");
  const [roleName, setRoleName] = useState("");
  const [rolePrompt, setRolePrompt] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const r = await listDebateRoles(token);
      setRoles(r.roles ?? []);
      if (roomId.trim()) {
        const s = await listDebateSessions(token, roomId.trim());
        setSessions(s.sessions ?? []);
      } else {
        setSessions([]);
      }
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load debate config"));
    } finally {
      setLoading(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSeed() {
    if (!token) return;
    setBusy("seed");
    try {
      const result = await seedDebateRoles(token);
      setNotice(`Seeded ${result.seeded ?? 0} default roles (Technical, Business, Risk).`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Seed failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateRole() {
    if (!token || !roleName.trim() || !rolePrompt.trim()) return;
    setBusy("create");
    try {
      await createDebateRole(token, {
        roleName: roleName.trim(),
        systemPrompt: rolePrompt.trim(),
        sortOrder: roles.length,
      });
      setRoleName("");
      setRolePrompt("");
      setNotice("Debate role created.");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create role failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteRole(id: string) {
    if (!token) return;
    setBusy(`del-${id}`);
    try {
      await deleteDebateRole(token, id);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRun() {
    if (!token || !roomId.trim() || !prompt.trim()) return;
    setBusy("run");
    setNotice(null);
    try {
      const result = await runAgentDebate(token, {
        roomId: roomId.trim(),
        prompt: prompt.trim(),
        maxRounds: 1,
      });
      setNotice(
        `Debate ${result.session?.status ?? "done"} — open the room to watch live agent_step events.`,
      );
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Run failed — is AI configured?"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell className="max-w-4xl">
      <ConsolePageHeader
        title="Multi-agent debate"
        description="Run visible perspective agents in a room, then post a moderator synthesis."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        Debate steps stream as <code className="text-xs">agent_step</code> events in the chat UI.{" "}
        <Link href="/agents/observability" className="underline underline-offset-2">
          Observability
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Debate roles">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void handleSeed()}>
                <Plus className="mr-2 h-4 w-4" />
                Seed defaults
              </Button>
            </div>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles — seed defaults to start.</p>
            ) : (
              <ul className="space-y-2">
                {roles.map((role) => (
                  <li key={role.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-violet-600" />
                        <span className="font-medium text-sm">{role.roleName}</span>
                        {!role.enabled ? <Badge variant="outline">disabled</Badge> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{role.systemPrompt}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!busy}
                      onClick={() => void handleDeleteRole(role.id)}
                      aria-label={`Delete ${role.roleName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Role name" />
              <Input
                value={rolePrompt}
                onChange={(e) => setRolePrompt(e.target.value)}
                placeholder="System prompt (short)"
              />
            </div>
            <Button className="mt-2" size="sm" disabled={!!busy} onClick={() => void handleCreateRole()}>
              Add role
            </Button>
          </Section>

          <Section title="Run debate in room">
            <div className="grid gap-3">
              <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room id" />
              <textarea
                className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Question for the debate"
              />
            </div>
            <Button className="mt-3" disabled={busy === "run"} onClick={() => void handleRun()}>
              {busy === "run" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run debate (1 round)
            </Button>
            {roomId.trim() ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Open{" "}
                <Link href={`/rooms?room=${encodeURIComponent(roomId.trim())}`} className="underline">
                  room chat
                </Link>{" "}
                to see live steps.
              </p>
            ) : null}
          </Section>

          {sessions.length > 0 ? (
            <Section title="Recent sessions">
              <ul className="space-y-2 text-sm">
                {sessions.slice(0, 5).map((s) => (
                  <li key={s.id} className="rounded-lg border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{s.status}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>
                      {s.latencyMs != null ? (
                        <span className="text-xs text-muted-foreground">{s.latencyMs}ms</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs">{s.prompt}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}
