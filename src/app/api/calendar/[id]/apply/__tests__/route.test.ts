import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/calendar/[id]/apply", () => {
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

  function makeFormData(overrides: Record<string, string> = {}, includeProof = true) {
    const formData = new FormData();
    formData.set("name", overrides.name ?? "Jane Doe");
    formData.set("email", overrides.email ?? "jane@example.com");
    formData.set("phone", overrides.phone ?? "+961 1 234567");
    formData.set("address", overrides.address ?? "123 Main St, Bchamoun");
    if (includeProof) {
      formData.set(
        "paymentProof",
        new File([new Uint8Array(JPEG_BYTES)], "proof.jpg", { type: "image/jpeg" }),
      );
    }
    return formData;
  }

  function makeRequest(id: string, formData: FormData) {
    return new NextRequest(`http://localhost/api/calendar/${id}/apply`, {
      method: "POST",
      body: formData,
    });
  }

  async function createSession(overrides: Partial<{ sessionDateTime: Date; capacity: number; applicantCount: number }> = {}) {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const teacher = await Teacher.create({
      name: "Mr. Smith",
      email: "mr.smith@example.com",
      subjects: ["Math"],
    });
    const sessionDateTime = overrides.sessionDateTime ?? new Date("2099-10-05T15:00:00.000Z");
    return CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date(sessionDateTime.toISOString().slice(0, 10)),
      endDate: new Date(sessionDateTime.toISOString().slice(0, 10)),
      teacherId: teacher._id,
      sessionDateTime,
      durationMinutes: 90,
      capacity: overrides.capacity ?? 10,
      applicantCount: overrides.applicantCount ?? 0,
      price: 20,
    });
  }

  it("creates an application and increments applicantCount", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(session._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();

    const { SessionApplication } = require("@/models/SessionApplication");
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await SessionApplication.findById(data.id);
    expect(saved.name).toBe("Jane Doe");
    expect(saved.address).toBe("123 Main St, Bchamoun");
    expect(saved.status).toBe("Pending");
    expect(saved.sessionId.toString()).toBe(session._id.toString());

    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(1);
  });

  it("rejects a missing name", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(
      makeRequest(session._id.toString(), makeFormData({ name: "" })),
      { params: Promise.resolve({ id: session._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing payment proof", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(
      makeRequest(session._id.toString(), makeFormData({}, false)),
      { params: Promise.resolve({ id: session._id.toString() }) },
    );
    expect(res.status).toBe(400);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(0);
  });

  it("rejects an invalid payment proof file, rolling back the reserved spot", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");
    const formData = makeFormData({}, false);
    formData.set("paymentProof", new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }));

    const res = await POST(makeRequest(session._id.toString(), formData), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(400);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(0);
  });

  it("returns 404 for a non-existent session id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const missingId = new mongoose.Types.ObjectId().toString();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(missingId, makeFormData()), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-Session category event", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const event = await CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(event._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: event._id.toString() }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the session's date/time has already passed", async () => {
    const session = await createSession({ sessionDateTime: new Date("2020-01-01T10:00:00.000Z") });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(session._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when the session is full", async () => {
    const session = await createSession({ capacity: 1, applicantCount: 1 });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(session._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(409);
  });

  it("allows exactly one of two concurrent applies for the last spot to succeed", async () => {
    const session = await createSession({ capacity: 5, applicantCount: 4 });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const [resA, resB] = await Promise.all([
      POST(makeRequest(session._id.toString(), makeFormData({ email: "a@example.com" })), {
        params: Promise.resolve({ id: session._id.toString() }),
      }),
      POST(makeRequest(session._id.toString(), makeFormData({ email: "b@example.com" })), {
        params: Promise.resolve({ id: session._id.toString() }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(5);
  });

  it("rejects a request over the body size limit", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");
    const request = new NextRequest(`http://localhost/api/calendar/${session._id.toString()}/apply`, {
      method: "POST",
      headers: { "content-length": String(6 * 1024 * 1024 + 1) },
      body: makeFormData(),
    });

    const res = await POST(request, { params: Promise.resolve({ id: session._id.toString() }) });
    expect(res.status).toBe(413);
  });
});
