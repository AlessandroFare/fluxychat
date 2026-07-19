export type ButtonStyle = "primary" | "danger" | "default";
export type TextStyle = "plain" | "bold" | "muted";
export type TableAlignment = "left" | "center" | "right";
export type ActionType = "action" | "modal";

export interface ButtonElement {
  type: "button";
  id: string;
  label: string;
  style?: ButtonStyle;
  actionType?: ActionType;
  value?: string;
  callbackUrl?: string;
  disabled?: boolean;
}

export interface LinkButtonElement {
  type: "link-button";
  url: string;
  label: string;
  style?: ButtonStyle;
  id?: string;
}

export interface TextElement {
  type: "text";
  content: string;
  style?: TextStyle;
}

export interface ImageElement {
  type: "image";
  url: string;
  alt?: string;
}

export interface DividerElement {
  type: "divider";
}

export interface ActionsElement {
  type: "actions";
  children: Array<ButtonElement | LinkButtonElement>;
}

export interface SectionElement {
  type: "section";
  children: CardChild[];
}

export interface FieldElement {
  type: "field";
  label: string;
  value: string;
}

export interface FieldsElement {
  type: "fields";
  fields: FieldElement[];
  alignment?: TableAlignment;
}

export interface LinkElement {
  type: "link";
  url: string;
  text?: string;
}

export interface TableElement {
  type: "table";
  headers: string[];
  rows: string[][];
  alignment?: TableAlignment[];
}

export type CardChild =
  | TextElement
  | ButtonElement
  | LinkButtonElement
  | ImageElement
  | DividerElement
  | ActionsElement
  | SectionElement
  | FieldElement
  | FieldsElement
  | LinkElement
  | TableElement;

export interface CardElement {
  type: "card";
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  children: CardChild[];
}

export type AnyCardElement = CardElement | CardChild;

export function isCardElement(value: unknown): value is CardElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as CardElement).type === "card"
  );
}

export function Card(opts: {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  children: CardChild[];
}): CardElement {
  return {
    type: "card",
    title: opts.title,
    subtitle: opts.subtitle,
    imageUrl: opts.imageUrl,
    children: opts.children,
  };
}

export function Text(opts: {
  content: string;
  style?: TextStyle;
}): TextElement {
  return { type: "text", content: opts.content, style: opts.style };
}

export function Button(opts: {
  id: string;
  label: string;
  style?: ButtonStyle;
  actionType?: ActionType;
  value?: string;
  callbackUrl?: string;
  disabled?: boolean;
}): ButtonElement {
  return {
    type: "button",
    id: opts.id,
    label: opts.label,
    style: opts.style,
    actionType: opts.actionType,
    value: opts.value,
    callbackUrl: opts.callbackUrl,
    disabled: opts.disabled,
  };
}

export function LinkButton(opts: {
  url: string;
  label: string;
  style?: ButtonStyle;
  id?: string;
}): LinkButtonElement {
  return {
    type: "link-button",
    url: opts.url,
    label: opts.label,
    style: opts.style,
    id: opts.id,
  };
}

export function Image(opts: {
  url: string;
  alt?: string;
}): ImageElement {
  return { type: "image", url: opts.url, alt: opts.alt };
}

export function Divider(): DividerElement {
  return { type: "divider" };
}

export function Actions(opts: {
  children: Array<ButtonElement | LinkButtonElement>;
}): ActionsElement {
  return { type: "actions", children: opts.children };
}

export function Section(opts: {
  children: CardChild[];
}): SectionElement {
  return { type: "section", children: opts.children };
}

export function Field(opts: {
  label: string;
  value: string;
}): FieldElement {
  return { type: "field", label: opts.label, value: opts.value };
}

export function Fields(opts: {
  fields: FieldElement[];
  alignment?: TableAlignment;
}): FieldsElement {
  return { type: "fields", fields: opts.fields, alignment: opts.alignment };
}

export function Link(opts: {
  url: string;
  text?: string;
}): LinkElement {
  return { type: "link", url: opts.url, text: opts.text };
}

export function Table(opts: {
  headers: string[];
  rows: string[][];
  alignment?: TableAlignment[];
}): TableElement {
  return { type: "table", headers: opts.headers, rows: opts.rows, alignment: opts.alignment };
}

export function tableElementToAscii(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  const colCount = Math.max(...allRows.map((r) => r.length));
  if (colCount === 0) return "";
  const colWidths: number[] = Array.from({ length: colCount }, () => 0);
  for (const row of allRows) {
    for (let i = 0; i < colCount; i++) {
      const cellLen = (row[i] || "").length;
      if (cellLen > colWidths[i]) colWidths[i] = cellLen;
    }
  }
  const formatRow = (cells: string[]): string =>
    Array.from({ length: colCount }, (_, i) => (cells[i] || "").padEnd(colWidths[i]))
      .join(" | ")
      .trimEnd();
  const lines: string[] = [];
  lines.push(formatRow(headers));
  lines.push(colWidths.map((w) => "-".repeat(w)).join("-|-"));
  for (const row of rows) lines.push(formatRow(row));
  return lines.join("\n");
}

function cardChildToFallbackText(child: CardChild): string | null {
  switch (child.type) {
    case "text":
      return child.style === "bold" ? `**${child.content}**` : child.content;
    case "link":
      return child.text ? `${child.text} (${child.url})` : child.url;
    case "fields":
      return child.fields.map((f) => `${f.label}: ${f.value}`).join("\n");
    case "actions":
      return null;
    case "table":
      return tableElementToAscii(child.headers, child.rows);
    case "section":
      return child.children
        .map((c) => cardChildToFallbackText(c))
        .filter((s): s is string => s !== null)
        .join("\n");
    default:
      return null;
  }
}

export function cardToFallbackText(element: AnyCardElement): string {
  if (element.type === "card") {
    const parts: string[] = [];
    if (element.title) parts.push(`**${element.title}**`);
    if (element.subtitle) parts.push(element.subtitle);
    for (const child of element.children) {
      const text = cardChildToFallbackText(child);
      if (text) parts.push(text);
    }
    return parts.join("\n");
  }
  return cardChildToFallbackText(element as CardChild) ?? "";
}

function cardChildToMarkdown(child: CardChild, indent?: string): string | null {
  const i = indent ?? "";
  switch (child.type) {
    case "text":
      if (child.style === "bold") return `${i}**${child.content}**`;
      if (child.style === "muted") return `${i}_${child.content}_`;
      return `${i}${child.content}`;
    case "link":
      return child.text ? `${i}[${child.text}](${child.url})` : `${i}${child.url}`;
    case "fields":
      return child.fields.map((f) => `${i}**${f.label}:** ${f.value}`).join("\n");
    case "actions":
      return null;
    case "table":
      return `${i}\`\`\`\n${tableElementToAscii(child.headers, child.rows)}\n${i}\`\`\``;
    case "section":
      return child.children
        .map((c) => cardChildToMarkdown(c, i))
        .filter((s): s is string => s !== null)
        .join("\n");
    case "divider":
      return `${i}---`;
    case "image":
      return child.alt ? `${i}![${child.alt}](${child.url})` : `${i}![](${child.url})`;
    case "button":
    case "link-button":
    case "field":
      return null;
    default:
      return null;
  }
}

export function cardToMarkdown(element: AnyCardElement): string {
  if (element.type === "card") {
    const parts: string[] = [];
    if (element.title) parts.push(`# ${element.title}`);
    if (element.subtitle) parts.push(`## ${element.subtitle}`);
    for (const child of element.children) {
      const md = cardChildToMarkdown(child);
      if (md) parts.push(md);
    }
    return parts.join("\n\n");
  }
  return cardChildToMarkdown(element as CardChild) ?? "";
}
