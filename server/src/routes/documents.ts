import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { ASTDocumentModel } from "../models/ASTDocument.js";
import type { BlockType } from "@syncdoc/shared/types";

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

router.put("/:id", async (req, res) => {
  try {
    const { title, rootNodes } = req.body as {
      title?: string;
      rootNodes?: unknown[];
    };

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (rootNodes !== undefined) update.rootNodes = rootNodes;

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
    res.status(500).json({ error: "Failed to update document" });
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
