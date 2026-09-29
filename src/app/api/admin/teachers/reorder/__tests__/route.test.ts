import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT /api/admin/teachers/reorder", () => {
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
    return new NextRequest("http://localhost/api/admin/teachers/reorder", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("sets order to match the submitted id sequence", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const a = await Teacher.create({ name: "A", email: "a@example.com", subjects: ["Math"], order: 0 });
    const b = await Teacher.create({ name: "B", email: "b@example.com", subjects: ["Math"], order: 1 });
    const c = await Teacher.create({ name: "C", email: "c@example.com", subjects: ["Math"], order: 2 });

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(
      makeRequest({ ids: [c._id.toString(), a._id.toString(), b._id.toString()] }),
    );
    expect(res.status).toBe(200);

    const updatedA = await Teacher.findById(a._id);
    const updatedB = await Teacher.findById(b._id);
    const updatedC = await Teacher.findById(c._id);
    expect(updatedC.order).toBe(0);
    expect(updatedA.order).toBe(1);
    expect(updatedB.order).toBe(2);
  });

  it("rejects a missing ids array", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects a list containing a malformed id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(makeRequest({ ids: ["not-an-id"] }));
    expect(res.status).toBe(400);
  });

  it("rejects a list containing a duplicate id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const a = await Teacher.create({ name: "A", email: "a@example.com", subjects: ["Math"], order: 0 });
    const b = await Teacher.create({ name: "B", email: "b@example.com", subjects: ["Math"], order: 1 });

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(
      makeRequest({ ids: [a._id.toString(), b._id.toString(), a._id.toString()] }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a list containing an id for a non-existent teacher", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const { Teacher } = require("@/models/Teacher");
    const a = await Teacher.create({ name: "A", email: "a@example.com", subjects: ["Math"], order: 0 });
    const missingId = new mongooseFresh.Types.ObjectId().toString();

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(makeRequest({ ids: [a._id.toString(), missingId] }));
    expect(res.status).toBe(400);
  });
});
