# Meeting Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Meeting Requests module — a public page where parents request a meeting with a specific teacher, and an admin dashboard section to confirm/decline/delete those requests. Final module of sub-project 3 (Booking & Scheduling).

**Architecture:** Mirrors the existing Tour Bookings module exactly (open request → admin confirms/declines with a datetime), with one addition: each request references a `Teacher` document, so `Teacher` deletion gets a guard preventing orphaned references.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose, Zod, Tailwind v4, Jest + mongodb-memory-server for tests.

**Spec:** `docs/superpowers/specs/2026-09-30-meeting-requests-module-design.md`

---

### Task 1: Shared status constant

**Files:**
- Create: `src/lib/meetingRequestStatuses.ts`

- [ ] **Step 1: Write the file**

```ts
export const MEETING_REQUEST_STATUSES = ["Pending", "Confirmed", "Declined"] as const;

export type MeetingRequestStatus = (typeof MEETING_REQUEST_STATUSES)[number];
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to this file (it has no dependents yet, so this just confirms syntax).

- [ ] **Step 3: Commit**

```bash
git add src/lib/meetingRequestStatuses.ts
git commit -m "feat: add MeetingRequestStatus shared constant"
```

---

### Task 2: MeetingRequest model

**Files:**
- Create: `src/models/MeetingRequest.ts`
- Test: `src/models/__tests__/MeetingRequest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

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

  it("creates a valid request, defaulting status/confirmedDateTime/reason", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");
    const teacherId = new mongoose.Types.ObjectId();

    const request = await MeetingRequest.create({
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "+961 1 234567",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });

    expect(request.status).toBe("Pending");
    expect(request.confirmedDateTime).toBeNull();
    expect(request.reason).toBe("");
    expect(request.teacherId.toString()).toBe(teacherId.toString());
  });

  it("rejects a missing parentName", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing studentName", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing studentGrade", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing teacherId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing requestedDateTime", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await expect(
      MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: new mongoose.Types.ObjectId(),
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
        status: "Maybe",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/MeetingRequest.test.ts`
Expected: FAIL — `Cannot find module '@/models/MeetingRequest'`

- [ ] **Step 3: Write the model**

```ts
import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { MEETING_REQUEST_STATUSES, type MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

export type { MeetingRequestStatus };

export interface IMeetingRequest extends Document {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  studentGrade: string;
  teacherId: Types.ObjectId;
  reason: string;
  requestedDateTime: Date;
  confirmedDateTime: Date | null;
  status: MeetingRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const meetingRequestSchema = new Schema<IMeetingRequest>(
  {
    parentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    parentEmail: {
      type: String,
      required: true,
      trim: true,
      maxlength: 254,
    },
    parentPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    studentGrade: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    requestedDateTime: {
      type: Date,
      required: true,
    },
    confirmedDateTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: [...MEETING_REQUEST_STATUSES],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const MeetingRequest: Model<IMeetingRequest> =
  mongoose.models.MeetingRequest ??
  mongoose.model<IMeetingRequest>("MeetingRequest", meetingRequestSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/MeetingRequest.test.ts`
Expected: PASS, 7/7 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/MeetingRequest.ts src/models/__tests__/MeetingRequest.test.ts
git commit -m "feat: add MeetingRequest model"
```

---

### Task 3: Public booking route

**Files:**
- Create: `src/app/api/meeting-requests/book/route.ts`
- Test: `src/app/api/meeting-requests/book/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

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
    const mongooseFresh = require("mongoose");
    await mongooseFresh.connection.dropDatabase();
  });

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function createTeacher() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    return Teacher.create({ name: "Mr. Smith", subjects: ["Math"] });
  }

  it("creates a request with all fields", async () => {
    const teacher = await createTeacher();
    const validBody = {
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "+961 1 234567",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId: teacher._id.toString(),
      requestedDateTime: "2026-10-15T10:00",
      reason: "Discuss progress in Math.",
    };
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const saved = await MeetingRequest.findById(data.id);
    expect(saved.parentName).toBe("Jane Doe");
    expect(saved.studentGrade).toBe("Grade 5");
    expect(saved.teacherId.toString()).toBe(teacher._id.toString());
    expect(saved.reason).toBe("Discuss progress in Math.");
    expect(saved.status).toBe("Pending");
  });

  it("creates a request without a reason, defaulting to empty", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");

    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const saved = await MeetingRequest.findById(data.id);
    expect(saved.reason).toBe("");
  });

  it("rejects a missing parentName", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid parentEmail", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "not-an-email",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed requestedDateTime shape", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-10-15",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-existent calendar date/time", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: teacher._id.toString(),
        requestedDateTime: "2026-02-30T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed teacherId", async () => {
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: "not-an-id",
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a well-formed but non-existent teacherId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const missingId = new mongoose.Types.ObjectId().toString();
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const res = await POST(
      makeRequest({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: missingId,
        requestedDateTime: "2026-10-15T10:00",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects a request over the body size limit", async () => {
    const teacher = await createTeacher();
    const validBody = {
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "123",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId: teacher._id.toString(),
      requestedDateTime: "2026-10-15T10:00",
    };
    const { POST } = require("@/app/api/meeting-requests/book/route");
    const request = new NextRequest("http://localhost/api/meeting-requests/book", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify(validBody),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/meeting-requests/book`
Expected: FAIL — `Cannot find module '@/app/api/meeting-requests/book/route'`

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { Teacher } from "@/models/Teacher";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";

const meetingRequestFieldsSchema = z.object({
  parentName: z.string().min(1, "Parent name is required").max(200, "Parent name is too long"),
  parentEmail: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  parentPhone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  studentName: z.string().min(1, "Student name is required").max(200, "Student name is too long"),
  studentGrade: z.string().min(1, "Grade is required").max(50, "Grade is too long"),
  teacherId: z.string().min(1, "Teacher is required"),
  requestedDateTime: z.string().regex(DATETIME_RE, "Invalid date/time"),
  reason: z.string().max(2000, "Reason is too long").optional(),
});

// No file upload in this module, so a legitimate body is a few hundred
// bytes — this cap is a sanity guard against abuse, not a real ceiling: a
// request with no Content-Length header (or chunked transfer-encoding)
// skips this check entirely, and request.json() will still fully buffer
// the body into memory before any downstream validation runs. Real
// enforcement needs a reverse-proxy/hosting-level body-size limit,
// deferred until a hosting target is chosen (see project notes). Same
// accepted tradeoff as src/app/api/tours/book/route.ts.
const MAX_REQUEST_SIZE = 100 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = meetingRequestFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!mongoose.isValidObjectId(parsed.data.teacherId)) {
    return NextResponse.json({ error: "Invalid teacher" }, { status: 400 });
  }

  if (!isRealDateTime(parsed.data.requestedDateTime)) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  const requestedDateTime = new Date(`${parsed.data.requestedDateTime}:00.000Z`);

  await connectToDatabase();

  const teacher = await Teacher.findById(parsed.data.teacherId);
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const meetingRequest = await MeetingRequest.create({
    parentName: parsed.data.parentName,
    parentEmail: parsed.data.parentEmail,
    parentPhone: parsed.data.parentPhone,
    studentName: parsed.data.studentName,
    studentGrade: parsed.data.studentGrade,
    teacherId: parsed.data.teacherId,
    reason: parsed.data.reason ?? "",
    requestedDateTime,
  });

  return NextResponse.json({ id: meetingRequest._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/meeting-requests/book`
Expected: PASS, 9/9 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/meeting-requests/book/route.ts "src/app/api/meeting-requests/book/__tests__/route.test.ts"
git commit -m "feat: add public meeting request booking endpoint"
```

---

### Task 4: Admin route (confirm/decline/delete)

**Files:**
- Create: `src/app/api/admin/meeting-requests/[id]/route.ts`
- Test: `src/app/api/admin/meeting-requests/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT/DELETE /api/admin/meeting-requests/[id]", () => {
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

  async function createMeetingRequest() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const { MeetingRequest } = require("@/models/MeetingRequest");
    const teacher = await Teacher.create({ name: "Mr. Smith", subjects: ["Math"] });
    return MeetingRequest.create({
      parentName: "Jane Doe",
      parentEmail: "jane@example.com",
      parentPhone: "+961 1 234567",
      studentName: "Sam Doe",
      studentGrade: "Grade 5",
      teacherId: teacher._id,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/meeting-requests/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("confirms a request with an explicit adjusted time", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-10-16T14:00",
      }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const updated = await MeetingRequest.findById(meetingRequest._id);
    expect(updated.status).toBe("Confirmed");
    expect(updated.confirmedDateTime.toISOString()).toContain("2026-10-16T14:00");
  });

  it("confirms a request without an explicit time, defaulting to the requested time", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), { status: "Confirmed" }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const updated = await MeetingRequest.findById(meetingRequest._id);
    expect(updated.confirmedDateTime.toISOString()).toBe(
      meetingRequest.requestedDateTime.toISOString(),
    );
  });

  it("preserves a previously-confirmed time across a decline-then-reconfirm cycle", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");
    const { MeetingRequest } = require("@/models/MeetingRequest");

    await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-10-20T09:00",
      }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );

    await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), { status: "Declined" }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );

    const res = await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), { status: "Confirmed" }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const updated = await MeetingRequest.findById(meetingRequest._id);
    expect(updated.status).toBe("Confirmed");
    expect(updated.confirmedDateTime.toISOString()).toContain("2026-10-20T09:00");
  });

  it("declines a request without touching confirmedDateTime", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), { status: "Declined" }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    const updated = await MeetingRequest.findById(meetingRequest._id);
    expect(updated.status).toBe("Declined");
    expect(updated.confirmedDateTime).toBeNull();
  });

  it("rejects an invalid confirmedDateTime on confirm", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-02-30T10:00",
      }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a status outside the fixed enum", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(
      makeRequest("PUT", meetingRequest._id.toString(), { status: "Maybe" }),
      { params: Promise.resolve({ id: meetingRequest._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");
    const res = await PUT(makeRequest("PUT", "not-an-id", { status: "Confirmed" }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await PUT(makeRequest("PUT", missingId, { status: "Confirmed" }), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a PUT request over the body size limit", async () => {
    const meetingRequest = await createMeetingRequest();
    const { PUT } = require("@/app/api/admin/meeting-requests/[id]/route");

    const request = new NextRequest(
      `http://localhost/api/admin/meeting-requests/${meetingRequest._id.toString()}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
        body: JSON.stringify({ status: "Confirmed" }),
      },
    );
    const res = await PUT(request, {
      params: Promise.resolve({ id: meetingRequest._id.toString() }),
    });
    expect(res.status).toBe(413);
  });

  it("deletes a request", async () => {
    const meetingRequest = await createMeetingRequest();
    const { DELETE } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await DELETE(makeRequest("DELETE", meetingRequest._id.toString()), {
      params: Promise.resolve({ id: meetingRequest._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { MeetingRequest } = require("@/models/MeetingRequest");
    expect(await MeetingRequest.findById(meetingRequest._id)).toBeNull();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/meeting-requests/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/meeting-requests/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/meeting-requests`
Expected: FAIL — `Cannot find module '@/app/api/admin/meeting-requests/[id]/route'`

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";
import { type MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

// MeetingRequest.status is created as "Pending" by the public booking route
// and only ever transitions away from it here — admin can move a request
// to Confirmed or Declined, never back to Pending, so this endpoint's input
// set is deliberately narrower than the model's full status enum. Typed
// against the shared MeetingRequestStatus union so a typo here, or a future
// change to the status set, is caught by the compiler.
const UPDATABLE_STATUSES = [
  "Confirmed",
  "Declined",
] as const satisfies readonly MeetingRequestStatus[];

const updateFieldsSchema = z.object({
  status: z.enum(UPDATABLE_STATUSES),
  confirmedDateTime: z.string().regex(DATETIME_RE, "Invalid date/time").optional(),
});

const MAX_REQUEST_SIZE = 100 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid meeting request id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (parsed.data.confirmedDateTime && !isRealDateTime(parsed.data.confirmedDateTime)) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await MeetingRequest.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Meeting request not found" }, { status: 404 });
  }

  existing.status = parsed.data.status;

  if (parsed.data.status === "Confirmed") {
    // Confirming without an explicit adjusted time keeps whatever was
    // already confirmed (supports re-confirming after an earlier change
    // without losing it), or falls back to the parent's originally
    // requested time if nothing has been confirmed yet.
    existing.confirmedDateTime = parsed.data.confirmedDateTime
      ? new Date(`${parsed.data.confirmedDateTime}:00.000Z`)
      : (existing.confirmedDateTime ?? existing.requestedDateTime);
  }

  await existing.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid meeting request id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await MeetingRequest.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Meeting request not found" }, { status: 404 });
  }

  await MeetingRequest.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/meeting-requests`
Expected: PASS, 12/12 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/meeting-requests
git commit -m "feat: add admin meeting request confirm/decline/delete endpoint"
```

---

### Task 5: Teacher deletion guard

**Files:**
- Modify: `src/app/api/admin/teachers/[id]/route.ts`
- Test: `src/app/api/admin/teachers/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("DELETE", ...)` block in `src/app/api/admin/teachers/[id]/__tests__/route.test.ts`, right after the `"deletes a teacher and their photo file"` test:

```ts
    it("returns 409 and does not delete when the teacher has meeting requests", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { MeetingRequest } = require("@/models/MeetingRequest");

      const existing = await Teacher.create({ name: "T", subjects: ["Math"] });
      await MeetingRequest.create({
        parentName: "Jane Doe",
        parentEmail: "jane@example.com",
        parentPhone: "123",
        studentName: "Sam Doe",
        studentGrade: "Grade 5",
        teacherId: existing._id,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      });

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const res = await DELETE(makeRequest(existing._id.toString()), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(409);

      const found = await Teacher.findById(existing._id);
      expect(found).not.toBeNull();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/teachers/\[id\]`
Expected: FAIL — expected 409, got 200 (teacher gets deleted since no guard exists yet)

- [ ] **Step 3: Add the guard**

In `src/app/api/admin/teachers/[id]/route.ts`, add the import:

```ts
import { MeetingRequest } from "@/models/MeetingRequest";
```

Then in the `DELETE` handler, insert the guard right after the `existing` not-found check and before the comment about deleting the DB record:

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Teacher.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const hasMeetingRequests = await MeetingRequest.exists({ teacherId: id });
  if (hasMeetingRequests) {
    return NextResponse.json(
      { error: "Cannot delete a teacher with existing meeting requests" },
      { status: 409 },
    );
  }

  const { photoUrl } = existing;

  // Delete the DB record first, then the photo file — same ordering
  // principle as PUT above: commit the authoritative change first, clean up
  // the filesystem after. A crash between these two steps orphans the photo
  // file (harmless), rather than risking a live record pointing at a
  // deleted file.
  await Teacher.deleteOne({ _id: id });

  if (photoUrl) {
    await deleteImageFile(photoUrl);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/teachers/\[id\]`
Expected: PASS, all tests including the new one

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx jest`
Expected: all suites PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/teachers/[id]/route.ts "src/app/api/admin/teachers/[id]/__tests__/route.test.ts"
git commit -m "fix: block deleting a teacher with existing meeting requests"
```

---

### Task 6: Admin list page

**Files:**
- Create: `src/app/admin/dashboard/meeting-requests/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { Teacher } from "@/models/Teacher";
import type { MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<MeetingRequestStatus, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Confirmed: "bg-navy/10 text-navy",
  Declined: "bg-maroon/10 text-maroon",
};

export default async function MeetingRequestsAdminPage() {
  await connectToDatabase();
  const [requests, teachers] = await Promise.all([
    MeetingRequest.find().sort({ createdAt: -1 }).lean(),
    Teacher.find().select("name").lean(),
  ]);
  const teacherNameById = new Map(teachers.map((t) => [t._id.toString(), t.name]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Meeting Requests</h1>
      {requests.length === 0 ? (
        <p className="text-gray-600">No meeting requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Parent
                </th>
                <th scope="col" className="py-2 pr-4">
                  Student
                </th>
                <th scope="col" className="py-2 pr-4">
                  Teacher
                </th>
                <th scope="col" className="py-2 pr-4">
                  Requested
                </th>
                <th scope="col" className="py-2 pr-4">
                  Status
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{r.parentName}</td>
                  <td className="py-2 pr-4">{r.studentName}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {teacherNameById.get(r.teacherId.toString()) ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {r.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/meeting-requests/${r._id.toString()}`}
                      aria-label={`View meeting request from "${r.parentName}"`}
                      className="text-navy hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/meeting-requests/page.tsx
git commit -m "feat: add admin meeting requests list page"
```

---

### Task 7: Admin detail page and actions

**Files:**
- Create: `src/app/admin/dashboard/meeting-requests/[id]/page.tsx`
- Create: `src/app/admin/dashboard/meeting-requests/[id]/MeetingRequestActions.tsx`

- [ ] **Step 1: Write the actions component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

interface MeetingRequestActionsProps {
  meetingRequestId: string;
  status: MeetingRequestStatus;
  requestedDateTime: string;
  confirmedDateTime: string | null;
}

export default function MeetingRequestActions({
  meetingRequestId,
  status,
  requestedDateTime,
  confirmedDateTime,
}: MeetingRequestActionsProps) {
  const router = useRouter();
  const [dateTime, setDateTime] = useState(confirmedDateTime ?? requestedDateTime);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "Confirmed" | "Declined") {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/meeting-requests/${meetingRequestId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "Confirmed" ? { confirmedDateTime: dateTime } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard/meeting-requests");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    if (!confirm("Delete this meeting request? This cannot be undone.")) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/meeting-requests/${meetingRequestId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        setLoading(false);
        return;
      }
      router.push("/admin/dashboard/meeting-requests");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Current status: <span className="font-medium text-navy">{status}</span>
      </p>
      <div>
        <label htmlFor="confirmedDateTime" className="block text-sm font-medium text-navy">
          Confirmed date &amp; time
        </label>
        <input
          id="confirmedDateTime"
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-maroon">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => updateStatus("Confirmed")}
          disabled={loading}
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => updateStatus("Declined")}
          disabled={loading}
          className="rounded border border-maroon px-4 py-2 text-sm font-medium text-maroon transition hover:bg-maroon/10 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="ml-auto rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the detail page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { Teacher } from "@/models/Teacher";
import MeetingRequestActions from "./MeetingRequestActions";

export const dynamic = "force-dynamic";

export default async function MeetingRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const meetingRequest = await MeetingRequest.findById(id).lean();

  if (!meetingRequest) {
    notFound();
  }

  const teacher = await Teacher.findById(meetingRequest.teacherId).select("name").lean();

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-navy">Meeting Request</h1>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-navy">Parent Name</dt>
          <dd className="text-gray-700">{meetingRequest.parentName}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Email</dt>
          <dd className="text-gray-700">{meetingRequest.parentEmail}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Phone</dt>
          <dd className="text-gray-700">{meetingRequest.parentPhone}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Student</dt>
          <dd className="text-gray-700">
            {meetingRequest.studentName} ({meetingRequest.studentGrade})
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Teacher</dt>
          <dd className="text-gray-700">{teacher?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Requested</dt>
          <dd className="text-gray-700">
            {meetingRequest.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
          </dd>
        </div>
        {meetingRequest.reason && (
          <div>
            <dt className="font-medium text-navy">Reason</dt>
            <dd className="whitespace-pre-wrap text-gray-700">{meetingRequest.reason}</dd>
          </div>
        )}
      </dl>
      <div className="mt-8 border-t border-gray-200 pt-6">
        <MeetingRequestActions
          meetingRequestId={meetingRequest._id.toString()}
          status={meetingRequest.status}
          requestedDateTime={meetingRequest.requestedDateTime.toISOString().slice(0, 16)}
          confirmedDateTime={
            meetingRequest.confirmedDateTime
              ? meetingRequest.confirmedDateTime.toISOString().slice(0, 16)
              : null
          }
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/dashboard/meeting-requests/[id]
git commit -m "feat: add admin meeting request detail page and actions"
```

---

### Task 8: Public page

**Files:**
- Create: `src/app/meeting-requests/page.tsx`
- Create: `src/app/meeting-requests/MeetingRequestClient.tsx`

- [ ] **Step 1: Write the client component**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";

interface TeacherOption {
  id: string;
  name: string;
  photoUrl: string | null;
  subjects: string[];
}

interface MeetingRequestClientProps {
  teachers: TeacherOption[];
}

export default function MeetingRequestClient({ teachers }: MeetingRequestClientProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!selectedTeacherId) {
      setError("Please select a teacher.");
      return;
    }

    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body = {
      teacherId: selectedTeacherId,
      parentName: formData.get("parentName"),
      parentEmail: formData.get("parentEmail"),
      parentPhone: formData.get("parentPhone"),
      studentName: formData.get("studentName"),
      studentGrade: formData.get("studentGrade"),
      requestedDateTime: formData.get("requestedDateTime"),
      reason: formData.get("reason") ?? "",
    };

    try {
      const res = await fetch("/api/meeting-requests/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className="text-navy">Request received — we&apos;ll be in touch to confirm.</p>;
  }

  return (
    <div>
      <fieldset>
        <legend className="mb-3 block text-sm font-medium text-navy">Select a teacher</legend>
        <div
          role="radiogroup"
          aria-label="Select a teacher"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {teachers.map((t) => {
            const selected = t.id === selectedTeacherId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedTeacherId(t.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selected ? "border-navy bg-navy/5" : "border-gray-200 hover:border-navy/50"
                }`}
              >
                <div className="mb-3 flex justify-center">
                  {t.photoUrl ? (
                    <Image
                      src={t.photoUrl}
                      alt={t.name}
                      width={64}
                      height={64}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-navy/10 text-xl text-navy"
                    >
                      {t.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-center text-sm font-semibold text-navy">{t.name}</p>
                <p className="mt-1 text-center text-xs text-maroon">{t.subjects.join(", ")}</p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <form onSubmit={handleSubmit} className="mt-8 max-w-lg space-y-4">
        <div>
          <label htmlFor="parentName" className="block text-sm font-medium text-navy">
            Parent Name
          </label>
          <input
            id="parentName"
            name="parentName"
            type="text"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="parentEmail" className="block text-sm font-medium text-navy">
            Email
          </label>
          <input
            id="parentEmail"
            name="parentEmail"
            type="email"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="parentPhone" className="block text-sm font-medium text-navy">
            Phone
          </label>
          <input
            id="parentPhone"
            name="parentPhone"
            type="tel"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="studentName" className="block text-sm font-medium text-navy">
            Student Name
          </label>
          <input
            id="studentName"
            name="studentName"
            type="text"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="studentGrade" className="block text-sm font-medium text-navy">
            Grade / Class
          </label>
          <input
            id="studentGrade"
            name="studentGrade"
            type="text"
            required
            placeholder="e.g. Grade 5"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="requestedDateTime" className="block text-sm font-medium text-navy">
            Preferred date &amp; time
          </label>
          <input
            id="requestedDateTime"
            name="requestedDateTime"
            type="datetime-local"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-navy">
            Reason <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-maroon">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Request Meeting"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import MeetingRequestClient from "./MeetingRequestClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request a Meeting — MLC",
  description: "Request a meeting with a teacher at Modernistic Learning Community.",
};

export default async function MeetingRequestsPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  const options = teachers.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    photoUrl: t.photoUrl,
    subjects: t.subjects,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">Request a Meeting</h1>
      <p className="mb-8 text-gray-600">
        Pick a teacher and tell us when works for you — we&apos;ll confirm a time.
      </p>
      <MeetingRequestClient teachers={options} />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `npx jest`
Expected: all suites PASS (no test regressions from this task's UI-only files)

- [ ] **Step 5: Commit**

```bash
git add src/app/meeting-requests
git commit -m "feat: add public meeting request page"
```

- [ ] **Step 6: Manual verification in browser**

Start the dev server, visit `/meeting-requests`, confirm the teacher card grid renders, select a card (highlight applies), fill and submit the form, confirm the success message appears and a new `MeetingRequest` document was created. Then visit `/admin/dashboard/meeting-requests`, confirm the new row appears, open its detail page, confirm/decline it, and confirm the list updates. Finally, in `/admin/dashboard/teachers`, attempt to delete the teacher used in the test request and confirm the 409 error message surfaces via `DeleteEntityButton`.
