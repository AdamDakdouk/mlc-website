import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink, access } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("/api/admin/announcements/[id]", () => {
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

  describe("PUT", () => {
    function makeRequest(id: string, formData: FormData) {
      return new NextRequest(`http://localhost/api/admin/announcements/${id}`, {
        method: "PUT",
        body: formData,
      });
    }

    it("updates title and body", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const existing = await Announcement.create({ title: "Old title", body: "Old body" });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "New title");
      formData.set("body", "New body");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Announcement.findById(existing._id);
      expect(updated.title).toBe("New title");
      expect(updated.body).toBe("New body");
    });

    it("replaces the image and deletes the old file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const oldImageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "old.jpg", { type: "image/jpeg" }),
      );
      const existing = await Announcement.create({
        title: "Has image",
        body: "Body",
        imageUrl: oldImageUrl,
      });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "Has image");
      formData.set("body", "Body");
      formData.set(
        "image",
        new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
      );

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Announcement.findById(existing._id);
      expect(updated.imageUrl).not.toBe(oldImageUrl);
      savedPaths.push(updated.imageUrl);

      const oldPath = path.join(process.cwd(), "public", oldImageUrl);
      await expect(access(oldPath)).rejects.toThrow();
    });

    it("removes the image when removeImage is set", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const imageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      );
      const existing = await Announcement.create({ title: "T", body: "B", imageUrl });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "T");
      formData.set("body", "B");
      formData.set("removeImage", "true");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Announcement.findById(existing._id);
      expect(updated.imageUrl).toBeNull();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "T");
      formData.set("body", "B");

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await PUT(makeRequest(fakeId, formData), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });
  });
});
