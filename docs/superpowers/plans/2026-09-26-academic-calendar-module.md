# Academic Calendar Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-managed calendar of academic dates/holidays/events, shown publicly as a month-grid with spanning color bars and prev/next navigation, per `docs/superpowers/specs/2026-09-26-academic-calendar-module-design.md`.

**Architecture:** Same shape as the Teachers/Announcements modules — a Mongoose model, admin CRUD API under `/api/admin/calendar` (already covered by `proxy.ts`'s existing `/api/admin/:path*` matcher, no proxy changes needed), a plain admin table + form UI, and a public `/calendar` page. No file uploads in this module. The public page's month-grid math is pure, testable logic factored into its own file.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose ^8.x, zod, Tailwind v4, Jest + `mongodb-memory-server`.

---

### Task 1: Add the `gold` theme color

**Files:**
- Modify: `src/app/globals.css`

The brand theme currently defines `--color-navy`, `--color-maroon`, `--color-cream`. The calendar needs a third category color (Event = gold) that doesn't exist yet.

- [ ] **Step 1: Add the token**

In `src/app/globals.css`, find:

```css
@theme {
  --color-navy: #1B3A4B;
  --color-maroon: #8B2E2E;
  --color-cream: #F7F5F2;
```

Change to:

```css
@theme {
  --color-navy: #1B3A4B;
  --color-maroon: #8B2E2E;
  --color-cream: #F7F5F2;
  --color-gold: #C9A227;
```

This makes `bg-gold`, `text-gold`, etc. available as Tailwind utility classes, the same way `bg-navy`/`bg-maroon` already work.

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add gold theme color for calendar event category"
```

---

### Task 2: Calendar categories constant

**Files:**
- Create: `src/lib/calendarCategories.ts`

This mirrors `src/lib/subjects.ts`'s pattern (a fixed `as const` array + derived type), plus a color-class lookup used by the public grid.

- [ ] **Step 1: Create the file**

```typescript
export const CATEGORIES = ["Academic", "Holiday", "Event"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_BG_CLASS: Record<Category, string> = {
  Academic: "bg-navy",
  Holiday: "bg-maroon",
  Event: "bg-gold",
};
```

No dedicated test for this file — it's a static constant, same as `subjects.ts` has none.

- [ ] **Step 2: Commit**

```bash
git add src/lib/calendarCategories.ts
git commit -m "feat: add calendar event category constants"
```

---

### Task 3: `CalendarEvent` model

**Files:**
- Create: `src/models/CalendarEvent.ts`
- Test: `src/models/__tests__/CalendarEvent.test.ts`

**Context:** Follow `src/models/Teacher.ts`'s structure exactly (same `mongoose.models.X ?? mongoose.model(...)` guard against redefinition, same `{ timestamps: true }`). The `endDate >= startDate` rule is enforced by a custom validator on the `endDate` path, referencing `this.startDate` — this works correctly with the `existing.save()` update pattern used elsewhere in this codebase (see `src/app/api/admin/teachers/[id]/route.ts`), because Mongoose document validators run against the live document instance at save time, not the raw update payload.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";

describe("CalendarEvent model", () => {
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

  it("creates a valid single-day event", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });

    expect(event.title).toBe("Open House");
    expect(event.category).toBe("Event");
    expect(event.description).toBe("");
  });

  it("creates a valid multi-day event", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Winter Break",
      category: "Holiday",
      startDate: new Date("2026-12-20"),
      endDate: new Date("2027-01-05"),
    });

    expect(event.startDate.toISOString()).toContain("2026-12-20");
    expect(event.endDate.toISOString()).toContain("2027-01-05");
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        category: "Event",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a category outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        title: "Bad Category",
        category: "Not A Real Category",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });

  it("rejects an endDate before startDate", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        title: "Backwards Range",
        category: "Event",
        startDate: new Date("2026-10-10"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });

  it("rejects a title over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    await expect(
      CalendarEvent.create({
        title: "a".repeat(201),
        category: "Event",
        startDate: new Date("2026-10-05"),
        endDate: new Date("2026-10-05"),
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/CalendarEvent.test.ts`
Expected: FAIL — `Cannot find module '@/models/CalendarEvent'`

- [ ] **Step 3: Implement the model**

```typescript
import mongoose, { Schema, type Document, type Model } from "mongoose";
import { CATEGORIES, type Category } from "@/lib/calendarCategories";

export interface ICalendarEvent extends Document {
  title: string;
  category: Category;
  startDate: Date;
  endDate: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      enum: [...CATEGORIES],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: ICalendarEvent, value: Date) {
          return value >= this.startDate;
        },
        message: "End date must be on or after start date",
      },
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

export const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ??
  mongoose.model<ICalendarEvent>("CalendarEvent", calendarEventSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/CalendarEvent.test.ts`
Expected: PASS, 6/6 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/CalendarEvent.ts src/models/__tests__/CalendarEvent.test.ts
git commit -m "feat: add CalendarEvent model"
```

---

### Task 4: `POST /api/admin/calendar` (create)

**Files:**
- Create: `src/app/api/admin/calendar/route.ts`
- Test: `src/app/api/admin/calendar/__tests__/route.test.ts`

**Context:** Unlike Teachers/Announcements, this module has no file upload, so the request body is plain JSON, not `FormData`. Follow `src/app/api/admin/teachers/route.ts`'s guard ordering (content-length guard first, then parse, then zod validate, then date validation, then DB write) but adapted for JSON. The 10MB `MAX_REQUEST_SIZE` used by the upload-carrying routes doesn't apply here — a calendar event body is a few hundred bytes at most, so use a much smaller cap (100KB) purely as a sanity guard against abuse, not because legitimate payloads approach it.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("POST /api/admin/calendar", () => {
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
    return new NextRequest("http://localhost/api/admin/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a single-day event, defaulting endDate to startDate", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({ title: "Open House", category: "Event", startDate: "2026-10-05" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await CalendarEvent.findById(data.id);
    expect(saved.title).toBe("Open House");
    expect(saved.startDate.toISOString()).toContain("2026-10-05");
    expect(saved.endDate.toISOString()).toContain("2026-10-05");
  });

  it("creates a multi-day event with an explicit endDate", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Winter Break",
        category: "Holiday",
        startDate: "2026-12-20",
        endDate: "2027-01-05",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await CalendarEvent.findById(data.id);
    expect(saved.endDate.toISOString()).toContain("2027-01-05");
  });

  it("rejects a missing title", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(makeRequest({ category: "Event", startDate: "2026-10-05" }));
    expect(res.status).toBe(400);
  });

  it("rejects a category outside the fixed enum", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Bad", category: "Nope", startDate: "2026-10-05" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed startDate", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Bad Date", category: "Event", startDate: "not-a-date" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an endDate before startDate", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Backwards",
        category: "Event",
        startDate: "2026-10-10",
        endDate: "2026-10-05",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const request = new NextRequest("http://localhost/api/admin/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const request = new NextRequest("http://localhost/api/admin/calendar", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify({ title: "x", category: "Event", startDate: "2026-10-05" }),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/calendar/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/admin/calendar/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { CATEGORIES } from "@/lib/calendarCategories";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  category: z.enum(CATEGORIES),
  startDate: z.string().regex(DATE_RE, "Invalid start date"),
  endDate: z.string().regex(DATE_RE, "Invalid end date").optional(),
  description: z.string().max(1000, "Description is too long").optional(),
});

// No file upload in this module, so a legitimate body is a few hundred
// bytes — this cap is a sanity guard against abuse, not a real ceiling.
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

  const parsed = calendarEventFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const event = await CalendarEvent.create({
    title: parsed.data.title,
    category: parsed.data.category,
    startDate,
    endDate,
    description: parsed.data.description ?? "",
  });

  return NextResponse.json({ id: event._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/calendar/__tests__/route.test.ts`
Expected: PASS, 7/7 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/calendar/route.ts src/app/api/admin/calendar/__tests__/route.test.ts
git commit -m "feat: add POST /api/admin/calendar"
```

---

### Task 5: `PUT` / `DELETE /api/admin/calendar/[id]`

**Files:**
- Create: `src/app/api/admin/calendar/[id]/route.ts`
- Test: `src/app/api/admin/calendar/[id]/__tests__/route.test.ts`

**Context:** Follow `src/app/api/admin/teachers/[id]/route.ts`'s `mongoose.isValidObjectId` guard and fetch-then-`.save()` update pattern (needed here so the model's `endDate >= startDate` validator runs against the live document). No file cleanup on delete — there are no files in this module.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("PUT/DELETE /api/admin/calendar/[id]", () => {
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

  async function createEvent() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    return CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/admin/calendar/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("updates an event's fields", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Open House (Rescheduled)",
        category: "Event",
        startDate: "2026-10-12",
        endDate: "2026-10-13",
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updated = await CalendarEvent.findById(event._id);
    expect(updated.title).toBe("Open House (Rescheduled)");
    expect(updated.endDate.toISOString()).toContain("2026-10-13");
  });

  it("rejects an update with endDate before startDate", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Backwards",
        category: "Event",
        startDate: "2026-10-10",
        endDate: "2026-10-05",
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");
    const res = await PUT(makeRequest("PUT", "not-an-id", { title: "x" }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();

    const res = await PUT(
      makeRequest("PUT", missingId, {
        title: "x",
        category: "Event",
        startDate: "2026-10-05",
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes an event", async () => {
    const event = await createEvent();
    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");

    const res = await DELETE(makeRequest("DELETE", event._id.toString()), {
      params: Promise.resolve({ id: event._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    expect(await CalendarEvent.findById(event._id)).toBeNull();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/admin/calendar/\[id\]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '@/app/api/admin/calendar/[id]/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { CATEGORIES } from "@/lib/calendarCategories";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  category: z.enum(CATEGORIES),
  startDate: z.string().regex(DATE_RE, "Invalid start date"),
  endDate: z.string().regex(DATE_RE, "Invalid end date").optional(),
  description: z.string().max(1000, "Description is too long").optional(),
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
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = calendarEventFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const existing = await CalendarEvent.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  existing.title = parsed.data.title;
  existing.category = parsed.data.category;
  existing.startDate = startDate;
  existing.endDate = endDate;
  existing.description = parsed.data.description ?? "";
  await existing.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await CalendarEvent.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await CalendarEvent.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/admin/calendar/\[id\]/__tests__/route.test.ts"`
Expected: PASS, 7/7 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/calendar/[id]/route.ts" "src/app/api/admin/calendar/[id]/__tests__/route.test.ts"
git commit -m "feat: add PUT/DELETE /api/admin/calendar/[id]"
```

---

### Task 6: Month-grid pure logic (`monthUtils.ts`)

**Files:**
- Create: `src/app/calendar/monthUtils.ts`
- Test: `src/app/calendar/__tests__/monthUtils.test.ts`

**Context:** This is the pure date math behind the public calendar page: parsing the `?month=` query param, stepping to the previous/next month, and building the 42-cell (6-week) grid of days with each day's active events attached. Everything here uses UTC date methods (`getUTCFullYear`, `Date.UTC`, etc.), never local-timezone methods — event dates come from `<input type="date">` values parsed as UTC midnight (e.g. `new Date("2026-10-05")`), so mixing in local-timezone getters would shift days by one in timezones behind/ahead of UTC. Keeping everything UTC end-to-end avoids that class of bug entirely.

- [ ] **Step 1: Write the failing test**

```typescript
import {
  parseMonthParam,
  formatMonthParam,
  adjacentMonth,
  buildMonthGrid,
  type CalendarEventLike,
} from "../monthUtils";

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM string", () => {
    expect(parseMonthParam("2026-10")).toEqual({ year: 2026, month: 10 });
  });

  it("falls back to the current UTC month for an undefined value", () => {
    const now = new Date();
    expect(parseMonthParam(undefined)).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it("falls back to the current month for a malformed value", () => {
    const now = new Date();
    expect(parseMonthParam("garbage")).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it("falls back to the current month for an out-of-range month number", () => {
    const now = new Date();
    expect(parseMonthParam("2026-13")).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });
});

describe("formatMonthParam", () => {
  it("pads single-digit months", () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("formats double-digit months as-is", () => {
    expect(formatMonthParam({ year: 2026, month: 12 })).toBe("2026-12");
  });
});

describe("adjacentMonth", () => {
  it("steps forward within a year", () => {
    expect(adjacentMonth({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
  });

  it("steps forward across a year boundary", () => {
    expect(adjacentMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("steps backward within a year", () => {
    expect(adjacentMonth({ year: 2026, month: 10 }, -1)).toEqual({ year: 2026, month: 9 });
  });

  it("steps backward across a year boundary", () => {
    expect(adjacentMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildMonthGrid", () => {
  const events: CalendarEventLike[] = [
    {
      id: "1",
      title: "Open House",
      category: "Event",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      description: "",
    },
    {
      id: "2",
      title: "Winter-ish Break",
      category: "Holiday",
      startDate: "2026-10-03",
      endDate: "2026-10-06",
      description: "",
    },
  ];

  it("returns 42 days (6 full weeks)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    expect(grid).toHaveLength(42);
  });

  it("marks days outside the target month as not in-month", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    // October 2026 starts on a Thursday, so the grid's first cells are
    // trailing September days.
    expect(grid[0].inMonth).toBe(false);
    const oct5 = grid.find((d) => d.date === "2026-10-05");
    expect(oct5?.inMonth).toBe(true);
  });

  it("attaches a single-day event only to its own date", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    const oct5 = grid.find((d) => d.date === "2026-10-05");
    const oct6 = grid.find((d) => d.date === "2026-10-06");
    expect(oct5?.events.map((e) => e.id)).toContain("1");
    expect(oct6?.events.map((e) => e.id)).not.toContain("1");
  });

  it("attaches a multi-day event to every day in its range", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    for (const date of ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]) {
      const day = grid.find((d) => d.date === date);
      expect(day?.events.map((e) => e.id)).toContain("2");
    }
    const oct7 = grid.find((d) => d.date === "2026-10-07");
    expect(oct7?.events.map((e) => e.id)).not.toContain("2");
  });

  it("marks isStart true only on an event's actual start date", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    const oct3 = grid.find((d) => d.date === "2026-10-03");
    const oct4 = grid.find((d) => d.date === "2026-10-04");
    expect(oct3?.events.find((e) => e.id === "2")?.isStart).toBe(true);
    expect(oct4?.events.find((e) => e.id === "2")?.isStart).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/calendar/__tests__/monthUtils.test.ts`
Expected: FAIL — `Cannot find module '../monthUtils'`

- [ ] **Step 3: Implement `monthUtils.ts`**

```typescript
export interface MonthParam {
  year: number;
  month: number; // 1-12
}

export function parseMonthParam(value: string | undefined): MonthParam {
  const now = new Date();
  const fallback: MonthParam = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  if (!value) return fallback;

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return fallback;

  return { year, month };
}

export function formatMonthParam({ year, month }: MonthParam): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function adjacentMonth({ year, month }: MonthParam, delta: 1 | -1): MonthParam {
  const zeroBasedTotal = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(zeroBasedTotal / 12);
  const newMonth = ((zeroBasedTotal % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export interface CalendarEventLike {
  id: string;
  title: string;
  category: string;
  startDate: string; // YYYY-MM-DD, UTC
  endDate: string; // YYYY-MM-DD, UTC
  description: string;
}

export interface GridEvent extends CalendarEventLike {
  isStart: boolean;
}

export interface GridDay {
  date: string; // YYYY-MM-DD, UTC
  inMonth: boolean;
  events: GridEvent[];
}

export function buildMonthGrid(
  { year, month }: MonthParam,
  events: CalendarEventLike[],
): GridDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday

  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - startWeekday);

  const days: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const current = new Date(gridStart);
    current.setUTCDate(gridStart.getUTCDate() + i);
    const dateStr = current.toISOString().slice(0, 10);
    const inMonth = current.getUTCMonth() === month - 1;

    const dayEvents: GridEvent[] = events
      .filter((e) => e.startDate <= dateStr && dateStr <= e.endDate)
      .map((e) => ({ ...e, isStart: e.startDate === dateStr }));

    days.push({ date: dateStr, inMonth, events: dayEvents });
  }

  return days;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/calendar/__tests__/monthUtils.test.ts`
Expected: PASS, 15/15 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/monthUtils.ts src/app/calendar/__tests__/monthUtils.test.ts
git commit -m "feat: add month-grid date logic for public calendar page"
```

---

### Task 7: Admin calendar list page

**Files:**
- Modify: `src/app/admin/dashboard/calendar/page.tsx` (currently a `ComingSoon` placeholder)

**Context:** Follow `src/app/admin/dashboard/announcements/page.tsx`'s pattern exactly — a single server component with an inline table, no separate client table component needed (there's no drag-and-drop here, unlike Teachers). Sort by `startDate` ascending so the soonest event is on top.

- [ ] **Step 1: Replace the placeholder**

Replace the entire contents of `src/app/admin/dashboard/calendar/page.tsx`:

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

function formatDateRange(startDate: Date, endDate: Date): string {
  const start = startDate.toLocaleDateString(undefined, { timeZone: "UTC" });
  const end = endDate.toLocaleDateString(undefined, { timeZone: "UTC" });
  return start === end ? start : `${start} – ${end}`;
}

export default async function CalendarAdminPage() {
  await connectToDatabase();
  const events = await CalendarEvent.find().sort({ startDate: 1 }).lean();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Academic Calendar</h1>
        <Link
          href="/admin/dashboard/calendar/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-gray-600">No events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4">
                  Category
                </th>
                <th scope="col" className="py-2 pr-4">
                  Date
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{e.title}</td>
                  <td className="py-2 pr-4 text-gray-600">{e.category}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {formatDateRange(e.startDate, e.endDate)}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/calendar/${e._id.toString()}/edit`}
                      aria-label={`Edit "${e.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={e._id.toString()}
                      label={e.title}
                      endpoint="/api/admin/calendar"
                    />
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

With `npm run dev` running and logged in as admin, visit `/admin/dashboard/calendar`. Expect: "No events yet." (empty DB) and a working "+ New" link (404 for now — built in Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/calendar/page.tsx
git commit -m "feat: add admin calendar events list page"
```

---

### Task 8: Admin create/edit form + `new` page

**Files:**
- Create: `src/app/admin/dashboard/calendar/CalendarEventForm.tsx`
- Create: `src/app/admin/dashboard/calendar/new/page.tsx`

**Context:** Follow `src/app/admin/dashboard/teachers/TeacherForm.tsx`'s structure (controlled inputs, `fetch` on submit, `router.push` + `router.refresh()` on success, inline error display) but adapted: JSON body instead of `FormData`, a category `<select>` instead of subject checkboxes, and date inputs. The end-date input is optional — if left blank, the client still doesn't need to fill it in; the server defaults it to `startDate` (Task 4/5 already handle this).

- [ ] **Step 1: Create the form component**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/calendarCategories";

interface CalendarEventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  initialTitle?: string;
  initialCategory?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDescription?: string;
}

export default function CalendarEventForm({
  mode,
  eventId,
  initialTitle = "",
  initialCategory = CATEGORIES[0],
  initialStartDate = "",
  initialEndDate = "",
  initialDescription = "",
}: CalendarEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const body = {
      title,
      category,
      startDate,
      endDate: endDate || undefined,
      description,
    };

    try {
      const url = mode === "create" ? "/api/admin/calendar" : `/api/admin/calendar/${eventId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard/calendar");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-navy">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-navy">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-sm font-medium text-navy">
            Start date
          </label>
          <input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-sm font-medium text-navy">
            End date <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-navy">
          Description <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          type="submit"
          disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard/calendar")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the `new` page**

```tsx
import CalendarEventForm from "../CalendarEventForm";

export default function NewCalendarEventPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Calendar Event</h1>
      <CalendarEventForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

With `npm run dev` running, visit `/admin/dashboard/calendar/new`, create a test event ("ZZZ Test Event", category Event, a start date), submit, confirm redirect to the list and the new row appears.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/dashboard/calendar/CalendarEventForm.tsx src/app/admin/dashboard/calendar/new/page.tsx
git commit -m "feat: add admin create-calendar-event page"
```

---

### Task 9: Admin edit page

**Files:**
- Create: `src/app/admin/dashboard/calendar/[id]/edit/page.tsx`

**Context:** Follow `src/app/admin/dashboard/teachers/[id]/edit/page.tsx`'s pattern (`isValidObjectId` guard, `notFound()` on invalid/missing, pass initial values into the form). Dates must be converted from `Date` objects to `YYYY-MM-DD` strings for the `<input type="date">` values — use `.toISOString().slice(0, 10)`, which is safe here because the stored dates are always UTC midnight (see Task 6's UTC-consistency note).

- [ ] **Step 1: Create the edit page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import CalendarEventForm from "../../CalendarEventForm";

export const dynamic = "force-dynamic";

export default async function EditCalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const event = await CalendarEvent.findById(id).lean();

  if (!event) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Calendar Event</h1>
      <CalendarEventForm
        mode="edit"
        eventId={event._id.toString()}
        initialTitle={event.title}
        initialCategory={event.category}
        initialStartDate={event.startDate.toISOString().slice(0, 10)}
        initialEndDate={event.endDate.toISOString().slice(0, 10)}
        initialDescription={event.description}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Edit the "ZZZ Test Event" created in Task 8 — change its title, save, confirm the change shows in the admin list.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/dashboard/calendar/[id]/edit/page.tsx"
git commit -m "feat: add admin edit-calendar-event page"
```

---

### Task 10: Public `/calendar` page — month grid + navigation

**Files:**
- Create: `src/app/calendar/page.tsx`
- Create: `src/app/calendar/CalendarGrid.tsx`

**Context:** `page.tsx` is a server component: reads `?month=` from search params, fetches events overlapping the visible 42-day grid window (not just events strictly inside the calendar month, since a grid can show trailing/leading days from adjacent months), builds the grid via `monthUtils.buildMonthGrid`, and renders prev/next `<Link>`s (no client JS needed for navigation — plain server-rendered links that change the URL). The grid itself, plus click-to-reveal event details, is a small client component (`CalendarGrid`) since that interaction needs state. Multi-day events render as a colored bar in every day cell they cover, per the approved mockup — only the day matching `isStart` shows the title text; other covered days show a same-color blank bar (this is a simplification of true calendar-bar-spanning, sufficient for a school calendar with few, rarely-overlapping events — see the design spec's "explicitly out of scope" section).

- [ ] **Step 1: Create the grid client component**

```tsx
"use client";

import { useState } from "react";
import type { GridDay, GridEvent } from "./monthUtils";
import { CATEGORY_BG_CLASS, type Category } from "@/lib/calendarCategories";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({ days }: { days: GridDay[] }) {
  const [selected, setSelected] = useState<GridEvent | null>(null);

  const monthEvents = Array.from(
    new Map(
      days
        .filter((d) => d.inMonth)
        .flatMap((d) => d.events)
        .map((e) => [e.id, e]),
    ).values(),
  );

  return (
    <div>
      {/* Month grid: hidden on narrow screens in favor of the list below. */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px bg-gray-200 text-xs font-medium text-navy">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-cream p-2 text-center">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {days.map((day) => (
            <div
              key={day.date}
              className={`min-h-24 bg-white p-1 ${day.inMonth ? "" : "bg-gray-50 text-gray-400"}`}
            >
              <span className="text-xs">{Number(day.date.slice(8, 10))}</span>
              <div className="mt-1 space-y-0.5">
                {day.events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelected(event)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white ${CATEGORY_BG_CLASS[event.category as Category]}`}
                  >
                    {event.isStart ? event.title : " "}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile fallback: a plain stacked list instead of a cramped grid. */}
      <ul className="space-y-2 sm:hidden">
        {monthEvents.length === 0 && <li className="text-sm text-gray-600">No events this month.</li>}
        {monthEvents.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => setSelected(event)}
              className={`block w-full rounded px-3 py-2 text-left text-sm text-white ${CATEGORY_BG_CLASS[event.category as Category]}`}
            >
              <span className="font-medium">{event.title}</span>
              <span className="ml-2 text-xs opacity-90">
                {event.startDate === event.endDate
                  ? event.startDate
                  : `${event.startDate} – ${event.endDate}`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-4 rounded border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-navy">{selected.title}</h3>
              <p className="text-sm text-gray-600">
                {selected.startDate === selected.endDate
                  ? selected.startDate
                  : `${selected.startDate} – ${selected.endDate}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close event details"
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          {selected.description && <p className="mt-2 text-sm text-gray-700">{selected.description}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the public page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { parseMonthParam, formatMonthParam, adjacentMonth, buildMonthGrid } from "./monthUtils";
import CalendarGrid from "./CalendarGrid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Academic Calendar — MLC",
  description: "Academic dates, holidays, and events at Modernistic Learning Community.",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const current = parseMonthParam(monthParam);
  const previous = adjacentMonth(current, -1);
  const next = adjacentMonth(current, 1);

  await connectToDatabase();
  // Fetch anything that could overlap the visible 42-day grid, not just
  // events strictly inside the calendar month — the grid shows trailing
  // days from the previous month and leading days from the next.
  const rangeStart = new Date(Date.UTC(previous.year, previous.month - 1, 1));
  const rangeEnd = new Date(Date.UTC(next.year, next.month, 0));
  const events = await CalendarEvent.find({
    startDate: { $lte: rangeEnd },
    endDate: { $gte: rangeStart },
  })
    .sort({ startDate: 1 })
    .lean();

  const eventsForGrid = events.map((e) => ({
    id: e._id.toString(),
    title: e.title,
    category: e.category,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
    description: e.description,
  }));

  const days = buildMonthGrid(current, eventsForGrid);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-navy">
          {MONTH_NAMES[current.month - 1]} {current.year}
        </h1>
        <div className="flex gap-3 text-sm">
          <Link
            href={`/calendar?month=${formatMonthParam(previous)}`}
            className="rounded border border-gray-300 px-3 py-1.5 text-navy hover:bg-gray-50"
          >
            ← Previous
          </Link>
          <Link
            href={`/calendar?month=${formatMonthParam(next)}`}
            className="rounded border border-gray-300 px-3 py-1.5 text-navy hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>
      </div>
      <CalendarGrid days={days} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

With `npm run dev` running, visit `/calendar` (no login needed). Expect the current month's grid with the "ZZZ Test Event" from Task 8 visible if its date falls in the current month; test Previous/Next links change the month shown.

- [ ] **Step 4: Commit**

```bash
git add src/app/calendar/page.tsx src/app/calendar/CalendarGrid.tsx
git commit -m "feat: add public calendar page with month grid and navigation"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass — confirm the actual count (should be the prior 97 plus this module's new tests: 6 model + 7 create-route + 7 update/delete-route + 15 monthUtils = 35 new, expect 132 total across however many suites).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run a production build**

Run: `npm run build`
Expected: succeeds, route table includes `/calendar`, `/admin/dashboard/calendar`, `/admin/dashboard/calendar/new`, `/admin/dashboard/calendar/[id]/edit`, `/api/admin/calendar`, `/api/admin/calendar/[id]`.

- [ ] **Step 5: Full manual smoke test**

With local MongoDB running and `npm run dev` started, logged in as admin, using throwaway "ZZZ Test" prefixed events (delete them all when done):

1. Create a single-day event (no end date) — appears correctly in admin list and on the public grid on the right day.
2. Create a multi-day event spanning several days, including across a month boundary (e.g. starts near month-end) — appears as a colored bar on every covered day in admin's date-range column and on the public grid; verify it also shows (correctly clipped/continuing) when navigating to the adjacent month via Previous/Next.
3. Edit an event's title/category/dates — reflected in both admin list and public page.
4. Edit an event so its endDate would be before its startDate — rejected with a clear error, no partial save.
5. Delete an event — gone from admin list and public page.
6. Navigate Previous/Next several months on the public page — grid always shows the correct month/year and correct day-of-week alignment.
7. Resize the browser to a narrow (mobile) width on the public page — grid is replaced by the stacked list fallback; click an event in the list — detail panel shows title/dates/description.
8. On a normal-width viewport, click an event bar on the grid — same detail panel appears; click the × to close it.
9. Log out; `curl -X POST http://localhost:3000/api/admin/calendar` (no cookie) — expect 401 JSON. Same for `curl -X PUT http://localhost:3000/api/admin/calendar/<any-id>` and `curl -X DELETE ...` — all 401.
10. Visit `/calendar` while logged out — loads fine, no auth required.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip if nothing needed fixing.)
