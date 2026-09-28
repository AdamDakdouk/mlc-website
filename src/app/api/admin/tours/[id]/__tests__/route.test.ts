import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT/DELETE /api/admin/tours/[id]", () => {
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

  async function createBooking() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");
    return TourBooking.create({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      numberOfVisitors: 2,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/tours/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("confirms a booking with an explicit adjusted time", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-10-16T14:00",
      }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    const updated = await TourBooking.findById(booking._id);
    expect(updated.status).toBe("Confirmed");
    expect(updated.confirmedDateTime.toISOString()).toContain("2026-10-16T14:00");
  });

  it("confirms a booking without an explicit time, defaulting to the requested time", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), { status: "Confirmed" }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    const updated = await TourBooking.findById(booking._id);
    expect(updated.confirmedDateTime.toISOString()).toBe(booking.requestedDateTime.toISOString());
  });

  it("declines a booking without touching confirmedDateTime", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), { status: "Declined" }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    const updated = await TourBooking.findById(booking._id);
    expect(updated.status).toBe("Declined");
    expect(updated.confirmedDateTime).toBeNull();
  });

  it("rejects an invalid confirmedDateTime on confirm", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-02-30T10:00",
      }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a status outside the fixed enum", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), { status: "Maybe" }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/tours/[id]/route");
    const res = await PUT(makeRequest("PUT", "not-an-id", { status: "Confirmed" }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(makeRequest("PUT", missingId, { status: "Confirmed" }), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a PUT request over the body size limit", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const request = new NextRequest(`http://localhost/api/admin/tours/${booking._id.toString()}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify({ status: "Confirmed" }),
    });
    const res = await PUT(request, { params: Promise.resolve({ id: booking._id.toString() }) });
    expect(res.status).toBe(413);
  });

  it("deletes a booking", async () => {
    const booking = await createBooking();
    const { DELETE } = require("@/app/api/admin/tours/[id]/route");

    const res = await DELETE(makeRequest("DELETE", booking._id.toString()), {
      params: Promise.resolve({ id: booking._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    expect(await TourBooking.findById(booking._id)).toBeNull();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/tours/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/tours/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
