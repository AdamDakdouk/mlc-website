import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("db connection", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    jest.resetModules();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it("connects to MongoDB and returns a ready connection", async () => {
    const { connectToDatabase } = require("@/lib/db");
    const conn = await connectToDatabase();
    expect(conn.connection.readyState).toBe(1);
  });

  it("reuses the cached connection on subsequent calls", async () => {
    const { connectToDatabase } = require("@/lib/db");
    const first = await connectToDatabase();
    const second = await connectToDatabase();
    expect(first).toBe(second);
  });
});
