import { MongoClient } from "mongodb";

/**
 * Single shared native MongoClient — used by GridFS modules so we don't open
 * one connection pool per bucket. This is intentionally separate from the
 * Mongoose connection in lib/db.ts because GridFS needs the raw driver.
 */
declare global {

  var _packattackMongoClient: MongoClient | undefined;
}

function buildClient(): MongoClient {
  return new MongoClient(process.env.MONGODB_URI!);
}

export function getMongoClient(): MongoClient {
  if (!global._packattackMongoClient) {
    global._packattackMongoClient = buildClient();
  }
  return global._packattackMongoClient;
}
