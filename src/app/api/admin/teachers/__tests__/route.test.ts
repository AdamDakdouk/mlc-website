import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/admin/teachers", () => {
  let mongod: MongoMemoryServer;
  const savedPaths: string[] = [];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    jest.resetModules();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    const mongooseFresh = require("mongoose");
    await mongooseFresh.connection.dropDatabase();
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  function makeRequest(formData: FormData) {
    return new NextRequest("http://localhost/api/admin/teachers", {
      method: "POST",
      body: formData,
    });
  }

  it("creates a teacher with name and subjects", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Jane Doe");
    formData.append("subjects", "Math");
    formData.append("subjects", "Physics");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();

    const { Teacher } = require("@/models/Teacher");
    const saved = await Teacher.findById(data.id);
    expect(saved.name).toBe("Jane Doe");
    expect(saved.subjects).toEqual(["Math", "Physics"]);
    expect(saved.photoUrl).toBeNull();
    expect(saved.order).toBe(0);
  });

  it("creates a teacher with a valid photo", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Photo Teacher");
    formData.append("subjects", "English");
    formData.set(
      "photo",
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Teacher } = require("@/models/Teacher");
    const saved = await Teacher.findById(data.id);
    expect(saved.photoUrl).toMatch(/^\/uploads\/teachers\//);
    savedPaths.push(saved.photoUrl);
  });

  it("assigns incrementing order values to successive teachers", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData1 = new FormData();
    formData1.set("name", "First Teacher");
    formData1.append("subjects", "Math");
    await POST(makeRequest(formData1));

    const formData2 = new FormData();
    formData2.set("name", "Second Teacher");
    formData2.append("subjects", "Math");
    const res2 = await POST(makeRequest(formData2));
    const data2 = await res2.json();

    const { Teacher } = require("@/models/Teacher");
    const second = await Teacher.findById(data2.id);
    expect(second.order).toBe(1);
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.append("subjects", "Math");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an empty subjects list", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "No Subjects");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a subject not in the predefined list", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Bad Subject Teacher");
    formData.append("subjects", "Underwater Basket Weaving");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid photo file", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Bad Photo Teacher");
    formData.append("subjects", "Math");
    formData.set(
      "photo",
      new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/teachers/route");
    const formData = new FormData();
    formData.set("name", "Big Request");
    formData.append("subjects", "Math");

    const request = new NextRequest("http://localhost/api/admin/teachers", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      body: formData,
    });

    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
