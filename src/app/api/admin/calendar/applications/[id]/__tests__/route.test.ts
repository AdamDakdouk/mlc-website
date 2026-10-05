import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

jest.mock("@/lib/mailer", () => ({
  sendSessionConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

describe("PUT/DELETE /api/admin/calendar/applications/[id]", () => {
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
    jest.clearAllMocks();
  });

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/calendar/applications/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function createApplication(applicantCount = 1) {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const { SessionApplication } = require("@/models/SessionApplication");

    const teacher = await Teacher.create({
      name: "Mr. Smith",
      email: "mr.smith@example.com",
      subjects: ["Math"],
    });
    const session = await CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date("2099-10-05"),
      endDate: new Date("2099-10-05"),
      teacherId: teacher._id,
      sessionDateTime: new Date("2099-10-05T15:00:00.000Z"),
      durationMinutes: 90,
      capacity: 10,
      applicantCount,
      price: 20,
    });
    const application = await SessionApplication.create({
      sessionId: session._id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "123",
      address: "123 Main St",
      paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
    });
    return { application, session };
  }

  describe("PUT", () => {
    it("verifies an application and sends a confirmation email", async () => {
      const { application, session } = await createApplication();
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");
      const { sendSessionConfirmationEmail } = require("@/lib/mailer");

      const res = await PUT(
        makeRequest("PUT", application._id.toString(), { status: "Verified" }),
        { params: Promise.resolve({ id: application._id.toString() }) },
      );
      expect(res.status).toBe(200);

      const { SessionApplication } = require("@/models/SessionApplication");
      const updated = await SessionApplication.findById(application._id);
      expect(updated.status).toBe("Verified");

      expect(sendSessionConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
          recipientName: "Jane Doe",
          sessionTitle: "Math Session",
          teacherName: "Mr. Smith",
          durationMinutes: 90,
          price: 20,
        }),
      );

      const { CalendarEvent } = require("@/models/CalendarEvent");
      const updatedSession = await CalendarEvent.findById(session._id);
      expect(updatedSession.applicantCount).toBe(1);
    });

    it("rejects an application, decrements applicantCount, and does not send email", async () => {
      const { application, session } = await createApplication();
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");
      const { sendSessionConfirmationEmail } = require("@/lib/mailer");

      const res = await PUT(
        makeRequest("PUT", application._id.toString(), { status: "Rejected" }),
        { params: Promise.resolve({ id: application._id.toString() }) },
      );
      expect(res.status).toBe(200);

      const { SessionApplication } = require("@/models/SessionApplication");
      const updated = await SessionApplication.findById(application._id);
      expect(updated.status).toBe("Rejected");
      expect(sendSessionConfirmationEmail).not.toHaveBeenCalled();

      const { CalendarEvent } = require("@/models/CalendarEvent");
      const updatedSession = await CalendarEvent.findById(session._id);
      expect(updatedSession.applicantCount).toBe(0);
    });

    it("still returns 200 when the email fails to send", async () => {
      const { application } = await createApplication();
      const { sendSessionConfirmationEmail } = require("@/lib/mailer");
      sendSessionConfirmationEmail.mockRejectedValueOnce(new Error("SMTP down"));
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");

      const res = await PUT(
        makeRequest("PUT", application._id.toString(), { status: "Verified" }),
        { params: Promise.resolve({ id: application._id.toString() }) },
      );
      expect(res.status).toBe(200);

      const { SessionApplication } = require("@/models/SessionApplication");
      const updated = await SessionApplication.findById(application._id);
      expect(updated.status).toBe("Verified");
    });

    it("rejects re-verifying an already-Verified application", async () => {
      const { application } = await createApplication();
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");

      await PUT(makeRequest("PUT", application._id.toString(), { status: "Verified" }), {
        params: Promise.resolve({ id: application._id.toString() }),
      });
      const res = await PUT(
        makeRequest("PUT", application._id.toString(), { status: "Verified" }),
        { params: Promise.resolve({ id: application._id.toString() }) },
      );
      expect(res.status).toBe(409);
    });

    it("rejects a status outside the updatable enum", async () => {
      const { application } = await createApplication();
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");

      const res = await PUT(
        makeRequest("PUT", application._id.toString(), { status: "Pending" }),
        { params: Promise.resolve({ id: application._id.toString() }) },
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for a malformed id", async () => {
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");
      const res = await PUT(makeRequest("PUT", "not-an-id", { status: "Verified" }), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const missingId = new mongoose.Types.ObjectId().toString();
      const { PUT } = require("@/app/api/admin/calendar/applications/[id]/route");

      const res = await PUT(makeRequest("PUT", missingId, { status: "Verified" }), {
        params: Promise.resolve({ id: missingId }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("deletes an application and its proof file, and frees its spot", async () => {
      const { application, session } = await createApplication();
      const { validateAndSavePaymentProof } = require("@/lib/paymentProofUpload");
      const realProof = await validateAndSavePaymentProof(
        new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])], "p.jpg", {
          type: "image/jpeg",
        }),
      );
      const { SessionApplication } = require("@/models/SessionApplication");
      application.paymentProofFilename = realProof;
      await application.save();

      const { DELETE } = require("@/app/api/admin/calendar/applications/[id]/route");
      const res = await DELETE(makeRequest("DELETE", application._id.toString()), {
        params: Promise.resolve({ id: application._id.toString() }),
      });
      expect(res.status).toBe(200);

      expect(await SessionApplication.findById(application._id)).toBeNull();

      const { readPaymentProofFile } = require("@/lib/paymentProofUpload");
      await expect(readPaymentProofFile(realProof)).rejects.toThrow();

      const { CalendarEvent } = require("@/models/CalendarEvent");
      const updatedSession = await CalendarEvent.findById(session._id);
      expect(updatedSession.applicantCount).toBe(0);
    });

    it("frees the spot when deleting a Verified application", async () => {
      const { application, session } = await createApplication(3);
      application.status = "Verified";
      await application.save();

      const { DELETE } = require("@/app/api/admin/calendar/applications/[id]/route");
      await DELETE(makeRequest("DELETE", application._id.toString()), {
        params: Promise.resolve({ id: application._id.toString() }),
      });

      const { CalendarEvent } = require("@/models/CalendarEvent");
      expect((await CalendarEvent.findById(session._id)).applicantCount).toBe(2);
    });

    it("does not free a spot a second time when deleting a Rejected application", async () => {
      // Rejecting already released the spot, so applicantCount is already 0 here.
      const { application, session } = await createApplication(0);
      application.status = "Rejected";
      await application.save();

      const { DELETE } = require("@/app/api/admin/calendar/applications/[id]/route");
      const res = await DELETE(makeRequest("DELETE", application._id.toString()), {
        params: Promise.resolve({ id: application._id.toString() }),
      });
      expect(res.status).toBe(200);

      const { CalendarEvent } = require("@/models/CalendarEvent");
      expect((await CalendarEvent.findById(session._id)).applicantCount).toBe(0);
    });

    it("never lets applicantCount go below zero", async () => {
      const { application, session } = await createApplication(0);

      const { DELETE } = require("@/app/api/admin/calendar/applications/[id]/route");
      await DELETE(makeRequest("DELETE", application._id.toString()), {
        params: Promise.resolve({ id: application._id.toString() }),
      });

      const { CalendarEvent } = require("@/models/CalendarEvent");
      expect((await CalendarEvent.findById(session._id)).applicantCount).toBe(0);
    });

    it("returns 400 for a malformed id", async () => {
      const { DELETE } = require("@/app/api/admin/calendar/applications/[id]/route");
      const res = await DELETE(makeRequest("DELETE", "not-an-id"), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const missingId = new mongoose.Types.ObjectId().toString();
      const { DELETE } = require("@/app/api/admin/calendar/applications/[id]/route");

      const res = await DELETE(makeRequest("DELETE", missingId), {
        params: Promise.resolve({ id: missingId }),
      });
      expect(res.status).toBe(404);
    });
  });
});
