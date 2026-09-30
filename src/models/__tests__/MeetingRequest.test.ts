import { MongoMemoryServer } from "mongodb-memory-server";

describe("MeetingRequest model", () => {
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

  const validFields = {
    parentName: "Jane Doe",
    parentEmail: "jane@example.com",
    parentPhone: "+961 1 234567",
    parentAddress: "123 Main St, Bchamoun",
    studentName: "Sam Doe",
    studentGrade: "Grade 5",
  };

  async function getModel() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    return require("@/models/MeetingRequest").MeetingRequest;
  }

  it("creates a valid request, defaulting status and reason", async () => {
    const MeetingRequest = await getModel();
    const request = await MeetingRequest.create(validFields);

    expect(request.status).toBe("Pending");
    expect(request.reason).toBe("");
  });

  it.each([
    "parentName",
    "parentEmail",
    "parentPhone",
    "parentAddress",
    "studentName",
    "studentGrade",
  ])("rejects a missing %s", async (field) => {
    const MeetingRequest = await getModel();
    const fields: Record<string, unknown> = { ...validFields };
    delete fields[field];

    await expect(MeetingRequest.create(fields)).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const MeetingRequest = await getModel();

    await expect(MeetingRequest.create({ ...validFields, status: "Confirmed" })).rejects.toThrow();
  });
});
