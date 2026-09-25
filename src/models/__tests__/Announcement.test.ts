import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Announcement model", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("creates an announcement with required fields and defaults", async () => {
    const { Announcement } = require("@/models/Announcement");
    const announcement = await Announcement.create({
      title: "Exam schedule posted",
      body: "The final exam schedule is now available.",
    });
    expect(announcement.title).toBe("Exam schedule posted");
    expect(announcement.imageUrl).toBeNull();
    expect(announcement.createdAt).toBeInstanceOf(Date);
    expect(announcement.updatedAt).toBeInstanceOf(Date);
  });

  it("stores an imageUrl when provided", async () => {
    const { Announcement } = require("@/models/Announcement");
    const announcement = await Announcement.create({
      title: "Sports day",
      body: "Join us for sports day.",
      imageUrl: "/uploads/announcements/abc123.jpg",
    });
    expect(announcement.imageUrl).toBe("/uploads/announcements/abc123.jpg");
  });

  it("rejects a missing title", async () => {
    const { Announcement } = require("@/models/Announcement");
    await expect(
      Announcement.create({ body: "Body text only" }),
    ).rejects.toThrow();
  });

  it("rejects a missing body", async () => {
    const { Announcement } = require("@/models/Announcement");
    await expect(
      Announcement.create({ title: "Title only" }),
    ).rejects.toThrow();
  });
});
