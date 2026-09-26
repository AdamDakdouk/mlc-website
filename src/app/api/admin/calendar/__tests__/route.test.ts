import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("POST /api/admin/calendar", () => {
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
    return new NextRequest("http://localhost/api/admin/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a single-day event, defaulting endDate to startDate", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({ title: "Open House", category: "Event", startDate: "2026-10-05" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await CalendarEvent.findById(data.id);
    expect(saved.title).toBe("Open House");
    expect(saved.startDate.toISOString()).toContain("2026-10-05");
    expect(saved.endDate.toISOString()).toContain("2026-10-05");
  });

  it("creates a multi-day event with an explicit endDate", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Winter Break",
        category: "Holiday",
        startDate: "2026-12-20",
        endDate: "2027-01-05",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await CalendarEvent.findById(data.id);
    expect(saved.endDate.toISOString()).toContain("2027-01-05");
  });

  it("rejects a missing title", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(makeRequest({ category: "Event", startDate: "2026-10-05" }));
    expect(res.status).toBe(400);
  });

  it("rejects a category outside the fixed enum", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Bad", category: "Nope", startDate: "2026-10-05" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed startDate", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Bad Date", category: "Event", startDate: "not-a-date" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an endDate before startDate", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Backwards",
        category: "Event",
        startDate: "2026-10-10",
        endDate: "2026-10-05",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const request = new NextRequest("http://localhost/api/admin/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const request = new NextRequest("http://localhost/api/admin/calendar", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify({ title: "x", category: "Event", startDate: "2026-10-05" }),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
