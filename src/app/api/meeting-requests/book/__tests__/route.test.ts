import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

describe("POST /api/meeting-requests/book", () => {
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
    return new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function createTeacher() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    return Teacher.create({ name: "Mr. Smith", email: "mr.smith@example.com", subjects: ["Math"] });
  }

  it("creates a request with all fields", async () => {
    const teacher = await createTeacher();
    const validBody = {
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "+961 1 234567",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId: teacher._id.toString(),
      parentAddress: "123 Main St, Bchamoun",
      requestedDateTime: "2026-10-15T10:00",
      reason: "Discuss progress in Math.",
    };
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const saved = await MeetingRequest.findById(data.id);
    expect(saved.parentName).toBe("Jane Doe");
    expect(saved.studentGrade).toBe("Grade 5");
    expect(saved.teacherId.toString()).toBe(teacher._id.toString());
    expect(saved.parentAddress).toBe("123 Main St, Bchamoun");
    expect(saved.reason).toBe("Discuss progress in Math.");
    expect(saved.status).toBe("Pending");
  });

  it("creates a request without a reason, defaulting to empty", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const saved = await MeetingRequest.findById(data.id);
    expect(saved.reason).toBe("");
  });

  it("rejects a missing parentName", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid parentEmail", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "not-an-email",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed requestedDateTime shape", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: "2026-10-15",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-existent calendar date/time", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: "2026-02-30T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed teacherId", async () => {
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: "not-an-id",
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a well-formed but non-existent teacherId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const missingId = new mongoose.Types.ObjectId().toString();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: missingId,
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects a missing parentAddress", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const teacher = await createTeacher();
    const validBody = {
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "123",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId: teacher._id.toString(),
      parentAddress: "123 Main St, Bchamoun",
      requestedDateTime: "2026-10-15T10:00",
    };
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const request = new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify(validBody),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
