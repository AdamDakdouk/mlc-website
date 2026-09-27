import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/admin/achievements", () => {
  let mongod: MongoMemoryServer;
  const savedPaths: string[] = [];

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
    const { unlink } = require("fs/promises");
    const path = require("path");
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  function makeRequest(formData: FormData) {
    return new NextRequest("http://localhost/api/admin/achievements", {
      method: "POST",
      body: formData,
    });
  }

  it("creates an achievement without a photo", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/achievements/route");

    const formData = new FormData();
    formData.set("title", "Regional Science Fair — 1st Place");
    formData.set("description", "Our robotics team took first place.");
    formData.set("date", "2026-03-10");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Achievement } = require("@/models/Achievement");
    const saved = await Achievement.findById(data.id);
    expect(saved.title).toBe("Regional Science Fair — 1st Place");
    expect(saved.photoUrl).toBeNull();
    expect(saved.date.toISOString()).toContain("2026-03-10");
  });

  it("creates an achievement with a valid photo", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/achievements/route");

    const formData = new FormData();
    formData.set("title", "Accreditation Renewed");
    formData.set("description", "MLC renewed its accreditation.");
    formData.set("date", "2026-01-15");
    formData.set(
      "photo",
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Achievement } = require("@/models/Achievement");
    const saved = await Achievement.findById(data.id);
    expect(saved.photoUrl).toMatch(/^\/uploads\/achievements\//);
    savedPaths.push(saved.photoUrl);
  });

  it("rejects a missing title", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a missing description", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("date", "2026-01-01");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a missing date", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid calendar date", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-02-30");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid photo file", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");
    formData.set(
      "photo",
      new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const request = new NextRequest("http://localhost/api/admin/achievements", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      body: formData,
    });

    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
