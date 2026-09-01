import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { io, type Socket } from "socket.io-client";
import type { ASTNode } from "@syncdoc/shared/types";

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface UseYjsSyncOpts {
  docId: string;
  token: string | null;
  initialNodes: ASTNode[];
}

interface UseYjsSyncReturn {
  ydoc: Y.Doc | null;
  yBlocks: Y.Array<Y.Map<unknown>> | null;
  socket: Socket | null;
  connected: boolean;
  blocks: ASTNode[];
  updateBlockContent: (blockId: string, content: string) => void;
  insertBlock: (type: ASTNode["type"], index?: number) => void;
  deleteBlock: (blockId: string) => void;
}

function yMapToNode(m: Y.Map<unknown>, index: number): ASTNode {
  return {
    _id: String(m.get("id") ?? crypto.randomUUID()),
    type: (m.get("type") as ASTNode["type"]) ?? "paragraph",
    content: String(m.get("content") ?? ""),
    children: [],
    parentId: (m.get("parentId") as string | null) ?? null,
    level: 0,
    order: index,
    metadata: (m.get("metadata") as Record<string, unknown>) ?? {},
    createdBy: String(m.get("createdBy") ?? "me"),
    updatedBy: String(m.get("updatedBy") ?? "me"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function useYjsSync({ docId, token, initialNodes }: UseYjsSyncOpts): UseYjsSyncReturn {
  const ydocRef = useRef<Y.Doc | null>(null);
  const yBlocksRef = useRef<Y.Array<Y.Map<unknown>> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [blocks, setBlocks] = useState<ASTNode[]>(initialNodes);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // hydrate blocks from Y.Array
  const syncFromY = useCallback(() => {
    const yb = yBlocksRef.current;
    if (!yb) return;
    const next = yb.toArray().map((m, i) => yMapToNode(m, i));
    // Avoid flicker if equal: shallow compare length/content
    setBlocks((prev) => {
      if (prev.length === next.length && prev.every((p, idx) => p._id === next[idx]!._id && p.content === next[idx]!.content && p.type === next[idx]!.type)) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");
    ydocRef.current = ydoc;
    yBlocksRef.current = yBlocks;

    // Seed from initialNodes if y empty
    if (yBlocks.length === 0 && initialNodes.length > 0) {
      ydoc.transact(() => {
        for (const n of initialNodes) {
          const m = new Y.Map<unknown>();
          m.set("id", n._id);
          m.set("type", n.type);
          m.set("content", n.content);
          m.set("parentId", n.parentId);
          m.set("metadata", n.metadata ?? {});
          m.set("createdBy", n.createdBy);
          m.set("updatedBy", n.updatedBy);
          yBlocks.push([m]);
        }
      });
    }
    setBlocks(initialNodes.length > 0 ? initialNodes : yBlocks.toArray().map((m, i) => yMapToNode(m, i)));

    // Observe Y changes → patch single blocks without full rebuild (Yjs delta)
    const observer = () => {
      // Batch updates in rAF for 60 FPS viewport
      requestAnimationFrame(() => syncFromY());
    };
    yBlocks.observe(observer);
    ydoc.on("update", (update: Uint8Array) => {
      if (!socketRef.current) return;
      const b64 = toBase64(update);
      socketRef.current.emit("yjs:update", { docId, update: b64 });
    });

    // Socket
    const socket = io("/", {
      auth: { token: token ?? undefined },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("yjs:update", (payload: { update: string }) => {
      try {
        const upd = fromBase64(payload.update);
        Y.applyUpdate(ydoc, upd);
        // syncFromY will fire via observer, but also ensure rAF
      } catch {
        // ignore malformed
      }
    });

    socket.emit("doc:join", { docId }, (res: { ok?: boolean; state?: string | null; error?: string }) => {
      if (res?.state) {
        try {
          const state = fromBase64(res.state);
          Y.applyUpdate(ydoc, state);
          syncFromY();
        } catch {
          // ignore
        }
      }
    });

    return () => {
      yBlocks.unobserve(observer);
      socket.disconnect();
      ydoc.destroy();
      ydocRef.current = null;
      yBlocksRef.current = null;
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, token]);

  // Keep blocks in sync if initialNodes arrive after mount (REST fetch)
  useEffect(() => {
    if (!ydocRef.current || !yBlocksRef.current) return;
    if (yBlocksRef.current.length === 0 && initialNodes.length > 0) {
      ydocRef.current.transact(() => {
        for (const n of initialNodes) {
          const m = new Y.Map<unknown>();
          m.set("id", n._id);
          m.set("type", n.type);
          m.set("content", n.content);
          m.set("parentId", n.parentId);
          m.set("metadata", n.metadata ?? {});
          yBlocksRef.current!.push([m]);
        }
      });
      syncFromY();
    }
  }, [initialNodes, syncFromY]);

  const updateBlockContent = useCallback((blockId: string, content: string) => {
    const yBlocks = yBlocksRef.current;
    const ydoc = ydocRef.current;
    if (!yBlocks || !ydoc) return;
    ydoc.transact(() => {
      const idx = yBlocks.toArray().findIndex((m) => String(m.get("id")) === blockId);
      if (idx === -1) return;
      const m = yBlocks.get(idx);
      m.set("content", content);
      m.set("updatedBy", "me");
    });
  }, []);

  const insertBlock = useCallback((type: ASTNode["type"], index?: number) => {
    const yBlocks = yBlocksRef.current;
    const ydoc = ydocRef.current;
    if (!yBlocks || !ydoc) return;
    ydoc.transact(() => {
      const m = new Y.Map<unknown>();
      m.set("id", crypto.randomUUID());
      m.set("type", type);
      m.set("content", type === "heading" ? "New heading" : type === "code_block" ? "// code" : "");
      m.set("parentId", null);
      m.set("metadata", type === "heading" ? { level: 2 } : {});
      m.set("createdBy", "me");
      m.set("updatedBy", "me");
      const at = typeof index === "number" ? index : yBlocks.length;
      yBlocks.insert(at, [m]);
    });
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    const yBlocks = yBlocksRef.current;
    const ydoc = ydocRef.current;
    if (!yBlocks || !ydoc) return;
    ydoc.transact(() => {
      const idx = yBlocks.toArray().findIndex((m) => String(m.get("id")) === blockId);
      if (idx !== -1) yBlocks.delete(idx, 1);
    });
  }, []);

  return {
    ydoc: ydocRef.current,
    yBlocks: yBlocksRef.current,
    socket: socketRef.current,
    connected,
    blocks,
    updateBlockContent,
    insertBlock,
    deleteBlock,
  };
}
