import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { ASTDocumentModel, type ASTNodeDoc } from "../models/ASTDocument.js";
import type { BlockType } from "@syncdoc/shared/types";
import { astToHtml, astToPdfStructure, sanitizeContent } from "../utils/transform.js";
import { getRedis } from "../config/redis.js";

const router: express.Router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const docs = await ASTDocumentModel.find({
      $or: [{ ownerId: userId }, { collaborators: userId }],
    })
      .select("title ownerId collaborators version createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doc = await ASTDocumentModel.findById(req.params.id).lean();
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title } = req.body as { title: string };
    const userId = req.user!.userId;

    const doc = await ASTDocumentModel.create({
      title: title ?? "Untitled Document",
      rootNodes: [
        {
          _id: crypto.randomUUID(),
          type: "paragraph" as BlockType,
          content: "",
          children: [],
          parentId: null,
          level: 0,
          order: 0,
          metadata: {},
          createdBy: userId,
          updatedBy: userId,
        },
      ],
      ownerId: userId,
      collaborators: [],
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to create document" });
  }
});

function deepSanitizeNodes(nodes: unknown[]): unknown[] {
  return nodes.map((n) => {
    const node = n as Record<string, unknown>;
    const sanitizedChildren = Array.isArray(node.children) ? deepSanitizeNodes(node.children as unknown[]) : [];
    return {
      ...node,
      content: typeof node.content === "string" ? sanitizeContent(node.content) : "",
      children: sanitizedChildren,
    };
  });
}

router.put("/:id", async (req, res) => {
  try {
    const { title, rootNodes } = req.body as {
      title?: string;
      rootNodes?: unknown[];
    };

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = typeof title === "string" ? sanitizeContent(title) : title;
    if (rootNodes !== undefined) update.rootNodes = Array.isArray(rootNodes) ? deepSanitizeNodes(rootNodes) : rootNodes;

    const doc = await ASTDocumentModel.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update document";
    res.status(422).json({ error: message });
  }
});

// Transformation Pipeline: export AST → sanitized HTML
router.get("/:id/export/html", async (req, res) => {
  try {
    const doc = await ASTDocumentModel.findById(req.params.id).lean();
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const html = astToHtml(doc.rootNodes as never);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: "Failed to export HTML" });
  }
});

// Transformation Pipeline: export AST → sanitized PDF structure (JSON)
router.get("/:id/export/pdf", async (req, res) => {
  try {
    const doc = await ASTDocumentModel.findById(req.params.id).lean();
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const structure = astToPdfStructure(doc.rootNodes as never);
    res.json({ title: doc.title, version: doc.version, blocks: structure });
  } catch (err) {
    res.status(500).json({ error: "Failed to export PDF structure" });
  }
});

// Delta: atomic single-block update (no full rebuild) + optimistic locking check
router.patch("/:id/blocks/:blockId", async (req, res) => {
  try {
    const { content, type, expectedVersion } = req.body as {
      content?: string;
      type?: BlockType;
      expectedVersion?: number;
    };
    const doc = await ASTDocumentModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    if (expectedVersion !== undefined && doc.version !== expectedVersion) {
      res.status(409).json({ error: "Version conflict", currentVersion: doc.version });
      return;
    }
    // Block-level lock check via Redis
    const redis = getRedis();
    const lockKey = `lock:${req.params.id}:${req.params.blockId}`;
    const lockOwner = await redis.get(lockKey);
    const requester = req.user!.userId;
    if (lockOwner && lockOwner !== requester) {
      res.status(423).json({ error: "Block locked by another user", lockedBy: lockOwner });
      return;
    }

    const sanitized = content !== undefined ? sanitizeContent(content) : undefined;

    function updateNode(nodes: ASTNodeDoc[]): boolean {
      for (const n of nodes) {
        if (n._id === req.params.blockId) {
          if (sanitized !== undefined) n.content = sanitized;
          if (type !== undefined) n.type = type;
          n.updatedBy = requester;
          return true;
        }
        if (n.children.length > 0 && updateNode(n.children as ASTNodeDoc[])) return true;
      }
      return false;
    }

    const found = updateNode(doc.rootNodes as unknown as ASTNodeDoc[]);
    if (!found) {
      res.status(404).json({ error: "Block not found" });
      return;
    }

    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to patch block";
    res.status(422).json({ error: message });
  }
});

// Operational block-locking (localized) via Redis TTL 30s
router.post("/:id/blocks/:blockId/lock", async (req, res) => {
  try {
    const redis = getRedis();
    const key = `lock:${req.params.id}:${req.params.blockId}`;
    const userId = req.user!.userId;
    const ttl = 30;
    const existing = await redis.get(key);
    if (existing && existing !== userId) {
      res.status(409).json({ error: "Block already locked", lockedBy: existing });
      return;
    }
    await redis.set(key, userId, "EX", ttl);
    res.json({ locked: true, blockId: req.params.blockId, userId, expiresIn: ttl });
  } catch {
    res.status(500).json({ error: "Failed to acquire lock" });
  }
});

router.delete("/:id/blocks/:blockId/lock", async (req, res) => {
  try {
    const redis = getRedis();
    const key = `lock:${req.params.id}:${req.params.blockId}`;
    const userId = req.user!.userId;
    const owner = await redis.get(key);
    if (owner && owner !== userId) {
      res.status(403).json({ error: "Not lock owner" });
      return;
    }
    await redis.del(key);
    res.json({ unlocked: true });
  } catch {
    res.status(500).json({ error: "Failed to release lock" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doc = await ASTDocumentModel.findByIdAndDelete(req.params.id).lean();
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export { router as documentRoutes };
