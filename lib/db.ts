import mongoose from "mongoose";
import { runSeed } from "./seed";

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }
  return uri;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {

  var _mongoose: MongooseCache | undefined;

  var _mongoose_seeded: boolean | undefined;
}

const cached: MongooseCache = global._mongoose ?? { conn: null, promise: null };

if (!global._mongoose) {
  global._mongoose = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(getMongoURI(), {
        bufferCommands: false,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;

  // Global flag survives Next.js HMR module reloads, so the translations /
  // email-templates / OP12 seeders only run once per process instead of on
  // every file edit in dev.
  if (!global._mongoose_seeded) {
    global._mongoose_seeded = true;
    runSeed().catch(console.error);
  }

  return cached.conn;
}

export default connectDB;
