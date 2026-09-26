# Careers Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-managed job postings with an on-site public application form (name/email/phone/PDF resume/cover note), per `docs/superpowers/specs/2026-09-27-careers-module-design.md`.

**Architecture:** Two related resources — `JobPosting` (admin-authored, same CRUD shape as every prior content module) and `Application` (publicly submitted, referencing a posting). This module introduces two genuinely new things to the codebase: the site's first **unauthenticated public write endpoint** (`POST /api/careers/[id]/apply`), and its first **private** file storage (resumes live outside `public/`, served only through an authenticated admin download route). Everything else follows established patterns exactly (proxy-based auth, zod-matches-Mongoose validation, `isValidObjectId` guards, fetch-then-`.save()` updates, save-then-cleanup file ordering).

**Naming note vs. the spec doc:** the spec calls the resume field `resumeUrl`; this plan uses `resumeFilename` instead, since the stored value is a private filename (e.g. `<uuid>.pdf`), never a servable URL — the more accurate name avoids anyone later assuming it can be used as an `<img src>`/`<a href>` directly.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose ^8.x, zod, Tailwind v4, Jest + `mongodb-memory-server`.

---

### Task 1: `JobPosting` model

**Files:**
- Create: `src/models/JobPosting.ts`
- Test: `src/models/__tests__/JobPosting.test.ts`

**Context:** Same shape as `src/models/CalendarEvent.ts` — a simple schema with a fixed-enum status field.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";

describe("JobPosting model", () => {
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

  it("creates a valid posting, defaulting status to Open", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    const posting = await JobPosting.create({
      title: "Math Teacher",
      description: "Teach middle school math.",
    });

    expect(posting.title).toBe("Math Teacher");
    expect(posting.status).toBe("Open");
    expect(posting.requirements).toBe("");
  });

  it("creates a posting with an explicit Closed status", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    const posting = await JobPosting.create({
      title: "Old Posting",
      description: "No longer needed.",
      status: "Closed",
    });

    expect(posting.status).toBe("Closed");
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(
      JobPosting.create({ description: "No title here." }),
    ).rejects.toThrow();
  });

  it("rejects a missing description", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(JobPosting.create({ title: "No Description" })).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(
      JobPosting.create({
        title: "Bad Status",
        description: "x",
        status: "Pending",
      }),
    ).rejects.toThrow();
  });

  it("rejects a title over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");

    await expect(
      JobPosting.create({ title: "a".repeat(201), description: "x" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/JobPosting.test.ts`
Expected: FAIL — `Cannot find module '@/models/JobPosting'`

- [ ] **Step 3: Implement the model**

```typescript
import mongoose, { Schema, type Document, type Model } from "mongoose";

export type JobPostingStatus = "Open" | "Closed";

export interface IJobPosting extends Document {
  title: string;
  description: string;
  requirements: string;
  status: JobPostingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const jobPostingSchema = new Schema<IJobPosting>(
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
      maxlength: 5000,
    },
    requirements: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      required: true,
      enum: ["Open", "Closed"],
      default: "Open",
    },
  },
  { timestamps: true },
);

export const JobPosting: Model<IJobPosting> =
  mongoose.models.JobPosting ?? mongoose.model<IJobPosting>("JobPosting", jobPostingSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/JobPosting.test.ts`
Expected: PASS, 6/6 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/JobPosting.ts src/models/__tests__/JobPosting.test.ts
git commit -m "feat: add JobPosting model"
```

---

### Task 2: `Application` model

**Files:**
- Create: `src/models/Application.ts`
- Test: `src/models/__tests__/Application.test.ts`

**Context:** References `JobPosting` via `postingId`. `resumeFilename` stores just a filename (e.g. `<uuid>.pdf`) — the actual file lives in a private directory handled by `src/lib/resumeUpload.ts` (Task 3), not under this model's concern. No Mongoose-level email-format validation here — that's zod's job at the API boundary (Task 9); the model only enforces presence/length, consistent with how other models in this codebase treat string fields.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";

describe("Application model", () => {
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

  it("creates a valid application", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");

    const posting = await JobPosting.create({ title: "Math Teacher", description: "x" });

    const application = await Application.create({
      postingId: posting._id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
    });

    expect(application.name).toBe("Jane Doe");
    expect(application.coverNote).toBe("");
    expect(application.submittedAt).toBeInstanceOf(Date);
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    await expect(
      Application.create({
        postingId: posting._id,
        email: "jane@example.com",
        phone: "123",
        resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing resumeFilename", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    await expect(
      Application.create({
        postingId: posting._id,
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing postingId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Application } = require("@/models/Application");

    await expect(
      Application.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      }),
    ).rejects.toThrow();
  });

  it("rejects a name over 200 characters", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    await expect(
      Application.create({
        postingId: posting._id,
        name: "a".repeat(201),
        email: "jane@example.com",
        phone: "123",
        resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/Application.test.ts`
Expected: FAIL — `Cannot find module '@/models/Application'`

- [ ] **Step 3: Implement the model**

```typescript
import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IApplication extends Document {
  postingId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  resumeFilename: string;
  coverNote: string;
  submittedAt: Date;
}

const applicationSchema = new Schema<IApplication>({
  postingId: {
    type: Schema.Types.ObjectId,
    ref: "JobPosting",
    required: true,
  },
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
  resumeFilename: {
    type: String,
    required: true,
  },
  coverNote: {
    type: String,
    default: "",
    trim: true,
    maxlength: 2000,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Application: Model<IApplication> =
  mongoose.models.Application ?? mongoose.model<IApplication>("Application", applicationSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/Application.test.ts`
Expected: PASS, 5/5 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/Application.ts src/models/__tests__/Application.test.ts
git commit -m "feat: add Application model"
```

---

### Task 3: Private resume storage (`resumeUpload.ts`)

**Files:**
- Create: `src/lib/resumeUpload.ts`
- Test: `src/lib/__tests__/resumeUpload.test.ts`
- Modify: `.gitignore`

**Context:** Sibling to `src/lib/imageUpload.ts`, but stores files **outside** `public/` — in `uploads-private/resumes/` at the project root — so Next.js never serves them as static files. Validation is PDF-magic-byte-only (`%PDF-` signature), matching `imageUpload.ts`'s approach of trusting file content over client-supplied MIME/filename. Three functions: save (validates + writes, returns a bare filename), read (for the admin download route), delete (for cleanup on application/posting deletion).

- [ ] **Step 1: Add the private uploads directory to `.gitignore`**

Find the existing uploads exclusion:

```
# user-uploaded content (local filesystem storage for dev; not source)
/public/uploads/
```

Change to:

```
# user-uploaded content (local filesystem storage for dev; not source)
/public/uploads/
/uploads-private/
```

- [ ] **Step 2: Write the failing test**

```typescript
import { readFile as fsReadFile, rm } from "fs/promises";
import path from "path";

const PDF_BYTES = Buffer.from("%PDF-1.4\n%test resume content\n");
const NOT_PDF_BYTES = Buffer.from("just some text, not a pdf");

const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private");

describe("resumeUpload", () => {
  afterEach(async () => {
    await rm(PRIVATE_ROOT, { recursive: true, force: true });
  });

  describe("validateAndSaveResume", () => {
    it("saves a valid PDF and returns a UUID-based filename", async () => {
      const { validateAndSaveResume } = require("@/lib/resumeUpload");
      const file = new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" });

      const filename = await validateAndSaveResume(file);

      expect(filename).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      const saved = await fsReadFile(path.join(PRIVATE_ROOT, "resumes", filename));
      expect(saved.equals(PDF_BYTES)).toBe(true);
    });

    it("rejects a file that isn't actually a PDF, regardless of claimed type", async () => {
      const { validateAndSaveResume, ResumeValidationError } = require("@/lib/resumeUpload");
      const file = new File([NOT_PDF_BYTES], "resume.pdf", { type: "application/pdf" });

      await expect(validateAndSaveResume(file)).rejects.toThrow(ResumeValidationError);
    });

    it("rejects a file over 5MB", async () => {
      const { validateAndSaveResume, ResumeValidationError } = require("@/lib/resumeUpload");
      const bigBytes = Buffer.concat([PDF_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
      const file = new File([bigBytes], "resume.pdf", { type: "application/pdf" });

      await expect(validateAndSaveResume(file)).rejects.toThrow(ResumeValidationError);
    });
  });

  describe("readResumeFile", () => {
    it("reads back a saved resume", async () => {
      const { validateAndSaveResume, readResumeFile } = require("@/lib/resumeUpload");
      const file = new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" });
      const filename = await validateAndSaveResume(file);

      const buffer = await readResumeFile(filename);
      expect(buffer.equals(PDF_BYTES)).toBe(true);
    });

    it("rejects a filename that doesn't match the expected UUID.pdf shape", async () => {
      const { readResumeFile, ResumeValidationError } = require("@/lib/resumeUpload");

      await expect(readResumeFile("../../etc/passwd")).rejects.toThrow(ResumeValidationError);
      await expect(readResumeFile("not-a-uuid.pdf")).rejects.toThrow(ResumeValidationError);
    });
  });

  describe("deleteResumeFile", () => {
    it("deletes a saved resume", async () => {
      const { validateAndSaveResume, deleteResumeFile, readResumeFile } = require("@/lib/resumeUpload");
      const file = new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" });
      const filename = await validateAndSaveResume(file);

      await deleteResumeFile(filename);

      await expect(readResumeFile(filename)).rejects.toThrow();
    });

    it("does not throw when deleting a non-existent file", async () => {
      const { deleteResumeFile } = require("@/lib/resumeUpload");
      await expect(
        deleteResumeFile("22222222-2222-2222-2222-222222222222.pdf"),
      ).resolves.not.toThrow();
    });

    it("silently no-ops for a malformed filename rather than deleting arbitrary paths", async () => {
      const { deleteResumeFile } = require("@/lib/resumeUpload");
      await expect(deleteResumeFile("../../etc/passwd")).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/resumeUpload.test.ts`
Expected: FAIL — `Cannot find module '@/lib/resumeUpload'`

- [ ] **Step 4: Implement `resumeUpload.ts`**

```typescript
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Deliberately outside `public/` — see src/lib/imageUpload.ts for the
// sibling pattern used for public images. A resume contains applicant PII
// and must only ever be reachable through the authenticated admin download
// route, never as a static file Next.js would otherwise serve directly.
const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private", "resumes");

const FILENAME_RE = /^[0-9a-f-]{36}\.pdf$/;

export class ResumeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeValidationError";
  }
}

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
}

export async function validateAndSaveResume(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new ResumeValidationError("Resume exceeds 5MB limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!isPdf(buffer)) {
    throw new ResumeValidationError("Resume must be a PDF file");
  }

  const filename = `${randomUUID()}.pdf`;
  await mkdir(PRIVATE_ROOT, { recursive: true });
  await writeFile(path.join(PRIVATE_ROOT, filename), buffer);

  return filename;
}

export async function readResumeFile(filename: string): Promise<Buffer> {
  if (!FILENAME_RE.test(filename)) {
    throw new ResumeValidationError("Invalid resume filename");
  }
  return readFile(path.join(PRIVATE_ROOT, filename));
}

export async function deleteResumeFile(filename: string): Promise<void> {
  if (!FILENAME_RE.test(filename)) {
    return;
  }
  try {
    await unlink(path.join(PRIVATE_ROOT, filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/resumeUpload.test.ts`
Expected: PASS, 8/8 tests

- [ ] **Step 6: Commit**

```bash
git add .gitignore src/lib/resumeUpload.ts src/lib/__tests__/resumeUpload.test.ts
git commit -m "feat: add private resume storage with PDF validation"
```

---

### Task 4: `POST /api/admin/careers` (create posting)

**Files:**
- Create: `src/app/api/admin/careers/route.ts`
- Test: `src/app/api/admin/careers/__tests__/route.test.ts`

**Context:** Plain JSON body (no file), mirrors `src/app/api/admin/calendar/route.ts`'s shape exactly.

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("POST /api/admin/careers", () => {
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
    return new NextRequest("http://localhost/api/admin/careers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a posting, defaulting requirements to empty", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/careers/route");

    const res = await POST(
      makeRequest({ title: "Math Teacher", description: "Teach math.", status: "Open" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { JobPosting } = require("@/models/JobPosting");
    const saved = await JobPosting.findById(data.id);
    expect(saved.title).toBe("Math Teacher");
    expect(saved.requirements).toBe("");
  });

  it("creates a posting with explicit requirements", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/careers/route");

    const res = await POST(
      makeRequest({
        title: "Physics Teacher",
        description: "Teach physics.",
        requirements: "BSc in Physics",
        status: "Open",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { JobPosting } = require("@/models/JobPosting");
    const saved = await JobPosting.findById(data.id);
    expect(saved.requirements).toBe("BSc in Physics");
  });

  it("rejects a missing title", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const res = await POST(makeRequest({ description: "x", status: "Open" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing description", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const res = await POST(makeRequest({ title: "x", status: "Open" }));
    expect(res.status).toBe(400);
  });

  it("rejects a status outside the fixed enum", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const res = await POST(
      makeRequest({ title: "x", description: "x", status: "Pending" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const request = new NextRequest("http://localhost/api/admin/careers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/careers/route");
    const request = new NextRequest("http://localhost/api/admin/careers", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(100 * 1024 + 1) },
      body: JSON.stringify({ title: "x", description: "x", status: "Open" }),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/careers/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/admin/careers/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";

const jobPostingFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required").max(5000, "Description is too long"),
  requirements: z.string().max(5000, "Requirements is too long").optional(),
  status: z.enum(["Open", "Closed"]),
});

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

  const parsed = jobPostingFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const posting = await JobPosting.create({
    title: parsed.data.title,
    description: parsed.data.description,
    requirements: parsed.data.requirements ?? "",
    status: parsed.data.status,
  });

  return NextResponse.json({ id: posting._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/careers/__tests__/route.test.ts`
Expected: PASS, 7/7 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/careers/route.ts src/app/api/admin/careers/__tests__/route.test.ts
git commit -m "feat: add POST /api/admin/careers"
```

---

### Task 5: `PUT` / `DELETE /api/admin/careers/[id]`

**Files:**
- Create: `src/app/api/admin/careers/[id]/route.ts`
- Test: `src/app/api/admin/careers/[id]/__tests__/route.test.ts`

**Context:** PUT follows the fetch-then-`.save()` pattern used everywhere else. DELETE is the one place this module makes a deliberate choice beyond precedent: deleting a posting **cascades** to delete all of its `Application` records and their resume files first. This is why postings have an Open/Closed status at all — closing is the normal end-of-life path that preserves application history; deleting is for correcting a mistake (e.g. a posting created by accident), and when that happens, its applications (which reference a now-gone posting) and their resume files (undeletable PII with no other cleanup path) must go with it.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/admin/careers/\[id\]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '@/app/api/admin/careers/[id]/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import { deleteResumeFile } from "@/lib/resumeUpload";

const jobPostingFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required").max(5000, "Description is too long"),
  requirements: z.string().max(5000, "Requirements is too long").optional(),
  status: z.enum(["Open", "Closed"]),
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
    return NextResponse.json({ error: "Invalid posting id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jobPostingFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const existing = await JobPosting.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  existing.title = parsed.data.title;
  existing.description = parsed.data.description;
  existing.requirements = parsed.data.requirements ?? "";
  existing.status = parsed.data.status;
  await existing.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid posting id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await JobPosting.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  // Cascade: an Application whose postingId points at nothing is useless,
  // and an orphaned resume file would be undeletable applicant PII with no
  // UI path to ever clean it up. This is why postings normally get closed
  // rather than deleted — delete is for correcting a mistake.
  const applications = await Application.find({ postingId: id });
  for (const application of applications) {
    await deleteResumeFile(application.resumeFilename);
  }
  await Application.deleteMany({ postingId: id });
  await JobPosting.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/admin/careers/\[id\]/__tests__/route.test.ts"`
Expected: PASS, 7/7 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/careers/[id]/route.ts" "src/app/api/admin/careers/[id]/__tests__/route.test.ts"
git commit -m "feat: add PUT/DELETE /api/admin/careers/[id] with cascading application delete"
```

---

### Task 6: Admin postings list page

**Files:**
- Modify: `src/app/admin/dashboard/careers/page.tsx` (currently a `ComingSoon` placeholder)

**Context:** Same shape as `src/app/admin/dashboard/calendar/page.tsx`, plus a per-posting application count (a small `Promise.all` of `countDocuments` calls — fine at this scale, same reasoning already accepted for other unbounded `find()` calls in this codebase) that links to that posting's applications page (built in Task 13).

- [ ] **Step 1: Replace the placeholder**

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function CareersAdminPage() {
  await connectToDatabase();
  const postings = await JobPosting.find().sort({ createdAt: -1 }).lean();

  const rows = await Promise.all(
    postings.map(async (p) => ({
      id: p._id.toString(),
      title: p.title,
      status: p.status,
      applicationCount: await Application.countDocuments({ postingId: p._id }),
    })),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Careers</h1>
        <Link
          href="/admin/dashboard/careers/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-600">No postings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4">
                  Applications
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.status}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    <Link
                      href={`/admin/dashboard/careers/${r.id}/applications`}
                      className="text-navy hover:underline"
                    >
                      {r.applicationCount}
                    </Link>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/careers/${r.id}/edit`}
                      aria-label={`Edit "${r.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton id={r.id} label={r.title} endpoint="/api/admin/careers" />
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

With `npm run dev` running and logged in as admin, visit `/admin/dashboard/careers`. Expect "No postings yet." and a working "+ New" link (404 for now — built in Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/careers/page.tsx
git commit -m "feat: add admin careers postings list page"
```

---

### Task 7: Admin posting form + `new` page

**Files:**
- Create: `src/app/admin/dashboard/careers/JobPostingForm.tsx`
- Create: `src/app/admin/dashboard/careers/new/page.tsx`

**Context:** Same structure as `src/app/admin/dashboard/calendar/CalendarEventForm.tsx` (JSON body, controlled inputs), with a status dropdown instead of a category dropdown, and two textareas (description, requirements) instead of date inputs.

- [ ] **Step 1: Create the form component**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface JobPostingFormProps {
  mode: "create" | "edit";
  postingId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialRequirements?: string;
  initialStatus?: "Open" | "Closed";
}

export default function JobPostingForm({
  mode,
  postingId,
  initialTitle = "",
  initialDescription = "",
  initialRequirements = "",
  initialStatus = "Open",
}: JobPostingFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [status, setStatus] = useState<"Open" | "Closed">(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const body = { title, description, requirements, status };

    try {
      const url = mode === "create" ? "/api/admin/careers" : `/api/admin/careers/${postingId}`;
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

      router.push("/admin/dashboard/careers");
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
        <label htmlFor="description" className="block text-sm font-medium text-navy">
          Description
        </label>
        <textarea
          id="description"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="requirements" className="block text-sm font-medium text-navy">
          Requirements <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="requirements"
          rows={4}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-navy">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "Open" | "Closed")}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        >
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
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
          onClick={() => router.push("/admin/dashboard/careers")}
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
import JobPostingForm from "../JobPostingForm";

export default function NewJobPostingPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Job Posting</h1>
      <JobPostingForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

With `npm run dev` running, visit `/admin/dashboard/careers/new`, create a test posting ("ZZZ Test Posting", some description, status Open), submit, confirm redirect to the list and the new row appears.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/dashboard/careers/JobPostingForm.tsx src/app/admin/dashboard/careers/new/page.tsx
git commit -m "feat: add admin create-job-posting page"
```

---

### Task 8: Admin edit page

**Files:**
- Create: `src/app/admin/dashboard/careers/[id]/edit/page.tsx`

**Context:** Same pattern as `src/app/admin/dashboard/calendar/[id]/edit/page.tsx`.

- [ ] **Step 1: Create the edit page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import JobPostingForm from "../../JobPostingForm";

export const dynamic = "force-dynamic";

export default async function EditJobPostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const posting = await JobPosting.findById(id).lean();

  if (!posting) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Job Posting</h1>
      <JobPostingForm
        mode="edit"
        postingId={posting._id.toString()}
        initialTitle={posting.title}
        initialDescription={posting.description}
        initialRequirements={posting.requirements}
        initialStatus={posting.status}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Edit the "ZZZ Test Posting" from Task 7 — change its title, save, confirm the change shows in the admin list.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/dashboard/careers/[id]/edit/page.tsx"
git commit -m "feat: add admin edit-job-posting page"
```

---

### Task 9: `POST /api/careers/[id]/apply` — the public application endpoint

**Files:**
- Create: `src/app/api/careers/[id]/apply/route.ts`
- Test: `src/app/api/careers/[id]/apply/__tests__/route.test.ts`

**Context:** This is the site's only unauthenticated write endpoint — it is NOT under `/api/admin/`, so `src/proxy.ts`'s matcher does not (and must not) protect it. Everything here needs to assume a hostile, unauthenticated caller: strict validation, no trust in client-declared file type, and a rejection of applications to a closed or nonexistent posting (returns 404 for both, uniformly, so a caller can't distinguish "never existed" from "exists but closed"). Uses `FormData` (not JSON) because it carries a file. Save-then-cleanup ordering: if the DB write fails after the resume file is already saved, the orphaned file is deleted (same rollback pattern used in `src/app/api/admin/teachers/route.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { rm } from "fs/promises";
import path from "path";

const PDF_BYTES = Buffer.from("%PDF-1.4\ntest resume content");

describe("POST /api/careers/[id]/apply", () => {
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/careers/\[id\]/apply/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '@/app/api/careers/[id]/apply/route'`

- [ ] **Step 3: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import { validateAndSaveResume, deleteResumeFile, ResumeValidationError } from "@/lib/resumeUpload";

const applicationFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  coverNote: z.string().max(2000, "Cover note is too long").optional(),
});

// The only unauthenticated write endpoint in the app. The cap covers a
// resume (up to 5MB, enforced again inside validateAndSaveResume) plus
// form-field overhead — not the same constant as the admin JSON routes'
// 100KB text-only cap.
const MAX_REQUEST_SIZE = 6 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = applicationFieldsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    coverNote: formData.get("coverNote") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  const resumeFile = formData.get("resume");
  if (!(resumeFile instanceof File) || resumeFile.size === 0) {
    return NextResponse.json({ error: "A resume file is required" }, { status: 400 });
  }

  await connectToDatabase();
  const posting = await JobPosting.findById(id);
  if (!posting || posting.status !== "Open") {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  let resumeFilename: string;
  try {
    resumeFilename = await validateAndSaveResume(resumeFile);
  } catch (err) {
    if (err instanceof ResumeValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    await Application.create({
      postingId: id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      resumeFilename,
      coverNote: parsed.data.coverNote ?? "",
    });
  } catch (err) {
    await deleteResumeFile(resumeFilename);
    throw err;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/careers/\[id\]/apply/__tests__/route.test.ts"`
Expected: PASS, 10/10 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/careers/[id]/apply/route.ts" "src/app/api/careers/[id]/apply/__tests__/route.test.ts"
git commit -m "feat: add public POST /api/careers/[id]/apply"
```

---

### Task 10: Public `/careers` list page

**Files:**
- Create: `src/app/careers/page.tsx`

**Context:** Lists only `status: "Open"` postings — closed ones simply don't appear (no placeholder needed). No auth, `force-dynamic`, matching every other public page in this app.

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Careers — MLC",
  description: "Open positions at Modernistic Learning Community.",
};

export default async function CareersPage() {
  await connectToDatabase();
  const postings = await JobPosting.find({ status: "Open" }).sort({ createdAt: -1 }).lean();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Careers</h1>
      {postings.length === 0 ? (
        <p className="text-gray-600">No open positions right now.</p>
      ) : (
        <ul className="space-y-4">
          {postings.map((p) => (
            <li key={p._id.toString()} className="rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-navy">
                <Link href={`/careers/${p._id.toString()}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-gray-700">{p.description}</p>
              <Link
                href={`/careers/${p._id.toString()}`}
                className="mt-3 inline-block text-sm text-maroon hover:underline"
              >
                View details & apply →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

With `npm run dev` running, visit `/careers` (no login needed). Expect the "ZZZ Test Posting" from Task 7 to appear (if its status is Open).

- [ ] **Step 3: Commit**

```bash
git add src/app/careers/page.tsx
git commit -m "feat: add public careers list page"
```

---

### Task 11: Public posting detail page + application form

**Files:**
- Create: `src/app/careers/[id]/page.tsx`
- Create: `src/app/careers/[id]/ApplicationForm.tsx`

**Context:** The detail page is a server component; `notFound()`s for a malformed id, a missing posting, or a `Closed` posting (closed postings are unreachable here too, not just hidden from the list — direct navigation to an old link for a now-closed posting should behave the same as if it never existed). The form is a small client component since it needs `useState` for the submitted/error/loading states, and submits `FormData` (not JSON) because it includes a file — POSTing directly to the Task 9 endpoint.

- [ ] **Step 1: Create the application form component**

```tsx
"use client";

import { useState, type FormEvent } from "react";

export default function ApplicationForm({ postingId }: { postingId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch(`/api/careers/${postingId}/apply`, {
        method: "POST",
        body: formData,
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
    return <p className="text-navy">Thanks — your application has been submitted.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
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
        <label htmlFor="resume" className="block text-sm font-medium text-navy">
          Resume (PDF)
        </label>
        <input
          id="resume"
          name="resume"
          type="file"
          accept="application/pdf"
          required
          className="mt-1 w-full text-sm"
        />
      </div>
      <div>
        <label htmlFor="coverNote" className="block text-sm font-medium text-navy">
          Cover note <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="coverNote"
          name="coverNote"
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
        {loading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the detail page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import ApplicationForm from "./ApplicationForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return { title: "Careers — MLC" };
  }
  await connectToDatabase();
  const posting = await JobPosting.findById(id).lean();
  return { title: posting ? `${posting.title} — Careers — MLC` : "Careers — MLC" };
}

export default async function JobPostingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const posting = await JobPosting.findById(id).lean();

  if (!posting || posting.status !== "Open") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-navy">{posting.title}</h1>
      <div className="mt-6 whitespace-pre-wrap text-gray-700">{posting.description}</div>
      {posting.requirements && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-navy">Requirements</h2>
          <div className="mt-2 whitespace-pre-wrap text-gray-700">{posting.requirements}</div>
        </div>
      )}
      <div className="mt-10 border-t border-gray-200 pt-8">
        <h2 className="mb-4 text-lg font-semibold text-navy">Apply</h2>
        <ApplicationForm postingId={posting._id.toString()} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Visit `/careers/<id>` for the "ZZZ Test Posting" — page shows title/description/requirements and the application form. Submit a real small PDF with the required fields — confirm the "Thanks — your application has been submitted" message replaces the form, and no error appears.

- [ ] **Step 4: Commit**

```bash
git add src/app/careers/[id]/page.tsx "src/app/careers/[id]/ApplicationForm.tsx"
git commit -m "feat: add public job posting detail page and application form"
```

---

### Task 12: Admin applications API (list, delete, resume download)

**Files:**
- Create: `src/app/api/admin/careers/[id]/applications/route.ts` (GET — list applications for a posting)
- Create: `src/app/api/admin/careers/applications/[id]/route.ts` (DELETE — one application)
- Create: `src/app/api/admin/careers/applications/[id]/resume/route.ts` (GET — stream the resume file)
- Test: `src/app/api/admin/careers/[id]/applications/__tests__/route.test.ts`
- Test: `src/app/api/admin/careers/applications/[id]/__tests__/route.test.ts`

**Context:** All three are covered by `proxy.ts`'s existing `/api/admin/:path*` matcher — no new auth code needed. The resume-download route is the most security-sensitive file in this module: it must never be reachable without going through the proxy, which it automatically is by virtue of its path.

- [ ] **Step 1: Write the failing tests**

`src/app/api/admin/careers/[id]/applications/__tests__/route.test.ts`:

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

describe("GET /api/admin/careers/[id]/applications", () => {
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

  it("lists applications for a posting, newest first", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const posting = await JobPosting.create({ title: "x", description: "x" });
    await Application.create({
      postingId: posting._id,
      name: "First",
      email: "a@example.com",
      phone: "1",
      resumeFilename: "11111111-1111-1111-1111-111111111111.pdf",
      submittedAt: new Date("2026-01-01"),
    });
    await Application.create({
      postingId: posting._id,
      name: "Second",
      email: "b@example.com",
      phone: "2",
      resumeFilename: "22222222-2222-2222-2222-222222222222.pdf",
      submittedAt: new Date("2026-02-01"),
    });

    const { GET } = require("@/app/api/admin/careers/[id]/applications/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/careers/${posting._id.toString()}/applications`),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toHaveLength(2);
    expect(data.applications[0].name).toBe("Second");
  });

  it("returns 400 for a malformed posting id", async () => {
    const { GET } = require("@/app/api/admin/careers/[id]/applications/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/careers/not-an-id/applications"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns an empty list for a posting with no applications", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const posting = await JobPosting.create({ title: "x", description: "x" });

    const { GET } = require("@/app/api/admin/careers/[id]/applications/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/careers/${posting._id.toString()}/applications`),
      { params: Promise.resolve({ id: posting._id.toString() }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toEqual([]);
  });
});
```

`src/app/api/admin/careers/applications/[id]/__tests__/route.test.ts`:

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { readFile, rm } from "fs/promises";
import path from "path";

describe("DELETE /api/admin/careers/applications/[id] and GET .../resume", () => {
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

  async function createApplicationWithResume() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { JobPosting } = require("@/models/JobPosting");
    const { Application } = require("@/models/Application");
    const { validateAndSaveResume } = require("@/lib/resumeUpload");

    const posting = await JobPosting.create({ title: "x", description: "x" });
    const pdfFile = new File([Buffer.from("%PDF-1.4\ntest")], "r.pdf", { type: "application/pdf" });
    const resumeFilename = await validateAndSaveResume(pdfFile);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest "src/app/api/admin/careers/\[id\]/applications" "src/app/api/admin/careers/applications"`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement the routes**

`src/app/api/admin/careers/[id]/applications/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid posting id" }, { status: 400 });
  }

  await connectToDatabase();
  const applications = await Application.find({ postingId: id })
    .sort({ submittedAt: -1 })
    .lean();

  return NextResponse.json({
    applications: applications.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      email: a.email,
      phone: a.phone,
      coverNote: a.coverNote,
      submittedAt: a.submittedAt.toISOString(),
    })),
  });
}
```

`src/app/api/admin/careers/applications/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { deleteResumeFile } from "@/lib/resumeUpload";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Application.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  await Application.deleteOne({ _id: id });
  await deleteResumeFile(existing.resumeFilename);

  return NextResponse.json({ success: true });
}
```

`src/app/api/admin/careers/applications/[id]/resume/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { readResumeFile } from "@/lib/resumeUpload";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const application = await Application.findById(id).lean();
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readResumeFile(application.resumeFilename);
  } catch {
    return NextResponse.json({ error: "Resume file not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resume.pdf"',
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest "src/app/api/admin/careers/\[id\]/applications" "src/app/api/admin/careers/applications"`
Expected: PASS, 3/3 + 5/5 tests (8 total)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/careers/[id]/applications" "src/app/api/admin/careers/applications"
git commit -m "feat: add admin applications list, delete, and resume download routes"
```

---

### Task 13: Admin applications page

**Files:**
- Create: `src/app/admin/dashboard/careers/[id]/applications/page.tsx`

**Context:** Reuses the existing shared `DeleteEntityButton` — no new button component needed, since `endpoint="/api/admin/careers/applications"` plus the application's own id is exactly the shape that component already expects. The resume download link is a plain `<a href>` (not a `fetch`+blob dance) — a same-origin navigation from within the authenticated admin dashboard carries the session cookie automatically, exactly like every other page in `/admin/dashboard/`.

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import DeleteEntityButton from "@/components/admin/DeleteEntityButton";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const posting = await JobPosting.findById(id).lean();
  if (!posting) {
    notFound();
  }

  const applications = await Application.find({ postingId: id })
    .sort({ submittedAt: -1 })
    .lean();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-navy">Applications</h1>
      <p className="mb-6 text-gray-600">{posting.title}</p>
      {applications.length === 0 ? (
        <p className="text-gray-600">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((a) => (
            <div key={a._id.toString()} className="rounded border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-navy">{a.name}</p>
                  <p className="text-sm text-gray-600">
                    {a.email} · {a.phone}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(a.submittedAt).toLocaleString(undefined, { timeZone: "UTC" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <a
                    href={`/api/admin/careers/applications/${a._id.toString()}/resume`}
                    className="text-navy hover:underline"
                  >
                    Download resume
                  </a>
                  <DeleteEntityButton
                    id={a._id.toString()}
                    label={a.name}
                    endpoint="/api/admin/careers/applications"
                  />
                </div>
              </div>
              {a.coverNote && <p className="mt-3 text-sm text-gray-700">{a.coverNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Visit `/admin/dashboard/careers`, click the application count for the "ZZZ Test Posting" (should show "1" after Task 11's manual test submission), confirm the applicant's details appear, click "Download resume" and confirm the PDF downloads, then delete the application and confirm it disappears and the count on the postings list goes back to 0.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/dashboard/careers/[id]/applications/page.tsx"
git commit -m "feat: add admin applications-per-posting page"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass — confirm the actual count.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run a production build**

Run: `npm run build`
Expected: succeeds, route table includes `/careers`, `/careers/[id]`, `/admin/dashboard/careers`, `/admin/dashboard/careers/new`, `/admin/dashboard/careers/[id]/edit`, `/admin/dashboard/careers/[id]/applications`, `/api/admin/careers`, `/api/admin/careers/[id]`, `/api/admin/careers/[id]/applications`, `/api/admin/careers/applications/[id]`, `/api/admin/careers/applications/[id]/resume`, `/api/careers/[id]/apply`.

- [ ] **Step 5: Full manual smoke test**

With local MongoDB running and `npm run dev` started, using a throwaway "ZZZ Test" prefixed posting (delete it and its applications when done — deleting the posting cascades, so one delete cleans up everything):

1. Log in as admin, create a posting ("ZZZ Test Posting", some description/requirements, status Open).
2. Visit `/careers` while logged out — the posting appears.
3. Visit `/careers/<id>` while logged out, fill out the application form with a real small PDF file (any PDF works, or create one with `printf '%%PDF-1.4\ntest' > /tmp/test-resume.pdf` and upload that), submit — confirm the "submitted" success message appears.
4. Log back in as admin, visit `/admin/dashboard/careers` — confirm the application count shows 1, click it.
5. On the applications page, confirm the applicant's name/email/phone/cover note (if any) are shown, click "Download resume" — confirm a PDF downloads with the right content.
6. Log out, then try to directly `curl http://localhost:3000/api/admin/careers/applications/<application-id>/resume` (no cookie) — expect 401 JSON, confirming the resume is NOT publicly reachable.
7. Log back in, edit the posting's status to Closed, save — confirm it disappears from `/careers` (check while logged out) but the posting and its application are still visible in the admin dashboard.
8. While logged out, try `curl -X POST` to `/api/careers/<closed-posting-id>/apply` with a valid form body — expect 404 (closed postings reject new applications even via direct API call).
9. Delete the application from the admin applications page — confirm it's gone and the resume file is removed from `uploads-private/resumes/` on disk (check the directory listing before/after).
10. Delete the posting itself — confirm it's gone from the admin list.
11. Log out; `curl -X POST http://localhost:3000/api/admin/careers` (no cookie) — expect 401 JSON. Same for `curl -X PUT`/`DELETE` on `/api/admin/careers/<any-id>` — all 401.
12. Confirm `POST /api/careers/<any-open-posting-id>/apply` works while logged out (it must — this is the intentionally public endpoint) by re-checking step 3 already covered this, so just confirm no regression: it should NOT require auth.

- [ ] **Step 6: Clean up test data**

Delete the "ZZZ Test Posting" (cascades to its application and resume file automatically per Task 5). Confirm `uploads-private/resumes/` has no leftover files and the DB has zero "ZZZ"-prefixed postings.

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip this step if nothing needed fixing.)
