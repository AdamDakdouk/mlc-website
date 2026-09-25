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

    it("returns 400 for a malformed id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "T");
      formData.set("body", "B");

      const res = await PUT(makeRequest("not-an-id", formData), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a request whose declared content-length exceeds the 10MB cap", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");

      // We only need the declared Content-Length to exceed the cap, not an
      // actual 10MB+ body — the route must reject based on the header alone,
      // before ever calling request.formData(). Keeping the body tiny (or
      // absent) keeps this test fast. The id doesn't need to correspond to
      // a real announcement since the request is rejected before the
      // record is ever looked up.
      const oversized = 10 * 1024 * 1024 + 1;
      const fakeId = new mongoose.Types.ObjectId().toString();
      const request = new NextRequest(`http://localhost/api/admin/announcements/${fakeId}`, {
        method: "PUT",
        headers: { "content-length": String(oversized) },
      });

      const res = await PUT(request, { params: Promise.resolve({ id: fakeId }) });
      expect(res.status).toBe(413);
    });

    it("rejects a title over 200 characters and leaves the existing image untouched", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const imageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      );
      savedPaths.push(imageUrl);
      const existing = await Announcement.create({ title: "T", body: "B", imageUrl });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "a".repeat(201));
      formData.set("body", "B");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(400);

      const unchanged = await Announcement.findById(existing._id);
      expect(unchanged.title).toBe("T");
      expect(unchanged.imageUrl).toBe(imageUrl);

      const imagePath = path.join(process.cwd(), "public", imageUrl);
      await expect(access(imagePath)).resolves.toBeUndefined();
    });

    it("rolls back the newly-uploaded file if save fails, leaving the old file untouched", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const oldImageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "old.jpg", { type: "image/jpeg" }),
      );
      savedPaths.push(oldImageUrl);
      const existing = await Announcement.create({ title: "T", body: "B", imageUrl: oldImageUrl });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");

      // Capture the exact path of the newly-uploaded file the same way the
      // sibling create-route test's cleanup test does, since the route
      // doesn't surface the generated path in the thrown error.
      const fsPromises = require("fs/promises");
      const writeFileSpy = jest.spyOn(fsPromises, "writeFile");

      const saveSpy = jest
        .spyOn(Announcement.prototype, "save")
        .mockRejectedValueOnce(new Error("simulated save failure"));

      try {
        const formData = new FormData();
        formData.set("title", "T");
        formData.set("body", "B");
        formData.set(
          "image",
          new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
        );

        await expect(
          PUT(makeRequest(existing._id.toString(), formData), {
            params: Promise.resolve({ id: existing._id.toString() }),
          }),
        ).rejects.toThrow("simulated save failure");

        expect(writeFileSpy).toHaveBeenCalledTimes(1);
        const newPath = writeFileSpy.mock.calls[0][0] as string;
        await expect(access(newPath)).rejects.toThrow();

        const unchanged = await Announcement.findById(existing._id);
        expect(unchanged.imageUrl).toBe(oldImageUrl);

        const oldPath = path.join(process.cwd(), "public", oldImageUrl);
        await expect(access(oldPath)).resolves.toBeUndefined();
      } finally {
        saveSpy.mockRestore();
        writeFileSpy.mockRestore();
      }
    });
  });

  describe("DELETE", () => {
    function makeRequest(id: string) {
      return new NextRequest(`http://localhost/api/admin/announcements/${id}`, {
        method: "DELETE",
      });
    }

    it("deletes an announcement and its image file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const imageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      );
      const existing = await Announcement.create({ title: "T", body: "B", imageUrl });

      const { DELETE } = require("@/app/api/admin/announcements/[id]/route");
      const res = await DELETE(makeRequest(existing._id.toString()), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const found = await Announcement.findById(existing._id);
      expect(found).toBeNull();

      const imagePath = path.join(process.cwd(), "public", imageUrl);
      await expect(access(imagePath)).rejects.toThrow();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/announcements/[id]/route");
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await DELETE(makeRequest(fakeId), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/announcements/[id]/route");
      const res = await DELETE(makeRequest("not-an-id"), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });
  });
});
