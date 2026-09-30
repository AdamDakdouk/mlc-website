import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT/DELETE /api/admin/meeting-requests/[id]", () => {
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

  async function createMeetingRequest() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");
    return MeetingRequest.create({
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "+961 1 234567",
      parentAddress: "123 Main St, Bchamoun",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/meeting-requests/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("marks a request as contacted", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(makeRequest("PUT", meetingRequest._id.toString(), { status: "Contacted" }), {
      params: Promise.resolve({ id: meetingRequest._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const updated = await MeetingRequest.findById(meetingRequest._id);
    expect(updated.status).toBe("Contacted");
  });

  it("rejects a status outside the updatable set", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    for (const status of ["Pending", "Confirmed", "Maybe"]) {
      const res = await PUT(makeRequest("PUT", meetingRequest._id.toString(), { status }), {
        params: Promise.resolve({ id: meetingRequest._id.toString() }),
      });
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");
    const res = await PUT(makeRequest("PUT", "not-an-id", { status: "Contacted" }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(makeRequest("PUT", missingId, { status: "Contacted" }), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a PUT request over the body size limit", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const request = new NextRequest(
      `http://localhost/api/admin/meeting-requests/${meetingRequest._id.toString()}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
        body: JSON.stringify({ status: "Contacted" }),
      },
    );
    const res = await PUT(request, { params: Promise.resolve({ id: meetingRequest._id.toString() }) });
    expect(res.status).toBe(413);
  });

  it("deletes a request", async () => {
    const meetingRequest = await createMeetingRequest();
    const { DELETE } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await DELETE(makeRequest("DELETE", meetingRequest._id.toString()), {
      params: Promise.resolve({ id: meetingRequest._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    expect(await MeetingRequest.findById(meetingRequest._id)).toBeNull();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/meeting-requests/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
