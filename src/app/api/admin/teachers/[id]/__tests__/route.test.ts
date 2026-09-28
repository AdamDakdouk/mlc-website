import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink, access } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("/api/admin/teachers/[id]", () => {
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
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  describe("PUT", () => {
    function makeRequest(id: string, formData: FormData) {
      return new NextRequest(`http://localhost/api/admin/teachers/${id}`, {
        method: "PUT",
        body: formData,
      });
    }

    it("updates name, subjects, qualifications, experience", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const existing = await Teacher.create({ name: "Old Name", subjects: ["Math"] });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "New Name");
      formData.append("subjects", "Physics");
      formData.append("subjects", "Chemistry");
      formData.set("qualifications", "PhD Physics");
      formData.set("experience", "5 years");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Teacher.findById(existing._id);
      expect(updated.name).toBe("New Name");
      expect(updated.subjects).toEqual(["Physics", "Chemistry"]);
      expect(updated.qualifications).toBe("PhD Physics");
      expect(updated.experience).toBe("5 years");
    });

    it("replaces the photo and deletes the old file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const oldPhotoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "old.jpg", { type: "image/jpeg" }),
        "teachers",
      );
      const existing = await Teacher.create({
        name: "Has Photo",
        subjects: ["Math"],
        photoUrl: oldPhotoUrl,
      });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "Has Photo");
      formData.append("subjects", "Math");
      formData.set(
        "photo",
        new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
      );

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Teacher.findById(existing._id);
      expect(updated.photoUrl).not.toBe(oldPhotoUrl);
      savedPaths.push(updated.photoUrl);

      const oldPath = path.join(process.cwd(), "public", oldPhotoUrl);
      await expect(access(oldPath)).rejects.toThrow();
    });

    it("removes the photo when removePhoto is set", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const photoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
        "teachers",
      );
      const existing = await Teacher.create({ name: "T", subjects: ["Math"], photoUrl });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");
      formData.set("removePhoto", "true");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Teacher.findById(existing._id);
      expect(updated.photoUrl).toBeNull();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await PUT(makeRequest(fakeId, formData), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");

      const res = await PUT(makeRequest("not-an-id", formData), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a name over 200 characters", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const existing = await Teacher.create({ name: "T", subjects: ["Math"] });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "A".repeat(201));
      formData.append("subjects", "Math");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a request over the body size limit", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const existing = await Teacher.create({ name: "T", subjects: ["Math"] });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");

      const request = new NextRequest(
        `http://localhost/api/admin/teachers/${existing._id.toString()}`,
        {
          method: "PUT",
          headers: { "content-length": String(10 * 1024 * 1024 + 1) },
          body: formData,
        },
      );

      const res = await PUT(request, {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(413);
    });
  });

  describe("DELETE", () => {
    function makeRequest(id: string) {
      return new NextRequest(`http://localhost/api/admin/teachers/${id}`, {
        method: "DELETE",
      });
    }

    it("deletes a teacher and their photo file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const photoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
        "teachers",
      );
      const existing = await Teacher.create({ name: "T", subjects: ["Math"], photoUrl });

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const res = await DELETE(makeRequest(existing._id.toString()), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const found = await Teacher.findById(existing._id);
      expect(found).toBeNull();

      const photoPath = path.join(process.cwd(), "public", photoUrl);
      await expect(access(photoPath)).rejects.toThrow();
    });

    it("returns 409 and does not delete when the teacher has meeting requests", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { MeetingRequest } = require("@/models/MeetingRequest");

      const existing = await Teacher.create({ name: "T", subjects: ["Math"] });
      await MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: existing._id,
        parentAddress: "123 Main St, Bchamoun",
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      });

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const res = await DELETE(makeRequest(existing._id.toString()), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(409);

      const found = await Teacher.findById(existing._id);
      expect(found).not.toBeNull();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await DELETE(makeRequest(fakeId), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const res = await DELETE(makeRequest("not-an-id"), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });
  });
});
