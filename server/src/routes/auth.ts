import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import express from "express";
import { config } from "../config/index.js";
import { getRedis } from "../config/redis.js";
import type { UserPayload, AuthToken } from "@syncdoc/shared/types";

const router: express.Router = express.Router();

const DEMO_USERS: Record<string, { passwordHash: string; name: string }> = {};

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name: string;
    };

    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, and name are required" });
      return;
    }

    if (DEMO_USERS[email]) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    DEMO_USERS[email] = { passwordHash, name };

    const userId = crypto.randomUUID();
    const tokens = generateTokens({ userId, email, name });

    const redis = getRedis();
    await redis.set(`refresh:${userId}`, tokens.refreshToken, "EX", 7 * 24 * 60 * 60);

    res.status(201).json({ userId, ...tokens });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = DEMO_USERS[email];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const userId = crypto.randomUUID();
    const tokens = generateTokens({ userId, email, name: user.name });

    const redis = getRedis();
    await redis.set(`refresh:${userId}`, tokens.refreshToken, "EX", 7 * 24 * 60 * 60);

    res.json({ userId, ...tokens });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken, userId } = req.body as {
      refreshToken: string;
      userId: string;
    };

    const redis = getRedis();
    const stored = await redis.get(`refresh:${userId}`);

    if (stored !== refreshToken) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const payload = jwt.decode(refreshToken) as UserPayload & { exp: number };
    const tokens = generateTokens({
      userId,
      email: payload.email,
      name: payload.name,
    });

    await redis.set(`refresh:${userId}`, tokens.refreshToken, "EX", 7 * 24 * 60 * 60);

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: "Token refresh failed" });
  }
});

function generateTokens(payload: UserPayload): AuthToken {
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtAccessExpiry,
  });

  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtRefreshExpiry,
  });

  return { accessToken, refreshToken };
}

export { router as authRoutes };
