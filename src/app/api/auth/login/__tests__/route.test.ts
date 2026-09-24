import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

describe("POST /api/auth/login", () => {
  let mongod: MongoMemoryServer;

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
    // `require("mongoose")`/`require("@/lib/db")`/`require("@/models/User")`
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
    // while a freshly-required `User` model binds to yet another, causing
    // every subsequent query to buffer forever.
    const currentMongoose = require("mongoose");
    await currentMongoose.connection.dropDatabase();
  });

  function makeRequest(body: unknown, ip = "10.0.0.1") {
    return new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
  }

  it("logs in with valid credentials and sets a cookie", async () => {
    const { hashPassword } = require("@/lib/password");
    const { User } = require("@/models/User");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    await User.create({
      email: "admin@example.com",
      passwordHash: await hashPassword("correct-password"),
      role: "admin",
    });

    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "admin@example.com", password: "correct-password" }, "10.0.0.2"),
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get("token")?.value).toBeTruthy();
  });

  it("rejects an incorrect password", async () => {
    const { hashPassword } = require("@/lib/password");
    const { User } = require("@/models/User");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    await User.create({
      email: "admin@example.com",
      passwordHash: await hashPassword("correct-password"),
      role: "admin",
    });

    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "admin@example.com", password: "wrong-password" }, "10.0.0.3"),
    );

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "nobody@example.com", password: "whatever123" }, "10.0.0.4"),
    );

    expect(res.status).toBe(401);
  });

  it("rejects a malformed request body", async () => {
    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "not-an-email" }, "10.0.0.5"));

    expect(res.status).toBe(400);
  });

  it("rejects a request with a mismatched Origin header", async () => {
    const { POST } = require("@/app/api/auth/login/route");
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.7",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ email: "admin@example.com", password: "correct-password" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("rate-limits after 5 failed attempts from the same IP", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { POST } = require("@/app/api/auth/login/route");
    const ip = "10.0.0.6";

    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ email: "nobody@example.com", password: "whatever123" }, ip));
    }
    const res = await POST(
      makeRequest({ email: "nobody@example.com", password: "whatever123" }, ip),
    );

    expect(res.status).toBe(429);
  });
});
