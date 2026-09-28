import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("MeetingRequest model", () => {
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

  it("creates a valid request, defaulting status/confirmedDateTime/reason", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");
    const teacherId = new mongoose.Types.ObjectId();

    const request = await MeetingRequest.create({
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "+961 1 234567",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });

    expect(request.status).toBe("Pending");
    expect(request.confirmedDateTime).toBeNull();
    expect(request.reason).toBe("");
    expect(request.teacherId.toString()).toBe(teacherId.toString());
  });

  it("rejects a missing parentName", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing studentName", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing studentGrade", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing teacherId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing requestedDateTime", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
        status: "Maybe",
      }),
    ).rejects.toThrow();
  });
});
