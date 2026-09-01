import * as Y from "yjs";
import { ASTDocumentModel } from "../models/ASTDocument.js";
import type { ASTNodeDoc } from "../models/ASTDocument.js";

interface DocEntry {
  ydoc: Y.Doc;
  yBlocks: Y.Array<Y.Map<unknown>>;
  refs: number;
  debounce: NodeJS.Timeout | null;
}

const store = new Map<string, DocEntry>();

export function getOrCreateDocEntry(docId: string): DocEntry {
  const existing = store.get(docId);
  if (existing) return existing;

  const ydoc = new Y.Doc();
  const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");

  // Load initial snapshot from Mongo asynchronously (fire-and-forget for now)
  ASTDocumentModel.findById(docId)
    .lean()
    .then((doc) => {
      if (doc && doc.rootNodes.length > 0 && yBlocks.length === 0) {
        ydoc.transact(() => {
          for (const node of doc.rootNodes as unknown as ASTNodeDoc[]) {
            const m = new Y.Map<unknown>();
            m.set("id", node._id);
            m.set("type", node.type);
            m.set("content", node.content);
            m.set("parentId", node.parentId);
            m.set("metadata", node.metadata ?? {});
            yBlocks.push([m]);
          }
        });
      }
    })
    .catch(() => {
      // ignore - doc may not exist yet
    });

  const entry: DocEntry = { ydoc, yBlocks, refs: 0, debounce: null };
  store.set(docId, entry);
  return entry;
}

export function incrementRef(docId: string): void {
  const e = store.get(docId);
  if (e) e.refs += 1;
}

export function decrementRef(docId: string): void {
  const e = store.get(docId);
  if (!e) return;
  e.refs -= 1;
  if (e.refs <= 0) {
    schedulePersist(docId);
    // Keep in memory for 60s to avoid churn
    setTimeout(() => {
      const cur = store.get(docId);
      if (cur && cur.refs <= 0) {
        cur.ydoc.destroy();
        store.delete(docId);
      }
    }, 60_000);
  }
}

function schedulePersist(docId: string): void {
  const entry = store.get(docId);
  if (!entry) return;
  if (entry.debounce) clearTimeout(entry.debounce);
  entry.debounce = setTimeout(async () => {
    try {
      const blocks = entry.yBlocks.toArray().map((m) => ({
        _id: String(m.get("id") ?? crypto.randomUUID()),
        type: String(m.get("type") ?? "paragraph"),
        content: String(m.get("content") ?? ""),
        children: [],
        parentId: (m.get("parentId") as string | null) ?? null,
        level: 0,
        order: 0,
        metadata: (m.get("metadata") as Record<string, unknown>) ?? {},
        createdBy: "system",
        updatedBy: "system",
      }));
      // Persist as rootNodes - version auto-bumps via pre-save
      await ASTDocumentModel.findByIdAndUpdate(
        docId,
        { $set: { rootNodes: blocks } },
        { runValidators: false }
      );
    } catch {
      // silent - will retry on next change
    }
  }, 2000);
}

export function applyUpdateAndBroadcast(
  docId: string,
  update: Uint8Array
): Uint8Array | null {
  const entry = store.get(docId);
  if (!entry) return null;
  try {
    Y.applyUpdate(entry.ydoc, update);
    schedulePersist(docId);
    return Y.encodeStateAsUpdate(entry.ydoc);
  } catch {
    return null;
  }
}

export function encodeState(docId: string): Uint8Array | null {
  const entry = store.get(docId);
  if (!entry) return null;
  return Y.encodeStateAsUpdate(entry.ydoc);
}

export function getDocEntry(docId: string): DocEntry | undefined {
  return store.get(docId);
}
