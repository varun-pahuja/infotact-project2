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

function HeadingBlock({
  node,
  content,
}: {
  node: ASTNode;
  content: string;
}) {
  const level = Number(node.metadata?.["level"] ?? 1);
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <Tag
      className="font-bold text-slate-900 mb-2"
      style={{ fontSize: `${1.8 - level * 0.2}rem` }}
      data-block-id={node._id}
      data-block-type="heading"
    >
      <span dangerouslySetInnerHTML={{ __html: content }} />
    </Tag>
  );
}

function CodeBlock({
  node,
  content,
}: {
  node: ASTNode;
  content: string;
}) {
  return (
    <pre
      className="bg-slate-900 text-slate-100 rounded-lg p-4 my-3 overflow-x-auto font-mono text-sm"
      data-block-id={node._id}
      data-block-type="code_block"
    >
      <code dangerouslySetInnerHTML={{ __html: content }} />
    </pre>
  );
}

function ListItemBlock({
  node,
  depth,
}: {
  node: ASTNode;
  depth: number;
}) {
  return (
    <div
      className="flex items-start gap-2 my-1"
      style={{ paddingLeft: `${depth * 1.5}rem` }}
      data-block-id={node._id}
      data-block-type="list_item"
    >
      <span className="mt-2 h-2 w-2 rounded-full bg-slate-400 shrink-0" />
      <div className="flex-1">
        <BlockRendererContent node={node} />
        {node.children.map((child) => (
          <BlockRenderer key={child._id} node={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

function ParagraphBlock({
  node,
  content,
}: {
  node: ASTNode;
  content: string;
}) {
  return (
    <p
      className="text-slate-700 leading-relaxed my-2"
      data-block-id={node._id}
      data-block-type="paragraph"
    >
      <span dangerouslySetInnerHTML={{ __html: content }} />
    </p>
  );
}

function BlockRendererContent({ node }: { node: ASTNode }) {
  const sanitized = DOMPurify.sanitize(node.content);
  return (
    <span
      className="text-slate-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
