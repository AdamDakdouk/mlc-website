import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { readFile, rm } from "fs/promises";
import path from "path";

describe("PUT/DELETE /api/admin/careers/[id]", () => {
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
    await rm(path.join(process.cwd(), "uploads-private"), { recursive: true, force: true });
  });

  async function createPosting() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    return JobPosting.create({ title: "Math Teacher", description: "Teach math.", status: "Open" });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/careers/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("updates a posting's fields", async () => {
    const posting = await createPosting();
    const { PUT } = require("@/app/api/admin/careers/[id]/route");

    const res = await PUT(
      makeRequest("PUT", posting._id.toString(), {
        title: "Senior Math Teacher",
        description: "Teach advanced math.",
        status: "Closed",
      }),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { JobPosting } = require("@/models/JobPosting");
    const updated = await JobPosting.findById(posting._id);
    expect(updated.title).toBe("Senior Math Teacher");
    expect(updated.status).toBe("Closed");
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/careers/[id]/route");
    const res = await PUT(
      makeRequest("PUT", "not-an-id", { title: "x", description: "x", status: "Open" }),
      { params: Promise.resolve({ id: "not-an-id" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/careers/[id]/route");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();

    const res = await PUT(
      makeRequest("PUT", missingId, { title: "x", description: "x", status: "Open" }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes a posting with no applications", async () => {
    const posting = await createPosting();
    const { DELETE } = require("@/app/api/admin/careers/[id]/route");

    const res = await DELETE(makeRequest("DELETE", posting._id.toString()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { JobPosting } = require("@/models/JobPosting");
    expect(await JobPosting.findById(posting._id)).toBeNull();
  });

  it("cascades: deleting a posting deletes its applications and their resume files", async () => {
    const posting = await createPosting();
    const { Application } = require("@/models/Application");
    const { validateAndSaveResume } = require("@/lib/resumeUpload");

    const pdfFile = new File([Buffer.from("%PDF-1.4\ntest")], "r.pdf", { type: "application/pdf" });
    const resumeFilename = await validateAndSaveResume(pdfFile);
    const application = await Application.create({
      postingId: posting._id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "123",
      resumeFilename,
    });

    const resumePath = path.join(process.cwd(), "uploads-private", "resumes", resumeFilename);
    expect((await readFile(resumePath)).length).toBeGreaterThan(0);

    const { DELETE } = require("@/app/api/admin/careers/[id]/route");
    const res = await DELETE(makeRequest("DELETE", posting._id.toString()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(200);

    expect(await Application.findById(application._id)).toBeNull();
    await expect(readFile(resumePath)).rejects.toThrow();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/careers/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/careers/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
