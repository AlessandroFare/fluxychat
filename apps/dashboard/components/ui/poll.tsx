"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, CheckCircle2, Clock, Loader2, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVote?: string | null;
  closed: boolean;
  type: "single" | "multi";
  endsAt?: string | null;
}

interface PollViewProps {
  poll: PollData;
  onVote: (optionId: string) => Promise<void>;
  onClose?: () => Promise<void>;
  canManage?: boolean;
}

export function PollView({ poll, onVote, onClose, canManage }: PollViewProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const hasVoted = Boolean(poll.userVote);
  const maxVotes = Math.max(...poll.options.map((o) => o.votes), 1);
  const isExpired = poll.endsAt ? new Date(poll.endsAt) < new Date() : false;
  const showResults = hasVoted || poll.closed || isExpired;

  const handleVote = async (optionId: string) => {
    if (showResults || voting) return;
    setVoting(optionId);
    try { await onVote(optionId); } finally { setVoting(null); }
  };

  return (
    <div className="mt-1.5 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          {poll.question}
        </div>
        {poll.closed && (
          <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">Closed</span>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {poll.options.map((opt) => {
          const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
          const isUserVote = opt.id === poll.userVote;
          const isVotingThis = voting === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={showResults}
              onClick={() => handleVote(opt.id)}
              className={cn(
                "relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-xs transition-all",
                showResults
                  ? "border-border cursor-default"
                  : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
                isUserVote && showResults && "border-primary/40 bg-primary/5",
              )}
            >
              {showResults && (
                <div
                  className="absolute inset-y-0 left-0 rounded-l bg-primary/8 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between">
                <span className={cn("flex items-center gap-1.5", isUserVote && showResults && "font-semibold")}>
                  {isUserVote && showResults && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  {opt.text}
                </span>
                {showResults && (
                  <span className="text-[10px] text-muted-foreground">
                    {opt.votes} ({pct}%)
                  </span>
                )}
                {isVotingThis && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2">
          {!hasVoted && !poll.closed && !isExpired && (
            <span className="text-primary/60">Tap to vote</span>
          )}
          {isExpired && !poll.closed && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Ended</span>
          )}
          {canManage && !poll.closed && onClose && (
            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1" onClick={async () => { setClosing(true); try { await onClose(); } finally { setClosing(false); } }} disabled={closing}>
              {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface PollCreateProps {
  onCreate: (question: string, options: string[]) => Promise<void>;
}

export function PollCreate({ onCreate }: PollCreateProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);

  const addOption = () => setOptions((p) => [...p, ""]);
  const removeOption = (i: number) => setOptions((p) => p.filter((_, idx) => idx !== i));
  const updateOption = (i: number, val: string) => setOptions((p) => { const n = [...p]; n[i] = val; return n; });

  const handleCreate = async () => {
    if (!question.trim() || options.filter((o) => o.trim()).length < 2) return;
    setCreating(true);
    try { await onCreate(question.trim(), options.filter((o) => o.trim())); setQuestion(""); setOptions(["", ""]); } finally { setCreating(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold"><BarChart3 className="h-3.5 w-3.5" /> Create poll</h4>
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question..." className="mt-2 text-xs" />
      <div className="mt-2 space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className="flex-1 text-xs" />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addOption} disabled={options.length >= 10}>
          <Plus className="h-3 w-3 mr-1" /> Add option
        </Button>
        <Button size="sm" className="h-6 text-xs" onClick={handleCreate} disabled={creating || !question.trim() || options.filter((o) => o.trim()).length < 2}>
          {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Create poll
        </Button>
      </div>
    </div>
  );
}
