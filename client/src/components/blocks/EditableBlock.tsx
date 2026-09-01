import { memo, useRef, useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import type { ASTNode } from "@syncdoc/shared/types";

interface EditableBlockProps {
  node: ASTNode;
  isActive: boolean;
  isLockedByOther: boolean;
  lockedBy?: { name: string; color: string };
  presenceCount?: number;
  onFocus: (id: string) => void;
  onChange: (id: string, content: string) => void;
  onCursor?: (blockId: string | null, position: number) => void;
  onLock?: (blockId: string) => void;
  onUnlock?: (blockId: string) => void;
}

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  const t = useRef<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(
    ((...args: Parameters<T>) => {
      if (t.current) window.clearTimeout(t.current);
      t.current = window.setTimeout(() => fnRef.current(...(args as never[])), delay);
    }) as T,
    [delay]
  );
}

export const EditableBlock = memo(function EditableBlock({ node, isActive, isLockedByOther, lockedBy, onFocus, onChange, onCursor, onLock, onUnlock }: EditableBlockProps) {
  const [local, setLocal] = useState(node.content);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setLocal(node.content), [node.content]);

  const debouncedChange = useDebouncedCallback((val: string) => onChange(node._id, val), 120);

  const handleChange = (val: string) => {
    if (isLockedByOther) return;
    setLocal(val);
    debouncedChange(val as never);
  };

  const handleFocus = () => {
    onFocus(node._id);
    onLock?.(node._id);
    // cursor at end
    onCursor?.(node._id, local.length);
  };
  const handleBlur = () => onUnlock?.(node._id);

  const handleSelect = () => {
    const el = taRef.current;
    if (!el) return;
    onCursor?.(node._id, el.selectionStart ?? 0);
  };

  const isCode = node.type === "code_block";
  const isHeading = node.type === "heading";

  return (
    <div className={`relative transition-all ${isActive ? "scale-[1.01]" : ""}`}>
      {/* Incoming delta indicator - hidden unless isActive */}
      <div className="absolute -left-1 top-0 bottom-0 w-1 rounded-full pointer-events-none" style={{ background: isActive ? "#6C7BFF" : isLockedByOther ? (lockedBy?.color ?? "#FFB86C") : "transparent", opacity: isActive || isLockedByOther ? 1 : 0 }} />

      {/* Header meta */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-extrabold tracking-widest uppercase px-2 py-1 rounded-full neu-pressed-sm text-[#6B7A90]">{node.type}</span>
        <span className="text-xs font-mono text-[#6B7A90]">{node._id.slice(0, 8)}</span>
        {isLockedByOther && lockedBy && <span className="ml-auto flex items-center gap-1.5 text-xs font-bold" style={{ color: lockedBy.color }}><span className="h-2 w-2 rounded-full" style={{ background: lockedBy.color }} /> {lockedBy.name} editing</span>}
        {isActive && !isLockedByOther && <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-[#6C7BFF]"><span className="h-2 w-2 rounded-full bg-[#6C7BFF] presence-dot" /> You editing</span>}
        {!isActive && !isLockedByOther && <span className="ml-auto text-[11px] font-semibold text-[#A3B1C6]">click to edit</span>}
      </div>

      {/* Content */}
      {isCode ? (
        <textarea
          ref={taRef}
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSelect={handleSelect}
          onKeyUp={handleSelect}
          placeholder="// code"
          className="w-full min-h-[96px] neu-input px-4 py-3 font-mono text-[13px] leading-relaxed text-[#2E3440] resize-none focus:outline-none disabled:opacity-60"
          disabled={isLockedByOther}
          rows={Math.max(3, local.split("\n").length)}
        />
      ) : isHeading ? (
        <input
          // use textarea for heading too to allow multiline? keep input single line
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSelect={(e) => onCursor?.(node._id, (e.target as HTMLInputElement).selectionStart ?? 0)}
          placeholder="Untitled heading…"
          className="w-full neu-input px-4 py-3 font-extrabold text-lg text-[#2E3440] placeholder:text-[#A3B1C6] disabled:opacity-60"
          disabled={isLockedByOther}
        />
      ) : (
        <textarea
          ref={taRef}
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSelect={handleSelect}
          onKeyUp={handleSelect}
          placeholder="Empty paragraph — click to edit…"
          className="w-full min-h-[56px] neu-input px-4 py-3 text-[14.5px] font-medium leading-relaxed text-[#2E3440] placeholder:text-[#A3B1C6] resize-none disabled:opacity-60"
          disabled={isLockedByOther}
          rows={Math.max(1, Math.ceil(local.length / 64) || 1)}
        />
      )}

      {/* Sanitized preview toggle - shows XSS blocked */}
      {local.includes("<") && (
        <div className="mt-2 neu-pressed-sm px-3 py-2 text-xs font-medium text-[#6B7A90]">
          <span className="font-bold">Sanitized preview:</span> <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(local) || "<em>empty</em>" }} />
        </div>
      )}

      {/* Real-time cursor ghost */}
      {isActive && <div className="mt-2 h-0.5 w-12 rounded-full animate-pulse" style={{ background: "linear-gradient(90deg,#6C7BFF,transparent)" }} />}
    </div>
  );
});
