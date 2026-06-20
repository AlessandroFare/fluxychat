"use client";

import React from "react";
import { Settings2, X } from "lucide-react";
import { Button, Input } from "./ui";

export interface ModelParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string;
}

interface ModelParamsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: ModelParams;
  onChange: (patch: Partial<ModelParams>) => void;
}

export function ModelParamsPanel({ open, onOpenChange, params, onChange }: ModelParamsPanelProps) {
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(!open)}>
        <Settings2 className="mr-1 h-3.5 w-3.5" />
        Model params
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => onOpenChange(false)} />
          <div className="relative z-50 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Model parameters</h3>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <ParamSlider
                label="Temperature"
                hint="Controls randomness. Lower = deterministic, higher = creative."
                min={0} max={2} step={0.1}
                value={params.temperature}
                onChange={(v) => onChange({ temperature: v })}
              />

              <ParamInput
                label="Max tokens"
                hint="Maximum tokens in the response."
                type="number"
                value={String(params.maxTokens)}
                onChange={(v) => onChange({ maxTokens: parseInt(v) || 1024 })}
              />

              <ParamSlider
                label="Top P"
                hint="Nucleus sampling. Alternative to temperature."
                min={0} max={1} step={0.05}
                value={params.topP}
                onChange={(v) => onChange({ topP: v })}
              />

              <ParamSlider
                label="Frequency penalty"
                hint="Penalizes repeated tokens."
                min={-2} max={2} step={0.1}
                value={params.frequencyPenalty}
                onChange={(v) => onChange({ frequencyPenalty: v })}
              />

              <ParamSlider
                label="Presence penalty"
                hint="Penalizes tokens that have appeared."
                min={-2} max={2} step={0.1}
                value={params.presencePenalty}
                onChange={(v) => onChange({ presencePenalty: v })}
              />

              <ParamInput
                label="Stop sequences"
                hint="Comma-separated. Stops generation when encountered."
                type="text"
                value={params.stopSequences}
                onChange={(v) => onChange({ stopSequences: v })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ParamSlider({ label, hint, min, max, step, value = 0, onChange }: {
  label: string; hint?: string; min: number; max: number; step: number;
  value?: number; onChange: (v: number) => void;
}) {
  const display = typeof value === "number" ? value.toFixed(step < 0.1 ? 1 : 2) : String(value ?? 0);
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{display}</span>
      </span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </label>
  );
}

function ParamInput({ label, hint, type, value, onChange }: {
  label: string; hint?: string; type: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </label>
  );
}
