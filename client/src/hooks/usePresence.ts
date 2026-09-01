import { useEffect, useState, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type { DocumentPresence } from "@syncdoc/shared/types";

export function usePresence(socket: Socket | null, docId: string): {
  presences: DocumentPresence[];
  lockedBlocks: Map<string, { userId: string; name: string; color: string }>;
  cursors: Map<string, { blockId: string | null; position: number; name: string; color: string }>;
  lockBlock: (blockId: string) => void;
  unlockBlock: (blockId: string) => void;
  updateCursor: (blockId: string | null, position: number) => void;
} {
  const [presences, setPresences] = useState<DocumentPresence[]>([]);
  const [lockedBlocks, setLockedBlocks] = useState<Map<string, { userId: string; name: string; color: string }>>(new Map());
  const cursorsRef = useRef<Map<string, { blockId: string | null; position: number; name: string; color: string }>>(new Map());
  const [, force] = useState(0);

  const triggerCursor = useCallback(() => force((x) => x + 1), []);

  useEffect(() => {
    if (!socket) return;

    const onPresence = (list: DocumentPresence[]) => setPresences(list);
    const onLocked = (p: { blockId: string; userId: string; name: string; color: string }) => {
      setLockedBlocks((prev) => {
        const next = new Map(prev);
        next.set(p.blockId, { userId: p.userId, name: p.name, color: p.color });
        return next;
      });
    };
    const onUnlocked = (p: { blockId: string }) => {
      setLockedBlocks((prev) => {
        const next = new Map(prev);
        next.delete(p.blockId);
        return next;
      });
    };
    const onCursor = (p: { userId: string; name: string; color: string; blockId: string | null; position: number }) => {
      cursorsRef.current.set(p.userId, { blockId: p.blockId, position: p.position, name: p.name, color: p.color });
      triggerCursor();
    };

    socket.on("presence:sync", onPresence);
    socket.on("block:locked", onLocked);
    socket.on("block:unlocked", onUnlocked);
    socket.on("cursor:update", onCursor);

    return () => {
      socket.off("presence:sync", onPresence);
      socket.off("block:locked", onLocked);
      socket.off("block:unlocked", onUnlocked);
      socket.off("cursor:update", onCursor);
    };
  }, [socket, triggerCursor]);

  const lockBlock = useCallback(
    (blockId: string) => {
      if (!socket || !docId) return;
      socket.emit("block:lock", { docId, blockId });
    },
    [socket, docId]
  );

  const unlockBlock = useCallback(
    (blockId: string) => {
      if (!socket || !docId) return;
      socket.emit("block:unlock", { docId, blockId });
    },
    [socket, docId]
  );

  const updateCursor = useCallback(
    (blockId: string | null, position: number) => {
      if (!socket || !docId) return;
      socket.emit("cursor:update", { docId, blockId, position });
    },
    [socket, docId]
  );

  return { presences, lockedBlocks, cursors: cursorsRef.current, lockBlock, unlockBlock, updateCursor };
}
