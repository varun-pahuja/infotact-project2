import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { config } from "./config/index.js";
import { connectMongo } from "./config/database.js";
import { documentRoutes } from "./routes/documents.js";
import { authRoutes } from "./routes/auth.js";
import { attachSyncServer } from "./sync/socketHandler.js";

const app: express.Express = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now(), crdt: "yjs", locks: "redis" });
});

app.get("/api/diagram", (_req, res) => {
  // Layout diagram mapping Markdown to JSON (Mid-Project Review sanity check)
  res.json({
    title: "Markdown → AST JSON mapping",
    examples: [
      { markdown: "# Heading", json: { type: "heading", metadata: { level: 1 }, content: "Heading" } },
      { markdown: "Paragraph text", json: { type: "paragraph", content: "Paragraph text" } },
      { markdown: "```js\\ncode\\n```", json: { type: "code_block", content: "code" } },
      { markdown: "- list item", json: { type: "list_item", content: "list item", children: [] } },
    ],
    pipeline: "Markdown --(markdownToAstMarkdown)--> ASTNodeDoc --(validateNodeHierarchy pre-save)--> Mongo --(astToHtml/astToPdfStructure)--> sanitized HTML/PDF",
    crdt: "Y.Doc { blocks: Y.Array<Y.Map> } ↔ Socket.io rooms per docId ↔ Redis block locks TTL 30s",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

const httpServer = createServer(app);
attachSyncServer(httpServer);

async function start(): Promise<void> {
  await connectMongo();
  console.log("Connected to MongoDB");

  httpServer.listen(config.port, () => {
    console.log(`SyncDoc server running on port ${config.port} (HTTP + Yjs WS)`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
export { httpServer };
