"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Minus,
  Plus,
  Send,
  Table as TableIcon,
  Text as TextIcon,
  Trash2,
  Type,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "../components/ui";
import { useDashboardSession } from "../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";
import type {
  CardChild,
  TextElement,
  ButtonElement,
  ImageElement,
  FieldsElement,
  FieldElement,
  TableElement,
  DividerElement,
  CardElement,
} from "@fluxy-chat/sdk";

/* -------------------------------------------------------------------------- */
/*  Types & helpers                                                           */
/* -------------------------------------------------------------------------- */

type ElementType = "text" | "button" | "image" | "fields" | "table" | "divider";

interface BuilderElement {
  id: string;
  type: ElementType;
  // text
  content?: string;
  textStyle?: "plain" | "bold" | "muted";
  // button
  buttonLabel?: string;
  buttonStyle?: "primary" | "danger" | "default";
  buttonId?: string;
  // image
  imageUrl?: string;
  imageAlt?: string;
  // fields
  fields?: Array<{ label: string; value: string }>;
  // table
  tableHeaders?: string[];
  tableRows?: string[][];
}

let elementIdCounter = 0;
function nextId(): string {
  elementIdCounter += 1;
  return `el-${elementIdCounter}`;
}

function elementsToCardChildren(elements: BuilderElement[]): CardChild[] {
  return elements.map((el): CardChild => {
    switch (el.type) {
      case "text":
        return {
          type: "text",
          content: el.content ?? "",
          style: el.textStyle,
        } as TextElement;
      case "button":
        return {
          type: "button",
          id: el.buttonId ?? el.id,
          label: el.buttonLabel ?? "Button",
          style: el.buttonStyle ?? "default",
        } as ButtonElement;
      case "image":
        return {
          type: "image",
          url: el.imageUrl ?? "",
          alt: el.imageAlt,
        } as ImageElement;
      case "fields":
        return {
          type: "fields",
          fields: (el.fields ?? []).map((f) => ({ label: f.label, value: f.value }) as FieldElement),
        } as FieldsElement;
      case "table":
        return {
          type: "table",
          headers: el.tableHeaders ?? [],
          rows: el.tableRows ?? [],
        } as TableElement;
      case "divider":
        return { type: "divider" } as DividerElement;
      default:
        return { type: "text", content: "" } as TextElement;
    }
  });
}

function elementsToCode(elements: BuilderElement[], format: "function" | "jsx"): string {
  const children = elementsToCardChildren(elements);

  if (format === "jsx") {
    const childrenJSX = children
      .map((c) => {
        switch (c.type) {
          case "text":
            return `      <Text content="${(c as TextElement).content}" style="${(c as TextElement).style ?? "plain"}" />`;
          case "button":
            return `      <Button id="${(c as ButtonElement).id}" label="${(c as ButtonElement).label}" style="${(c as ButtonElement).style ?? "default"}" />`;
          case "image":
            return `      <Image url="${(c as ImageElement).url}" alt="${(c as ImageElement).alt ?? ""}" />`;
          case "fields":
            return `      <Fields fields={[${(c as FieldsElement).fields
              .map((f) => `{ label: "${f.label}", value: "${f.value}" }`)
              .join(", ")}]} />`;
          case "table":
            return `      <Table headers={${JSON.stringify((c as TableElement).headers)}} rows={${JSON.stringify((c as TableElement).rows)}} />`;
          case "divider":
            return `      <Divider />`;
          default:
            return "";
        }
      })
      .filter(Boolean)
      .join("\n");

    return `import { Card, Text, Button, Image, Fields, Table, Divider } from "@fluxy-chat/sdk";

const myCard = (
  <Card title="My Card">
${childrenJSX}
  </Card>
);`;
  }

  // function API
  const childrenFn = children
    .map((c) => {
      switch (c.type) {
        case "text":
          return `    Text({ content: "${(c as TextElement).content}", style: "${(c as TextElement).style ?? "plain"}" }),`;
        case "button":
          return `    Button({ id: "${(c as ButtonElement).id}", label: "${(c as ButtonElement).label}", style: "${(c as ButtonElement).style ?? "default"}" }),`;
        case "image":
          return `    Image({ url: "${(c as ImageElement).url}", alt: "${(c as ImageElement).alt ?? ""}" }),`;
        case "fields":
          return `    Fields({ fields: [${(c as FieldsElement).fields
            .map((f) => `{ label: "${f.label}", value: "${f.value}" }`)
            .join(", ")}] }),`;
        case "table":
          return `    Table({ headers: ${JSON.stringify((c as TableElement).headers)}, rows: ${JSON.stringify((c as TableElement).rows)} }),`;
        case "divider":
          return `    Divider(),`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  return `import { Card, Text, Button, Image, Fields, Table, Divider } from "@fluxy-chat/sdk";

const myCard = Card({
  title: "My Card",
  children: [
${childrenFn}
  ],
});`;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const ELEMENT_ADDERS: { type: ElementType; label: string; icon: typeof TextIcon }[] = [
  { type: "text", label: "Text", icon: TextIcon },
  { type: "button", label: "Button", icon: Plus },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "fields", label: "Fields", icon: Type },
  { type: "table", label: "Table", icon: TableIcon },
  { type: "divider", label: "Divider", icon: Minus },
];

export default function PlaygroundPage() {
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const workerUrl = getPublicWorkerUrl();

  const [cardTitle, setCardTitle] = useState("My Card");
  const [elements, setElements] = useState<BuilderElement[]>([
    { id: nextId(), type: "text", content: "Hello from FluxyChat!", textStyle: "bold" },
    { id: nextId(), type: "button", buttonLabel: "Click me", buttonStyle: "primary", buttonId: "btn-1" },
  ]);
  const [codeFormat, setCodeFormat] = useState<"function" | "jsx">("function");
  const [copied, setCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const authHeaders = useMemo<HeadersInit>(() => {
    const token = adminJwt.trim() || memberJwt.trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, [adminJwt, memberJwt]);

  const addElement = useCallback((type: ElementType) => {
    const base: BuilderElement = { id: nextId(), type };
    switch (type) {
      case "text":
        base.content = "New text";
        base.textStyle = "plain";
        break;
      case "button":
        base.buttonLabel = "New Button";
        base.buttonStyle = "default";
        base.buttonId = `btn-${Date.now()}`;
        break;
      case "image":
        base.imageUrl = "https://placehold.co/300x200";
        base.imageAlt = "Placeholder";
        break;
      case "fields":
        base.fields = [
          { label: "Name", value: "Alice" },
          { label: "Role", value: "Admin" },
        ];
        break;
      case "table":
        base.tableHeaders = ["Col A", "Col B"];
        base.tableRows = [["1", "2"], ["3", "4"]];
        break;
      case "divider":
        break;
    }
    setElements((prev) => [...prev, base]);
  }, []);

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<BuilderElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const moveElement = useCallback((id: string, dir: -1 | 1) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  const generatedCode = useMemo(
    () => elementsToCode(elements, codeFormat),
    [elements, codeFormat],
  );

  const cardJson = useMemo(() => {
    const cardEl: CardElement = {
      type: "card",
      title: cardTitle || undefined,
      children: elementsToCardChildren(elements),
    };
    return cardEl;
  }, [cardTitle, elements]);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [generatedCode]);

  const sendCard = useCallback(
    async (roomId: string) => {
      setSending(true);
      setSendStatus(null);
      try {
        const res = await fetch(`${workerUrl}/api/cards/send`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ roomId, card: cardJson }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setSendStatus("Card sent successfully!");
      } catch (err) {
        setSendStatus(err instanceof Error ? err.message : "Failed to send card");
      } finally {
        setSending(false);
      }
    },
    [cardJson, workerUrl, authHeaders],
  );

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Card Builder Playground"
        description={
          <>
            Compose rich interactive cards visually, preview the result, copy the code, and send it
            to a room.{" "}
            <Link href="/docs" className="text-brand underline underline-offset-2">
              Card docs →
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left: Builder */}
        <div className="min-w-0 space-y-4">
          {/* Card title */}
          <Panel title="Card settings">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Card title</label>
            <Input
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              placeholder="Card title (optional)"
            />
          </Panel>

          {/* Add elements */}
          <Panel title="Add elements">
            <div className="flex flex-wrap gap-2">
              {ELEMENT_ADDERS.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addElement(type)}
                >
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </Panel>

          {/* Element list */}
          <Panel title={`Elements (${elements.length})`}>
            {elements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No elements yet. Add some above.</p>
            ) : (
              <div className="space-y-3">
                {elements.map((el, idx) => (
                  <div
                    key={el.id}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {el.type} #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveElement(el.id, -1)}
                          disabled={idx === 0}
                          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveElement(el.id, 1)}
                          disabled={idx === elements.length - 1}
                          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeElement(el.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Type-specific editors */}
                    {el.type === "text" && (
                      <div className="space-y-2">
                        <Textarea
                          value={el.content ?? ""}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateElement(el.id, { content: e.target.value })}
                          rows={2}
                          className="text-sm"
                        />
                        <select
                          value={el.textStyle ?? "plain"}
                          onChange={(e) => updateElement(el.id, { textStyle: e.target.value as TextElement["style"] })}
                          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                        >
                          <option value="plain">Plain</option>
                          <option value="bold">Bold</option>
                          <option value="muted">Muted</option>
                        </select>
                      </div>
                    )}

                    {el.type === "button" && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={el.buttonLabel ?? ""}
                          onChange={(e) => updateElement(el.id, { buttonLabel: e.target.value })}
                          placeholder="Label"
                          className="text-sm"
                        />
                        <Input
                          value={el.buttonId ?? ""}
                          onChange={(e) => updateElement(el.id, { buttonId: e.target.value })}
                          placeholder="ID"
                          className="text-sm"
                        />
                        <select
                          value={el.buttonStyle ?? "default"}
                          onChange={(e) => updateElement(el.id, { buttonStyle: e.target.value as ButtonElement["style"] })}
                          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                        >
                          <option value="default">Default</option>
                          <option value="primary">Primary</option>
                          <option value="danger">Danger</option>
                        </select>
                      </div>
                    )}

                    {el.type === "image" && (
                      <div className="space-y-2">
                        <Input
                          value={el.imageUrl ?? ""}
                          onChange={(e) => updateElement(el.id, { imageUrl: e.target.value })}
                          placeholder="Image URL"
                          className="text-sm"
                        />
                        <Input
                          value={el.imageAlt ?? ""}
                          onChange={(e) => updateElement(el.id, { imageAlt: e.target.value })}
                          placeholder="Alt text"
                          className="text-sm"
                        />
                      </div>
                    )}

                    {el.type === "fields" && (
                      <div className="space-y-2">
                        {(el.fields ?? []).map((field, fIdx) => (
                          <div key={fIdx} className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={field.label}
                              onChange={(e) => {
                                const fields = [...(el.fields ?? [])];
                                fields[fIdx] = { ...fields[fIdx], label: e.target.value };
                                updateElement(el.id, { fields });
                              }}
                              placeholder="Label"
                              className="text-sm"
                            />
                            <Input
                              value={field.value}
                              onChange={(e) => {
                                const fields = [...(el.fields ?? [])];
                                fields[fIdx] = { ...fields[fIdx], value: e.target.value };
                                updateElement(el.id, { fields });
                              }}
                              placeholder="Value"
                              className="text-sm"
                            />
                            <button
                              onClick={() => {
                                const fields = (el.fields ?? []).filter((_, i) => i !== fIdx);
                                updateElement(el.id, { fields });
                              }}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateElement(el.id, {
                              fields: [...(el.fields ?? []), { label: "New", value: "" }],
                            })
                          }
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add field
                        </Button>
                      </div>
                    )}

                    {el.type === "table" && (
                      <div className="space-y-2">
                        <Input
                          value={(el.tableHeaders ?? []).join(", ")}
                          onChange={(e) =>
                            updateElement(el.id, {
                              tableHeaders: e.target.value.split(",").map((s) => s.trim()),
                            })
                          }
                          placeholder="Headers (comma-separated)"
                          className="text-sm"
                        />
                        {(el.tableRows ?? []).map((row, rIdx) => (
                          <div key={rIdx} className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={row.join(", ")}
                              onChange={(e) => {
                                const tableRows = [...(el.tableRows ?? [])];
                                tableRows[rIdx] = e.target.value.split(",").map((s) => s.trim());
                                updateElement(el.id, { tableRows });
                              }}
                              placeholder="Row (comma-separated)"
                              className="text-sm"
                            />
                            <button
                              onClick={() => {
                                const tableRows = (el.tableRows ?? []).filter((_, i) => i !== rIdx);
                                updateElement(el.id, { tableRows });
                              }}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateElement(el.id, {
                              tableRows: [...(el.tableRows ?? []), ["", ""]],
                            })
                          }
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add row
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right: Preview + Code */}
        <div className="min-w-0 space-y-4">
          {/* Live preview */}
          <Panel title="Live preview">
            <CardPreview title={cardTitle} elements={elements} />
          </Panel>

          {/* Generated code */}
          <Panel title="Generated code">
            <div className="mb-3 flex items-center justify-end gap-2">
              <div className="flex rounded-md border border-border">
                <button
                  onClick={() => setCodeFormat("function")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    codeFormat === "function"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Function
                </button>
                <button
                  onClick={() => setCodeFormat("jsx")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    codeFormat === "jsx"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  JSX
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={copyCode}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
              {generatedCode}
            </pre>
          </Panel>

          {/* Send to room */}
          {activeProject ? (
            <Panel title="Send to room">
              <SendCardForm sending={sending} status={sendStatus} onSend={sendCard} />
            </Panel>
          ) : (
            <Panel title="Send to room">
              <p className="text-sm text-muted-foreground">
                Connect a project to send cards to a room.{" "}
                <Link href="/onboarding" className="text-brand underline underline-offset-2">
                  Get started →
                </Link>
              </p>
            </Panel>
          )}
        </div>
      </div>
    </ConsoleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card Preview                                                              */
/* -------------------------------------------------------------------------- */

function CardPreview({ title, elements }: { title: string; elements: BuilderElement[] }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      {title ? (
        <h3 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-foreground">
          {title}
        </h3>
      ) : null}
      <div className="space-y-2">
        {elements.length === 0 ? (
          <p className="text-xs text-muted-foreground">Empty card. Add elements to see preview.</p>
        ) : null}
        {elements.map((el) => {
          switch (el.type) {
            case "text":
              return (
                <p
                  key={el.id}
                  className={cn(
                    "text-sm",
                    el.textStyle === "bold" && "font-bold",
                    el.textStyle === "muted" && "text-muted-foreground",
                  )}
                >
                  {el.content}
                </p>
              );
            case "button":
              return (
                <button
                  key={el.id}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    el.buttonStyle === "primary" && "bg-primary text-white",
                    el.buttonStyle === "danger" && "bg-red-600 text-white",
                    el.buttonStyle === "default" && "border border-border bg-background text-foreground",
                  )}
                  disabled
                >
                  {el.buttonLabel}
                </button>
              );
            case "image":
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={el.id}
                  src={el.imageUrl}
                  alt={el.imageAlt ?? ""}
                  className="max-h-40 max-w-full rounded-lg border border-border object-cover"
                />
              );
            case "fields":
              return (
                <div key={el.id} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(el.fields ?? []).map((f, i) => (
                    <div key={i} className="rounded-md bg-muted/40 px-2 py-1">
                      <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                      <p className="text-sm text-foreground">{f.value}</p>
                    </div>
                  ))}
                </div>
              );
            case "table":
              return (
                <div key={el.id} className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {(el.tableHeaders ?? []).map((h, i) => (
                          <th key={i} className="px-2 py-1 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(el.tableRows ?? []).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-border/50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            case "divider":
              return <hr key={el.id} className="border-border" />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Send Card Form                                                            */
/* -------------------------------------------------------------------------- */

function SendCardForm({
  sending,
  status,
  onSend,
}: {
  sending: boolean;
  status: string | null;
  onSend: (roomId: string) => void;
}) {
  const [roomId, setRoomId] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room ID"
          className="text-sm"
        />
        <Button
          variant="default"
          disabled={sending || !roomId.trim()}
          onClick={() => onSend(roomId.trim())}
        >
          {sending ? <Loader2Icon /> : <Send className="h-3.5 w-3.5" />}
          Send
        </Button>
      </div>
      {status ? (
        <p
          className={cn(
            "text-xs",
            status.includes("success") ? "text-emerald-600" : "text-red-600",
          )}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

function Loader2Icon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
