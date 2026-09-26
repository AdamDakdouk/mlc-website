import { MongoMemoryServer } from "mongodb-memory-server";

describe("Application model", () => {
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

  it("creates a valid application", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");

    const posting = await JobPosting.create({ title: "Math Teacher", description: "x" });

    const application = await Application.create({
      postingId: posting._id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
    });

    expect(application.name).toBe("Jane Doe");
    expect(application.coverNote).toBe("");
    expect(application.submittedAt).toBeInstanceOf(Date);
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    await expect(
      Application.create({
        postingId: posting._id,
        email: "jane@example.com",
        phone: "123",
        resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing resumeFilename", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    await expect(
      Application.create({
        postingId: posting._id,
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing postingId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Application } = require("@/models/Application");

    await expect(
      Application.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      }),
    ).rejects.toThrow();
  });

  it("rejects a name over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    await expect(
      Application.create({
        postingId: posting._id,
        name: "a".repeat(201),
        email: "jane@example.com",
        phone: "123",
        resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      }),
    ).rejects.toThrow();
  });
});
