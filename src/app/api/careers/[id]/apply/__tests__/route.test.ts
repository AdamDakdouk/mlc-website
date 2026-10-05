import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { deleteResumeFile } from "@/lib/resumeUpload";

const PDF_BYTES = Buffer.from("%PDF-1.4\ntest resume content");

jest.mock("@/lib/mailer", () => ({
  sendAdminNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));

describe("POST /api/careers/[id]/apply", () => {
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
    delete process.env.SMTP_HOST;
    require("@/lib/mailer").sendAdminNotificationEmail.mockClear();
    require("@/lib/rateLimit").resetRateLimit("careers-apply:unknown");
    const mongooseFresh = require("mongoose");
    await mongooseFresh.connection.dropDatabase();
    for (const filename of createdResumeFilenames.splice(0)) {
      await deleteResumeFile(filename);
    }
  });

  async function createPosting(status: "Open" | "Closed" = "Open") {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    return JobPosting.create({ title: "Math Teacher", description: "Teach math.", status });
  }

  function makeFormData(overrides: Record<string, string> = {}, includeResume = true) {
    const formData = new FormData();
    formData.set("name", overrides.name ?? "Jane Doe");
    formData.set("email", overrides.email ?? "jane@example.com");
    formData.set("phone", overrides.phone ?? "+961 1 234567");
    if ("coverNote" in overrides) formData.set("coverNote", overrides.coverNote);
    if ("website" in overrides) formData.set("website", overrides.website);
    if (includeResume) {
      formData.set("resume", new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" }));
    }
    return formData;
  }

  function makeRequest(id: string, formData: FormData) {
    return new NextRequest(`http://localhost/api/careers/${id}/apply`, {
      method: "POST",
      body: formData,
    });
  }

  it("creates an application for an open posting", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(makeRequest(posting._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(201);

    const { Application } = require("@/models/Application");
    const applications = await Application.find({ postingId: posting._id });
    expect(applications).toHaveLength(1);
    expect(applications[0].name).toBe("Jane Doe");
    expect(applications[0].resumeFilename).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    createdResumeFilenames.push(applications[0].resumeFilename);
  });

  it("rejects an application to a closed posting", async () => {
    const posting = await createPosting("Closed");
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(makeRequest(posting._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(404);

    const { Application } = require("@/models/Application");
    expect(await Application.countDocuments({})).toBe(0);
  });

  it("rejects an application to a non-existent posting", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(makeRequest(missingId, makeFormData()), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a malformed posting id", async () => {
    const { POST } = require("@/app/api/careers/[id]/apply/route");
    const res = await POST(makeRequest("not-an-id", makeFormData()), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a missing name", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");
    const formData = makeFormData();
    formData.delete("name");

    const res = await POST(makeRequest(posting._id.toString(), formData), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(
      makeRequest(posting._id.toString(), makeFormData({ email: "not-an-email" })),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing resume file", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(
      makeRequest(posting._id.toString(), makeFormData({}, false)),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a resume that isn't actually a PDF", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");
    const formData = makeFormData();
    formData.set("resume", new File([Buffer.from("not a pdf")], "resume.pdf", { type: "application/pdf" }));

    const res = await POST(makeRequest(posting._id.toString(), formData), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(400);

    const { Application } = require("@/models/Application");
    expect(await Application.countDocuments({})).toBe(0);
  });

  it("rejects a request over the body size limit", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");
    const formData = makeFormData();

    const request = new NextRequest(`http://localhost/api/careers/${posting._id.toString()}/apply`, {
      method: "POST",
      headers: { "content-length": String(6 * 1024 * 1024 + 1) },
      body: formData,
    });
    const res = await POST(request, { params: Promise.resolve({ id: posting._id.toString() }) });
    expect(res.status).toBe(413);
  });

  it("accepts an application with no cover note, defaulting it to empty", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(makeRequest(posting._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(201);

    const { Application } = require("@/models/Application");
    const application = await Application.findOne({ postingId: posting._id });
    expect(application.coverNote).toBe("");
    createdResumeFilenames.push(application.resumeFilename);
  });

  it("deletes the saved resume file when the DB write fails after upload", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");
    const { Application } = require("@/models/Application");
    const { readResumeFile } = require("@/lib/resumeUpload");

    // Force the save-then-cleanup rollback path: the resume is genuinely
    // written to disk first (validateAndSaveResume is not mocked), and only
    // the DB write is forced to fail, mirroring a real create() error.
    const createSpy = jest
      .spyOn(Application, "create")
      .mockRejectedValueOnce(new Error("simulated DB failure"));

    await expect(
      POST(makeRequest(posting._id.toString(), makeFormData()), {
        params: Promise.resolve({ id: posting._id.toString() }),
      }),
    ).rejects.toThrow("simulated DB failure");

    expect(createSpy).toHaveBeenCalledTimes(1);
    const resumeFilename = (createSpy.mock.calls[0][0] as { resumeFilename: string })
      .resumeFilename;
    expect(resumeFilename).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    createdResumeFilenames.push(resumeFilename);

    createSpy.mockRestore();

    expect(await Application.countDocuments({})).toBe(0);
    // The file that was written before the failed create() must have been
    // removed by the rollback — reading it back should fail.
    await expect(readResumeFile(resumeFilename)).rejects.toThrow();
  });

  it("pretends success but saves nothing when the honeypot field is filled", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(
      makeRequest(posting._id.toString(), makeFormData({ website: "http://spam.example" })),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(201);

    const { Application } = require("@/models/Application");
    expect(await Application.countDocuments()).toBe(0);
  });

  it("returns 429 after 10 attempts from the same IP", async () => {
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");
    const id = posting._id.toString();

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // Invalid (no resume) requests still count against the limit.
      const res = await POST(makeRequest(id, makeFormData({}, false)), { params: Promise.resolve({ id }) });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("emails the admin about a new application", async () => {
    process.env.SMTP_HOST = "smtp.test.local";
    const posting = await createPosting();
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(makeRequest(posting._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(201);

    const { Application } = require("@/models/Application");
    const saved = await Application.findOne({ postingId: posting._id });
    createdResumeFilenames.push(saved.resumeFilename);

    const { sendAdminNotificationEmail } = require("@/lib/mailer");
    expect(sendAdminNotificationEmail).toHaveBeenCalledTimes(1);
    const args = sendAdminNotificationEmail.mock.calls[0][0];
    expect(args.subject).toBe("New job application: Math Teacher");
    expect(args.replyTo).toBe("jane@example.com");
    expect(args.text).toContain(`/admin/dashboard/careers/${posting._id.toString()}/applications`);
  });

  it("sends no notification when the application is rejected", async () => {
    process.env.SMTP_HOST = "smtp.test.local";
    const posting = await createPosting("Closed");
    const { POST } = require("@/app/api/careers/[id]/apply/route");

    const res = await POST(makeRequest(posting._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: posting._id.toString() }),
    });
    expect(res.status).toBe(404);
    const { sendAdminNotificationEmail } = require("@/lib/mailer");
    expect(sendAdminNotificationEmail).not.toHaveBeenCalled();
  });
});
