import DOMPurify from "dompurify";
import type { ASTNode } from "@syncdoc/shared/types";

interface BlockRendererProps {
  node: ASTNode;
  depth?: number;
}

export function BlockRenderer({ node, depth = 0 }: BlockRendererProps) {
  const sanitizedContent = DOMPurify.sanitize(node.content);

  switch (node.type) {
    case "heading":
      return <HeadingBlock node={node} content={sanitizedContent} />;
    case "code_block":
      return <CodeBlock node={node} content={sanitizedContent} />;
    case "list_item":
      return <ListItemBlock node={node} depth={depth} />;
    case "paragraph":
    default:
      return <ParagraphBlock node={node} content={sanitizedContent} />;
  }
}

function HeadingBlock({ node, content }: { node: ASTNode; content: string }) {
  const level = Number(node.metadata?.["level"] ?? 1);
  const clamped = Math.min(6, Math.max(1, level));
  const Tag = `h${clamped}` as keyof JSX.IntrinsicElements;
  const sizes: Record<number, string> = { 1: "text-2xl", 2: "text-xl", 3: "text-lg", 4: "text-base", 5: "text-sm", 6: "text-xs tracking-widest uppercase" };
  return (
    <Tag className={`${sizes[clamped]} font-extrabold text-[#2E3440] leading-tight`} data-block-id={node._id} data-block-type="heading">
      <span dangerouslySetInnerHTML={{ __html: content || '<span class="text-[#A3B1C6] font-semibold">Untitled heading…</span>' }} />
    </Tag>
  );
}

function CodeBlock({ node, content }: { node: ASTNode; content: string }) {
  return (
    <div className="neu-pressed-sm p-0 overflow-hidden" data-block-id={node._id} data-block-type="code_block">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#D1D9E6]/60">
        <span className="h-3 w-3 rounded-full" style={{ background: "#FF5F56", boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.2)" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#FFBD2E" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#27C93F" }} />
        <span className="ml-auto text-[11px] font-bold tracking-widest uppercase text-[#6B7A90]">Code · AST node</span>
      </div>
      <pre className="bg-transparent text-[#2E3440] p-4 overflow-x-auto font-mono text-[13px] leading-relaxed m-0">
        <code dangerouslySetInnerHTML={{ __html: content || '<span class="text-[#A3B1C6]">// empty code block</span>' }} />
      </pre>
    </div>
  );
}

function ListItemBlock({ node, depth }: { node: ASTNode; depth: number }) {
  return (
    <div className="flex items-start gap-3 my-1" style={{ paddingLeft: `${depth * 1.1}rem` }} data-block-id={node._id} data-block-type="list_item">
      <span className="mt-2 h-2.5 w-2.5 rounded-full shrink-0 neu-pressed flex items-center justify-center" style={{ minWidth: 10, minHeight: 10 }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#6C7BFF]" />
      </span>
      <div className="flex-1 min-w-0">
        <BlockRendererContent node={node} />
        {node.children.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.children.map((child) => (
              <BlockRenderer key={child._id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParagraphBlock({ node, content }: { node: ASTNode; content: string }) {
  return (
    <p className="text-[14.5px] leading-relaxed text-[#2E3440] font-medium" data-block-id={node._id} data-block-type="paragraph">
      <span dangerouslySetInnerHTML={{ __html: content || '<span class="text-[#A3B1C6]">Empty paragraph — click to edit…</span>' }} />
    </p>
  );
}

function BlockRendererContent({ node }: { node: ASTNode }) {
  const sanitized = DOMPurify.sanitize(node.content);
  return <span className="text-[14.5px] leading-relaxed text-[#2E3440] font-medium" dangerouslySetInnerHTML={{ __html: sanitized || '<span class="text-[#A3B1C6]">• empty item</span>' }} />;
}
