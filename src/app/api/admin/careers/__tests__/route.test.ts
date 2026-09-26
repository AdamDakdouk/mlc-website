import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("POST /api/admin/careers", () => {
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
    return new NextRequest("http://localhost/api/admin/careers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a posting, defaulting requirements to empty", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/careers/route");

    const res = await POST(
      makeRequest({ title: "Math Teacher", description: "Teach math.", status: "Open" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { JobPosting } = require("@/models/JobPosting");
    const saved = await JobPosting.findById(data.id);
    expect(saved.title).toBe("Math Teacher");
    expect(saved.requirements).toBe("");
  });

  it("creates a posting with explicit requirements", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/careers/route");

    const res = await POST(
      makeRequest({
        title: "Physics Teacher",
        description: "Teach physics.",
        requirements: "BSc in Physics",
        status: "Open",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { JobPosting } = require("@/models/JobPosting");
    const saved = await JobPosting.findById(data.id);
    expect(saved.requirements).toBe("BSc in Physics");
  });

  it("rejects a missing title", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const res = await POST(makeRequest({ description: "x", status: "Open" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing description", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const res = await POST(makeRequest({ title: "x", status: "Open" }));
    expect(res.status).toBe(400);
  });

  it("rejects a status outside the fixed enum", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const res = await POST(
      makeRequest({ title: "x", description: "x", status: "Pending" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const request = new NextRequest("http://localhost/api/admin/careers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const request = new NextRequest("http://localhost/api/admin/careers", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify({ title: "x", description: "x", status: "Open" }),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
