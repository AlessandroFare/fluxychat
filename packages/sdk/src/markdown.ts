import type {
  Blockquote,
  Code,
  Content,
  Delete,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  Root,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
} from "mdast";

import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { tableElementToAscii } from "./cards";

export type {
  Blockquote,
  Code,
  Content,
  Delete,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  Root,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
} from "mdast";

export type Nodes = Content | Root;

export function isTextNode(node: Nodes): node is Text {
  return node.type === "text";
}

export function isParagraphNode(node: Nodes): node is Paragraph {
  return node.type === "paragraph";
}

export function isStrongNode(node: Nodes): node is Strong {
  return node.type === "strong";
}

export function isEmphasisNode(node: Nodes): node is Emphasis {
  return node.type === "emphasis";
}

export function isDeleteNode(node: Nodes): node is Delete {
  return node.type === "delete";
}

export function isInlineCodeNode(node: Nodes): node is InlineCode {
  return node.type === "inlineCode";
}

export function isCodeNode(node: Nodes): node is Code {
  return node.type === "code";
}

export function isLinkNode(node: Nodes): node is Link {
  return node.type === "link";
}

export function isBlockquoteNode(node: Nodes): node is Blockquote {
  return node.type === "blockquote";
}

export function isListNode(node: Nodes): node is List {
  return node.type === "list";
}

export function isListItemNode(node: Nodes): node is ListItem {
  return node.type === "listItem";
}

export function isTableNode(node: Nodes): node is Table {
  return node.type === "table";
}

export function isTableRowNode(node: Nodes): node is TableRow {
  return node.type === "tableRow";
}

export function isTableCellNode(node: Nodes): node is TableCell {
  return node.type === "tableCell";
}

export function isHeadingNode(node: Nodes): node is Heading {
  return node.type === "heading";
}

export function getNodeChildren(node: Nodes): Content[] {
  if ("children" in node && Array.isArray(node.children)) {
    return node.children as Content[];
  }
  return [];
}

export function getNodeValue(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  return "";
}

export function parseMarkdown(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm);
  return processor.parse(markdown);
}

export interface StringifyOptions {
  bullet?: "*" | "-" | "+";
  emphasis?: "*" | "_";
}

export function stringifyMarkdown(ast: Root, options?: StringifyOptions): string {
  const processor = unified().use(remarkStringify, options).use(remarkGfm);
  return processor.stringify(ast);
}

export function toPlainText(ast: Root): string {
  return mdastToString(ast);
}

export function markdownToPlainText(markdown: string): string {
  return toPlainText(parseMarkdown(markdown));
}

export function walkAst<T extends Nodes>(node: T, visitor: (node: Content) => Content | null): T {
  if ("children" in node && Array.isArray(node.children)) {
    node.children = node.children
      .map((child) => {
        const result = visitor(child as Content);
        if (result === null) return null;
        return walkAst(result, visitor);
      })
      .filter((n): n is Content => n !== null);
  }
  return node;
}

export function tableToAscii(table: Table): string {
  const rows: string[][] = [];
  for (const row of table.children) {
    const cells: string[] = [];
    for (const cell of row.children) {
      cells.push(mdastToString(cell));
    }
    rows.push(cells);
  }
  if (rows.length === 0) return "";
  return tableElementToAscii(rows[0], rows.slice(1));
}

export function text(value: string): Text {
  return { type: "text", value };
}

export function strong(children: Content[]): Strong {
  return { type: "strong", children: children as Strong["children"] };
}

export function emphasis(children: Content[]): Emphasis {
  return { type: "emphasis", children: children as Emphasis["children"] };
}

export function strikethrough(children: Content[]): Delete {
  return { type: "delete", children: children as Delete["children"] };
}

export function inlineCode(value: string): InlineCode {
  return { type: "inlineCode", value };
}

export function codeBlock(value: string, lang?: string): Code {
  return { type: "code", value, lang };
}

export function link(url: string, children: Content[], title?: string): Link {
  return { type: "link", url, children: children as Link["children"], title };
}

export function blockquote(children: Content[]): Blockquote {
  return { type: "blockquote", children: children as Blockquote["children"] };
}

export function paragraph(children: Content[]): Paragraph {
  return { type: "paragraph", children: children as Paragraph["children"] };
}

export function root(children: Content[]): Root {
  return { type: "root", children: children as Root["children"] };
}
