import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink, readdir } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/admin/announcements", () => {
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
    // `jest.resetModules()` in `beforeAll` forces the dynamic
    // `require("mongoose")`/`require("@/lib/db")`/`require("@/models/Announcement")`
    // calls inside each test body to load a fresh module instance, so the
    // connection those tests actually use lives on a *different* `mongoose`
    // object than the one imported statically at the top of this file
    // (which was evaluated before `beforeAll` ever ran and was never
    // connected). Dropping the database through the stale top-level import
    // just buffers forever and times out, so re-require the current
    // instance here instead. Note: we deliberately do NOT call
    // `jest.resetModules()` again here — `connectToDatabase()`'s cache
    // lives on a real `global`, so a second reset would leave it pointing
    // at a connection tied to a now-discarded mongoose module instance
    // while a freshly-required `Announcement` model binds to yet another,
    // causing every subsequent query to buffer forever. (See the identical
    // pattern/comment in src/app/api/auth/login/__tests__/route.test.ts.)
    const currentMongoose = require("mongoose");
    await currentMongoose.connection.dropDatabase();
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  function makeRequest(formData: FormData) {
    return new NextRequest("http://localhost/api/admin/announcements", {
      method: "POST",
      body: formData,
    });
  }

  it("creates an announcement with title and body", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("title", "Exam schedule posted");
    formData.set("body", "Final exams begin next week.");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();

    const { Announcement } = require("@/models/Announcement");
    const saved = await Announcement.findById(data.id);
    expect(saved.title).toBe("Exam schedule posted");
    expect(saved.imageUrl).toBeNull();
  });

  it("creates an announcement with a valid image", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("title", "Sports day");
    formData.set("body", "Join us for sports day.");
    formData.set(
      "image",
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Announcement } = require("@/models/Announcement");
    const saved = await Announcement.findById(data.id);
    expect(saved.imageUrl).toMatch(/^\/uploads\/announcements\//);
    savedPaths.push(saved.imageUrl);
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("body", "Body without a title.");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid image file", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("title", "Bad image test");
    formData.set("body", "This upload should fail.");
    formData.set(
      "image",
      new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a request whose declared content-length exceeds the 10MB cap", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    // We only need the declared Content-Length to exceed the cap, not an
    // actual 10MB+ body — the route must reject based on the header alone,
    // before ever calling request.formData(). Keeping the body tiny (or
    // absent) keeps this test fast.
    const oversized = 10 * 1024 * 1024 + 1;
    const request = new NextRequest("http://localhost/api/admin/announcements", {
      method: "POST",
      headers: { "content-length": String(oversized) },
    });

    const res = await POST(request);
    expect(res.status).toBe(413);
  });

  it("cleans up the uploaded image if Announcement.create fails after a successful upload", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Announcement } = require("@/models/Announcement");
    const { POST } = require("@/app/api/admin/announcements/route");

    // `deleteImageFile`/`validateAndSaveImage` are re-exported through this
    // project's ESM-interop transform as getter-only properties on the
    // required module object, so `jest.spyOn` can't redefine them directly
    // ("Cannot redefine property"). Rather than fight that, verify the
    // outcome that actually matters: no file is left behind in the upload
    // directory after a request that uploads an image but then fails to
    // persist the announcement. `Announcement.create` itself is a normal
    // writable static method on the (non-ESM-exported) mongoose Model
    // object, so spying on it directly works fine.
    const uploadDir = path.join(process.cwd(), "public", "uploads", "announcements");
    const before = await readdir(uploadDir).catch(() => [] as string[]);

    const createSpy = jest
      .spyOn(Announcement, "create")
      .mockRejectedValueOnce(new Error("simulated DB failure"));

    try {
      const formData = new FormData();
      formData.set("title", "Cleanup test");
      formData.set("body", "This announcement should not be persisted.");
      formData.set(
        "image",
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      );

      await expect(POST(makeRequest(formData))).rejects.toThrow("simulated DB failure");

      const after = await readdir(uploadDir).catch(() => [] as string[]);
      expect(after.sort()).toEqual(before.sort());

      const count = await Announcement.countDocuments();
      expect(count).toBe(0);
    } finally {
      createSpy.mockRestore();
    }
  });
});
