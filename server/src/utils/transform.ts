import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import type { ASTNodeDoc } from "../models/ASTDocument.js";

const { window: jsdomWindow } = new JSDOM("");
const DOMPurify = createDOMPurify(jsdomWindow as unknown as Parameters<typeof createDOMPurify>[0]);

/**
 * Strict DOMPurify config - blocks XSS fragments within saved blocks
 * Reference: OWASP XSS prevention, DOMPurify hardening
 */
const PURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "pre",
    "code",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "br",
    "span",
    "div",
    "blockquote",
  ],
  ALLOWED_ATTR: ["class", "data-block-id", "data-block-type"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "img", "svg", "math", "link", "meta"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "onchange",
    "onsubmit",
    "src",
    "href",
    "xlink:href",
    "style",
  ],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  USE_PROFILES: { html: true },
};

export function sanitizeContent(dirty: string): string {
  if (!dirty) return "";
  // Strip any attempt to inject via protocol handlers before purify
  const preStripped = dirty.replace(/javascript\s*:/gi, "").replace(/data\s*:/gi, "");
  return DOMPurify.sanitize(preStripped, PURIFY_CONFIG) as unknown as string;
}

/**
 * Escape text for safe HTML when content is plain text (no allowed markup)
 * We sanitize first, then wrap.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export interface HtmlExportOptions {
  sanitize: boolean;
}

export function astNodeToHtml(node: ASTNodeDoc, opts: HtmlExportOptions = { sanitize: true }): string {
  const raw = opts.sanitize ? sanitizeContent(node.content) : node.content;
  // If sanitized result still contains HTML-like allowed tags, trust PURIFY; otherwise escape
  const safeContent = raw || "";

  switch (node.type) {
    case "heading": {
      const lvl = typeof node.metadata?.level === "number" ? node.metadata.level : 1;
      const clamped = Math.max(1, Math.min(6, Number(lvl) || 1));
      return `<h${clamped} data-block-id="${escapeHtml(node._id)}" data-block-type="heading">${safeContent || "<br/>"}</h${clamped}>`;
    }
    case "code_block": {
      return `<pre data-block-id="${escapeHtml(node._id)}" data-block-type="code_block"><code>${escapeHtml(sanitizeContent(node.content))}</code></pre>`;
    }
    case "list_item": {
      const childrenHtml = node.children.map((c) => astNodeToHtml(c, opts)).join("");
      const nested = childrenHtml ? `<ul>${childrenHtml}</ul>` : "";
      return `<li data-block-id="${escapeHtml(node._id)}" data-block-type="list_item"><span>${safeContent}</span>${nested}</li>`;
    }
    case "paragraph":
    default: {
      return `<p data-block-id="${escapeHtml(node._id)}" data-block-type="paragraph">${safeContent || "<br/>"}</p>`;
    }
  }
}

export function astToHtml(rootNodes: ASTNodeDoc[], opts: HtmlExportOptions = { sanitize: true }): string {
  const body = rootNodes.map((n) => astNodeToHtml(n, opts)).join("\n");
  // Top-level list_items should be wrapped; we already handle per-item, but wrap consecutive lis for valid HTML
  // For simplicity, wrap all in article and let CSS handle; sanitize outer template too
  const wrapped = `<article class="syncdoc-ast">${body}</article>`;
  return opts.sanitize ? (DOMPurify.sanitize(wrapped, PURIFY_CONFIG) as unknown as string) : wrapped;
}

// PDF structures - clean, sanitized text only, no HTML
export interface PdfBlock {
  id: string;
  type: string;
  level?: number;
  text: string;
  children: PdfBlock[];
}

export function astToPdfStructure(rootNodes: ASTNodeDoc[]): PdfBlock[] {
  function toText(content: string): string {
    // Strip all tags after sanitization, return plain text
    const sanitized = sanitizeContent(content);
    // Remove any remaining tags via JSDOM textContent
    const dom = new JSDOM(`<div>${sanitized}</div>`);
    return dom.window.document.body.textContent?.trim() ?? "";
  }

  function convert(nodes: ASTNodeDoc[]): PdfBlock[] {
    return nodes.map((n) => ({
      id: n._id,
      type: n.type,
      level: n.type === "heading" ? Number(n.metadata?.level ?? 1) : undefined,
      text: toText(n.content),
      children: n.children.length > 0 ? convert(n.children) : [],
    }));
  }
  return convert(rootNodes);
}

/**
 * Utility mapping Markdown → JSON (for Mid-Project Review diagrams)
 * Simplified: supports #, ##, ``` code blocks, - list items
 */
export function markdownToAstMarkdown(md: string, createdBy: string): ASTNodeDoc[] {
  const lines = md.split("\n");
  const nodes: ASTNodeDoc[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let codeId: string | null = null;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeBuffer = [];
        codeId = crypto.randomUUID();
      } else {
        inCode = false;
        nodes.push({
          _id: codeId!,
          type: "code_block",
          content: sanitizeContent(codeBuffer.join("\n")),
          children: [],
          parentId: null,
          level: 0,
          order: nodes.length,
          metadata: {},
          createdBy,
          updatedBy: createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const match = line.match(/^(#{1,6})\s+(.*)/);
      if (match) {
        nodes.push({
          _id: crypto.randomUUID(),
          type: "heading",
          content: sanitizeContent(match[2] ?? ""),
          children: [],
          parentId: null,
          level: 0,
          order: nodes.length,
          metadata: { level: match[1]!.length },
          createdBy,
          updatedBy: createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      nodes.push({
        _id: crypto.randomUUID(),
        type: "list_item",
        content: sanitizeContent(line.replace(/^\s*[-*]\s+/, "")),
        children: [],
        parentId: null,
        level: 0,
        order: nodes.length,
        metadata: {},
        createdBy,
        updatedBy: createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      continue;
    }
    if (line.trim().length === 0) continue;
    nodes.push({
      _id: crypto.randomUUID(),
      type: "paragraph",
      content: sanitizeContent(line),
      children: [],
      parentId: null,
      level: 0,
      order: nodes.length,
      metadata: {},
      createdBy,
      updatedBy: createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return nodes;
}
