import { MongoMemoryServer } from "mongodb-memory-server";

describe("CalendarEvent model", () => {
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

  it("creates a valid single-day event", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });

    expect(event.title).toBe("Open House");
    expect(event.category).toBe("Event");
    expect(event.description).toBe("");
  });

  it("creates a valid multi-day event", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Winter Break",
      category: "Holiday",
      startDate: new Date("2026-12-20"),
      endDate: new Date("2027-01-05"),
    });

    expect(event.startDate.toISOString()).toContain("2026-12-20");
    expect(event.endDate.toISOString()).toContain("2027-01-05");
  });

  it("defaults applicantCount to 0", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });

    expect(event.applicantCount).toBe(0);
  });

  it("stores Session-only fields", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const mongoose = require("mongoose");
    const teacherId = new mongoose.Types.ObjectId();

    const event = await CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
      teacherId,
      sessionDateTime: new Date("2026-10-05T15:00:00.000Z"),
      durationMinutes: 90,
      capacity: 10,
      price: 20,
    });

    expect(event.teacherId.toString()).toBe(teacherId.toString());
    expect(event.sessionDateTime.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(event.durationMinutes).toBe(90);
    expect(event.capacity).toBe(10);
    expect(event.price).toBe(20);
    expect(event.applicantCount).toBe(0);
  });

  it("allows a non-Session event with no session fields set", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Winter Break",
      category: "Holiday",
      startDate: new Date("2026-12-20"),
      endDate: new Date("2027-01-05"),
    });

    expect(event.teacherId).toBeUndefined();
    expect(event.sessionDateTime).toBeUndefined();
    expect(event.durationMinutes).toBeUndefined();
    expect(event.capacity).toBeUndefined();
    expect(event.price).toBeUndefined();
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        category: "Event",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a category outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        title: "Bad Category",
        category: "Not A Real Category",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });

  it("rejects an endDate before startDate", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        title: "Backwards Range",
        category: "Event",
        startDate: new Date("2026-10-10"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a title over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        title: "a".repeat(201),
        category: "Event",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });
});
