import mongoose, { Schema } from "mongoose";
import type { BlockType } from "@syncdoc/shared/types";
import { generateId } from "@syncdoc/shared/utils";

interface ASTNodeDoc {
  _id: string;
  type: BlockType;
  content: string;
  children: ASTNodeDoc[];
  parentId: string | null;
  level: number;
  order: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ASTDocumentDoc {
  _id: mongoose.Types.ObjectId;
  title: string;
  rootNodes: ASTNodeDoc[];
  ownerId: string;
  collaborators: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ASTNodeSchema = new Schema<ASTNodeDoc>(
  {
    _id: { type: String, default: () => generateId() },
    type: {
      type: String,
      enum: ["paragraph", "heading", "code_block", "list_item"],
      required: true,
    },
    content: { type: String, default: "" },
    children: { type: Schema.Types.Mixed, default: [] },
    parentId: { type: String, default: null },
    level: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { _id: false, timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

const ASTDocumentSchema = new Schema<ASTDocumentDoc>(
  {
    title: { type: String, required: true, trim: true },
    rootNodes: { type: [ASTNodeSchema], default: [] },
    ownerId: { type: String, required: true },
    collaborators: { type: [String], default: [] },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

function validateNodeHierarchy(
  nodes: ASTNodeDoc[],
  parentId: string | null,
  depth: number
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    node.parentId = parentId;
    node.order = i;
    node.level = depth;

    if (node.type === "heading") {
      const levelMeta = node.metadata?.["level"];
      if (levelMeta && (Number(levelMeta) < 1 || Number(levelMeta) > 6)) {
        throw new Error(`Invalid heading level: ${levelMeta}`);
      }
    }

    if (node.children?.length > 0) {
      if (node.type === "paragraph" || node.type === "code_block") {
        throw new Error(`Block type "${node.type}" cannot have children`);
      }
      validateNodeHierarchy(node.children, node._id, depth + 1);
    }
  }
}

ASTDocumentSchema.pre("save", function (next) {
  try {
    validateNodeHierarchy(this.rootNodes, null, 0);
    this.version += 1;
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error("Validation failed"));
  }
});

ASTDocumentSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Record<string, unknown>;
  if (update.rootNodes) {
    try {
      validateNodeHierarchy(
        update.rootNodes as ASTNodeDoc[],
        null,
        0
      );
    } catch (err) {
      next(err instanceof Error ? err : new Error("Validation failed"));
      return;
    }
  }
  next();
});

export const ASTDocumentModel = mongoose.model<ASTDocumentDoc>(
  "ASTDocument",
  ASTDocumentSchema
);

export type { ASTDocumentDoc, ASTNodeDoc };
