import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { connectMongo } from "./config/database.js";
import { documentRoutes } from "./routes/documents.js";
import { authRoutes } from "./routes/auth.js";

const app: express.Express = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

async function start(): Promise<void> {
  await connectMongo();
  console.log("Connected to MongoDB");

  app.listen(config.port, () => {
    console.log(`SyncDoc server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
