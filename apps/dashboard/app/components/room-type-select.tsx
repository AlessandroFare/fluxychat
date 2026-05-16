import { ROOM_TYPE_OPTIONS } from "@/lib/room-types";
import { cn } from "@/lib/utils";

interface RoomTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function RoomTypeSelect({ value, onChange, id = "room-type", className, disabled }: RoomTypeSelectProps) {
  return (
    <div className={cn("flex min-w-[10rem] flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        Room type
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {ROOM_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {ROOM_TYPE_OPTIONS.find((o) => o.value === value)?.description ?? "group, public, or dm"}
      </p>
    </div>
  );
}
