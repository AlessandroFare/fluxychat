"use client";

import { cn } from "@/lib/utils";
import type {
  CardChild,
  CardElement,
  ButtonElement,
  LinkButtonElement,
  TextElement,
  FieldsElement,
  TableElement,
  ImageElement,
} from "@fluxy-chat/sdk";

interface InteractiveCardRendererProps {
  card: CardElement;
  className?: string;
  onAction?: (button: ButtonElement) => void;
}

export function InteractiveCardRenderer({ card, className, onAction }: InteractiveCardRendererProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 shadow-sm", className)}>
      {card.title ? (
        <h4 className="mb-2 border-b border-border pb-2 text-sm font-semibold text-foreground">{card.title}</h4>
      ) : null}
      <div className="space-y-2">
        {card.children.map((child, index) => (
          <CardChildView key={`${child.type}-${index}`} child={child} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

function CardChildView({
  child,
  onAction,
}: {
  child: CardChild;
  onAction?: (button: ButtonElement) => void;
}) {
  switch (child.type) {
    case "text":
      return <TextView el={child} />;
    case "button":
      return (
        <button
          type="button"
          disabled={child.disabled}
          onClick={() => onAction?.(child)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            child.style === "primary" && "bg-primary text-primary-foreground",
            child.style === "danger" && "bg-red-600 text-white",
            (!child.style || child.style === "default") && "border border-border bg-background",
            child.disabled && "opacity-50",
          )}
        >
          {child.label}
        </button>
      );
    case "link-button": {
      const link = child as LinkButtonElement;
      return (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {link.label}
        </a>
      );
    }
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={(child as ImageElement).url}
          alt={(child as ImageElement).alt ?? ""}
          className="max-h-48 max-w-full rounded-lg border border-border object-cover"
        />
      );
    case "divider":
      return <hr className="border-border" />;
    case "fields":
      return <FieldsView el={child as FieldsElement} />;
    case "table":
      return <TableView el={child as TableElement} />;
    case "section":
      return (
        <div className="space-y-1 rounded-md bg-muted/30 p-2">
          {child.children.map((c, i) => (
            <CardChildView key={i} child={c} onAction={onAction} />
          ))}
        </div>
      );
    case "actions":
      return (
        <div className="flex flex-wrap gap-2">
          {child.children.map((c, i) => (
            <CardChildView key={i} child={c} onAction={onAction} />
          ))}
        </div>
      );
    default:
      return null;
  }
}

function TextView({ el }: { el: TextElement }) {
  return (
    <p
      className={cn(
        "text-sm",
        el.style === "bold" && "font-bold",
        el.style === "muted" && "text-muted-foreground",
      )}
    >
      {el.content}
    </p>
  );
}

function FieldsView({ el }: { el: FieldsElement }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {el.fields.map((f, i) => (
        <div key={i} className="rounded-md bg-muted/40 px-2 py-1">
          <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
          <p className="text-sm text-foreground">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

function TableView({ el }: { el: TableElement }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {el.headers.map((h, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {el.rows.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-border/50">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-2 py-1">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
