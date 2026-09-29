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

  it("rejects a startDate that isn't a real calendar date", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Bad Date", category: "Event", startDate: "2026-02-30" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a startDate with an out-of-range month instead of crashing", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Bad Month", category: "Event", startDate: "2026-13-01" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an endDate that isn't a real calendar date", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Bad End Date",
        category: "Event",
        startDate: "2026-04-01",
        endDate: "2026-04-31",
      }),
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

  async function createTeacher() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    return Teacher.create({ name: "Mr. Smith", email: "mr.smith@example.com", subjects: ["Math"] });
  }

  it("creates a Session event with all session fields", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await CalendarEvent.findById(data.id);
    expect(saved.teacherId.toString()).toBe(teacher._id.toString());
    expect(saved.sessionDateTime.toISOString()).toContain("2026-10-05T15:00");
    expect(saved.durationMinutes).toBe(90);
    expect(saved.capacity).toBe(10);
    expect(saved.price).toBe(20);
    expect(saved.applicantCount).toBe(0);
    expect(saved.startDate.toISOString()).toContain("2026-10-05");
    expect(saved.endDate.toISOString()).toContain("2026-10-05");
  });

  it("rejects a Session event missing teacherId", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing sessionDateTime", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing durationMinutes", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing capacity", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing price", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event with a non-existent teacherId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongoose = require("mongoose");
    const missingTeacherId = new mongoose.Types.ObjectId().toString();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: missingTeacherId,
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event with a malformed teacherId", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: "not-a-valid-object-id",
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event with an invalid sessionDateTime", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-02-30T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("does not require session fields for a non-Session category", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Open House", category: "Event", startDate: "2026-10-05" }),
    );
    expect(res.status).toBe(201);
  });
});
