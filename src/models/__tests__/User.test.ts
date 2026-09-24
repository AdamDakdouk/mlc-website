import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("User model", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    // mongoose builds `unique: true` indexes in the background; without
    // waiting for them, the very first two creates in a test can race
    // ahead of the index build and the duplicate-email check silently
    // passes. `ensureIndexes()` (unlike the cached `Model.init()`) always
    // rebuilds indexes against the current collection, so call it here and
    // again after every drop below.
    const { User } = require("@/models/User");
    await User.ensureIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
    const { User } = require("@/models/User");
    await User.ensureIndexes();
  });

  it("creates a user with required fields", async () => {
    const { User } = require("@/models/User");
    const user = await User.create({
      email: "admin@example.com",
      passwordHash: "hashed-value",
      role: "admin",
    });
    expect(user.email).toBe("admin@example.com");
    expect(user.role).toBe("admin");
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a duplicate email", async () => {
    const { User } = require("@/models/User");
    await User.create({
      email: "admin@example.com",
      passwordHash: "hashed-value",
      role: "admin",
    });

    await expect(
      User.create({
        email: "admin@example.com",
        passwordHash: "another-hash",
        role: "admin",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing email", async () => {
    const { User } = require("@/models/User");
    await expect(
      User.create({ passwordHash: "hashed-value", role: "admin" }),
    ).rejects.toThrow();
  });
});
