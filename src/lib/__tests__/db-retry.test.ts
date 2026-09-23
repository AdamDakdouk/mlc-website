import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("db connection retry after failure", () => {
  let mongod: MongoMemoryServer | null = null;
  let port: number;

  beforeAll(async () => {
    // Start a server once just to grab a free port, then stop it so the
    // first connection attempt below has nothing listening on that port.
    const probe = await MongoMemoryServer.create();
    const uri = new URL(probe.getUri());
    port = Number(uri.port);
    await probe.stop();

    // Point MONGODB_URI at that now-dead port, with short timeouts so the
    // failing attempt doesn't eat the whole test timeout.
    process.env.MONGODB_URI = `mongodb://127.0.0.1:${port}/?serverSelectionTimeoutMS=1500&connectTimeoutMS=1500`;
    jest.resetModules();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it("recovers on the next call after a failed connection attempt, instead of reusing the rejected promise forever", async () => {
    const { connectToDatabase } = require("@/lib/db");

    // Nothing is listening on `port` yet, so this must fail.
    await expect(connectToDatabase()).rejects.toThrow();

    // Restart a MongoDB instance on the exact same port the cache is
    // already configured to use.
    mongod = await MongoMemoryServer.create({ instance: { port } });

    // If the cached rejected promise were reused (the bug), this would
    // reject again forever even though a real server is now reachable.
    const conn = await connectToDatabase();
    expect(conn.connection.readyState).toBe(1);
  });
});
