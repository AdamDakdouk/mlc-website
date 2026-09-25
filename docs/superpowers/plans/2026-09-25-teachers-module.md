# Teachers Content Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin/dashboard/teachers` placeholder with real admin CRUD (create/edit/delete, photo upload, drag-and-drop manual ordering), and add a public `/teachers` page — the second Content Module, reusing and extending the Announcements module's patterns.

**Architecture:** Same as Announcements — Server Components for public/admin reads, API routes under `/api/admin/teachers` for writes (proxy already protects `/api/admin/:path*`, no proxy changes needed). One shared-infrastructure change: generalizes `src/lib/imageUpload.ts` to accept a `folder` parameter instead of hardcoding `"announcements"`, since it's now used by two modules.

**Tech Stack:** Same as Announcements — TypeScript, Next.js 16, MongoDB + Mongoose, zod, Jest + `mongodb-memory-server`. New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` for drag-and-drop reordering.

---

## Prerequisites

- Foundation & Admin Core and the Announcements module are merged to `master`, `npm test` passes (66 tests / 15 suites as of the Announcements merge).
- Local MongoDB running for manual testing.

---

### Task 1: Generalize the image upload utility and update Announcements' call sites

**Files:**
- Modify: `src/lib/imageUpload.ts`
- Modify: `src/lib/__tests__/imageUpload.test.ts`
- Modify: `src/app/api/admin/announcements/route.ts`
- Modify: `src/app/api/admin/announcements/[id]/route.ts`
- Modify: `src/app/api/admin/announcements/__tests__/route.test.ts`
- Modify: `src/app/api/admin/announcements/[id]/__tests__/route.test.ts`

**Why this is one task, not two:** changing `validateAndSaveImage`'s signature to require a `folder` argument breaks every existing call site immediately — leaving that broken between commits would mean the test suite is red until a second task lands. Doing the generalization and the caller updates atomically keeps every commit green.

- [ ] **Step 1: Write the failing/updated test for the generalized utility**

Replace the full contents of `src/lib/__tests__/imageUpload.test.ts` with:

```ts
import { unlink, access } from "fs/promises";
import path from "path";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const WEBP_BYTES = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("imageUpload", () => {
  const savedPaths: string[] = [];

  afterEach(async () => {
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  it("saves a valid JPEG under the given folder and returns its public URL", async () => {
    const file = makeFile(JPEG_BYTES, "photo.jpg", "image/jpeg");
    const url = await validateAndSaveImage(file, "announcements");
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.jpg$/);
  });

  it("saves a file under a different folder correctly", async () => {
    const file = makeFile(PNG_BYTES, "photo.png", "image/png");
    const url = await validateAndSaveImage(file, "teachers");
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/teachers\/[a-f0-9-]+\.png$/);
  });

  it("saves a valid WebP and returns its public URL", async () => {
    const file = makeFile(WEBP_BYTES, "photo.webp", "image/webp");
    const url = await validateAndSaveImage(file, "announcements");
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.webp$/);
  });

  it("rejects a file whose content isn't a recognized image format, regardless of claimed type", async () => {
    const file = makeFile([0x00, 0x01, 0x02, 0x03], "fake.jpg", "image/jpeg");
    await expect(validateAndSaveImage(file, "announcements")).rejects.toThrow(ImageValidationError);
  });

  it("rejects a file over 5MB", async () => {
    const bigBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    bigBytes.set(JPEG_BYTES);
    const file = new File([bigBytes], "big.jpg", { type: "image/jpeg" });
    await expect(validateAndSaveImage(file, "announcements")).rejects.toThrow(ImageValidationError);
  });

  it("deleteImageFile removes an existing file without error", async () => {
    const file = makeFile(JPEG_BYTES, "to-delete.jpg", "image/jpeg");
    const url = await validateAndSaveImage(file, "announcements");
    const filePath = path.join(process.cwd(), "public", url);

    await deleteImageFile(url);

    await expect(access(filePath)).rejects.toThrow();
  });

  it("deleteImageFile correctly deletes a file from a non-default folder", async () => {
    const file = makeFile(PNG_BYTES, "to-delete.png", "image/png");
    const url = await validateAndSaveImage(file, "teachers");
    const filePath = path.join(process.cwd(), "public", url);

    await deleteImageFile(url);

    await expect(access(filePath)).rejects.toThrow();
  });

  it("deleteImageFile does not throw when the file is already gone", async () => {
    await expect(
      deleteImageFile("/uploads/announcements/does-not-exist.jpg"),
    ).resolves.not.toThrow();
  });

  it("deleteImageFile no-ops on a malformed filename", async () => {
    await expect(deleteImageFile("/uploads/announcements/not-a-uuid.jpg")).resolves.not.toThrow();
    await expect(deleteImageFile("/uploads/announcements/..")).resolves.not.toThrow();
  });

  it("deleteImageFile no-ops when the folder segment isn't a plain safe name", async () => {
    await expect(
      deleteImageFile("/../00000000-0000-0000-0000-000000000000.jpg"),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/imageUpload.test.ts --forceExit`
Expected: FAIL — `validateAndSaveImage` currently only accepts one argument, so calls passing `"announcements"`/`"teachers"` as a second argument will still run (JS ignores extra args) but the URLs won't yet reflect a folder param since the implementation hasn't changed. More precisely: this will fail on the "different folder" test (still saves under `announcements` since the old implementation hardcodes it) and the "malformed folder segment" test (old `deleteImageFile` doesn't parse a folder from the URL at all).

- [ ] **Step 3: Implement the generalized utility**

Replace the full contents of `src/lib/imageUpload.ts` with:

```ts
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

// Note for callers: the size check below happens after the platform has
// already fully buffered the uploaded file — it does NOT protect against a
// large-request-body DoS at the network layer; callers must enforce an
// upstream body-size limit. Validation here is magic-bytes-only (confirms
// file format, not structural well-formedness) — do not feed the output
// into an image-decoding/processing step without additional validation.
export async function validateAndSaveImage(file: File, folder: string): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new ImageValidationError("Image exceeds 5MB limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    throw new ImageValidationError("File must be a JPEG, PNG, or WebP image");
  }

  const ext = ALLOWED_TYPES[detectedType];
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = path.join(UPLOADS_ROOT, folder);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return `/uploads/${folder}/${filename}`;
}

export async function deleteImageFile(imageUrl: string): Promise<void> {
  const filename = path.basename(imageUrl);
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
    return;
  }
  const folder = path.basename(path.dirname(imageUrl));
  if (!/^[a-z0-9]+$/.test(folder)) {
    return;
  }
  const filePath = path.join(UPLOADS_ROOT, folder, filename);
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run the utility test to verify it passes**

Run: `npx jest src/lib/__tests__/imageUpload.test.ts --forceExit`
Expected: `10 passed, 10 total`

- [ ] **Step 5: Find and update all Announcements call sites**

Run: `grep -rn "validateAndSaveImage(" src/app/api/admin/announcements`

This will show every place `validateAndSaveImage` is called in the Announcements module (production routes and their tests — expect roughly 5-7 matches across `route.ts`, `[id]/route.ts`, and their `__tests__` files). For **every** match, add `"announcements"` as the second argument — i.e. a call like `validateAndSaveImage(someFile)` becomes `validateAndSaveImage(someFile, "announcements")`. Do not change anything else about these lines (no reordering, no renaming).

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: all tests pass. Don't check the count against a specific predicted number — `imageUpload.test.ts` was replaced wholesale in Step 1, and its exact prior test count (after several rounds of Announcements review fixes) isn't precisely known at plan-writing time. What matters is: no failures, and no test file other than `imageUpload.test.ts` changed, so nothing else should have moved. If anything outside `imageUpload.test.ts` fails, that's a real regression from the call-site updates in Step 5 — investigate it, don't wave it away as a count mismatch.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: generalize image upload utility to support multiple folders"
```

---

### Task 2: Subject list and Teacher model

**Files:**
- Create: `src/lib/subjects.ts`
- Create: `src/models/Teacher.ts`
- Create: `src/models/__tests__/Teacher.test.ts`

- [ ] **Step 1: Create the subject list**

Create `src/lib/subjects.ts`:

```ts
export const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Arabic",
  "French",
  "History",
  "Geography",
  "Computer Science",
  "Art",
  "Music",
  "Physical Education",
] as const;

export type Subject = (typeof SUBJECTS)[number];
```

- [ ] **Step 2: Write the failing test**

Create `src/models/__tests__/Teacher.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Teacher model", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("creates a teacher with required fields and defaults", async () => {
    const { Teacher } = require("@/models/Teacher");
    const teacher = await Teacher.create({
      name: "Jane Doe",
      subjects: ["Math", "Physics"],
    });
    expect(teacher.name).toBe("Jane Doe");
    expect(teacher.photoUrl).toBeNull();
    expect(teacher.subjects).toEqual(["Math", "Physics"]);
    expect(teacher.qualifications).toBe("");
    expect(teacher.experience).toBe("");
    expect(teacher.order).toBe(0);
    expect(teacher.createdAt).toBeInstanceOf(Date);
    expect(teacher.updatedAt).toBeInstanceOf(Date);
  });

  it("stores optional fields when provided", async () => {
    const { Teacher } = require("@/models/Teacher");
    const teacher = await Teacher.create({
      name: "John Smith",
      subjects: ["English"],
      qualifications: "MA English Literature",
      experience: "10 years teaching high school English",
      photoUrl: "/uploads/teachers/abc123.jpg",
      order: 3,
    });
    expect(teacher.qualifications).toBe("MA English Literature");
    expect(teacher.experience).toBe("10 years teaching high school English");
    expect(teacher.photoUrl).toBe("/uploads/teachers/abc123.jpg");
    expect(teacher.order).toBe(3);
  });

  it("rejects a missing name", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(Teacher.create({ subjects: ["Math"] })).rejects.toThrow();
  });

  it("rejects an empty subjects array", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(
      Teacher.create({ name: "No Subjects", subjects: [] }),
    ).rejects.toThrow();
  });

  it("rejects a subject not in the predefined list", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(
      Teacher.create({ name: "Bad Subject", subjects: ["Underwater Basket Weaving"] }),
    ).rejects.toThrow();
  });

  it("rejects a name over 200 characters", async () => {
    const { Teacher } = require("@/models/Teacher");
    await expect(
      Teacher.create({ name: "A".repeat(201), subjects: ["Math"] }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/models/__tests__/Teacher.test.ts --forceExit`
Expected: FAIL — `Cannot find module '@/models/Teacher'`

- [ ] **Step 4: Implement the Teacher model**

Create `src/models/Teacher.ts`:

```ts
import mongoose, { Schema, type Document, type Model } from "mongoose";
import { SUBJECTS } from "@/lib/subjects";

export interface ITeacher extends Document {
  name: string;
  photoUrl: string | null;
  subjects: string[];
  qualifications: string;
  experience: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacher>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) =>
          value.length > 0 && value.every((s) => (SUBJECTS as readonly string[]).includes(s)),
        message: "At least one valid subject is required",
      },
    },
    qualifications: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    experience: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true },
);

export const Teacher: Model<ITeacher> =
  mongoose.models.Teacher ?? mongoose.model<ITeacher>("Teacher", teacherSchema);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/models/__tests__/Teacher.test.ts --forceExit`
Expected: `6 passed, 6 total`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add subject list and Teacher model"
```

---

### Task 3: Create teacher API route (POST)

**Files:**
- Create: `src/app/api/admin/teachers/route.ts`
- Create: `src/app/api/admin/teachers/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/teachers/__tests__/route.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/admin/teachers", () => {
  let mongod: MongoMemoryServer;
  const savedPaths: string[] = [];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    jest.resetModules();
  });

  afterAll(async () => {
    await mongoose.disconnect();
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

  function makeRequest(formData: FormData) {
    return new NextRequest("http://localhost/api/admin/teachers", {
      method: "POST",
      body: formData,
    });
  }

  it("creates a teacher with name and subjects", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Jane Doe");
    formData.append("subjects", "Math");
    formData.append("subjects", "Physics");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();

    const { Teacher } = require("@/models/Teacher");
    const saved = await Teacher.findById(data.id);
    expect(saved.name).toBe("Jane Doe");
    expect(saved.subjects).toEqual(["Math", "Physics"]);
    expect(saved.photoUrl).toBeNull();
    expect(saved.order).toBe(0);
  });

  it("creates a teacher with a valid photo", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Photo Teacher");
    formData.append("subjects", "English");
    formData.set(
      "photo",
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Teacher } = require("@/models/Teacher");
    const saved = await Teacher.findById(data.id);
    expect(saved.photoUrl).toMatch(/^\/uploads\/teachers\//);
    savedPaths.push(saved.photoUrl);
  });

  it("assigns incrementing order values to successive teachers", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData1 = new FormData();
    formData1.set("name", "First Teacher");
    formData1.append("subjects", "Math");
    await POST(makeRequest(formData1));

    const formData2 = new FormData();
    formData2.set("name", "Second Teacher");
    formData2.append("subjects", "Math");
    const res2 = await POST(makeRequest(formData2));
    const data2 = await res2.json();

    const { Teacher } = require("@/models/Teacher");
    const second = await Teacher.findById(data2.id);
    expect(second.order).toBe(1);
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.append("subjects", "Math");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an empty subjects list", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "No Subjects");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a subject not in the predefined list", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Bad Subject Teacher");
    formData.append("subjects", "Underwater Basket Weaving");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid photo file", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/teachers/route");

    const formData = new FormData();
    formData.set("name", "Bad Photo Teacher");
    formData.append("subjects", "Math");
    formData.set(
      "photo",
      new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects a request over the body size limit", async () => {
    const { POST } = require("@/app/api/admin/teachers/route");
    const formData = new FormData();
    formData.set("name", "Big Request");
    formData.append("subjects", "Math");

    const request = new NextRequest("http://localhost/api/admin/teachers", {
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

Run: `npx jest src/app/api/admin/teachers --forceExit`
Expected: FAIL — `Cannot find module '@/app/api/admin/teachers/route'`

- [ ] **Step 3: Implement the create route**

Create `src/app/api/admin/teachers/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";
import { SUBJECTS } from "@/lib/subjects";

const teacherFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  subjects: z.array(z.enum(SUBJECTS)).min(1, "At least one subject is required"),
  qualifications: z.string().max(2000, "Qualifications is too long"),
  experience: z.string().max(2000, "Experience is too long"),
});

// Note for callers: the size check below happens after the platform has
// already fully buffered the uploaded file — Next.js 16's
// proxyClientMaxBodySize silently truncates request bodies over its own
// 10MB default rather than rejecting them, so this explicit check is still
// necessary, not redundant. See
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md
const MAX_REQUEST_SIZE = 10 * 1024 * 1024;

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

  const parsed = teacherFieldsSchema.safeParse({
    name: formData.get("name"),
    subjects: formData.getAll("subjects"),
    qualifications: formData.get("qualifications") ?? "",
    experience: formData.get("experience") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  let photoUrl: string | null = null;
  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      photoUrl = await validateAndSaveImage(photoFile, "teachers");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  await connectToDatabase();
  const highestOrderTeacher = await Teacher.findOne().sort({ order: -1 });
  const nextOrder = highestOrderTeacher ? highestOrderTeacher.order + 1 : 0;

  let teacher;
  try {
    teacher = await Teacher.create({
      name: parsed.data.name,
      subjects: parsed.data.subjects,
      qualifications: parsed.data.qualifications,
      experience: parsed.data.experience,
      photoUrl,
      order: nextOrder,
    });
  } catch (err) {
    if (photoUrl) {
      await deleteImageFile(photoUrl);
    }
    throw err;
  }

  return NextResponse.json({ id: teacher._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/teachers --forceExit`
Expected: `8 passed, 8 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add create-teacher API route"
```

---

### Task 4: Update teacher API route (PUT)

**Files:**
- Create: `src/app/api/admin/teachers/[id]/route.ts`
- Create: `src/app/api/admin/teachers/[id]/__tests__/route.test.ts`

This route applies from the start the patterns Announcements discovered via follow-up fixes (malformed-id guard, zod limits matching the Mongoose schema, save-then-cleanup filesystem ordering) — no separate fix-up task needed this time.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/teachers/[id]/__tests__/route.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink, access } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("/api/admin/teachers/[id]", () => {
  let mongod: MongoMemoryServer;
  const savedPaths: string[] = [];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    jest.resetModules();
  });

  afterAll(async () => {
    await mongoose.disconnect();
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

  describe("PUT", () => {
    function makeRequest(id: string, formData: FormData) {
      return new NextRequest(`http://localhost/api/admin/teachers/${id}`, {
        method: "PUT",
        body: formData,
      });
    }

    it("updates name, subjects, qualifications, experience", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const existing = await Teacher.create({ name: "Old Name", subjects: ["Math"] });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "New Name");
      formData.append("subjects", "Physics");
      formData.append("subjects", "Chemistry");
      formData.set("qualifications", "PhD Physics");
      formData.set("experience", "5 years");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Teacher.findById(existing._id);
      expect(updated.name).toBe("New Name");
      expect(updated.subjects).toEqual(["Physics", "Chemistry"]);
      expect(updated.qualifications).toBe("PhD Physics");
      expect(updated.experience).toBe("5 years");
    });

    it("replaces the photo and deletes the old file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const oldPhotoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "old.jpg", { type: "image/jpeg" }),
        "teachers",
      );
      const existing = await Teacher.create({
        name: "Has Photo",
        subjects: ["Math"],
        photoUrl: oldPhotoUrl,
      });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "Has Photo");
      formData.append("subjects", "Math");
      formData.set(
        "photo",
        new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
      );

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Teacher.findById(existing._id);
      expect(updated.photoUrl).not.toBe(oldPhotoUrl);
      savedPaths.push(updated.photoUrl);

      const oldPath = path.join(process.cwd(), "public", oldPhotoUrl);
      await expect(access(oldPath)).rejects.toThrow();
    });

    it("removes the photo when removePhoto is set", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const photoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
        "teachers",
      );
      const existing = await Teacher.create({ name: "T", subjects: ["Math"], photoUrl });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");
      formData.set("removePhoto", "true");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Teacher.findById(existing._id);
      expect(updated.photoUrl).toBeNull();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await PUT(makeRequest(fakeId, formData), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");

      const res = await PUT(makeRequest("not-an-id", formData), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a name over 200 characters", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const existing = await Teacher.create({ name: "T", subjects: ["Math"] });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "A".repeat(201));
      formData.append("subjects", "Math");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a request over the body size limit", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const existing = await Teacher.create({ name: "T", subjects: ["Math"] });

      const { PUT } = require("@/app/api/admin/teachers/[id]/route");
      const formData = new FormData();
      formData.set("name", "T");
      formData.append("subjects", "Math");

      const request = new NextRequest(
        `http://localhost/api/admin/teachers/${existing._id.toString()}`,
        {
          method: "PUT",
          headers: { "content-length": String(10 * 1024 * 1024 + 1) },
          body: formData,
        },
      );

      const res = await PUT(request, {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(413);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/teachers --forceExit`
Expected: FAIL (the new file's tests) — `Cannot find module '@/app/api/admin/teachers/[id]/route'`. This substring pattern also re-runs Task 3's already-passing create-route tests, which should still pass.

- [ ] **Step 3: Implement the update route**

Create `src/app/api/admin/teachers/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";
import { SUBJECTS } from "@/lib/subjects";

const teacherFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  subjects: z.array(z.enum(SUBJECTS)).min(1, "At least one subject is required"),
  qualifications: z.string().max(2000, "Qualifications is too long"),
  experience: z.string().max(2000, "Experience is too long"),
});

const MAX_REQUEST_SIZE = 10 * 1024 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });
  }

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

  const parsed = teacherFieldsSchema.safeParse({
    name: formData.get("name"),
    subjects: formData.getAll("subjects"),
    qualifications: formData.get("qualifications") ?? "",
    experience: formData.get("experience") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const existing = await Teacher.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const removePhoto = formData.get("removePhoto") === "true";
  const photoFile = formData.get("photo");

  const oldPhotoUrl = existing.photoUrl;
  let newPhotoUrl = oldPhotoUrl;

  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      newPhotoUrl = await validateAndSaveImage(photoFile, "teachers");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } else if (removePhoto) {
    newPhotoUrl = null;
  }

  existing.name = parsed.data.name;
  existing.subjects = parsed.data.subjects;
  existing.qualifications = parsed.data.qualifications;
  existing.experience = parsed.data.experience;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/teachers --forceExit`
Expected: `16 passed, 16 total` (8 create-route tests + 8 PUT tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add update-teacher API route"
```

---

### Task 5: Delete teacher API route (DELETE)

**Files:**
- Modify: `src/app/api/admin/teachers/[id]/route.ts`
- Modify: `src/app/api/admin/teachers/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/app/api/admin/teachers/[id]/__tests__/route.test.ts`, add a new `describe("DELETE", ...)` block as a sibling of the existing `describe("PUT", ...)` block, inside the outer `describe("/api/admin/teachers/[id]", ...)`. Insert it immediately after the closing `});` of the `describe("PUT", ...)` block (before the outer describe's closing `});`):

```ts
  describe("DELETE", () => {
    function makeRequest(id: string) {
      return new NextRequest(`http://localhost/api/admin/teachers/${id}`, {
        method: "DELETE",
      });
    }

    it("deletes a teacher and their photo file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Teacher } = require("@/models/Teacher");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const photoUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
        "teachers",
      );
      const existing = await Teacher.create({ name: "T", subjects: ["Math"], photoUrl });

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const res = await DELETE(makeRequest(existing._id.toString()), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const found = await Teacher.findById(existing._id);
      expect(found).toBeNull();

      const photoPath = path.join(process.cwd(), "public", photoUrl);
      await expect(access(photoPath)).rejects.toThrow();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await DELETE(makeRequest(fakeId), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/teachers/[id]/route");
      const res = await DELETE(makeRequest("not-an-id"), {
        params: Promise.resolve({ id: "not-an-id" }),
      });
      expect(res.status).toBe(400);
    });
  });
```

- [ ] **Step 2: Run test to verify the new cases fail**

Run: `npx jest src/app/api/admin/teachers --forceExit`
Expected: the 16 existing tests still pass, the 3 new DELETE tests FAIL — `DELETE is not a function` (not exported yet)

- [ ] **Step 3: Add the DELETE handler**

In `src/app/api/admin/teachers/[id]/route.ts`, add this function after the existing `PUT` function (keep the existing imports and `PUT` function unchanged):

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

Run: `npx jest src/app/api/admin/teachers --forceExit`
Expected: `19 passed, 19 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add delete-teacher API route"
```

---

### Task 6: Reorder API route

**Files:**
- Create: `src/app/api/admin/teachers/reorder/route.ts`
- Create: `src/app/api/admin/teachers/reorder/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/teachers/reorder/__tests__/route.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

describe("PUT /api/admin/teachers/reorder", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    jest.resetModules();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    const mongooseFresh = require("mongoose");
    await mongooseFresh.connection.dropDatabase();
  });

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/admin/teachers/reorder", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("sets order to match the submitted id sequence", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const a = await Teacher.create({ name: "A", subjects: ["Math"], order: 0 });
    const b = await Teacher.create({ name: "B", subjects: ["Math"], order: 1 });
    const c = await Teacher.create({ name: "C", subjects: ["Math"], order: 2 });

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(
      makeRequest({ ids: [c._id.toString(), a._id.toString(), b._id.toString()] }),
    );
    expect(res.status).toBe(200);

    const updatedA = await Teacher.findById(a._id);
    const updatedB = await Teacher.findById(b._id);
    const updatedC = await Teacher.findById(c._id);
    expect(updatedC.order).toBe(0);
    expect(updatedA.order).toBe(1);
    expect(updatedB.order).toBe(2);
  });

  it("rejects a missing ids array", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects a list containing a malformed id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { PUT } = require("@/app/api/admin/teachers/reorder/route");
    const res = await PUT(makeRequest({ ids: ["not-an-id"] }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/teachers/reorder --forceExit`
Expected: FAIL — `Cannot find module '@/app/api/admin/teachers/reorder/route'`

- [ ] **Step 3: Implement the reorder route**

Create `src/app/api/admin/teachers/reorder/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";

const reorderSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one id is required"),
});

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A list of teacher ids is required" }, { status: 400 });
  }

  if (!parsed.data.ids.every((id) => mongoose.isValidObjectId(id))) {
    return NextResponse.json({ error: "One or more ids are invalid" }, { status: 400 });
  }

  await connectToDatabase();

  await Promise.all(
    parsed.data.ids.map((id, index) =>
      Teacher.updateOne({ _id: id }, { $set: { order: index } }),
    ),
  );

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/teachers/reorder --forceExit`
Expected: `3 passed, 3 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add teacher reorder API route"
```

---

### Task 7: Admin teachers list page (no drag-and-drop yet)

**Files:**
- Modify: `src/app/admin/dashboard/teachers/page.tsx` (replaces the Foundation-era placeholder)
- Create: `src/app/admin/dashboard/teachers/DeleteTeacherButton.tsx`

- [ ] **Step 1: Implement the delete button**

Create `src/app/admin/dashboard/teachers/DeleteTeacherButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteTeacherButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (loading) return;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete teacher.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Delete "${name}"`}
        className="text-maroon hover:underline disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-xs text-maroon">
          {error}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Replace the placeholder list page**

Replace the full contents of `src/app/admin/dashboard/teachers/page.tsx` with:

```tsx
import Image from "next/image";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import DeleteTeacherButton from "./DeleteTeacherButton";

export const dynamic = "force-dynamic";

export default async function TeachersAdminPage() {
  await connectToDatabase();
  // .lean() is safe here: only plain strings/numbers and this record's own
  // ObjectId/Dates are read, and nothing crosses a JSON boundary — this page
  // renders entirely server-side before any client hydration.
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Teachers</h1>
        <Link
          href="/admin/dashboard/teachers/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {teachers.length === 0 ? (
        <p className="text-gray-600">No teachers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-navy">
                <th scope="col" className="py-2 pr-4">
                  Photo
                </th>
                <th scope="col" className="py-2 pr-4">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4">
                  Subjects
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t._id.toString()} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    {t.photoUrl ? (
                      <Image
                        src={t.photoUrl}
                        alt={t.name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-xs text-navy">
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">{t.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{t.subjects.join(", ")}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/teachers/${t._id.toString()}/edit`}
                      aria-label={`Edit "${t.name}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteTeacherButton id={t._id.toString()} name={t.name} />
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

- [ ] **Step 3: Manual check**

Run: `npm run dev`, log in, visit `/admin/dashboard/teachers`
Expected: "No teachers yet." message (empty DB), "+ New" button visible (will 404 until Task 10 — expected for now)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin teachers list page"
```

---

### Task 8: Drag-and-drop reordering

**Files:**
- Modify: `src/app/admin/dashboard/teachers/page.tsx`
- Create: `src/app/admin/dashboard/teachers/TeachersTable.tsx`

- [ ] **Step 1: Install dnd-kit**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Create the client-side sortable table**

Create `src/app/admin/dashboard/teachers/TeachersTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DeleteTeacherButton from "./DeleteTeacherButton";

interface TeacherRow {
  id: string;
  name: string;
  subjects: string[];
  photoUrl: string | null;
}

function SortableRow({ row }: { row: TeacherRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-100 bg-white">
      <td className="w-8 py-2 pr-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder "${row.name}"`}
          className="cursor-grab text-gray-400 hover:text-navy active:cursor-grabbing"
        >
          ⠿
        </button>
      </td>
      <td className="py-2 pr-4">
        {row.photoUrl ? (
          <Image
            src={row.photoUrl}
            alt={row.name}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-xs text-navy">
            {row.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </td>
      <td className="py-2 pr-4">{row.name}</td>
      <td className="py-2 pr-4 text-gray-600">{row.subjects.join(", ")}</td>
      <td className="py-2 text-right">
        <Link
          href={`/admin/dashboard/teachers/${row.id}/edit`}
          aria-label={`Edit "${row.name}"`}
          className="mr-3 text-navy hover:underline"
        >
          Edit
        </Link>
        <DeleteTeacherButton id={row.id} name={row.name} />
      </td>
    </tr>
  );
}

export default function TeachersTable({ initialRows }: { initialRows: TeacherRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    const reordered = [...rows];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setRows(reordered);
    setError(null);

    try {
      const res = await fetch("/api/admin/teachers/reorder", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
      });
      if (!res.ok) {
        setError("Failed to save the new order.");
        setRows(initialRows);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setRows(initialRows);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-maroon">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-navy">
              <th scope="col" className="py-2 pr-2">
                <span className="sr-only">Reorder</span>
              </th>
              <th scope="col" className="py-2 pr-4">
                Photo
              </th>
              <th scope="col" className="py-2 pr-4">
                Name
              </th>
              <th scope="col" className="py-2 pr-4">
                Subjects
              </th>
              <th scope="col" className="py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {rows.map((row) => (
                  <SortableRow key={row.id} row={row} />
                ))}
              </SortableContext>
            </DndContext>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the table into the admin page**

Replace the full contents of `src/app/admin/dashboard/teachers/page.tsx` with:

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import TeachersTable from "./TeachersTable";

export const dynamic = "force-dynamic";

export default async function TeachersAdminPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  const rows = teachers.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    subjects: t.subjects,
    photoUrl: t.photoUrl,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Teachers</h1>
        <Link
          href="/admin/dashboard/teachers/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-600">No teachers yet.</p>
      ) : (
        <TeachersTable initialRows={rows} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual check — this is the important one**

Run: `npm run dev`, log in. Since the DB is likely empty, create 3+ teachers first via direct authenticated API calls (multipart POST to `/api/admin/teachers`) so there's something to reorder — or wait until Task 11 (new teacher page) exists and come back to this check then if that's easier. Once at least 3 teachers exist:
1. Visit `/admin/dashboard/teachers` — confirm the drag-handle (⠿), photo/initials, name, subjects, edit/delete all render per row.
2. Drag a row to a new position with the mouse — confirm it visually reorders immediately, and after the request completes, refreshing the page keeps the new order (proving it persisted, not just a client-side illusion).
3. Test keyboard reordering too: Tab to a drag handle, press Space to pick it up, use arrow keys to move it, press Space again to drop — confirm this also works and persists (this is what makes the feature accessible, not just mouse-only).
4. Check the browser console for errors throughout.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add drag-and-drop reordering to admin teachers list"
```

---

### Task 9: Shared teacher form component

**Files:**
- Create: `src/app/admin/dashboard/teachers/TeacherForm.tsx`

- [ ] **Step 1: Implement the shared form**

Create `src/app/admin/dashboard/teachers/TeacherForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SUBJECTS } from "@/lib/subjects";

interface TeacherFormProps {
  mode: "create" | "edit";
  teacherId?: string;
  initialName?: string;
  initialSubjects?: string[];
  initialQualifications?: string;
  initialExperience?: string;
  initialPhotoUrl?: string | null;
}

export default function TeacherForm({
  mode,
  teacherId,
  initialName = "",
  initialSubjects = [],
  initialQualifications = "",
  initialExperience = "",
  initialPhotoUrl = null,
}: TeacherFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [subjects, setSubjects] = useState<string[]>(initialSubjects);
  const [qualifications, setQualifications] = useState(initialQualifications);
  const [experience, setExperience] = useState(initialExperience);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSubject(subject: string) {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (subjects.length === 0) {
      setError("Select at least one subject.");
      return;
    }

    setLoading(true);

    const formData = new FormData(event.currentTarget);
    for (const subject of subjects) {
      formData.append("subjects", subject);
    }
    if (removePhoto) {
      formData.set("removePhoto", "true");
    }

    try {
      const url = mode === "create" ? "/api/admin/teachers" : `/api/admin/teachers/${teacherId}`;
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

      router.push("/admin/dashboard/teachers");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <fieldset>
        <legend className="block text-sm font-medium text-navy">Subjects</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {SUBJECTS.map((subject) => (
            <label key={subject} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={subjects.includes(subject)}
                onChange={() => toggleSubject(subject)}
                className="rounded border-gray-300"
              />
              {subject}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="qualifications" className="block text-sm font-medium text-navy">
          Qualifications
        </label>
        <textarea
          id="qualifications"
          name="qualifications"
          rows={3}
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="experience" className="block text-sm font-medium text-navy">
          Experience
        </label>
        <textarea
          id="experience"
          name="experience"
          rows={3}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
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
              className="rounded-full object-cover"
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
          onClick={() => router.push("/admin/dashboard/teachers")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shared teacher form component"
```

(No standalone test — not reachable via any route until Task 10.)

---

### Task 10: New teacher page

**Files:**
- Create: `src/app/admin/dashboard/teachers/new/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/admin/dashboard/teachers/new/page.tsx`:

```tsx
import TeacherForm from "../TeacherForm";

export default function NewTeacherPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Teacher</h1>
      <TeacherForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, log in, visit `/admin/dashboard/teachers/new`. Create at least 3 teachers across separate submissions (mix: some with a photo, some without, different subject combinations) so Task 8's drag-and-drop check (if not already done) and later tasks have real data to work with. Confirm each redirects to the list and appears correctly (photo/initials, name, subjects). Also test: submit with zero subjects selected (should show the inline "Select at least one subject." error without submitting), and submit a name over 200 characters (should get the inline server error).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add new-teacher admin page"
```

---

### Task 11: Edit teacher page

**Files:**
- Create: `src/app/admin/dashboard/teachers/[id]/edit/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/admin/dashboard/teachers/[id]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import TeacherForm from "../../TeacherForm";

export const dynamic = "force-dynamic";

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const teacher = await Teacher.findById(id).lean();

  if (!teacher) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Teacher</h1>
      <TeacherForm
        mode="edit"
        teacherId={teacher._id.toString()}
        initialName={teacher.name}
        initialSubjects={teacher.subjects}
        initialQualifications={teacher.qualifications}
        initialExperience={teacher.experience}
        initialPhotoUrl={teacher.photoUrl}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, log in, click "Edit" on an existing teacher. Confirm pre-fill (name, correct subjects checked, qualifications, experience, photo preview if present). Change the name and a subject, save — confirm redirect and updated values in the list. Edit again, remove the photo (confirm the "Undo" flow works), save — confirm photo gone from list, DB, and disk. Also visit `/admin/dashboard/teachers/not-an-id/edit` directly — confirm a clean 404, not a crash.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add edit-teacher admin page"
```

---

### Task 12: Public teachers page

**Files:**
- Create: `src/app/teachers/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/teachers/page.tsx`:

```tsx
import Image from "next/image";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teachers — MLC",
  description: "Meet the teaching staff of Modernistic Learning Community.",
};

export default async function TeachersPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().sort({ order: 1 }).lean();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Our Teachers</h1>
      {teachers.length === 0 ? (
        <p className="text-gray-600">No teachers to show yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <article key={t._id.toString()} className="rounded-lg border border-gray-200 p-6">
              <div className="mb-4 flex justify-center">
                {t.photoUrl ? (
                  <Image
                    src={t.photoUrl}
                    alt={t.name}
                    width={96}
                    height={96}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-navy/10 text-2xl text-navy">
                    {t.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="text-center text-lg font-semibold text-navy">{t.name}</h2>
              <p className="mt-1 text-center text-sm text-maroon">{t.subjects.join(", ")}</p>
              {t.qualifications && <p className="mt-3 text-sm text-gray-700">{t.qualifications}</p>}
              {t.experience && <p className="mt-2 text-sm text-gray-600">{t.experience}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Log out (or use a fresh session) and visit `/teachers` — confirm it loads with no login redirect (verify via network tab or by checking the URL never changes to `/admin/login`), shows all teachers in the drag-and-drop order set earlier, photos/initials render correctly, subjects/qualifications/experience all correct.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add public teachers page"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass. Just confirm the actual count and that everything is green — don't try to reconcile it against a predicted number (the Announcements module's plan learned this the hard way: follow-up review fixes reliably add more tests than any upfront estimate predicts).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors, no warnings (the project has maintained a zero/zero baseline since Foundation's Task 18 and held it through the Announcements module — confirm it's still true).

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run a production build**

Run: `npm run build`
Expected: succeeds, route table includes `/teachers`, `/admin/dashboard/teachers`, `/admin/dashboard/teachers/new`, `/admin/dashboard/teachers/[id]/edit`, `/api/admin/teachers`, `/api/admin/teachers/[id]`, `/api/admin/teachers/reorder`.

- [ ] **Step 5: Full manual smoke test**

With local MongoDB running and `npm run dev` started, logged in as admin:
1. Create a teacher with a photo — appears in admin list, appears on public `/teachers` page with the photo rendered.
2. Create a teacher without a photo — appears correctly in both places with an initials placeholder, no broken image icon.
3. Edit a teacher's name/subjects — changes reflected in both admin list and public page.
4. Edit a teacher to replace their photo — old file gone from `public/uploads/teachers/`, new one present, public page shows the new photo.
5. Edit a teacher to remove their photo — photo gone from both DB record and disk, list/public page show the initials placeholder instead.
6. Delete a teacher — gone from admin list and public page, their photo file (if any) removed from disk.
7. Drag-reorder teachers in the admin list, refresh the page, confirm the new order persisted, then confirm the public `/teachers` page reflects the same new order.
8. Log out, then `curl -X POST http://localhost:3000/api/admin/teachers` (no cookie) — should get a 401 JSON response, not a redirect or 500. Also try `curl -X PUT http://localhost:3000/api/admin/teachers/reorder` (no cookie) with a JSON body — same 401 expectation, confirming the reorder endpoint is genuinely covered by the proxy too, not just assumed.
9. Visit `/teachers` while logged out — works fine (public page, no auth required).

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip this step if nothing needed fixing.)
