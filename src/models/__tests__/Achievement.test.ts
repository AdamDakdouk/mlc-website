import { MongoMemoryServer } from "mongodb-memory-server";

describe("Achievement model", () => {
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

  it("creates a valid achievement, defaulting photoUrl to null", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    const achievement = await Achievement.create({
      title: "Regional Science Fair — 1st Place",
      description: "Our robotics team took first place.",
      date: new Date("2026-03-10"),
    });

    expect(achievement.title).toBe("Regional Science Fair — 1st Place");
    expect(achievement.photoUrl).toBeNull();
  });

  it("creates a valid achievement with a photoUrl", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    const achievement = await Achievement.create({
      title: "Accreditation Renewed",
      description: "MLC renewed its accreditation.",
      date: new Date("2026-01-15"),
      photoUrl: "/uploads/achievements/11111111-1111-1111-1111-111111111111.jpg",
    });

    expect(achievement.photoUrl).toBe(
      "/uploads/achievements/11111111-1111-1111-1111-111111111111.jpg",
    );
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(
      Achievement.create({ description: "x", date: new Date("2026-01-01") }),
    ).rejects.toThrow();
  });

  it("rejects a missing description", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(
      Achievement.create({ title: "x", date: new Date("2026-01-01") }),
    ).rejects.toThrow();
  });

  it("rejects a missing date", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(Achievement.create({ title: "x", description: "x" })).rejects.toThrow();
  });

  it("rejects a title over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(
      Achievement.create({
        title: "a".repeat(201),
        description: "x",
        date: new Date("2026-01-01"),
      }),
    ).rejects.toThrow();
  });
});
