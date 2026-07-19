"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";

const PRESET_STATUSES = [
  { emoji: "📅", text: "In a meeting" },
  { emoji: "🎯", text: "Deep work" },
  { emoji: "☕", text: "Coffee break" },
  { emoji: "🍕", text: "Lunch" },
  { emoji: "🏖️", text: "On vacation" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🚗", text: "Commuting" },
  { emoji: "💻", text: "Working" },
  { emoji: "🔴", text: "Busy" },
  { emoji: "💬", text: "Available" },
];

const EXPIRATION_OPTIONS = [
  { value: 0, label: "Don't clear" },
  { value: 1800, label: "30 min" },
  { value: 3600, label: "1 hour" },
  { value: 14400, label: "4 hours" },
  { value: 86400, label: "Today" },
];

interface CustomStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmoji?: string | null;
  currentText?: string | null;
  onSave: (emoji: string | null, text: string | null) => Promise<void>;
}

export function CustomStatusDialog({ open, onOpenChange, currentEmoji, currentText, onSave }: CustomStatusDialogProps) {
  const [emoji, setEmoji] = useState(currentEmoji || "💬");
  const [text, setText] = useState(currentText || "");
  const [expiration, setExpiration] = useState(3600);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(emoji || null, text.trim() || null);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onOpenChange(false); }, 800);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onSave(null, null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set custom status</DialogTitle>
          <DialogDescription>Let others know what you're up to.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-14 text-center text-lg"
            placeholder="😀"
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's your status?"
            className="flex-1"
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_STATUSES.map((preset) => (
              <button
                key={preset.text}
                type="button"
                onClick={() => { setEmoji(preset.emoji); setText(preset.text); }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:bg-muted/40"
              >
                <span>{preset.emoji}</span>
                <span>{preset.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Clear after</p>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={expiration}
            onChange={(e) => setExpiration(Number(e.target.value))}
          >
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button size="sm" variant="ghost" onClick={handleClear} disabled={saving}>
            Clear status
          </Button>
          <div className="flex items-center gap-2">
            {success && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
