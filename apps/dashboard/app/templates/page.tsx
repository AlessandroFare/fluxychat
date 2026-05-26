"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Banner, Button, EmptyState, Input, Panel, SkeletonCard, Textarea } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { formatDateTime } from "@/lib/format-datetime";

const WORKER_URL = getPublicWorkerUrl();

interface TemplateRow {
  id: string;
  name: string;
  body: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const { adminJwt, activeProject } = useDashboardSession();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [previewVars, setPreviewVars] = useState('{"name":"Ada"}');
  const [previewOut, setPreviewOut] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const client = React.useMemo(() => {
    const token = adminJwt.trim();
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: "console-admin",
      token,
    });
  }, [adminJwt]);

  const loadTemplates = useCallback(async () => {
    if (!client) {
      setError("Admin JWT required (owner/admin). Connect from Projects or Onboarding.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await client.listMessageTemplates();
      setTemplates(
        rows.map((t) => ({
          id: t.id,
          name: t.name,
          body: t.body,
          updatedAt: t.updatedAt,
        })),
      );
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load templates"));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (adminJwt.trim()) void loadTemplates();
  }, [adminJwt, loadTemplates]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setBody(selected.body);
    }
  }, [selected]);

  const resetForm = () => {
    setSelectedId(null);
    setName("");
    setBody("");
    setPreviewOut("");
  };

  const saveTemplate = async () => {
    if (!client) return;
    if (!name.trim() || !body.trim()) {
      setError("Name and body are required.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      if (selectedId) {
        await client.updateMessageTemplate(selectedId, {
          name: name.trim(),
          body: body.trim(),
        });
        setNotice("Template updated.");
      } else {
        const created = await client.createMessageTemplate(name.trim(), body.trim());
        if (created) setSelectedId(created.id);
        setNotice("Template created.");
      }
      await loadTemplates();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Save failed"));
    }
  };

  const runPreview = async () => {
    if (!client) return;
    setError(null);
    try {
      let vars: Record<string, string> = {};
      if (previewVars.trim()) {
        const parsed = JSON.parse(previewVars) as Record<string, string>;
        vars = parsed;
      }
      const content = await client.renderMessageTemplate({
        templateId: selectedId ?? undefined,
        body: selectedId ? undefined : body,
        vars,
      });
      setPreviewOut(content);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Preview failed"));
    }
  };

  const confirmDelete = async () => {
    if (!client || !deleteId) return;
    try {
      await client.deleteMessageTemplate(deleteId);
      if (selectedId === deleteId) resetForm();
      setNotice("Template deleted.");
      await loadTemplates();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <ConsoleShell className="max-w-5xl">
      <ConsolePageHeader
        title="Message templates"
        description={
          <>
            Reusable bodies with <code>{"{{var}}"}</code> placeholders. Project:{" "}
            <code>{activeProject?.name || "none"}</code>
          </>
        }
        actions={
          <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {notice ? <Banner variant="success">{notice}</Banner> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel className="rounded-2xl border border-border/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Templates</h2>
            <Button variant="outline" size="sm" onClick={resetForm}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              New
            </Button>
          </div>
          {loading ? (
            <SkeletonCard />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description="Create one to send structured messages via POST /messages with templateId."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === t.id
                        ? "border-brand/40 bg-brand/5"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {t.id} · {formatDateTime(t.updatedAt)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="rounded-2xl border border-border/80 p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {selectedId ? "Edit template" : "New template"}
          </h2>
          <div className="flex flex-col gap-3">
            <label className="text-xs text-muted-foreground">
              Name
              <Input
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="welcome"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Body
              <Textarea
                className="mt-1 min-h-[140px] font-mono text-xs"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hello {{name}}, welcome to the room."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveTemplate()}>Save</Button>
              {selectedId ? (
                <Button variant="outline" onClick={() => setDeleteId(selectedId)}>
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                  Delete
                </Button>
              ) : null}
            </div>

            <hr className="my-2 border-border/60" />

            <label className="text-xs text-muted-foreground">
              Preview vars (JSON)
              <Input
                className="mt-1 font-mono text-xs"
                value={previewVars}
                onChange={(e) => setPreviewVars(e.target.value)}
              />
            </label>
            <Button variant="outline" onClick={() => void runPreview()}>
              Render preview
            </Button>
            {previewOut ? (
              <pre className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {previewOut}
              </pre>
            ) : null}
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete template?"
        description="This cannot be undone. Messages already sent are not affected."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      />
    </ConsoleShell>
  );
}
