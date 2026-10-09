import { MongoMemoryServer } from "mongodb-memory-server";

describe("GET /api/health", () => {
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

  it("returns 200 ok when the database is reachable", async () => {
    const { GET } = require("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 with no details when the database ping fails", async () => {
    const { GET } = require("@/app/api/health/route");
    const mongooseFresh = require("mongoose");
    const spy = jest
      .spyOn(mongooseFresh.connection.db!, "admin")
      .mockImplementation(() => {
        throw new Error("secret connection detail");
      });

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: "error" });
    expect(JSON.stringify(body)).not.toContain("secret");
    spy.mockRestore();
  });
});
