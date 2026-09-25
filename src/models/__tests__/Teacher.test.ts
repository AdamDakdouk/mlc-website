import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Teacher model", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("creates a teacher with required fields and defaults", async () => {
    const { Teacher } = require("@/models/Teacher");
    const teacher = await Teacher.create({
      name: "Jane Doe",
      subjects: ["Math", "Physics"],
    });
    expect(teacher.name).toBe("Jane Doe");
    expect(teacher.photoUrl).toBeNull();
    expect(teacher.subjects).toEqual(["Math", "Physics"]);
    expect(teacher.qualifications).toBe("");
    expect(teacher.experience).toBe("");
    expect(teacher.order).toBe(0);
    expect(teacher.createdAt).toBeInstanceOf(Date);
    expect(teacher.updatedAt).toBeInstanceOf(Date);
  });

  it("stores optional fields when provided", async () => {
    const { Teacher } = require("@/models/Teacher");
    const teacher = await Teacher.create({
      name: "John Smith",
      subjects: ["English"],
      qualifications: "MA English Literature",
      experience: "10 years teaching high school English",
      photoUrl: "/uploads/teachers/abc123.jpg",
      order: 3,
    });
    expect(teacher.qualifications).toBe("MA English Literature");
    expect(teacher.experience).toBe("10 years teaching high school English");
    expect(teacher.photoUrl).toBe("/uploads/teachers/abc123.jpg");
    expect(teacher.order).toBe(3);
  });

  it("rejects a missing name", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(Teacher.create({ subjects: ["Math"] })).rejects.toThrow();
  });

  it("rejects an empty subjects array", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(
      Teacher.create({ name: "No Subjects", subjects: [] }),
    ).rejects.toThrow();
  });

  it("rejects a subject not in the predefined list", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(
      Teacher.create({ name: "Bad Subject", subjects: ["Underwater Basket Weaving"] }),
    ).rejects.toThrow();
  });

  it("rejects a name over 200 characters", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(
      Teacher.create({ name: "A".repeat(201), subjects: ["Math"] }),
    ).rejects.toThrow();
  });
});
