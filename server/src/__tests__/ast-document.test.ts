import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import { ASTDocumentModel } from "../models/ASTDocument.js";
import type { BlockType } from "@syncdoc/shared/types";

const MONGO_URI = "mongodb://localhost:27017/syncdoc-test";

beforeEach(async () => {
  await mongoose.connect(MONGO_URI);
});

afterEach(async () => {
  await ASTDocumentModel.deleteMany({});
  await mongoose.disconnect();
});

describe("ASTDocument Model", () => {
  it("should create a document with valid AST nodes", async () => {
    const doc = await ASTDocumentModel.create({
      title: "Test Doc",
      rootNodes: [
        {
          _id: crypto.randomUUID(),
          type: "paragraph" as BlockType,
          content: "Hello world",
          children: [],
          parentId: null,
          level: 0,
          order: 0,
          metadata: {},
          createdBy: "user1",
          updatedBy: "user1",
        },
      ],
      ownerId: "user1",
    });

    expect(doc.title).toBe("Test Doc");
    expect(doc.rootNodes).toHaveLength(1);
    expect(doc.rootNodes[0]!.content).toBe("Hello world");
    expect(doc.version).toBe(1);
  });

  it("should increment version on save", async () => {
    const doc = await ASTDocumentModel.create({
      title: "Versioned Doc",
      rootNodes: [],
      ownerId: "user1",
    });

    const initialVersion = doc.version;
    doc.title = "Updated Title";
    await doc.save();

    expect(doc.version).toBe(initialVersion + 1);
  });

  it("should validate heading levels 1-6", async () => {
    await expect(
      ASTDocumentModel.create({
        title: "Bad Heading",
        rootNodes: [
          {
            _id: crypto.randomUUID(),
            type: "heading" as BlockType,
            content: "Bad",
            children: [],
            parentId: null,
            level: 0,
            order: 0,
            metadata: { level: "7" },
            createdBy: "user1",
            updatedBy: "user1",
          },
        ],
        ownerId: "user1",
      })
    ).rejects.toThrow("Invalid heading level");
  });

  it("should reject paragraphs with children", async () => {
    await expect(
      ASTDocumentModel.create({
        title: "Bad Children",
        rootNodes: [
          {
            _id: crypto.randomUUID(),
            type: "paragraph" as BlockType,
            content: "Parent",
            children: [
              {
                _id: crypto.randomUUID(),
                type: "paragraph" as BlockType,
                content: "Child",
                children: [],
                parentId: null,
                level: 1,
                order: 0,
                metadata: {},
                createdBy: "user1",
                updatedBy: "user1",
              },
            ],
            parentId: null,
            level: 0,
            order: 0,
            metadata: {},
            createdBy: "user1",
            updatedBy: "user1",
          },
        ],
        ownerId: "user1",
      })
    ).rejects.toThrow('Block type "paragraph" cannot have children');
  });

  it("should allow list_items with children", async () => {
    const doc = await ASTDocumentModel.create({
      title: "Nested List",
      rootNodes: [
        {
          _id: crypto.randomUUID(),
          type: "list_item" as BlockType,
          content: "Item 1",
          children: [
            {
              _id: crypto.randomUUID(),
              type: "paragraph" as BlockType,
              content: "Nested content",
              children: [],
              parentId: null,
              level: 1,
              order: 0,
              metadata: {},
              createdBy: "user1",
              updatedBy: "user1",
            },
          ],
          parentId: null,
          level: 0,
          order: 0,
          metadata: {},
          createdBy: "user1",
          updatedBy: "user1",
        },
      ],
      ownerId: "user1",
    });

    expect(doc.rootNodes[0]!.children).toHaveLength(1);
  });

  it("should set parentId and order on pre-save hook", async () => {
    const childId = crypto.randomUUID();
    const doc = await ASTDocumentModel.create({
      title: "Parent Tracking",
      rootNodes: [
        {
          _id: crypto.randomUUID(),
          type: "list_item" as BlockType,
          content: "Parent",
          children: [
            {
              _id: childId,
              type: "paragraph" as BlockType,
              content: "Child",
              children: [],
              parentId: null,
              level: 0,
              order: 0,
              metadata: {},
              createdBy: "user1",
              updatedBy: "user1",
            },
          ],
          parentId: null,
          level: 0,
          order: 0,
          metadata: {},
          createdBy: "user1",
          updatedBy: "user1",
        },
      ],
      ownerId: "user1",
    });

    const child = doc.rootNodes[0]!.children[0]!;
    expect(child.parentId).toBe(doc.rootNodes[0]!._id);
    expect(child.order).toBe(0);
    expect(child.level).toBe(1);
  });
});
