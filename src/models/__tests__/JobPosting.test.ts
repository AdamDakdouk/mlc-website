import { MongoMemoryServer } from "mongodb-memory-server";

describe("JobPosting model", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    jest.resetModules();
  });

  afterAll(async () => {
    const mongooseFresh = require("mongoose");
    await mongooseFresh.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    const mongooseFresh = require("mongoose");
    await mongooseFresh.connection.dropDatabase();
  });

  it("creates a valid posting, defaulting status to Open", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    const posting = await JobPosting.create({
      title: "Math Teacher",
      description: "Teach middle school math.",
    });

    expect(posting.title).toBe("Math Teacher");
    expect(posting.status).toBe("Open");
    expect(posting.requirements).toBe("");
  });

  it("creates a posting with an explicit Closed status", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    const posting = await JobPosting.create({
      title: "Old Posting",
      description: "No longer needed.",
      status: "Closed",
    });

    expect(posting.status).toBe("Closed");
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(
      JobPosting.create({ description: "No title here." }),
    ).rejects.toThrow();
  });

  it("rejects a missing description", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(JobPosting.create({ title: "No Description" })).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(
      JobPosting.create({
        title: "Bad Status",
        description: "x",
        status: "Pending",
      }),
    ).rejects.toThrow();
  });

  it("rejects a title over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(
      JobPosting.create({ title: "a".repeat(201), description: "x" }),
    ).rejects.toThrow();
  });
});
