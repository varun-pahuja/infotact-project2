import mongoose from "mongoose";
import { config } from "./index.js";

export async function connectMongo(): Promise<typeof mongoose> {
  return mongoose.connect(config.mongoUri);
}
