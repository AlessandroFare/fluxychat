"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Gavel, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export interface DecisionProgress {
  role: string;
  required: number;
  current: number;
  ackedBy: Array<{ userId: string; ackedAt: string }>;
}

export interface DecisionData {
  messageId: number;
  content: string;
  state: "pending" | "decided" | "expired_no_quorum";
  progress: DecisionProgress[];
  totalRequired: number;
  totalCurrent: number;
  quorumMet: boolean;
  expiresAt: string;
  acks: Array<{ userId: string; role: string; ackedAt: string }>;
}

interface DecisionViewProps {
  decision: DecisionData;
  currentUserId?: string;
  onAck: () => Promise<void>;
}

export function DecisionView({ decision, currentUserId, onAck }: DecisionViewProps) {
  const [busy, setBusy] = useState(false);
  const hasAcked = decision.acks.some((a) => a.userId === currentUserId);
  const isPending = decision.state === "pending";
  const isExpired = decision.state === "expired_no_quorum";
  const pct =
    decision.totalRequired > 0
      ? Math.min(100, Math.round((decision.totalCurrent / decision.totalRequired) * 100))
      : 0;

  return (
    <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Gavel className="h-3.5 w-3.5 text-amber-600" />
          Decision
        </div>
        {decision.state === "decided" ? (
          <span className="shrink-0 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-700">
            Decided
          </span>
        ) : null}
        {isExpired ? (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Expired
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-foreground">{decision.content}</p>

      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>
            Quorum {decision.totalCurrent}/{decision.totalRequired}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              decision.quorumMet ? "bg-green-500" : "bg-amber-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="mt-2 space-y-1">
        {decision.progress.map((p) => (
          <li key={p.role} className="flex justify-between text-[10px] text-muted-foreground">
            <span className="capitalize">{p.role}</span>
            <span>
              {p.current}/{p.required}
              {p.ackedBy.length > 0
                ? ` · ${p.ackedBy.map((a) => a.userId.slice(0, 8)).join(", ")}`
                : ""}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        {isPending && !isExpired ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Until {new Date(decision.expiresAt).toLocaleString()}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground" />
        )}
        {isPending && !hasAcked ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAck();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
            Confirm
          </Button>
        ) : hasAcked ? (
          <span className="flex items-center gap-1 text-[10px] text-green-600">
            <CheckCircle2 className="h-3 w-3" /> You confirmed
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface DecisionCreateProps {
  onCreate: (content: string, requiredRoles: Array<{ role: string; count: number }>, ttlHours: number) => Promise<void>;
}

export function DecisionCreate({ onCreate }: DecisionCreateProps) {
  const [content, setContent] = useState("");
  const [role, setRole] = useState("admin");
  const [count, setCount] = useState(2);
  const [ttlHours, setTtlHours] = useState(48);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold">
        <Gavel className="h-3.5 w-3.5" /> Create decision
      </h4>
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What needs approval?"
        className="mt-2 text-xs"
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className="text-xs" />
        <Input
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="text-xs"
        />
        <Input
          type="number"
          min={1}
          max={720}
          value={ttlHours}
          onChange={(e) => setTtlHours(Number(e.target.value))}
          placeholder="Hours"
          className="text-xs"
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Need {count} member(s) with role &quot;{role}&quot; within {ttlHours}h
      </p>
      <Button
        size="sm"
        className="mt-2 h-6 text-xs"
        disabled={busy || !content.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate(content.trim(), [{ role: role.trim(), count }], ttlHours);
            setContent("");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        Post decision
      </Button>
    </div>
  );
}
