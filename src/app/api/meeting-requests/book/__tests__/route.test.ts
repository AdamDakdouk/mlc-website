import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

jest.mock("@/lib/mailer", () => ({
  sendAdminNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));

describe("POST /api/meeting-requests/book", () => {
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
    delete process.env.SMTP_HOST;
    require("@/lib/mailer").sendAdminNotificationEmail.mockClear();
    require("@/lib/rateLimit").resetRateLimit("meeting-request:unknown");
    const mongooseFresh = require("mongoose");
    await mongooseFresh.connection.dropDatabase();
  });

  const validBody = {
    parentName: "Jane Doe",
    parentEmail: "jane@example.com",
    parentPhone: "+961 1 234567",
    parentAddress: "123 Main St, Bchamoun",
    studentName: "Sam Doe",
    studentGrade: "Grade 5",
    reason: "Discuss progress in Math.",
  };

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a request with all fields", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const saved = await MeetingRequest.findById(data.id);
    expect(saved.parentName).toBe("Jane Doe");
    expect(saved.parentAddress).toBe("123 Main St, Bchamoun");
    expect(saved.studentGrade).toBe("Grade 5");
    expect(saved.reason).toBe("Discuss progress in Math.");
    expect(saved.status).toBe("Pending");
  });

  it("creates a request without a reason, defaulting to empty", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const body: Record<string, unknown> = { ...validBody };
    delete body.reason;

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const saved = await MeetingRequest.findById(data.id);
    expect(saved.reason).toBe("");
  });

  it.each([
    "parentName",
    "parentEmail",
    "parentPhone",
    "parentAddress",
    "studentName",
    "studentGrade",
  ])("rejects a missing %s", async (field) => {
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const body: Record<string, unknown> = { ...validBody };
    delete body[field];

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid parentEmail", async () => {
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(makeRequest({ ...validBody, parentEmail: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const request = new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const request = new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify(validBody),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });

  it("pretends success but saves nothing when the honeypot field is filled", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest({ ...validBody, website: "http://spam.example" }));
    expect(res.status).toBe(201);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    expect(await MeetingRequest.countDocuments()).toBe(0);
  });

  it("accepts an empty honeypot field as a normal submission", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest({ ...validBody, website: "" }));
    expect(res.status).toBe(201);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    expect(await MeetingRequest.countDocuments()).toBe(1);
  });

  it("returns 429 after 10 submissions from the same IP", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await POST(makeRequest(validBody))).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("emails the admin about a new request, with a link and reply-to", async () => {
    process.env.SMTP_HOST = "smtp.test.local";
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(201);

    const { sendAdminNotificationEmail } = require("@/lib/mailer");
    expect(sendAdminNotificationEmail).toHaveBeenCalledTimes(1);
    const args = sendAdminNotificationEmail.mock.calls[0][0];
    expect(args.subject).toBe("New meeting request from Jane Doe");
    expect(args.replyTo).toBe("jane@example.com");
    expect(args.text).toContain("Student: Sam Doe");
    expect(args.text).toContain(`/admin/dashboard/meeting-requests/${data.id}`);
  });

  it("still saves the request when the notification email fails", async () => {
    process.env.SMTP_HOST = "smtp.test.local";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { sendAdminNotificationEmail } = require("@/lib/mailer");
    sendAdminNotificationEmail.mockRejectedValueOnce(new Error("SMTP down"));
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const { MeetingRequest } = require("@/models/MeetingRequest");
    expect(await MeetingRequest.countDocuments()).toBe(1);
    errorSpy.mockRestore();
  });

  it("sends no notification for a honeypot submission", async () => {
    process.env.SMTP_HOST = "smtp.test.local";
    const { POST } = require("@/app/api/meeting-requests/book/route");

    await POST(makeRequest({ ...validBody, website: "http://spam.example" }));
    const { sendAdminNotificationEmail } = require("@/lib/mailer");
    expect(sendAdminNotificationEmail).not.toHaveBeenCalled();
  });
});
