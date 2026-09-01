import { describe, it, expect } from "vitest";
import { sanitizeContent, astToHtml, astToPdfStructure, markdownToAstMarkdown } from "../utils/transform.js";
import type { ASTNodeDoc } from "../models/ASTDocument.js";

const mkNode = (over: Partial<ASTNodeDoc> = {}): ASTNodeDoc =>
  ({
    _id: crypto.randomUUID(),
    type: "paragraph",
    content: "hello",
    children: [],
    parentId: null,
    level: 0,
    order: 0,
    metadata: {},
    createdBy: "tester",
    updatedBy: "tester",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ASTNodeDoc);

describe("Transformation Pipeline (DOMPurify)", () => {
  it("should block <script> XSS", () => {
    const out = sanitizeContent('<script>alert(1)</script>hello');
    expect(out).not.toContain("<script>");
    expect(out).toContain("hello");
  });

  it("should block javascript: and onerror fragments", () => {
    const out = sanitizeContent('<img src=x onerror=alert(1)> <a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<img");
  });

  it("should export AST to sanitized HTML", () => {
    const nodes: ASTNodeDoc[] = [
      mkNode({ type: "heading", content: "Title", metadata: { level: 2 } }),
      mkNode({ type: "code_block", content: "<script>evil</script>code" }),
    ];
    const html = astToHtml(nodes);
    expect(html).toContain("<h2");
    expect(html).toContain("<pre");
    expect(html).not.toContain("<script>");
  });

  it("should export AST to PDF structure with plain text", () => {
    const nodes: ASTNodeDoc[] = [mkNode({ content: "<b>bold</b> text <script>x</script>" })];
    const pdf = astToPdfStructure(nodes);
    expect(pdf[0]!.text).toBe("bold text");
    expect(pdf[0]!.text).not.toContain("<script>");
  });

  it("should map Markdown → JSON (layout diagram sanity)", () => {
    const md = "# Heading\nParagraph line\n- list item\n```js\ncode\n```";
    const nodes = markdownToAstMarkdown(md, "tester");
    expect(nodes.map((n) => n.type)).toEqual(["heading", "paragraph", "list_item", "code_block"]);
  });
});
