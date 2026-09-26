import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { deleteResumeFile } from "@/lib/resumeUpload";

describe("DELETE /api/admin/careers/applications/[id] and GET .../resume", () => {
  let mongod: MongoMemoryServer;
  const createdResumeFilenames: string[] = [];

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
    for (const filename of createdResumeFilenames.splice(0)) {
      await deleteResumeFile(filename);
    }
  });

  async function createApplicationWithResume() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const { validateAndSaveResume } = require("@/lib/resumeUpload");

    const posting = await JobPosting.create({ title: "x", description: "x" });
    const pdfFile = new File([Buffer.from("%PDF-1.4\ntest")], "r.pdf", { type: "application/pdf" });
    const resumeFilename = await validateAndSaveResume(pdfFile);
    createdResumeFilenames.push(resumeFilename);
    const application = await Application.create({
      postingId: posting._id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "123",
      resumeFilename,
    });
    return { application, resumeFilename };
  }

  it("downloads a resume as application/pdf", async () => {
    const { application } = await createApplicationWithResume();
    const { GET } = require("@/app/api/admin/careers/applications/[id]/resume/route");

    const res = await GET(
      new NextRequest(`http://localhost/api/admin/careers/applications/${application._id.toString()}/resume`),
      { params: Promise.resolve({ id: application._id.toString() }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString("ascii", 0, 5)).toBe("%PDF-");
  });

  it("returns 404 downloading a resume for a non-existent application", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { GET } = require("@/app/api/admin/careers/applications/[id]/resume/route");

    const res = await GET(
      new NextRequest(`http://localhost/api/admin/careers/applications/${missingId}/resume`),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes an application and its resume file", async () => {
    const { application, resumeFilename } = await createApplicationWithResume();
    const { DELETE } = require("@/app/api/admin/careers/applications/[id]/route");

    const res = await DELETE(
      new NextRequest(`http://localhost/api/admin/careers/applications/${application._id.toString()}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: application._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { Application } = require("@/models/Application");
    expect(await Application.findById(application._id)).toBeNull();

    const resumePath = path.join(process.cwd(), "uploads-private", "resumes", resumeFilename);
    await expect(readFile(resumePath)).rejects.toThrow();
  });

  it("returns 400 for a malformed application id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/careers/applications/[id]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/careers/applications/not-an-id", { method: "DELETE" }),
      { params: Promise.resolve({ id: "not-an-id" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 deleting a non-existent application", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { DELETE } = require("@/app/api/admin/careers/applications/[id]/route");

    const res = await DELETE(
      new NextRequest(`http://localhost/api/admin/careers/applications/${missingId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
  });
});
