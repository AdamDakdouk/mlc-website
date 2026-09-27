# Achievements Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-managed achievements (school/student/team accolades, undifferentiated) with an optional photo and a "date it happened" field, shown publicly as a photo-card grid, per `docs/superpowers/specs/2026-09-28-achievements-module-design.md`.

**Architecture:** The simplest content module in this sub-project — pure recombination of two already-proven patterns, no new architecture. Admin CRUD + photo upload follows `src/app/api/admin/announcements/route.ts`'s shape exactly; date handling reuses the `isRealCalendarDate` helper (`src/lib/calendarDate.ts`) already hardened during the Academic Calendar module against silently-wrong dates like `"2026-02-30"`. The public page follows the Teachers module's grid layout, without the initials-avatar fallback (a photo-less achievement card just shows text, which reads fine for an accolades list).

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose ^8.x, zod, Tailwind v4, Jest + `mongodb-memory-server`.

---

### Task 1: Allow the `achievements` upload folder

**Files:**
- Modify: `src/lib/imageUpload.ts`

**Context:** `imageUpload.ts` already generalizes over an allowlist of folders (`ALLOWED_FOLDERS`). This is a one-line addition — no other code in that file changes.

- [ ] **Step 1: Add the folder**

In `src/lib/imageUpload.ts`, find:

```typescript
const ALLOWED_FOLDERS = ["announcements", "teachers"] as const;
```

Change to:

```typescript
const ALLOWED_FOLDERS = ["announcements", "teachers", "achievements"] as const;
```

No test changes needed here — the folder allowlist is exercised end-to-end by this module's own route tests (Task 3/4), which pass `"achievements"` as the folder and rely on it being accepted.

- [ ] **Step 2: Commit**

```bash
git add src/lib/imageUpload.ts
git commit -m "feat: allow achievements folder for photo uploads"
```

---

### Task 2: `Achievement` model

**Files:**
- Create: `src/models/Achievement.ts`
- Test: `src/models/__tests__/Achievement.test.ts`

**Context:** Same shape as `src/models/Announcement.ts` plus a required `date` field (the Mongoose schema itself doesn't need date-validity checking beyond `required: true` — the real-calendar-date check happens at the API layer via `isRealCalendarDate`, same division of responsibility as the Calendar module).

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";

describe("Achievement model", () => {
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

  it("creates a valid achievement, defaulting photoUrl to null", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    const achievement = await Achievement.create({
      title: "Regional Science Fair — 1st Place",
      description: "Our robotics team took first place.",
      date: new Date("2026-03-10"),
    });

    expect(achievement.title).toBe("Regional Science Fair — 1st Place");
    expect(achievement.photoUrl).toBeNull();
  });

  it("creates a valid achievement with a photoUrl", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    const achievement = await Achievement.create({
      title: "Accreditation Renewed",
      description: "MLC renewed its accreditation.",
      date: new Date("2026-01-15"),
      photoUrl: "/uploads/achievements/11111111-1111-1111-1111-111111111111.jpg",
    });

    expect(achievement.photoUrl).toBe(
      "/uploads/achievements/11111111-1111-1111-1111-111111111111.jpg",
    );
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(
      Achievement.create({ description: "x", date: new Date("2026-01-01") }),
    ).rejects.toThrow();
  });

  it("rejects a missing description", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(
      Achievement.create({ title: "x", date: new Date("2026-01-01") }),
    ).rejects.toThrow();
  });

  it("rejects a missing date", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(Achievement.create({ title: "x", description: "x" })).rejects.toThrow();
  });

  it("rejects a title over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");

    await expect(
      Achievement.create({
        title: "a".repeat(201),
        description: "x",
        date: new Date("2026-01-01"),
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/Achievement.test.ts`
Expected: FAIL — `Cannot find module '@/models/Achievement'`

- [ ] **Step 3: Implement the model**

```typescript
import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAchievement extends Document {
  title: string;
  description: string;
  date: Date;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const achievementSchema = new Schema<IAchievement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    date: {
      type: Date,
      required: true,
    },
    photoUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const Achievement: Model<IAchievement> =
  mongoose.models.Achievement ?? mongoose.model<IAchievement>("Achievement", achievementSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/Achievement.test.ts`
Expected: PASS, 6/6 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/Achievement.ts src/models/__tests__/Achievement.test.ts
git commit -m "feat: add Achievement model"
```

---

### Task 3: `POST /api/admin/achievements` (create)

**Files:**
- Create: `src/app/api/admin/achievements/route.ts`
- Test: `src/app/api/admin/achievements/__tests__/route.test.ts`

**Context:** FormData body (photo upload), mirroring `src/app/api/admin/announcements/route.ts`'s shape exactly, plus the `isRealCalendarDate` check from `src/lib/calendarDate.ts` (already hardened against both silent-rollover dates like `"2026-02-30"` and fully-invalid dates like `"2026-13-01"` — reuse it here rather than re-deriving date validation from scratch).

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/admin/achievements", () => {
  let mongod: MongoMemoryServer;
  const savedPaths: string[] = [];

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
    const { unlink } = require("fs/promises");
    const path = require("path");
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  function makeRequest(formData: FormData) {
    return new NextRequest("http://localhost/api/admin/achievements", {
      method: "POST",
      body: formData,
    });
  }

  it("creates an achievement without a photo", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/achievements/route");

    const formData = new FormData();
    formData.set("title", "Regional Science Fair — 1st Place");
    formData.set("description", "Our robotics team took first place.");
    formData.set("date", "2026-03-10");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Achievement } = require("@/models/Achievement");
    const saved = await Achievement.findById(data.id);
    expect(saved.title).toBe("Regional Science Fair — 1st Place");
    expect(saved.photoUrl).toBeNull();
    expect(saved.date.toISOString()).toContain("2026-03-10");
  });

  it("creates an achievement with a valid photo", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/achievements/route");

    const formData = new FormData();
    formData.set("title", "Accreditation Renewed");
    formData.set("description", "MLC renewed its accreditation.");
    formData.set("date", "2026-01-15");
    formData.set(
      "photo",
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Achievement } = require("@/models/Achievement");
    const saved = await Achievement.findById(data.id);
    expect(saved.photoUrl).toMatch(/^\/uploads\/achievements\//);
    savedPaths.push(saved.photoUrl);
  });

  it("rejects a missing title", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a missing description", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("date", "2026-01-01");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a missing date", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid calendar date", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-02-30");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid photo file", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");
    formData.set(
      "photo",
      new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/achievements/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const request = new NextRequest("http://localhost/api/admin/achievements", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      body: formData,
    });

    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/achievements/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/admin/achievements/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";
import { isRealCalendarDate } from "@/lib/calendarDate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const achievementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required").max(2000, "Description is too long"),
  date: z.string().regex(DATE_RE, "Invalid date"),
});

// Headroom above imageUpload's 5MB image cap, to account for form field
// overhead and multipart boundaries, while still bounding worst-case memory
// use.
//
// Note: Next.js 16 (via the proxy this route is matched by, see
// src/proxy.ts's config.matcher covering /api/admin/:path*) already buffers
// incoming request bodies up to `proxyClientMaxBodySize`, which defaults to
// 10MB (see
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md).
// That platform-level buffering is NOT a substitute for this check: on
// overflow it silently truncates the body and lets the request continue
// processing with partial data instead of rejecting it, which would
// otherwise surface here as a confusing 400 from a broken multipart parse
// rather than a clear 413. This explicit check gives callers a well-defined
// "payload too large" response instead.
//
// This only covers the declared-Content-Length path: a chunked
// transfer-encoding request has no Content-Length header and so bypasses
// this check entirely. That gap is bounded, not unbounded, though — Next's
// own proxyClientMaxBodySize buffering (see above) still caps what actually
// reaches this handler at 10MB underneath, even without this guard.
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = achievementFieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!isRealCalendarDate(parsed.data.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const date = new Date(parsed.data.date);

  let photoUrl: string | null = null;
  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      photoUrl = await validateAndSaveImage(photoFile, "achievements");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  await connectToDatabase();
  let achievement;
  try {
    achievement = await Achievement.create({
      title: parsed.data.title,
      description: parsed.data.description,
      date,
      photoUrl,
    });
  } catch (err) {
    // Avoid orphaning an already-saved photo file if the DB write fails
    // after a successful upload.
    if (photoUrl) {
      await deleteImageFile(photoUrl);
    }
    throw err;
  }

  return NextResponse.json({ id: achievement._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/achievements/__tests__/route.test.ts`
Expected: PASS, 8/8 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/achievements/route.ts src/app/api/admin/achievements/__tests__/route.test.ts
git commit -m "feat: add POST /api/admin/achievements"
```

---

### Task 4: `PUT` / `DELETE /api/admin/achievements/[id]`

**Files:**
- Create: `src/app/api/admin/achievements/[id]/route.ts`
- Test: `src/app/api/admin/achievements/[id]/__tests__/route.test.ts`

**Context:** Mirrors `src/app/api/admin/announcements/[id]/route.ts`'s PUT (fetch-then-`.save()`, save-then-cleanup rollback on failure, old-file-deleted-only-after-save-succeeds) and DELETE (DB record deleted before file, so a mid-delete crash orphans a harmless file rather than leaving a live record pointing at nothing — same principle as every other single-child photo-bearing module in this codebase). Adds the same `isRealCalendarDate` check as the create route.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("PUT/DELETE /api/admin/achievements/[id]", () => {
  let mongod: MongoMemoryServer;
  const savedPaths: string[] = [];

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
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  async function createAchievement(withPhoto = false) {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Achievement } = require("@/models/Achievement");
    let photoUrl: string | null = null;
    if (withPhoto) {
      const { validateAndSaveImage } = require("@/lib/imageUpload");
      photoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
        "achievements",
      );
      savedPaths.push(photoUrl);
    }
    return Achievement.create({
      title: "Regional Science Fair — 1st Place",
      description: "Our robotics team took first place.",
      date: new Date("2026-03-10"),
      photoUrl,
    });
  }

  function makeRequest(method: "PUT" | "DELETE", id: string, formData?: FormData) {
    return new NextRequest(`http://localhost/api/admin/achievements/${id}`, {
      method,
      body: formData,
    });
  }

  it("updates an achievement's fields without touching an existing photo", async () => {
    const achievement = await createAchievement(true);
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", "Regional Science Fair — 1st Place (Updated)");
    formData.set("description", "Updated description.");
    formData.set("date", "2026-03-12");

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    const updated = await Achievement.findById(achievement._id);
    expect(updated.title).toBe("Regional Science Fair — 1st Place (Updated)");
    expect(updated.photoUrl).toBe(achievement.photoUrl);
  });

  it("replaces the photo and deletes the old file", async () => {
    const achievement = await createAchievement(true);
    const oldPhotoUrl = achievement.photoUrl;
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", achievement.title);
    formData.set("description", achievement.description);
    formData.set("date", "2026-03-10");
    formData.set(
      "photo",
      new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
    );

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    const updated = await Achievement.findById(achievement._id);
    expect(updated.photoUrl).not.toBe(oldPhotoUrl);
    savedPaths.push(updated.photoUrl);

    const oldFilePath = path.join(process.cwd(), "public", oldPhotoUrl);
    await expect(readFile(oldFilePath)).rejects.toThrow();
  });

  it("removes the photo entirely", async () => {
    const achievement = await createAchievement(true);
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", achievement.title);
    formData.set("description", achievement.description);
    formData.set("date", "2026-03-10");
    formData.set("removePhoto", "true");

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    const updated = await Achievement.findById(achievement._id);
    expect(updated.photoUrl).toBeNull();
  });

  it("rejects an update with an invalid calendar date", async () => {
    const achievement = await createAchievement();
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-02-30");

    const res = await PUT(makeRequest("PUT", achievement._id.toString(), formData), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id on PUT", async () => {
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");
    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const res = await PUT(makeRequest("PUT", "not-an-id", formData), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but non-existent id on PUT", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongooseFresh = require("mongoose");
    const missingId = new mongooseFresh.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/achievements/[id]/route");

    const formData = new FormData();
    formData.set("title", "x");
    formData.set("description", "x");
    formData.set("date", "2026-01-01");

    const res = await PUT(makeRequest("PUT", missingId, formData), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes an achievement and its photo file", async () => {
    const achievement = await createAchievement(true);
    const photoUrl = achievement.photoUrl;
    const { DELETE } = require("@/app/api/admin/achievements/[id]/route");

    const res = await DELETE(makeRequest("DELETE", achievement._id.toString()), {
      params: Promise.resolve({ id: achievement._id.toString() }),
    });
    expect(res.status).toBe(200);

    const { Achievement } = require("@/models/Achievement");
    expect(await Achievement.findById(achievement._id)).toBeNull();

    const filePath = path.join(process.cwd(), "public", photoUrl);
    await expect(readFile(filePath)).rejects.toThrow();
  });

  it("returns 400 for a malformed id on DELETE", async () => {
    const { DELETE } = require("@/app/api/admin/achievements/[id]/route");
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
    const { DELETE } = require("@/app/api/admin/achievements/[id]/route");

    const res = await DELETE(makeRequest("DELETE", missingId), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/admin/achievements/\[id\]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '@/app/api/admin/achievements/[id]/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";
import { isRealCalendarDate } from "@/lib/calendarDate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const achievementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required").max(2000, "Description is too long"),
  date: z.string().regex(DATE_RE, "Invalid date"),
});

// Headroom above imageUpload's 5MB image cap, to account for form field
// overhead and multipart boundaries, while still bounding worst-case memory
// use.
//
// Note: Next.js 16 (via the proxy this route is matched by, see
// src/proxy.ts's config.matcher covering /api/admin/:path*) already buffers
// incoming request bodies up to `proxyClientMaxBodySize`, which defaults to
// 10MB (see
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md).
// That platform-level buffering is NOT a substitute for this check: on
// overflow it silently truncates the body and lets the request continue
// processing with partial data instead of rejecting it, which would
// otherwise surface here as a confusing 400 from a broken multipart parse
// rather than a clear 413. This explicit check gives callers a well-defined
// "payload too large" response instead.
//
// This only covers the declared-Content-Length path: a chunked
// transfer-encoding request has no Content-Length header and so bypasses
// this check entirely. That gap is bounded, not unbounded, though — Next's
// own proxyClientMaxBodySize buffering (see above) still caps what actually
// reaches this handler at 10MB underneath, even without this guard.
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

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
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = achievementFieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!isRealCalendarDate(parsed.data.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const date = new Date(parsed.data.date);

  await connectToDatabase();
  const existing = await Achievement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }

  const removePhoto = formData.get("removePhoto") === "true";
  const photoFile = formData.get("photo");

  const oldPhotoUrl = existing.photoUrl;
  let newPhotoUrl = oldPhotoUrl;

  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      newPhotoUrl = await validateAndSaveImage(photoFile, "achievements");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } else if (removePhoto) {
    newPhotoUrl = null;
  }

  existing.title = parsed.data.title;
  existing.description = parsed.data.description;
  existing.date = date;
  existing.photoUrl = newPhotoUrl;

  try {
    await existing.save();
  } catch (err) {
    // Save failed — roll back the newly-uploaded file (if any). The old
    // file and DB record are untouched, so no broken reference is ever
    // visible — the record still points at oldPhotoUrl until save succeeds.
    if (newPhotoUrl && newPhotoUrl !== oldPhotoUrl) {
      await deleteImageFile(newPhotoUrl);
    }
    throw err;
  }

  // Only delete the old file once the DB write is confirmed — a crash here
  // leaves an orphaned old file (harmless), never a broken live reference.
  if (oldPhotoUrl && oldPhotoUrl !== newPhotoUrl) {
    await deleteImageFile(oldPhotoUrl);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Achievement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }
  const { photoUrl } = existing;

  // Delete the DB record first, then the photo file — same ordering
  // principle as PUT above: commit the authoritative change first, clean up
  // the filesystem after. A crash between these two steps orphans the photo
  // file (harmless), rather than risking a live record pointing at a
  // deleted file.
  await Achievement.deleteOne({ _id: id });

  if (photoUrl) {
    await deleteImageFile(photoUrl);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/admin/achievements/\[id\]/__tests__/route.test.ts"`
Expected: PASS, 9/9 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/achievements/[id]/route.ts" "src/app/api/admin/achievements/[id]/__tests__/route.test.ts"
git commit -m "feat: add PUT/DELETE /api/admin/achievements/[id]"
```

---

### Task 5: Admin achievements list page

**Files:**
- Modify: `src/app/admin/dashboard/achievements/page.tsx` (currently a `ComingSoon` placeholder)

**Context:** Same shape as `src/app/admin/dashboard/announcements/page.tsx`, sorted by `date` descending (not `createdAt`).

- [ ] **Step 1: Replace the placeholder**

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function AchievementsAdminPage() {
  await connectToDatabase();
  const achievements = await Achievement.find().sort({ date: -1 }).lean();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Achievements</h1>
        <Link
          href="/admin/dashboard/achievements/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {achievements.length === 0 ? (
        <p className="text-gray-600">No achievements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4">
                  Photo
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {achievements.map((a) => (
                <tr key={a._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{a.title}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {a.date.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </td>
                  <td className="py-2 pr-4">{a.photoUrl ? "Yes" : "—"}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/achievements/${a._id.toString()}/edit`}
                      aria-label={`Edit "${a.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={a._id.toString()}
                      label={a.title}
                      endpoint="/api/admin/achievements"
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

With `npm run dev` running and logged in as admin, visit `/admin/dashboard/achievements`. Expect "No achievements yet." and a working "+ New" link (404 for now — built in Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/achievements/page.tsx
git commit -m "feat: add admin achievements list page"
```

---

### Task 6: Admin form + `new` page

**Files:**
- Create: `src/app/admin/dashboard/achievements/AchievementForm.tsx`
- Create: `src/app/admin/dashboard/achievements/new/page.tsx`

**Context:** Same structure as `src/app/admin/dashboard/announcements/AnnouncementForm.tsx` (FormData submission, controlled inputs, photo replace/remove UI), with a `date` input added and the image field renamed `photo`/`photoUrl` (matching Teachers' naming for a subject-specific photo, as decided in the design spec).

- [ ] **Step 1: Create the form component**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface AchievementFormProps {
  mode: "create" | "edit";
  achievementId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialDate?: string;
  initialPhotoUrl?: string | null;
}

export default function AchievementForm({
  mode,
  achievementId,
  initialTitle = "",
  initialDescription = "",
  initialDate = "",
  initialPhotoUrl = null,
}: AchievementFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(initialDate);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    if (removePhoto) {
      formData.set("removePhoto", "true");
    }

    try {
      const url =
        mode === "create" ? "/api/admin/achievements" : `/api/admin/achievements/${achievementId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard/achievements");
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
          name="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-navy">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-navy">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="photo" className="block text-sm font-medium text-navy">
          Photo {mode === "edit" && !removePhoto && "(leave blank to keep current)"}
        </label>
        {mode === "edit" && initialPhotoUrl && !removePhoto && (
          <div className="mt-2 flex items-center gap-3">
            <Image
              src={initialPhotoUrl}
              alt=""
              width={64}
              height={64}
              className="rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setRemovePhoto(true)}
              className="text-sm text-maroon hover:underline"
            >
              Remove photo
            </button>
          </div>
        )}
        {mode === "edit" && removePhoto && (
          <p className="mt-2 text-sm text-maroon">
            Photo will be removed on save.{" "}
            <button type="button" onClick={() => setRemovePhoto(false)} className="underline">
              Undo
            </button>
          </p>
        )}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="photo-hint"
          className="mt-1 w-full text-sm"
        />
        <p id="photo-hint" className="mt-1 text-xs text-gray-500">
          JPEG, PNG, or WebP, max 5MB
        </p>
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
          onClick={() => router.push("/admin/dashboard/achievements")}
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
import AchievementForm from "../AchievementForm";

export default function NewAchievementPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Achievement</h1>
      <AchievementForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

With `npm run dev` running, visit `/admin/dashboard/achievements/new`, create a test achievement ("ZZZ Test Achievement", a description, some date, optionally a photo), submit, confirm redirect to the list and the new row appears.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/dashboard/achievements/AchievementForm.tsx src/app/admin/dashboard/achievements/new/page.tsx
git commit -m "feat: add admin create-achievement page"
```

---

### Task 7: Admin edit page

**Files:**
- Create: `src/app/admin/dashboard/achievements/[id]/edit/page.tsx`

**Context:** Same pattern as `src/app/admin/dashboard/announcements/[id]/edit/page.tsx`, converting the stored `Date` to a `YYYY-MM-DD` string for the date input via `.toISOString().slice(0, 10)` — safe here for the same reason it's safe in the Calendar module (dates are always UTC midnight, coming from a `<input type="date">` value parsed via `new Date("YYYY-MM-DD")`).

- [ ] **Step 1: Create the edit page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";
import AchievementForm from "../../AchievementForm";

export const dynamic = "force-dynamic";

export default async function EditAchievementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const achievement = await Achievement.findById(id).lean();

  if (!achievement) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Achievement</h1>
      <AchievementForm
        mode="edit"
        achievementId={achievement._id.toString()}
        initialTitle={achievement.title}
        initialDescription={achievement.description}
        initialDate={achievement.date.toISOString().slice(0, 10)}
        initialPhotoUrl={achievement.photoUrl}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Edit the "ZZZ Test Achievement" from Task 6 — change its title, save, confirm the change shows in the admin list.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/dashboard/achievements/[id]/edit/page.tsx"
git commit -m "feat: add admin edit-achievement page"
```

---

### Task 8: Public `/achievements` grid page

**Files:**
- Create: `src/app/achievements/page.tsx`

**Context:** Follows the Teachers module's grid layout (`src/app/teachers/page.tsx`) but without an initials-avatar fallback — an achievement card with no photo just shows text, which reads fine for an accolades list (unlike a staff directory where a person-shaped placeholder matters). No auth, `force-dynamic`, no pagination (a flat grid sorted by `date` descending is sufficient per the design spec — this module explicitly does not need Announcements' pagination, since achievements are expected to accumulate far more slowly than announcements).

- [ ] **Step 1: Create the page**

```tsx
import Image from "next/image";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Achievements — MLC",
  description: "Awards, honors, and accomplishments at Modernistic Learning Community.",
};

export default async function AchievementsPage() {
  await connectToDatabase();
  const achievements = await Achievement.find().sort({ date: -1 }).lean();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Achievements</h1>
      {achievements.length === 0 ? (
        <p className="text-gray-600">No achievements to show yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <article key={a._id.toString()} className="rounded-lg border border-gray-200 p-6">
              {a.photoUrl && (
                <Image
                  src={a.photoUrl}
                  alt={a.title}
                  width={400}
                  height={225}
                  className="mb-4 w-full rounded object-cover"
                />
              )}
              <h2 className="text-lg font-semibold text-navy">{a.title}</h2>
              <p className="mt-1 text-sm text-maroon">
                {a.date.toLocaleDateString(undefined, { timeZone: "UTC" })}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.description}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

With `npm run dev` running, visit `/achievements` (no login needed). Expect the "ZZZ Test Achievement" from earlier to appear in the grid, with or without a photo depending on what was set.

- [ ] **Step 3: Commit**

```bash
git add src/app/achievements/page.tsx
git commit -m "feat: add public achievements grid page"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass — confirm the actual count (should be the prior 189 plus this module's new tests: 6 model + 8 create-route + 9 update/delete-route = 23 new, expect 212 total).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run a production build**

Run: `npm run build`
Expected: succeeds, route table includes `/achievements`, `/admin/dashboard/achievements`, `/admin/dashboard/achievements/new`, `/admin/dashboard/achievements/[id]/edit`, `/api/admin/achievements`, `/api/admin/achievements/[id]`.

- [ ] **Step 5: Full manual smoke test**

With local MongoDB running and `npm run dev` started, logged in as admin, using throwaway "ZZZ Test" prefixed achievements (delete them all when done):

1. Create an achievement with a photo — appears in admin list and on the public grid with the photo rendered.
2. Create an achievement without a photo — appears correctly in both places, no broken image icon, card just shows text.
3. Edit an achievement's title/description/date — reflected in both admin list and public page.
4. Edit an achievement to replace its photo — old file gone from `public/uploads/achievements/`, new one present, public page shows the new photo.
5. Edit an achievement to remove its photo — photo gone from both DB record and disk, public page card shows text only.
6. Edit an achievement with an invalid calendar date (e.g. try to submit `2026-02-30` — note the HTML date picker likely won't let you type this directly; verify via a direct API call instead if needed) — rejected cleanly, no partial save.
7. Delete an achievement — gone from admin list and public page, its photo file (if any) removed from disk.
8. Create two achievements with different dates, confirm the public grid and admin list both show the most recent `date` first (not creation order — create the older-dated one second, confirm it still sorts correctly by its `date` field, not by when it was entered).
9. Log out, then `curl -X POST http://localhost:3000/api/admin/achievements` (no cookie) — expect 401 JSON.
10. Visit `/achievements` while logged out — works fine (public page, no auth required).

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip this step if nothing needed fixing.)
