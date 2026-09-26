import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("GET /api/admin/careers/[id]/applications", () => {
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

  it("lists applications for a posting, newest first", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });
    await Application.create({
      postingId: posting._id,
      name: "First",
      email: "a@example.com",
      phone: "1",
      resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      submittedAt: new Date("2026-01-01"),
    });
    await Application.create({
      postingId: posting._id,
      name: "Second",
      email: "b@example.com",
      phone: "2",
      resumeFilename: "22222222-2222-2222-2222-222222222222.pdf",
      submittedAt: new Date("2026-02-01"),
    });

    const { GET } = require("@/app/api/admin/careers/[id]/applications/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/careers/${posting._id.toString()}/applications`),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toHaveLength(2);
    expect(data.applications[0].name).toBe("Second");
  });

  it("returns 400 for a malformed posting id", async () => {
    const { GET } = require("@/app/api/admin/careers/[id]/applications/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/careers/not-an-id/applications"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns an empty list for a posting with no applications", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    const { GET } = require("@/app/api/admin/careers/[id]/applications/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/careers/${posting._id.toString()}/applications`),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toEqual([]);
  });
});
