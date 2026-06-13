interface ConsoleStatRowProps {
  label: string;
  value: React.ReactNode;
}

export function ConsoleStatRow({ label, value }: ConsoleStatRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
