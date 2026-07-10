/**
 * P22-C1: Card element types for rich message rendering.
 * Type-only export — runtime implementation lives in worker.
 * SDK consumers use these types for multi-platform card rendering.
 */

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

export function Card(opts: {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  children: CardChild[];
}): CardElement {
  throw new Error("Card not implemented in SDK - use worker runtime");
}

export function Text(opts: {
  content: string;
  style?: TextStyle;
}): TextElement {
  throw new Error("Text not implemented in SDK - use worker runtime");
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
  throw new Error("Button not implemented in SDK - use worker runtime");
}

export function LinkButton(opts: {
  url: string;
  label: string;
  style?: ButtonStyle;
  id?: string;
}): LinkButtonElement {
  throw new Error("LinkButton not implemented in SDK - use worker runtime");
}

export function Image(opts: {
  url: string;
  alt?: string;
}): ImageElement {
  throw new Error("Image not implemented in SDK - use worker runtime");
}

export function Divider(): DividerElement {
  throw new Error("Divider not implemented in SDK - use worker runtime");
}

export function Actions(opts: {
  children: Array<ButtonElement | LinkButtonElement>;
}): ActionsElement {
  throw new Error("Actions not implemented in SDK - use worker runtime");
}

export function Section(opts: {
  children: CardChild[];
}): SectionElement {
  throw new Error("Section not implemented in SDK - use worker runtime");
}

export function Field(opts: {
  label: string;
  value: string;
}): FieldElement {
  throw new Error("Field not implemented in SDK - use worker runtime");
}

export function Fields(opts: {
  fields: FieldElement[];
  alignment?: TableAlignment;
}): FieldsElement {
  throw new Error("Fields not implemented in SDK - use worker runtime");
}

export function Link(opts: {
  url: string;
  text?: string;
}): LinkElement {
  throw new Error("Link not implemented in SDK - use worker runtime");
}

export function Table(opts: {
  headers: string[];
  rows: string[][];
  alignment?: TableAlignment[];
}): TableElement {
  throw new Error("Table not implemented in SDK - use worker runtime");
}

export function cardToFallbackText(element: AnyCardElement): string {
  throw new Error("cardToFallbackText not implemented in SDK - use worker runtime");
}
export function cardToMarkdown(element: AnyCardElement): string {
  throw new Error("cardToMarkdown not implemented in SDK - use worker runtime");
}
