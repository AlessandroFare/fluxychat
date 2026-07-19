import { describe, it, expect } from "vitest";
import {
  text,
  strong,
  emphasis,
  strikethrough,
  inlineCode,
  codeBlock,
  link,
  blockquote,
  paragraph,
  root,
  parseMarkdown,
  stringifyMarkdown,
  toPlainText,
  markdownToPlainText,
  walkAst,
  getNodeChildren,
  getNodeValue,
  tableToAscii,
  isTextNode,
  isParagraphNode,
  isStrongNode,
  isEmphasisNode,
  isDeleteNode,
  isInlineCodeNode,
  isCodeNode,
  isLinkNode,
  isBlockquoteNode,
  isListNode,
  isListItemNode,
  isTableNode,
  isTableRowNode,
  isTableCellNode,
  isHeadingNode,
} from "./markdown";

describe("builder functions", () => {
  it("text creates a text node", () => {
    const n = text("hello");
    expect(n).toEqual({ type: "text", value: "hello" });
    expect(isTextNode(n)).toBe(true);
  });

  it("strong creates a bold node", () => {
    const n = strong([text("bold")]);
    expect(n.type).toBe("strong");
    expect(getNodeChildren(n)).toHaveLength(1);
    expect(isStrongNode(n)).toBe(true);
  });

  it("emphasis creates italic node", () => {
    const n = emphasis([text("italic")]);
    expect(n.type).toBe("emphasis");
    expect(isEmphasisNode(n)).toBe(true);
  });

  it("strikethrough creates delete node", () => {
    const n = strikethrough([text("struck")]);
    expect(n.type).toBe("delete");
    expect(isDeleteNode(n)).toBe(true);
  });

  it("inlineCode creates inline code node", () => {
    const n = inlineCode("const x = 1");
    expect(n).toEqual({ type: "inlineCode", value: "const x = 1" });
    expect(isInlineCodeNode(n)).toBe(true);
  });

  it("codeBlock creates code block node", () => {
    const n = codeBlock("let x = 1", "js");
    expect(n).toEqual({ type: "code", value: "let x = 1", lang: "js" });
    expect(isCodeNode(n)).toBe(true);
  });

  it("codeBlock creates code block without lang", () => {
    const n = codeBlock("plain text");
    expect(n).toEqual({ type: "code", value: "plain text", lang: undefined });
  });

  it("link creates link node", () => {
    const n = link("https://example.com", [text("example")], "Example");
    expect(n.type).toBe("link");
    expect(n.url).toBe("https://example.com");
    expect(n.title).toBe("Example");
    expect(isLinkNode(n)).toBe(true);
  });

  it("link creates link node without title", () => {
    const n = link("https://example.com", [text("example")]);
    expect(n.title).toBeUndefined();
  });

  it("blockquote creates blockquote node", () => {
    const n = blockquote([paragraph([text("quote")])]);
    expect(n.type).toBe("blockquote");
    expect(isBlockquoteNode(n)).toBe(true);
  });

  it("paragraph creates paragraph node", () => {
    const n = paragraph([text("para")]);
    expect(n.type).toBe("paragraph");
    expect(isParagraphNode(n)).toBe(true);
  });

  it("root creates root node", () => {
    const n = root([paragraph([text("hello")]), paragraph([text("world")])]);
    expect(n.type).toBe("root");
    expect(n.children).toHaveLength(2);
  });
});

describe("type guards", () => {
  it("isTextNode returns false for non-text nodes", () => {
    expect(isTextNode(paragraph([]))).toBe(false);
    expect(isTextNode(strong([]))).toBe(false);
  });

  it("isParagraphNode returns false for non-paragraph nodes", () => {
    expect(isParagraphNode(text("hi"))).toBe(false);
  });

  it("isHeadingNode detects heading nodes", () => {
    const ast = parseMarkdown("# Title\n\nBody");
    expect(isHeadingNode(ast.children[0])).toBe(true);
  });

  it("isListNodetects list nodes", () => {
    const ast = parseMarkdown("- item");
    expect(isListNode(ast.children[0])).toBe(true);
  });

  it("isTableNode detects table nodes", () => {
    const ast = parseMarkdown("| A | B |\n|---|---|");
    expect(isTableNode(ast.children[0])).toBe(true);
  });
});

describe("parseMarkdown", () => {
  it("parses simple text", () => {
    const ast = parseMarkdown("hello");
    expect(ast.type).toBe("root");
    expect(ast.children).toHaveLength(1);
    expect(isParagraphNode(ast.children[0])).toBe(true);
  });

  it("parses multiple paragraphs", () => {
    const ast = parseMarkdown("para one\n\npara two");
    expect(ast.children).toHaveLength(2);
  });

  it("parses bold text", () => {
    const ast = parseMarkdown("**bold**");
    const p = ast.children[0] as any;
    expect(isStrongNode(p.children[0])).toBe(true);
  });

  it("parses italic text", () => {
    const ast = parseMarkdown("*italic*");
    const p = ast.children[0] as any;
    expect(isEmphasisNode(p.children[0])).toBe(true);
  });

  it("parses strikethrough (GFM)", () => {
    const ast = parseMarkdown("~~strikethrough~~");
    const p = ast.children[0] as any;
    expect(isDeleteNode(p.children[0])).toBe(true);
  });

  it("parses inline code", () => {
    const ast = parseMarkdown("`code`");
    const p = ast.children[0] as any;
    expect(isInlineCodeNode(p.children[0])).toBe(true);
  });

  it("parses code blocks", () => {
    const ast = parseMarkdown("```js\nconst x = 1\n```");
    expect(isCodeNode(ast.children[0])).toBe(true);
    expect((ast.children[0] as any).lang).toBe("js");
  });

  it("parses links", () => {
    const ast = parseMarkdown("[text](https://example.com)");
    const p = ast.children[0] as any;
    expect(isLinkNode(p.children[0])).toBe(true);
    expect((p.children[0] as any).url).toBe("https://example.com");
  });

  it("parses blockquotes", () => {
    const ast = parseMarkdown("> quote");
    expect(isBlockquoteNode(ast.children[0])).toBe(true);
  });

  it("parses lists", () => {
    const ast = parseMarkdown("- a\n- b\n- c");
    expect(isListNode(ast.children[0])).toBe(true);
  });

  it("parses GFM tables", () => {
    const ast = parseMarkdown("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(isTableNode(ast.children[0])).toBe(true);
  });

  it("parses headings", () => {
    const ast = parseMarkdown("## Section");
    expect(isHeadingNode(ast.children[0])).toBe(true);
    expect((ast.children[0] as any).depth).toBe(2);
  });

  it("handles empty string", () => {
    const ast = parseMarkdown("");
    expect(ast.children).toHaveLength(0);
  });
});

describe("stringifyMarkdown", () => {
  it("stringifies a root with paragraphs", () => {
    const ast = root([paragraph([text("hello")]), paragraph([text("world")])]);
    expect(stringifyMarkdown(ast)).toBe("hello\n\nworld\n");
  });

  it("stringifies bold text", () => {
    const ast = root([paragraph([strong([text("bold")])])]);
    expect(stringifyMarkdown(ast)).toBe("**bold**\n");
  });

  it("stringifies links", () => {
    const ast = root([paragraph([link("https://example.com", [text("example")])])]);
    expect(stringifyMarkdown(ast)).toMatch("[example](https://example.com)");
  });

  it("accepts options", () => {
    const ast = root([paragraph([strong([text("bold")])])]);
    const result = stringifyMarkdown(ast, { emphasis: "_", bullet: "-" });
    expect(result).toBe("**bold**\n");
  });

  it("roundtrips complex markdown", () => {
    const md = "# Title\n\n**bold** and *italic* and `code`\n\n- list item\n\n> blockquote";
    const ast = parseMarkdown(md);
    const result = stringifyMarkdown(ast);
    expect(parseMarkdown(result)).toBeDefined();
  });

  it("roundtrips a table", () => {
    const md = "| A | B |\n| - | - |\n| 1 | 2 |\n";
    const ast = parseMarkdown(md);
    const result = stringifyMarkdown(ast);
    expect(result).toContain("|");
  });
});

describe("toPlainText", () => {
  it("extracts plain text from AST", () => {
    const ast = parseMarkdown("**bold** and *italic*");
    expect(toPlainText(ast)).toBe("bold and italic");
  });

  it("strips links", () => {
    const ast = parseMarkdown("[text](https://example.com)");
    expect(toPlainText(ast)).toBe("text");
  });

  it("strips code blocks", () => {
    const ast = parseMarkdown("```js\ncode\n```");
    expect(toPlainText(ast)).toBe("code");
  });
});

describe("markdownToPlainText", () => {
  it("converts markdown string to plain text", () => {
    expect(markdownToPlainText("**bold** and _italic_")).toBe("bold and italic");
  });

  it("handles empty string", () => {
    expect(markdownToPlainText("")).toBe("");
  });

  it("preserves regular text", () => {
    expect(markdownToPlainText("hello world")).toBe("hello world");
  });
});

describe("walkAst", () => {
  it("transforms all text nodes", () => {
    const ast = parseMarkdown("hello **world**");
    walkAst(ast, (node) => {
      if (isTextNode(node)) return { ...node, value: node.value.toUpperCase() } as any;
      return node;
    });
    expect(toPlainText(ast)).toBe("HELLO WORLD");
  });

  it("removes nodes by returning null", () => {
    const ast = parseMarkdown("**remove** keep");
    walkAst(ast, (node) => {
      if (isStrongNode(node)) return null;
      return node;
    });
    expect(toPlainText(ast).trim()).toBe("keep");
  });

  it("does not modify text when visitor returns unchanged", () => {
    const ast = parseMarkdown("hello world");
    walkAst(ast, (node) => node);
    expect(toPlainText(ast)).toBe("hello world");
  });
});

describe("getNodeChildren", () => {
  it("returns children for parent nodes", () => {
    const n = strong([text("a"), text("b")]);
    expect(getNodeChildren(n)).toHaveLength(2);
  });

  it("returns empty array for leaf nodes", () => {
    expect(getNodeChildren(text("leaf"))).toEqual([]);
  });
});

describe("getNodeValue", () => {
  it("returns value for leaf nodes", () => {
    expect(getNodeValue(text("hello"))).toBe("hello");
  });

  it("returns empty string for parent nodes", () => {
    expect(getNodeValue(paragraph([]))).toBe("");
  });
});

describe("tableToAscii", () => {
  it("renders a markdown table as ASCII", () => {
    const ast = parseMarkdown("| Name | Age |\n|------|-----|\n| Alice | 30 |");
    const table = ast.children[0] as any;
    const result = tableToAscii(table);
    expect(result).toContain("Name");
    expect(result).toContain("Alice");
    expect(result).toContain("|");
  });

  it("handles single-row table", () => {
    const ast = parseMarkdown("| X |\n|---|");
    const table = ast.children[0] as any;
    const result = tableToAscii(table);
    expect(result).toContain("X");
  });

  it("handles empty table", () => {
    expect(tableToAscii({ type: "table", children: [] } as any)).toBe("");
  });
});
