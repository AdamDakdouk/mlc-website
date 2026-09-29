import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("GET /api/admin/calendar/applications/[id]/payment-proof", () => {
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

  function makeRequest(id: string) {
    return new NextRequest(`http://localhost/api/admin/calendar/applications/${id}/payment-proof`, {
      method: "GET",
    });
  }

  it("returns the proof image with the right content type", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { validateAndSavePaymentProof } = require("@/lib/paymentProofUpload");
    const { SessionApplication } = require("@/models/SessionApplication");

    const filename = await validateAndSavePaymentProof(
      new File([new Uint8Array(JPEG_BYTES)], "proof.jpg", { type: "image/jpeg" }),
    );
    const application = await SessionApplication.create({
      sessionId: new mongoose.Types.ObjectId(),
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "123",
      address: "123 Main St",
      paymentProofFilename: filename,
    });

    const { GET } = require("@/app/api/admin/calendar/applications/[id]/payment-proof/route");
    const res = await GET(makeRequest(application._id.toString()), {
      params: Promise.resolve({ id: application._id.toString() }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");

    const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
    await deletePaymentProofFile(filename);
  });

  it("returns 400 for a malformed id", async () => {
    const { GET } = require("@/app/api/admin/calendar/applications/[id]/payment-proof/route");
    const res = await GET(makeRequest("not-an-id"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent application id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const missingId = new mongoose.Types.ObjectId().toString();
    const { GET } = require("@/app/api/admin/calendar/applications/[id]/payment-proof/route");

    const res = await GET(makeRequest(missingId), { params: Promise.resolve({ id: missingId }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the file is missing on disk", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");
    const application = await SessionApplication.create({
      sessionId: new mongoose.Types.ObjectId(),
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "123",
      address: "123 Main St",
      paymentProofFilename: "22222222-2222-2222-2222-222222222222.jpg",
    });

    const { GET } = require("@/app/api/admin/calendar/applications/[id]/payment-proof/route");
    const res = await GET(makeRequest(application._id.toString()), {
      params: Promise.resolve({ id: application._id.toString() }),
    });
    expect(res.status).toBe(404);
  });
});
