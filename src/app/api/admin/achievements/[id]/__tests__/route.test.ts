import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("PUT/DELETE /api/admin/achievements/[id]", () => {
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

  async function createAchievement(withPhoto = false) {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");
    let photoUrl: string | null = null;
    if (withPhoto) {
      const { validateAndSaveImage } = require("@/lib/imageUpload");
      photoUrl = (await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
        "achievements",
      )) as string;
      savedPaths.push(photoUrl);
    }
    return Achievement.create({
      title: "Regional Science Fair — 1st Place",
      description: "Our robotics team took first place.",
      date: new Date("2026-03-10"),
      photoUrl,
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, formData?: FormData) {
    return new NextRequest(`http://localhost/api/admin/achievements/${id}`, {
      method,
      body: formData,
    });
  }

  it("updates an achievement's fields without touching an existing photo", async () => {
    const achievement = await createAchievement(true);
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", "Regional Science Fair — 1st Place (Updated)");
    formData.set("description", "Updated description.");
    formData.set("date", "2026-03-12");

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    const updated = await Achievement.findById(achievement._id);
    expect(updated.title).toBe("Regional Science Fair — 1st Place (Updated)");
    expect(updated.photoUrl).toBe(achievement.photoUrl);
  });

  it("replaces the photo and deletes the old file", async () => {
    const achievement = await createAchievement(true);
    const oldPhotoUrl = achievement.photoUrl;
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", achievement.title);
    formData.set("description", achievement.description);
    formData.set("date", "2026-03-10");
    formData.set(
      "photo",
      new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
    );

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    const updated = await Achievement.findById(achievement._id);
    expect(updated.photoUrl).not.toBe(oldPhotoUrl);
    savedPaths.push(updated.photoUrl);

    const oldFilePath = path.join(process.cwd(), "public", oldPhotoUrl);
    await expect(readFile(oldFilePath)).rejects.toThrow();
  });

  it("removes the photo entirely", async () => {
    const achievement = await createAchievement(true);
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", achievement.title);
    formData.set("description", achievement.description);
    formData.set("date", "2026-03-10");
    formData.set("removePhoto", "true");

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    const updated = await Achievement.findById(achievement._id);
    expect(updated.photoUrl).toBeNull();
  });

  it("rejects an update with an invalid calendar date", async () => {
    const achievement = await createAchievement();
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-02-30");

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const res = await PUT(makeRequest("PUT", "not-an-id", formData), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const res = await PUT(makeRequest("PUT", missingId, formData), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes an achievement and its photo file", async () => {
    const achievement = await createAchievement(true);
    const photoUrl = achievement.photoUrl;
    const { DELETE } = require("@/app/api/admin/achievements/[id]/route");

    const res = await DELETE(makeRequest("DELETE", achievement._id.toString()), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    expect(await Achievement.findById(achievement._id)).toBeNull();

    const filePath = path.join(process.cwd(), "public", photoUrl);
    await expect(readFile(filePath)).rejects.toThrow();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/achievements/[id]/route");
    const res = await DELETE(makeRequest("DELETE", "not-an-id"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 deleting a non-existent id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { DELETE } = require("@/app/api/admin/achievements/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
