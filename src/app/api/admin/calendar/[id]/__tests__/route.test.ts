import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT/DELETE /api/admin/calendar/[id]", () => {
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

  async function createEvent() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    return CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/calendar/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("updates an event's fields", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Open House (Rescheduled)",
        category: "Event",
        startDate: "2026-10-12",
        endDate: "2026-10-13",
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updated = await CalendarEvent.findById(event._id);
    expect(updated.title).toBe("Open House (Rescheduled)");
    expect(updated.endDate.toISOString()).toContain("2026-10-13");
  });

  it("rejects an update with endDate before startDate", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Backwards",
        category: "Event",
        startDate: "2026-10-10",
        endDate: "2026-10-05",
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects an update with an invalid calendar date", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Bad Date",
        category: "Event",
        startDate: "2026-02-30",
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  async function createTeacher() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    return Teacher.create({ name: "Mr. Smith", email: "mr.smith@example.com", subjects: ["Math"] });
  }

  it("updates a Session event's session fields", async () => {
    const event = await createEvent();
    const teacher = await createTeacher();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updated = await CalendarEvent.findById(event._id);
    expect(updated.category).toBe("Session");
    expect(updated.teacherId.toString()).toBe(teacher._id.toString());
    expect(updated.durationMinutes).toBe(90);
    expect(updated.capacity).toBe(10);
    expect(updated.price).toBe(20);
  });

  it("rejects a Session update missing teacherId", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session update with a non-existent teacherId", async () => {
    const event = await createEvent();
    const mongoose = require("mongoose");
    const missingTeacherId = new mongoose.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: missingTeacherId,
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session update with a malformed teacherId", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: "not-a-valid-object-id",
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("clears session fields when a Session event's category is switched away from Session", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const teacher = await createTeacher();
    const sessionEvent = await CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
      teacherId: teacher._id,
      sessionDateTime: new Date("2026-10-05T15:00:00.000Z"),
      durationMinutes: 90,
      capacity: 10,
      price: 20,
    });

    const { PUT } = require("@/app/api/admin/calendar/[id]/route");
    const res = await PUT(
      makeRequest("PUT", sessionEvent._id.toString(), {
        title: "Open House",
        category: "Event",
        startDate: "2026-10-05",
      }),
      { params: Promise.resolve({ id: sessionEvent._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const updated = await CalendarEvent.findById(sessionEvent._id);
    expect(updated.category).toBe("Event");
    expect(updated.teacherId).toBeUndefined();
    expect(updated.sessionDateTime).toBeUndefined();
    expect(updated.durationMinutes).toBeUndefined();
    expect(updated.capacity).toBeUndefined();
    expect(updated.price).toBeUndefined();
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");
    const res = await PUT(makeRequest("PUT", "not-an-id", { title: "x" }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();

    const res = await PUT(
      makeRequest("PUT", missingId, {
        title: "x",
        category: "Event",
        startDate: "2026-10-05",
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes an event", async () => {
    const event = await createEvent();
    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");

    const res = await DELETE(makeRequest("DELETE", event._id.toString()), {
      params: Promise.resolve({ id: event._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    expect(await CalendarEvent.findById(event._id)).toBeNull();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");
    const res = await DELETE(makeRequest("DELETE", "not-an-id"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 deleting a non-existent id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
