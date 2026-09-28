import { MongoMemoryServer } from "mongodb-memory-server";

describe("TourBooking model", () => {
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

  it("creates a valid booking, defaulting status/confirmedDateTime/notes", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    const booking = await TourBooking.create({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      numberOfVisitors: 2,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });

    expect(booking.status).toBe("Pending");
    expect(booking.confirmedDateTime).toBeNull();
    expect(booking.notes).toBe("");
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing email", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        phone: "123",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing phone", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing requestedDateTime", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 1,
      }),
    ).rejects.toThrow();
  });

  it("rejects numberOfVisitors below 1", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 0,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects numberOfVisitors above 50", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 51,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
        status: "Maybe",
      }),
    ).rejects.toThrow();
  });
});
