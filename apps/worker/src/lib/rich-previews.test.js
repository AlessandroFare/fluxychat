import { describe, it, expect } from "vitest";
import {
  renderMarkdown,
  extractMarkdownFeatures,
  detectFileType,
  generateRichPreview,
} from "./rich-previews.js";

describe("rich-previews", () => {
  describe("renderMarkdown", () => {
    it("renders headers", () => {
      const html = renderMarkdown("# Title\n## Subtitle");
      expect(html).toContain("<h1>Title</h1>");
      expect(html).toContain("<h2>Subtitle</h2>");
    });

    it("renders bold and italic", () => {
      expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
      expect(renderMarkdown("*italic*")).toContain("<em>italic</em>");
      expect(renderMarkdown("***bold italic***")).toContain("<strong><em>bold italic</em></strong>");
    });

    it("renders inline code", () => {
      const html = renderMarkdown("Use `console.log` here");
      expect(html).toContain('<code class="md-inline-code">console.log</code>');
    });

    it("renders fenced code blocks", () => {
      const md = "```javascript\nconst x = 1;\n```";
      const html = renderMarkdown(md);
      expect(html).toContain('<pre class="md-code-block">');
      expect(html).toContain('class="language-javascript"');
      expect(html).toContain("const x = 1;");
    });

    it("renders links", () => {
      const html = renderMarkdown("[Google](https://google.com)");
      expect(html).toContain('<a href="https://google.com"');
      expect(html).toContain("Google</a>");
    });

    it("renders images", () => {
      const html = renderMarkdown("![alt](https://img.png)");
      expect(html).toContain('<img src="https://img.png" alt="alt"');
    });

    it("renders tables", () => {
      const md = "| A | B |\n|---|---|\n| 1 | 2 |";
      const html = renderMarkdown(md);
      expect(html).toContain("<table");
      expect(html).toContain("<th>A</th>");
      expect(html).toContain("<td>1</td>");
    });

    it("renders blockquotes", () => {
      const html = renderMarkdown("> quoted text");
      expect(html).toContain("<blockquote>");
      expect(html).toContain("quoted text");
    });

    it("renders lists", () => {
      const html = renderMarkdown("- item 1\n- item 2");
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>item 1</li>");
      expect(html).toContain("<li>item 2</li>");
    });

    it("renders ordered lists", () => {
      const html = renderMarkdown("1. first\n2. second");
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>first</li>");
    });

    it("renders horizontal rules", () => {
      expect(renderMarkdown("---")).toContain("<hr>");
    });

    it("renders strikethrough", () => {
      expect(renderMarkdown("~~deleted~~")).toContain("<del>deleted</del>");
    });

    it("escapes HTML in code blocks", () => {
      const html = renderMarkdown("```\n<script>alert(1)</script>\n```");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>");
    });

    it("returns empty string for falsy input", () => {
      expect(renderMarkdown("")).toBe("");
      expect(renderMarkdown(null)).toBe("");
      expect(renderMarkdown(undefined)).toBe("");
    });
  });

  describe("extractMarkdownFeatures", () => {
    it("detects code blocks", () => {
      const md = "text\n```js\nconst x = 1;\n```\nmore";
      const features = extractMarkdownFeatures(md);
      expect(features.hasCode).toBe(true);
      expect(features.codeBlocks.length).toBe(1);
      expect(features.codeBlocks[0].lang).toBe("js");
    });

    it("detects tables", () => {
      const features = extractMarkdownFeatures("| A | B |\n|---|---|\n| 1 | 2 |");
      expect(features.hasTable).toBe(true);
    });

    it("extracts links", () => {
      const features = extractMarkdownFeatures("[link1](url1) and https://example.com");
      expect(features.hasLinks).toBe(true);
      expect(features.links.length).toBe(2);
    });

    it("extracts headings", () => {
      const features = extractMarkdownFeatures("# H1\n## H2\n### H3");
      expect(features.headings).toEqual(["H1", "H2", "H3"]);
    });

    it("counts words", () => {
      const features = extractMarkdownFeatures("hello world foo bar");
      expect(features.wordCount).toBe(4);
    });

    it("returns defaults for empty input", () => {
      const features = extractMarkdownFeatures("");
      expect(features.hasCode).toBe(false);
      expect(features.hasTable).toBe(false);
      expect(features.hasLinks).toBe(false);
      expect(features.wordCount).toBe(0);
    });
  });

  describe("detectFileType", () => {
    it("detects image MIME", () => {
      const result = detectFileType({ mimeType: "image/png" });
      expect(result.icon).toBe("🖼️");
      expect(result.category).toBe("image");
      expect(result.isPreviewable).toBe(true);
    });

    it("detects PDF", () => {
      const result = detectFileType({ filename: "doc.pdf" });
      expect(result.icon).toBe("📄");
      expect(result.category).toBe("document");
      expect(result.isPreviewable).toBe(true);
    });

    it("detects code files by extension", () => {
      const result = detectFileType({ filename: "app.py" });
      expect(result.icon).toBe("🐍");
      expect(result.category).toBe("code");
      expect(result.isPreviewable).toBe(true);
    });

    it("detects archive files", () => {
      const result = detectFileType({ filename: "backup.zip" });
      expect(result.icon).toBe("📦");
      expect(result.category).toBe("archive");
      expect(result.isPreviewable).toBe(false);
    });

    it("detects video files", () => {
      const result = detectFileType({ mimeType: "video/mp4" });
      expect(result.icon).toBe("🎬");
      expect(result.category).toBe("video");
      expect(result.isPreviewable).toBe(true);
    });

    it("detects audio files", () => {
      const result = detectFileType({ mimeType: "audio/mpeg" });
      expect(result.icon).toBe("🎵");
      expect(result.category).toBe("audio");
      expect(result.isPreviewable).toBe(true);
    });

    it("returns generic icon for unknown type", () => {
      const result = detectFileType({ filename: "unknown.xyz" });
      expect(result.icon).toBe("📎");
      expect(result.category).toBe("file");
    });

    it("truncates long filenames", () => {
      const result = detectFileType({ filename: "a".repeat(50) + ".txt" });
      expect(result.label.length).toBeLessThan(55);
      expect(result.label).toContain("...");
    });
  });

  describe("generateRichPreview", () => {
    it("generates preview for markdown content", () => {
      const preview = generateRichPreview({
        content: "# Title\n\nSome text with **bold** and `code`.",
      });
      expect(preview.hasCode).toBe(false);
      expect(preview.markdown.headings).toContain("Title");
      expect(preview.needsExpandedView).toBe(false);
    });

    it("generates preview with attachments", () => {
      const preview = generateRichPreview({
        content: "Check this out",
        attachments: [{ filename: "photo.jpg", mimeType: "image/jpeg" }],
      });
      expect(preview.hasAttachments).toBe(true);
      expect(preview.attachmentCount).toBe(1);
      expect(preview.attachments[0].category).toBe("image");
    });

    it("marks large content as needing expanded view", () => {
      const longContent = "word ".repeat(250);
      const preview = generateRichPreview({ content: longContent });
      expect(preview.needsExpandedView).toBe(true);
    });

    it("marks code blocks as needing expanded view", () => {
      const preview = generateRichPreview({
        content: "```js\nconst x = 1;\n```",
      });
      expect(preview.needsExpandedView).toBe(true);
      expect(preview.hasCode).toBe(true);
    });

    it("marks tables as needing expanded view", () => {
      const preview = generateRichPreview({
        content: "| A | B |\n|---|---|\n| 1 | 2 |",
      });
      expect(preview.needsExpandedView).toBe(true);
      expect(preview.hasTable).toBe(true);
    });

    it("handles empty input", () => {
      const preview = generateRichPreview({ content: "", attachments: [] });
      expect(preview.hasAttachments).toBe(false);
      expect(preview.needsExpandedView).toBe(false);
    });
  });
});
