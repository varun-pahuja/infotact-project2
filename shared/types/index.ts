export type BlockType = "paragraph" | "heading" | "code_block" | "list_item";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface ASTNode {
  _id: string;
  type: BlockType;
  content: string;
  children: ASTNode[];
  parentId: string | null;
  level: number;
  order: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ASTDocument {
  _id: string;
  title: string;
  rootNodes: ASTNode[];
  ownerId: string;
  collaborators: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockOperation {
  type: "insert" | "update" | "delete" | "move";
  nodeId: string;
  parentId: string | null;
  position: number;
  content?: string;
  blockType?: BlockType;
  userId: string;
  timestamp: number;
}

export interface UserPayload {
  userId: string;
  email: string;
  name: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
}

export interface BlockLock {
  nodeId: string;
  userId: string;
  lockedAt: number;
  expiresAt: number;
}

export interface DocumentPresence {
  userId: string;
  name: string;
  activeBlockId: string | null;
  cursorPosition: number;
  color: string;
}
