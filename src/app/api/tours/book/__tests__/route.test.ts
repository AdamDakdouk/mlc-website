import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("POST /api/tours/book", () => {
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

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/tours/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const validBody = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+961 1 234567",
    numberOfVisitors: 3,
    requestedDateTime: "2026-10-15T10:00",
    notes: "We'd love to see the science labs.",
  };

  it("creates a booking with all fields", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/tours/book/route");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { TourBooking } = require("@/models/TourBooking");
    const saved = await TourBooking.findById(data.id);
    expect(saved.name).toBe("Jane Doe");
    expect(saved.numberOfVisitors).toBe(3);
    expect(saved.notes).toBe("We'd love to see the science labs.");
    expect(saved.requestedDateTime.toISOString()).toContain("2026-10-15T10:00");
    expect(saved.status).toBe("Pending");
  });

  it("creates a booking without notes, defaulting to empty", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/tours/book/route");
    const { notes, ...bodyWithoutNotes } = validBody;

    const res = await POST(makeRequest(bodyWithoutNotes));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { TourBooking } = require("@/models/TourBooking");
    const saved = await TourBooking.findById(data.id);
    expect(saved.notes).toBe("");
  });

  it("rejects a missing name", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const { name, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed requestedDateTime shape", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, requestedDateTime: "2026-10-15" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-existent calendar date/time", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, requestedDateTime: "2026-02-30T10:00" }));
    expect(res.status).toBe(400);
  });

  it("rejects a numberOfVisitors of 0", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, numberOfVisitors: 0 }));
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const request = new NextRequest("http://localhost/api/tours/book", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify(validBody),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
