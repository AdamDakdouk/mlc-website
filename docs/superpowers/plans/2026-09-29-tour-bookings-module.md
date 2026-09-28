# Tour Bookings Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public tour/admission-visit request form reviewed by admin (confirm with an optional adjusted date/time, or decline), per `docs/superpowers/specs/2026-09-29-tour-bookings-module-design.md`.

**Architecture:** First module in the Booking & Scheduling sub-project. Shaped like the Careers module's application flow (public unauthenticated write, admin review) but simpler — no file upload, no "posting" to apply against, JSON body throughout. It introduces one genuinely new thing: full date-**and-time** handling (`<input type="datetime-local">`, `YYYY-MM-DDTHH:mm` strings), which needs its own validity helper — `isRealDateTime` in a new `src/lib/dateTime.ts`, built the same way as the Calendar module's `isRealCalendarDate` (round-trip through `Date`/`toISOString`, with the `NaN` guard baked in from the start this time, since that gap was only found and fixed after the fact during the Calendar module's review).

**Deviation from the design spec, noted here for the record:** the spec said `TourBooking` should skip `{ timestamps: true }` "same reasoning as `Application`." On reflection that reasoning doesn't actually hold here: `Application` is truly immutable after creation, but a `TourBooking` gets its `status` (and `confirmedDateTime`) changed by admin after creation — an `updatedAt` is genuinely useful for it, unlike `Application`. This plan adds `{ timestamps: true }` to `TourBooking`, correctly matching the mutable-record precedent (`JobPosting`, `CalendarEvent`) instead of the immutable one.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose ^8.x, zod, Tailwind v4, Jest + `mongodb-memory-server`.

---

### Task 1: Datetime validity helper (`dateTime.ts`)

**Files:**
- Create: `src/lib/dateTime.ts`
- Test: `src/lib/__tests__/dateTime.test.ts`

**Context:** `<input type="datetime-local">` produces values shaped `YYYY-MM-DDTHH:mm` (no seconds, no timezone designator). Same round-trip validity technique as `src/lib/calendarDate.ts`'s `isRealCalendarDate` (construct a `Date`, format it back, compare to the input — a value that doesn't round-trip cleanly, like a rolled-over or fully-invalid date/time, is rejected), extended to cover both the date part and the time-of-day part, and forcing UTC interpretation explicitly (appending `:00.000Z`) so parsing never depends on the server's local timezone — the same principle Calendar's date-only fields already follow, just carried through to a full timestamp. The `Number.isNaN` guard is included from the start (this exact class of bug — a fully-invalid string producing an `Invalid Date` that then throws inside `.toISOString()` — was found and fixed reactively during the Calendar module; there's no reason to reintroduce it here).

- [ ] **Step 1: Write the failing test**

```typescript
import { isRealDateTime } from "../dateTime";

describe("isRealDateTime", () => {
  it("accepts a valid date and time", () => {
    expect(isRealDateTime("2026-10-15T10:00")).toBe(true);
  });

  it("accepts a valid leap-day date and time", () => {
    expect(isRealDateTime("2028-02-29T09:30")).toBe(true);
  });

  it("rejects a non-existent calendar date", () => {
    expect(isRealDateTime("2026-02-30T10:00")).toBe(false);
  });

  it("rejects an out-of-range hour", () => {
    expect(isRealDateTime("2026-01-01T25:00")).toBe(false);
  });

  it("rejects an out-of-range minute", () => {
    expect(isRealDateTime("2026-01-01T10:75")).toBe(false);
  });

  it("rejects a malformed shape (missing the T separator)", () => {
    expect(isRealDateTime("2026-01-01 10:00")).toBe(false);
  });

  it("rejects a date-only string with no time component", () => {
    expect(isRealDateTime("2026-01-01")).toBe(false);
  });

  it("does not throw on a fully garbage string", () => {
    expect(() => isRealDateTime("not-a-date-at-all")).not.toThrow();
    expect(isRealDateTime("not-a-date-at-all")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/dateTime.test.ts`
Expected: FAIL — `Cannot find module '../dateTime'`

- [ ] **Step 3: Implement `dateTime.ts`**

```typescript
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isRealDateTime(value: string): boolean {
  if (!DATETIME_RE.test(value)) {
    return false;
  }
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 16) === value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/dateTime.test.ts`
Expected: PASS, 8/8 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/dateTime.ts src/lib/__tests__/dateTime.test.ts
git commit -m "feat: add datetime validity helper for tour bookings"
```

---

### Task 2: `TourBooking` model

**Files:**
- Create: `src/models/TourBooking.ts`
- Test: `src/models/__tests__/TourBooking.test.ts`

**Context:** See the plan header's note on `{ timestamps: true }` — included here, deviating from the spec's stated (but on-reflection-incorrect) reasoning. No email-format or datetime-validity checking at this layer — those are zod's job at the API boundary, same division of responsibility as every prior module.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";

describe("TourBooking model", () => {
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

  it("creates a valid booking, defaulting status/confirmedDateTime/notes", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    const booking = await TourBooking.create({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      numberOfVisitors: 2,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });

    expect(booking.status).toBe("Pending");
    expect(booking.confirmedDateTime).toBeNull();
    expect(booking.notes).toBe("");
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing email", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        phone: "123",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing phone", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing requestedDateTime", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 1,
      }),
    ).rejects.toThrow();
  });

  it("rejects numberOfVisitors below 1", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 0,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects numberOfVisitors above 50", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 51,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");

    await expect(
      TourBooking.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        numberOfVisitors: 1,
        requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
        status: "Maybe",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/TourBooking.test.ts`
Expected: FAIL — `Cannot find module '@/models/TourBooking'`

- [ ] **Step 3: Implement the model**

```typescript
import mongoose, { Schema, type Document, type Model } from "mongoose";

export type TourBookingStatus = "Pending" | "Confirmed" | "Declined";

export interface ITourBooking extends Document {
  name: string;
  email: string;
  phone: string;
  numberOfVisitors: number;
  notes: string;
  requestedDateTime: Date;
  confirmedDateTime: Date | null;
  status: TourBookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tourBookingSchema = new Schema<ITourBooking>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    numberOfVisitors: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    notes: {
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
      enum: ["Pending", "Confirmed", "Declined"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const TourBooking: Model<ITourBooking> =
  mongoose.models.TourBooking ?? mongoose.model<ITourBooking>("TourBooking", tourBookingSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/TourBooking.test.ts`
Expected: PASS, 8/8 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/TourBooking.ts src/models/__tests__/TourBooking.test.ts
git commit -m "feat: add TourBooking model"
```

---

### Task 3: `POST /api/tours/book` — the public booking request endpoint

**Files:**
- Create: `src/app/api/tours/book/route.ts`
- Test: `src/app/api/tours/book/__tests__/route.test.ts`

**Context:** This is the site's SECOND unauthenticated public write endpoint (after Careers' `POST /api/careers/[id]/apply`) — it is NOT under `/api/admin/`, so `src/proxy.ts`'s matcher does not (and must not) protect it. Plain JSON body (no file, unlike Careers), so a small content-length cap is appropriate — the Calendar module's 100KB text-only cap, not Careers' 6MB file-inclusive one.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("POST /api/tours/book", () => {
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
    return new NextRequest("http://localhost/api/tours/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const validBody = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+961 1 234567",
    numberOfVisitors: 3,
    requestedDateTime: "2026-10-15T10:00",
    notes: "We'd love to see the science labs.",
  };

  it("creates a booking with all fields", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/tours/book/route");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { TourBooking } = require("@/models/TourBooking");
    const saved = await TourBooking.findById(data.id);
    expect(saved.name).toBe("Jane Doe");
    expect(saved.numberOfVisitors).toBe(3);
    expect(saved.notes).toBe("We'd love to see the science labs.");
    expect(saved.requestedDateTime.toISOString()).toContain("2026-10-15T10:00");
    expect(saved.status).toBe("Pending");
  });

  it("creates a booking without notes, defaulting to empty", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/tours/book/route");
    const { notes, ...bodyWithoutNotes } = validBody;

    const res = await POST(makeRequest(bodyWithoutNotes));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { TourBooking } = require("@/models/TourBooking");
    const saved = await TourBooking.findById(data.id);
    expect(saved.notes).toBe("");
  });

  it("rejects a missing name", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const { name, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed requestedDateTime shape", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, requestedDateTime: "2026-10-15" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-existent calendar date/time", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, requestedDateTime: "2026-02-30T10:00" }));
    expect(res.status).toBe(400);
  });

  it("rejects a numberOfVisitors of 0", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const res = await POST(makeRequest({ ...validBody, numberOfVisitors: 0 }));
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/tours/book/route");
    const request = new NextRequest("http://localhost/api/tours/book", {
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

Run: `npx jest src/app/api/tours/book/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/tours/book/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import { isRealDateTime } from "@/lib/dateTime";

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const bookingFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  numberOfVisitors: z
    .number()
    .int("Number of visitors must be a whole number")
    .min(1, "At least 1 visitor is required")
    .max(50, "Too many visitors"),
  requestedDateTime: z.string().regex(DATETIME_RE, "Invalid date/time"),
  notes: z.string().max(2000, "Notes is too long").optional(),
});

// No file upload in this module, so a legitimate body is a few hundred
// bytes — this cap is a sanity guard against abuse, not a real ceiling
// (see src/app/api/careers/[id]/apply/route.ts for the fuller caveat about
// why a Content-Length-based check like this can be bypassed entirely by
// omitting the header or using chunked transfer-encoding — the same
// accepted tradeoff applies here).
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

  const parsed = bookingFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!isRealDateTime(parsed.data.requestedDateTime)) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  const requestedDateTime = new Date(`${parsed.data.requestedDateTime}:00.000Z`);

  await connectToDatabase();
  const booking = await TourBooking.create({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    numberOfVisitors: parsed.data.numberOfVisitors,
    notes: parsed.data.notes ?? "",
    requestedDateTime,
  });

  return NextResponse.json({ id: booking._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/tours/book/__tests__/route.test.ts`
Expected: PASS, 8/8 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tours/book/route.ts src/app/api/tours/book/__tests__/route.test.ts
git commit -m "feat: add public POST /api/tours/book"
```

---

### Task 4: `PUT` / `DELETE /api/admin/tours/[id]`

**Files:**
- Create: `src/app/api/admin/tours/[id]/route.ts`
- Test: `src/app/api/admin/tours/[id]/__tests__/route.test.ts`

**Context:** Covered by `proxy.ts`'s existing `/api/admin/:path*` matcher — no new auth code needed. PUT updates `status` (`"Confirmed"` or `"Declined"`) and, only when confirming, `confirmedDateTime`: if an explicit adjusted time is supplied, use it (after validating it); if not, keep whatever was already confirmed (supports re-confirming with a new time later without losing it if the request omits the field), falling back to the visitor's original `requestedDateTime` if nothing has ever been confirmed yet. `confirmedDateTime` is left untouched when declining. DELETE removes a booking outright (for spam/duplicate cleanup) — no cascading concerns, no files.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT/DELETE /api/admin/tours/[id]", () => {
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

  async function createBooking() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { TourBooking } = require("@/models/TourBooking");
    return TourBooking.create({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      numberOfVisitors: 2,
      requestedDateTime: new Date("2026-10-15T10:00:00.000Z"),
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/tours/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("confirms a booking with an explicit adjusted time", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-10-16T14:00",
      }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    const updated = await TourBooking.findById(booking._id);
    expect(updated.status).toBe("Confirmed");
    expect(updated.confirmedDateTime.toISOString()).toContain("2026-10-16T14:00");
  });

  it("confirms a booking without an explicit time, defaulting to the requested time", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), { status: "Confirmed" }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    const updated = await TourBooking.findById(booking._id);
    expect(updated.confirmedDateTime.toISOString()).toBe(booking.requestedDateTime.toISOString());
  });

  it("declines a booking without touching confirmedDateTime", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), { status: "Declined" }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    const updated = await TourBooking.findById(booking._id);
    expect(updated.status).toBe("Declined");
    expect(updated.confirmedDateTime).toBeNull();
  });

  it("rejects an invalid confirmedDateTime on confirm", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), {
        status: "Confirmed",
        confirmedDateTime: "2026-02-30T10:00",
      }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a status outside the fixed enum", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(
      makeRequest("PUT", booking._id.toString(), { status: "Maybe" }),
      { params: Promise.resolve({ id: booking._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/tours/[id]/route");
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
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const res = await PUT(makeRequest("PUT", missingId, { status: "Confirmed" }), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a PUT request over the body size limit", async () => {
    const booking = await createBooking();
    const { PUT } = require("@/app/api/admin/tours/[id]/route");

    const request = new NextRequest(`http://localhost/api/admin/tours/${booking._id.toString()}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify({ status: "Confirmed" }),
    });
    const res = await PUT(request, { params: Promise.resolve({ id: booking._id.toString() }) });
    expect(res.status).toBe(413);
  });

  it("deletes a booking", async () => {
    const booking = await createBooking();
    const { DELETE } = require("@/app/api/admin/tours/[id]/route");

    const res = await DELETE(makeRequest("DELETE", booking._id.toString()), {
      params: Promise.resolve({ id: booking._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { TourBooking } = require("@/models/TourBooking");
    expect(await TourBooking.findById(booking._id)).toBeNull();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/tours/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/tours/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/admin/tours/\[id\]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '@/app/api/admin/tours/[id]/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import { isRealDateTime } from "@/lib/dateTime";

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const updateFieldsSchema = z.object({
  status: z.enum(["Confirmed", "Declined"]),
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
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
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
  const existing = await TourBooking.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  existing.status = parsed.data.status;

  if (parsed.data.status === "Confirmed") {
    // Confirming without an explicit adjusted time keeps whatever was
    // already confirmed (supports re-confirming after an earlier change
    // without losing it), or falls back to the visitor's originally
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
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await TourBooking.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  await TourBooking.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/admin/tours/\[id\]/__tests__/route.test.ts"`
Expected: PASS, 11/11 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/tours/[id]/route.ts" "src/app/api/admin/tours/[id]/__tests__/route.test.ts"
git commit -m "feat: add PUT/DELETE /api/admin/tours/[id]"
```

---

### Task 5: Admin bookings list page

**Files:**
- Modify: `src/app/admin/dashboard/bookings/page.tsx` (currently a `ComingSoon` placeholder)

**Context:** No "+ New" link — admin never creates bookings, only visitors do via the public form. Each row links to a detail page (Task 6) rather than an inline edit form, since confirming needs enough space for a datetime picker plus two distinct actions (confirm/decline) — more than fits cleanly in a table row.

- [ ] **Step 1: Replace the placeholder**

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Confirmed: "bg-navy/10 text-navy",
  Declined: "bg-maroon/10 text-maroon",
};

export default async function BookingsAdminPage() {
  await connectToDatabase();
  const bookings = await TourBooking.find().sort({ submittedAt: -1 }).lean();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Bookings</h1>
      {bookings.length === 0 ? (
        <p className="text-gray-600">No booking requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4">
                  Requested
                </th>
                <th scope="col" className="py-2 pr-4">
                  Visitors
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
              {bookings.map((b) => (
                <tr key={b._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{b.name}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {b.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{b.numberOfVisitors}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[b.status]}`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/bookings/${b._id.toString()}`}
                      aria-label={`View booking from "${b.name}"`}
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

- [ ] **Step 2: Manually verify**

With `npm run dev` running and logged in as admin, visit `/admin/dashboard/bookings`. Expect "No booking requests yet." (empty DB) and no "+ New" link (correctly absent — admin doesn't create bookings).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/bookings/page.tsx
git commit -m "feat: add admin bookings list page"
```

---

### Task 6: Admin booking detail page + confirm/decline/delete actions

**Files:**
- Create: `src/app/admin/dashboard/bookings/[id]/page.tsx`
- Create: `src/app/admin/dashboard/bookings/[id]/BookingActions.tsx`

**Context:** The detail page is a server component showing all booking fields; the actions (confirm with an adjustable datetime picker, decline, delete) live in a small client component since they need `useState` for the datetime input value and loading/error states. Delete reuses the `confirm()`-dialog + fetch pattern already established by `DeleteEntityButton`, but isn't literally that shared component here since this page needs two other buttons (Confirm/Decline) alongside it with shared loading state — a bespoke small component is the right call, not a forced reuse.

- [ ] **Step 1: Create the actions component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BookingActionsProps {
  bookingId: string;
  status: "Pending" | "Confirmed" | "Declined";
  requestedDateTime: string;
  confirmedDateTime: string | null;
}

export default function BookingActions({
  bookingId,
  status,
  requestedDateTime,
  confirmedDateTime,
}: BookingActionsProps) {
  const router = useRouter();
  const [dateTime, setDateTime] = useState(confirmedDateTime ?? requestedDateTime);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "Confirmed" | "Declined") {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tours/${bookingId}`, {
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

      router.push("/admin/dashboard/bookings");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    if (!confirm("Delete this booking request? This cannot be undone.")) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tours/${bookingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        setLoading(false);
        return;
      }
      router.push("/admin/dashboard/bookings");
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

- [ ] **Step 2: Create the detail page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import BookingActions from "./BookingActions";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const booking = await TourBooking.findById(id).lean();

  if (!booking) {
    notFound();
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-navy">Booking Request</h1>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-navy">Name</dt>
          <dd className="text-gray-700">{booking.name}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Email</dt>
          <dd className="text-gray-700">{booking.email}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Phone</dt>
          <dd className="text-gray-700">{booking.phone}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Visitors</dt>
          <dd className="text-gray-700">{booking.numberOfVisitors}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Requested</dt>
          <dd className="text-gray-700">
            {booking.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
          </dd>
        </div>
        {booking.notes && (
          <div>
            <dt className="font-medium text-navy">Notes</dt>
            <dd className="whitespace-pre-wrap text-gray-700">{booking.notes}</dd>
          </div>
        )}
      </dl>
      <div className="mt-8 border-t border-gray-200 pt-6">
        <BookingActions
          bookingId={booking._id.toString()}
          status={booking.status}
          requestedDateTime={booking.requestedDateTime.toISOString().slice(0, 16)}
          confirmedDateTime={
            booking.confirmedDateTime ? booking.confirmedDateTime.toISOString().slice(0, 16) : null
          }
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

With `npm run dev` running and at least one test booking in the DB (created in Task 7 or via a direct API call for now), visit `/admin/dashboard/bookings`, click "View" on a pending booking, confirm the detail page shows all fields correctly, adjust the confirmed date/time and click Confirm — confirm it redirects to the list and the status badge now shows "Confirmed". Create a second test booking, view it, click Decline — confirm status shows "Declined" and `confirmedDateTime` stayed empty. Click Delete on one — confirm it's removed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/dashboard/bookings/[id]/page.tsx" "src/app/admin/dashboard/bookings/[id]/BookingActions.tsx"
git commit -m "feat: add admin booking detail page with confirm/decline/delete actions"
```

---

### Task 7: Public `/tours` booking request page

**Files:**
- Create: `src/app/tours/page.tsx`
- Create: `src/app/tours/BookingForm.tsx`

**Context:** Unlike every other public page in this project, this one has no database query at all — it's a static page rendering a client-side form, so no `dynamic = "force-dynamic"` or `connectToDatabase()` is needed. The form submits JSON (not FormData, since there's no file) directly to `POST /api/tours/book`.

- [ ] **Step 1: Create the form component**

```tsx
"use client";

import { useState, type FormEvent } from "react";

export default function BookingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      numberOfVisitors: Number(formData.get("numberOfVisitors")),
      requestedDateTime: formData.get("requestedDateTime"),
      notes: formData.get("notes") ?? "",
    };

    try {
      const res = await fetch("/api/tours/book", {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-navy">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-navy">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-navy">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="numberOfVisitors" className="block text-sm font-medium text-navy">
          Number of visitors
        </label>
        <input
          id="numberOfVisitors"
          name="numberOfVisitors"
          type="number"
          min="1"
          max="50"
          required
          defaultValue={1}
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
        <label htmlFor="notes" className="block text-sm font-medium text-navy">
          Notes <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
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
        {loading ? "Submitting..." : "Request Tour"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
import type { Metadata } from "next";
import BookingForm from "./BookingForm";

export const metadata: Metadata = {
  title: "Book a Tour — MLC",
  description: "Request a campus tour or admission consultation at Modernistic Learning Community.",
};

export default function ToursPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">Book a Tour</h1>
      <p className="mb-8 text-gray-600">
        Interested in visiting MLC? Tell us when works for you and we&apos;ll confirm a time.
      </p>
      <BookingForm />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

With `npm run dev` running, visit `/tours` (no login needed). Fill out the form with a real future date/time and submit — confirm the "Request received" message appears. Log in as admin, visit `/admin/dashboard/bookings`, confirm the new request appears with status "Pending".

- [ ] **Step 4: Commit**

```bash
git add src/app/tours/page.tsx src/app/tours/BookingForm.tsx
git commit -m "feat: add public tour booking request page"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass — confirm the actual count (should be around 214 + 8 dateTime + 8 model + 8 create-route + 11 update/delete-route = 249).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run a production build**

Run: `npm run build`
Expected: succeeds, route table includes `/tours`, `/admin/dashboard/bookings`, `/admin/dashboard/bookings/[id]`, `/api/tours/book`, `/api/admin/tours/[id]`.

- [ ] **Step 5: Full manual smoke test**

With local MongoDB running and `npm run dev` started, using throwaway "ZZZ Test" prefixed bookings (delete them all when done):

1. Visit `/tours` while logged out, submit a booking request ("ZZZ Test Visitor", a future date/time, 2 visitors, a note) — confirm the "Request received" message appears.
2. Log in as admin, visit `/admin/dashboard/bookings` — confirm the request appears with status "Pending".
3. Click into the booking — confirm all fields (name/email/phone/visitors/requested time/notes) display correctly.
4. Confirm it with an adjusted date/time (different from what was requested) — confirm it redirects to the list, status shows "Confirmed".
5. Click back into the same booking — confirm the confirmed date/time field now shows the adjusted time you set, not the originally requested one.
6. Submit a second test booking, view it, decline it — confirm status shows "Declined" and no confirmed time was ever set.
7. Try confirming a booking with an invalid date/time via a direct API call (e.g. `curl -X PUT` with `confirmedDateTime: "2026-02-30T10:00"`, logged in with a valid session cookie) — expect a clean 400, not a 500 or silent acceptance.
8. Delete a test booking from its detail page — confirm it's gone from the list.
9. Log out, then `curl -X POST http://localhost:3000/api/admin/tours/<any-id>` (no cookie, with a JSON body) — expect 401 JSON.
10. Confirm `POST /api/tours/book` works while logged out (already covered by step 1, just confirm no regression — it must NOT require auth, since it's the intentionally public endpoint).

- [ ] **Step 6: Clean up test data**

Delete all "ZZZ Test"-prefixed bookings created during this verification. Confirm the DB has zero "ZZZ"-prefixed bookings left.

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip this step if nothing needed fixing.)
