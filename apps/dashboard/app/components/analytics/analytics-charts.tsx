import { formatNumber } from "@/lib/format-number";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "success" | "warning" | "danger";
}

const accentRing: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "border-border bg-white",
  success: "border-emerald-200/80 bg-emerald-50/50",
  warning: "border-amber-200/80 bg-amber-50/50",
  danger: "border-red-200/80 bg-red-50/50",
};

export function StatCard({ label, value, hint, accent = "default" }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border p-4 shadow-[var(--shadow-subtle)]", accentRing[accent])}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface BarItem {
  label: string;
  value: number;
  formatted?: string;
  color?: string;
}

export function HorizontalBarChart({ items, unit = "" }: { items: BarItem[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.min(100, (item.value / max) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.formatted ?? formatNumber(item.value)}
                {unit}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color ?? "oklch(0.7328 0.0960 -106.08)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
}

export function UsageMeter({ label, used, limit }: UsageMeterProps) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface HealthGaugeProps {
  label: string;
  value: number;
  max?: number;
  format?: (v: number) => string;
  ok?: boolean;
}

export function HealthGauge({ label, value, max = 100, format, ok }: HealthGaugeProps) {
  const pct = Math.min(100, (value / max) * 100);
  const display = format ? format(value) : `${value.toFixed(1)}%`;
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          ok === false ? "text-red-700" : ok ? "text-emerald-700" : "text-foreground",
        )}
      >
        {display}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", ok === false ? "bg-red-500" : ok ? "bg-emerald-500" : "bg-slate-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = (cumulative / total) * 100;
    cumulative += seg.value;
    const end = (cumulative / total) * 100;
    return `${seg.color} ${start}% ${end}%`;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div
        className="relative h-36 w-36 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
        role="img"
        aria-label={centerLabel}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>
          <span className="font-heading text-lg font-bold text-foreground">{centerValue}</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="tabular-nums text-muted-foreground">{((seg.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

