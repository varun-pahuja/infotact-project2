import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

const MONGO_URI = "mongodb://localhost:27017/syncdoc-auth-test";

let app: express.Express;

beforeEach(async () => {
  await mongoose.connect(MONGO_URI);
  app = express();
  app.use(express.json());
});

afterEach(async () => {
  await mongoose.disconnect();
});

function generateTestToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.jwtSecret, {
    algorithm: "RS256",
    expiresIn: "15m",
  });
}

describe("Auth Middleware", () => {
  it("should reject requests without auth header", async () => {
    const { authMiddleware } = await import("../middleware/auth.js");

    app.get("/protected", authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });

    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Missing");
  });

  it("should reject invalid tokens", async () => {
    const { authMiddleware } = await import("../middleware/auth.js");

    app.get("/protected", authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
  });

  it("should accept valid tokens", async () => {
    const { authMiddleware } = await import("../middleware/auth.js");

    app.get("/protected", authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });

    const token = generateTestToken({
      userId: "test-user",
      email: "test@test.com",
      name: "Test User",
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe("test-user");
  });
});
