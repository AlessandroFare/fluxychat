"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import {
  extractTemplateVarNames,
  FluxyChatClient,
  renderMessageTemplate,
  type FluxyMessageTemplate,
} from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { Button, Input } from "./ui";
import { cn } from "@/lib/utils";

export interface AgentRoomTemplateSelection {
  templateId: string;
  template: FluxyMessageTemplate;
  vars: Record<string, string>;
  renderedPreview: string;
}

interface AgentRoomTemplatePickerProps {
  adminJwt: string;
  disabled?: boolean;
  value: AgentRoomTemplateSelection | null;
  onChange: (value: AgentRoomTemplateSelection | null) => void;
  className?: string;
}

export function AgentRoomTemplatePicker({
  adminJwt,
  disabled = false,
  value,
  onChange,
  className,
}: AgentRoomTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<FluxyMessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [vars, setVars] = useState<Record<string, string>>({});

  const client = useMemo(() => {
    const token = adminJwt.trim();
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId: "console-admin",
      token,
    });
  }, [adminJwt]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const varNames = useMemo(
    () => (selectedTemplate ? extractTemplateVarNames(selectedTemplate.body) : []),
    [selectedTemplate],
  );

  const renderedPreview = useMemo(() => {
    if (!selectedTemplate) return "";
    return renderMessageTemplate(selectedTemplate.body, vars);
  }, [selectedTemplate, vars]);

  const loadTemplates = useCallback(async () => {
    if (!client) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await client.listMessageTemplates();
      setTemplates(rows);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load templates"));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (open && client) void loadTemplates();
  }, [open, client, loadTemplates]);

  useEffect(() => {
    if (!value) {
      setSelectedId("");
      setVars({});
      return;
    }
    setSelectedId(value.templateId);
    setVars(value.vars);
    setOpen(true);
  }, [value]);

  useEffect(() => {
    if (!selectedTemplate) {
      if (value !== null) onChange(null);
      return;
    }
    const missing = varNames.some((k) => !vars[k]?.trim());
    if (missing) {
      if (value !== null) onChange(null);
      return;
    }
    const next: AgentRoomTemplateSelection = {
      templateId: selectedTemplate.id,
      template: selectedTemplate,
      vars,
      renderedPreview,
    };
    if (
      value?.templateId === next.templateId &&
      JSON.stringify(value.vars) === JSON.stringify(next.vars)
    ) {
      return;
    }
    onChange(next);
  }, [selectedTemplate, varNames, vars, renderedPreview, onChange, value]);

  const onSelectId = (id: string) => {
    setSelectedId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      setVars({});
      return;
    }
    const names = extractTemplateVarNames(tpl.body);
    const next: Record<string, string> = {};
    for (const name of names) next[name] = vars[name] ?? "";
    setVars(next);
  };

  if (!adminJwt.trim()) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Admin JWT required to pick message templates.
      </p>
    );
  }

  return (
    <div
      className={cn("rounded-lg border border-border/60 bg-muted/20", className)}
      data-testid="agent-room-template-picker"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className="inline-flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
          {value ? `Template: ${value.template.name}` : "Use message template"}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadTemplates()}
              disabled={loading || disabled}
            >
              {loading ? "Loading…" : "Refresh templates"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedId("");
                  setVars({});
                  onChange(null);
                }}
                disabled={disabled}
              >
                Clear
              </Button>
            ) : null}
          </div>

          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <label className="block text-xs text-muted-foreground">
            Template
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={selectedId}
              onChange={(e) => onSelectId(e.target.value)}
              disabled={disabled || templates.length === 0}
              data-testid="agent-room-template-select"
            >
              <option value="">— Select —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {varNames.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {varNames.map((name) => (
                <label key={name} className="text-xs text-muted-foreground">
                  {`{{${name}}}`}
                  <Input
                    className="mt-1 font-mono text-xs"
                    value={vars[name] ?? ""}
                    onChange={(e) =>
                      setVars((prev) => ({ ...prev, [name]: e.target.value }))
                    }
                    disabled={disabled}
                    data-testid={`agent-room-template-var-${name}`}
                  />
                </label>
              ))}
            </div>
          ) : selectedTemplate ? (
            <p className="text-xs text-muted-foreground">No variables in this template.</p>
          ) : null}

          {selectedTemplate && renderedPreview ? (
            <pre
              className="max-h-24 overflow-auto rounded-md border border-border/50 bg-background/80 p-2 text-xs whitespace-pre-wrap"
              data-testid="agent-room-template-preview"
            >
              {renderedPreview}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
