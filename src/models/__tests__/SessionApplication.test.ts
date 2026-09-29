import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("SessionApplication model", () => {
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

  it("creates a valid application, defaulting status to Pending", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");
    const sessionId = new mongoose.Types.ObjectId();

    const application = await SessionApplication.create({
      sessionId,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      address: "123 Main St, Bchamoun",
      paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
    });

    expect(application.status).toBe("Pending");
    expect(application.sessionId.toString()).toBe(sessionId.toString());
    expect(application.submittedAt).toBeInstanceOf(Date);
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing email", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing phone", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing address", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing sessionId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing paymentProofFilename", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
      }),
    ).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
        status: "Maybe",
      }),
    ).rejects.toThrow();
  });
});
