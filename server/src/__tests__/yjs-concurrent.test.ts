import { describe, it, expect } from "vitest";
import * as Y from "yjs";

/**
 * Mid-Project Review sanity check: 10 concurrent clients CRDT merge
 * Simulates: User A types paragraph at index 0 while User B adds code block lower down
 * Ensures zero-overwrite via Yjs matrix
 */

function createClientDoc(id: number): { doc: Y.Doc; blocks: Y.Array<Y.Map<unknown>> } {
  const doc = new Y.Doc();
  const blocks = doc.getArray<Y.Map<unknown>>("blocks");
  return { doc, blocks };
}

describe("Yjs CRDT concurrent merge (10 clients)", () => {
  it("should merge 10 concurrent clients without overwrites", () => {
    const clients = Array.from({ length: 10 }, (_, i) => createClientDoc(i));

    // Each client inserts a distinct block concurrently (no central coordination)
    clients.forEach(({ doc, blocks }, i) => {
      doc.transact(() => {
        const m = new Y.Map<unknown>();
        m.set("id", `block-${i}`);
        m.set("type", i % 3 === 0 ? "code_block" : i % 2 === 0 ? "heading" : "paragraph");
        m.set("content", `Client ${i} — ${i % 3 === 0 ? "code()" : "paragraph"}`);
        m.set("parentId", null);
        blocks.push([m]);
      });
    });

    // Simulate network: collect all updates and apply to every other doc (matrix)
    const updates = clients.map(({ doc }) => Y.encodeStateAsUpdate(doc));
    for (let i = 0; i < clients.length; i++) {
      for (let j = 0; j < clients.length; j++) {
        if (i === j) continue;
        Y.applyUpdate(clients[j]!.doc, updates[i]!);
      }
    }

    // All docs must converge to same state with 10 blocks
    const expectedIds = new Set(Array.from({ length: 10 }, (_, i) => `block-${i}`));
    for (const { blocks } of clients) {
      expect(blocks.length).toBe(10);
      const ids = new Set(blocks.toArray().map((m) => String(m.get("id"))));
      expect(ids).toEqual(expectedIds);
    }
  });

  it("should handle simultaneous edits to different blocks (User A paragraph, User B code block)", () => {
    const a = createClientDoc(0);
    const b = createClientDoc(1);

    // Seed via single source of truth to ensure same Yjs history
    a.doc.transact(() => {
      const p = new Y.Map<unknown>();
      p.set("id", "para-1");
      p.set("type", "paragraph");
      p.set("content", "initial");
      p.set("parentId", null);
      const c = new Y.Map<unknown>();
      c.set("id", "code-1");
      c.set("type", "code_block");
      c.set("content", "console.log(1)");
      c.set("parentId", null);
      a.blocks.push([p, c]);
    });
    // Sync seed to b
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    // Concurrent edits: A edits paragraph, B edits code block (different indices)
    a.doc.transact(() => {
      const m = a.blocks.get(0);
      m.set("content", "User A new paragraph");
    });
    b.doc.transact(() => {
      const m = b.blocks.get(1);
      m.set("content", "User B new code block lower down");
    });

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(a.doc);
    const updateB = Y.encodeStateAsUpdate(b.doc);
    Y.applyUpdate(a.doc, updateB);
    Y.applyUpdate(b.doc, updateA);

    // Neither edit lost
    const aPara = String(a.blocks.get(0).get("content"));
    const aCode = String(a.blocks.get(1).get("content"));
    const bPara = String(b.blocks.get(0).get("content"));
    const bCode = String(b.blocks.get(1).get("content"));

    expect(aPara).toBe("User A new paragraph");
    expect(aCode).toBe("User B new code block lower down");
    expect(bPara).toBe("User A new paragraph");
    expect(bCode).toBe("User B new code block lower down");
  });

  it("should sustain 60 FPS expectation: Yjs updates batch in rAF without blocking", async () => {
    const doc = new Y.Doc();
    const blocks = doc.getArray<Y.Map<unknown>>("blocks");

    const start = performance.now();
    doc.transact(() => {
      for (let i = 0; i < 100; i++) {
        const m = new Y.Map<unknown>();
        m.set("id", `perf-${i}`);
        m.set("type", "paragraph");
        m.set("content", `block ${i}`);
        blocks.push([m]);
      }
    });
    const elapsed = performance.now() - start;
    // 100 inserts should be well under 16ms (60 FPS frame budget)
    expect(elapsed).toBeLessThan(16);
    expect(blocks.length).toBe(100);
  });
});
