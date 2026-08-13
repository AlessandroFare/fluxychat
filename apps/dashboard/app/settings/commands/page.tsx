"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Terminal, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createCustomSlashCommand,
  deleteCustomSlashCommand,
  listCustomSlashCommands,
  listSlashCommands,
  type RoomCommand,
} from "@/lib/slash-commands-client";

export default function SlashCommandsSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [builtIn, setBuiltIn] = useState<RoomCommand[]>([]);
  const [custom, setCustom] = useState<RoomCommand[]>([]);
  const [newCommand, setNewCommand] = useState("/standup");
  const [newDescription, setNewDescription] = useState("Post daily standup template");
  const [newTemplate, setNewTemplate] = useState("Standup time! What did you do yesterday? What's next?");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [allRes, customRes] = await Promise.all([
        listSlashCommands(token),
        listCustomSlashCommands(token),
      ]);
      const all = allRes.commands ?? [];
      const customIds = new Set((customRes.commands ?? []).map((c) => c.command));
      setBuiltIn(all.filter((c) => !customIds.has(c.command)));
      setCustom(customRes.commands ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load slash commands"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createCustomSlashCommand(token, {
        command: newCommand,
        description: newDescription,
        handler: "echo",
        config: { responseTemplate: newTemplate.replace(/\{args\}/g, "").trim() || newDescription },
      });
      setNotice(`Created ${newCommand.startsWith("/") ? newCommand : `/${newCommand}`}`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(command: RoomCommand) {
    if (!token || !command.id) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCustomSlashCommand(token, command.id);
      setNotice(`Deleted ${command.command}`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Slash commands"
        description="Built-in /poll, /remind, /assign plus tenant custom commands registered in room_commands."
        icon={Terminal}
      />
      <ConsoleFeedback error={error} notice={notice} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading commands…
        </div>
      ) : (
        <div className="space-y-6">
          <Panel>
            <Section title="Built-in commands" description="Deterministic handlers intercepted on message send.">
              <div className="space-y-2">
                {builtIn.map((cmd) => (
                  <div key={cmd.command} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <div>
                      <div className="font-mono font-semibold">{cmd.command}</div>
                      <div className="text-muted-foreground">{cmd.description}</div>
                      {cmd.usage ? <div className="mt-1 font-mono text-xs text-muted-foreground/80">{cmd.usage}</div> : null}
                    </div>
                    <Badge variant="secondary">{cmd.required_role ?? "member"}</Badge>
                  </div>
                ))}
              </div>
            </Section>
          </Panel>

          <Panel>
            <Section title="Custom tenant commands" description="Echo handler posts a room message from responseTemplate.">
              <div className="mb-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="/mycommand" />
                  <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" />
                </div>
                <Input
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder="Response template (use {args} for remainder)"
                />
                <Button type="button" disabled={busy || !token} onClick={() => void handleCreate()}>
                  <Plus className="size-4" />
                  Add command
                </Button>
              </div>
              {custom.length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom commands yet.</p>
              ) : (
                <div className="space-y-2">
                  {custom.map((cmd) => (
                    <div key={cmd.id ?? cmd.command} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <div>
                        <div className="font-mono font-semibold">{cmd.command}</div>
                        <div className="text-muted-foreground">{cmd.description}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleDelete(cmd)}
                        aria-label={`Delete ${cmd.command}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Panel>
        </div>
      )}
    </ConsoleShell>
  );
}
