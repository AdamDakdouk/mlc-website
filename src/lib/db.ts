// mongoose is pinned to ^8.x (not latest ^9.x): mongoose 9.x bundles mongodb
// driver 7.6.0, which has a confirmed regression under Jest's node test
// environment ("Missing required sub-document 'driver' in the client
// metadata document"). Tracked upstream: typegoose/mongodb-memory-server#1026,
// MongoDB NODE-7832. Do not bump past ^8.x until that's fixed upstream.
import mongoose, { type Mongoose } from "mongoose";
import { env } from "@/lib/env";

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cache;

export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
