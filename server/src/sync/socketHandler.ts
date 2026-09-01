import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import type { UserPayload, DocumentPresence } from "@syncdoc/shared/types";
import { getOrCreateDocEntry, incrementRef, decrementRef, encodeState } from "./yjsDocStore.js";
import * as Y from "yjs";
import { getRedis } from "../config/redis.js";

interface AuthSocket extends Socket {
  user?: UserPayload;
}

// In-memory presence per doc: Map<docId, Map<userId, DocumentPresence>>
const presenceByDoc = new Map<string, Map<string, DocumentPresence>>();

const USER_COLORS = ["#6C7BFF", "#4ECDC4", "#FFB86C", "#FF6B9D", "#9B59B6", "#1ABC9C"];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length]!;
}

export function attachSyncServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
    transports: ["websocket", "polling"],
  });

  io.use((socket: AuthSocket, next) => {
    const token = (socket.handshake.auth as Record<string, string>).token ?? (socket.handshake.headers.authorization as string | undefined)?.replace("Bearer ", "");
    if (!token) {
      // Guest fallback for demo / stress test without auth
      socket.user = {
        userId: `guest-${socket.id.slice(0, 6)}`,
        email: `guest-${socket.id.slice(0, 6)}@syncdoc.local`,
        name: `Guest ${socket.id.slice(0, 4)}`,
      };
      next();
      return;
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as UserPayload;
      socket.user = decoded;
      next();
    } catch {
      // allow guest on invalid token in dev to keep demo flowing
      socket.user = {
        userId: `guest-${socket.id.slice(0, 6)}`,
        email: `guest-${socket.id.slice(0, 6)}@syncdoc.local`,
        name: `Guest ${socket.id.slice(0, 4)}`,
      };
      next();
    }
  });

  io.on("connection", (raw: Socket) => {
    const socket = raw as AuthSocket;
    const user = socket.user!;
    let joinedDocId: string | null = null;

    // eslint-disable-next-line no-console
    console.log(`[sync] user ${user.name} (${user.userId}) connected ${socket.id}`);

    socket.on("doc:join", async (payload: { docId: string }, ack?: (res: unknown) => void) => {
      const { docId } = payload ?? {};
      if (!docId || typeof docId !== "string") {
        ack?.({ error: "docId required" });
        return;
      }
      if (joinedDocId) {
        await socket.leave(joinedDocId);
        decrementRef(joinedDocId);
      }
      joinedDocId = docId;
      const entry = getOrCreateDocEntry(docId);
      incrementRef(docId);
      await socket.join(docId);

      // presence join
      let presMap = presenceByDoc.get(docId);
      if (!presMap) {
        presMap = new Map();
        presenceByDoc.set(docId, presMap);
      }
      presMap.set(user.userId, {
        userId: user.userId,
        name: user.name,
        activeBlockId: null,
        cursorPosition: 0,
        color: colorFor(user.userId),
      });
      io.to(docId).emit("presence:sync", Array.from(presMap.values()));

      // send current Y state
      const state = encodeState(docId);
      ack?.({ ok: true, state: state ? Buffer.from(state).toString("base64") : null });
      socket.to(docId).emit("user:joined", { userId: user.userId, name: user.name });
    });

    socket.on("yjs:update", (payload: { docId: string; update: string }) => {
      if (!payload?.docId || !payload.update) return;
      const { docId, update } = payload;
      try {
        const buf = Buffer.from(update, "base64");
        const entry = getOrCreateDocEntry(docId);
        Y.applyUpdate(entry.ydoc, new Uint8Array(buf));
        // broadcast to others
        socket.to(docId).emit("yjs:update", { update, sender: user.userId });
      } catch {
        // ignore malformed
      }
    });

    // Localized block locking via Redis + socket broadcast
    socket.on("block:lock", async (payload: { docId: string; blockId: string }) => {
      const { docId, blockId } = payload ?? {};
      if (!docId || !blockId) return;
      const redis = getRedis();
      const key = `lock:${docId}:${blockId}`;
      const existing = await redis.get(key);
      if (existing && existing !== user.userId) {
        socket.emit("block:lock:denied", { blockId, lockedBy: existing });
        return;
      }
      await redis.set(key, user.userId, "EX", 30);
      io.to(docId).emit("block:locked", { blockId, userId: user.userId, name: user.name, color: colorFor(user.userId) });

      const presMap = presenceByDoc.get(docId);
      if (presMap) {
        const cur = presMap.get(user.userId);
        if (cur) {
          cur.activeBlockId = blockId;
          io.to(docId).emit("presence:sync", Array.from(presMap.values()));
        }
      }
    });

    socket.on("block:unlock", async (payload: { docId: string; blockId: string }) => {
      const { docId, blockId } = payload ?? {};
      if (!docId || !blockId) return;
      const redis = getRedis();
      const key = `lock:${docId}:${blockId}`;
      const owner = await redis.get(key);
      if (owner === user.userId || owner === null) {
        await redis.del(key);
        io.to(docId).emit("block:unlocked", { blockId, userId: user.userId });
        const presMap = presenceByDoc.get(docId);
        if (presMap) {
          const cur = presMap.get(user.userId);
          if (cur) {
            cur.activeBlockId = null;
            io.to(docId).emit("presence:sync", Array.from(presMap.values()));
          }
        }
      }
    });

    socket.on("cursor:update", (payload: { docId: string; blockId: string | null; position: number }) => {
      const { docId, blockId, position } = payload ?? {};
      if (!docId) return;
      const presMap = presenceByDoc.get(docId);
      if (!presMap) return;
      const cur = presMap.get(user.userId);
      if (!cur) return;
      cur.activeBlockId = blockId ?? null;
      cur.cursorPosition = typeof position === "number" ? position : 0;
      socket.to(docId).emit("cursor:update", { userId: user.userId, name: user.name, color: cur.color, blockId, position });
    });

    socket.on("disconnect", async () => {
      if (joinedDocId) {
        decrementRef(joinedDocId);
        const presMap = presenceByDoc.get(joinedDocId);
        if (presMap) {
          presMap.delete(user.userId);
          io.to(joinedDocId).emit("presence:sync", Array.from(presMap.values()));
          io.to(joinedDocId).emit("user:left", { userId: user.userId });
        }
        // cleanup locks owned by this user
        try {
          const redis = getRedis();
          const keys = await redis.keys(`lock:${joinedDocId}:*`);
          for (const k of keys) {
            const owner = await redis.get(k);
            if (owner === user.userId) {
              await redis.del(k);
              const blockId = k.split(":").pop();
              io.to(joinedDocId).emit("block:unlocked", { blockId, userId: user.userId });
            }
          }
        } catch {
          // ignore redis errors on disconnect
        }
      }
      // eslint-disable-next-line no-console
      console.log(`[sync] user ${user.name} disconnected ${socket.id}`);
    });
  });

  return io;
}
