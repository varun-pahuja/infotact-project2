import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/syncdoc",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
  jwtAccessExpiry: "15m",
  jwtRefreshExpiry: "7d",
  rsaPrivateKeyPath: process.env.RSA_PRIVATE_KEY_PATH ?? "./keys/private.pem",
  rsaPublicKeyPath: process.env.RSA_PUBLIC_KEY_PATH ?? "./keys/public.pem",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
} as const;
