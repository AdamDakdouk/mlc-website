# Announcements Content Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin/dashboard/announcements` placeholder with real admin CRUD (create/edit/delete, with optional image upload) and add a public `/announcements` page, establishing the pattern the remaining four Content Modules will reuse.

**Architecture:** Server Components query MongoDB directly for reads (public list page, admin list page, admin edit page — no API round-trip needed). API routes under `/api/admin/announcements` handle writes (create/update/delete), protected by extending the existing `proxy.ts`'s matcher. Images are validated by magic bytes (never trust client-supplied MIME type) and stored on the local filesystem under `public/uploads/announcements/`.

**Tech Stack:** Same as Foundation & Admin Core — TypeScript, Next.js 16 (App Router), MongoDB + Mongoose ^8.x, `zod`, Jest + `mongodb-memory-server`. No new dependencies needed for this module.

---

## Prerequisites

- Foundation & Admin Core is merged to `master` and working (`npm test` passes, `npm run dev` runs, you can log in at `/admin/login`).
- Local MongoDB running for manual testing (tests themselves use `mongodb-memory-server`, no local MongoDB needed for `npm test`).

---

### Task 1: Extend proxy to protect admin API routes

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/__tests__/proxy.test.ts`

**Why:** `proxy.ts` currently only protects `/admin/dashboard/:path*` (pages). This module adds admin API routes under `/api/admin/*` that need the same JWT check. A page redirect (307 to `/admin/login`) makes sense for a browser navigation, but an API route called via `fetch()` should get a clean 401 JSON response instead — a redirect would make the fetch follow it and receive the login page's HTML, which the calling code isn't expecting.

- [ ] **Step 1: Write the failing tests**

Add two new test cases to `src/__tests__/proxy.test.ts`. Replace the full file with:

```ts
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("redirects to /admin/login when no token cookie is present", async () => {
    const request = new NextRequest("http://localhost/admin/dashboard");
    const res = await proxy(request);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("redirects to /admin/login when the token is invalid", async () => {
    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: { cookie: "token=garbage-value" },
    });
    const res = await proxy(request);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("allows the request through when the token is valid", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: { cookie: `token=${token}` },
    });
    const res = await proxy(request);

    expect(res.status).toBe(200);
  });

  it("returns a 401 JSON response (not a redirect) for an unauthenticated API request", async () => {
    const request = new NextRequest("http://localhost/api/admin/announcements");
    const res = await proxy(request);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("allows an authenticated API request through", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    const request = new NextRequest("http://localhost/api/admin/announcements", {
      headers: { cookie: `token=${token}` },
    });
    const res = await proxy(request);

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify the two new ones fail**

Run: `npx jest src/__tests__/proxy.test.ts --forceExit`
Expected: 3 pass, 2 fail (the new API-path tests — `proxy` doesn't branch on path yet, and the matcher doesn't cover `/api/admin/*` yet, though the matcher itself isn't exercised by calling `proxy()` directly in these unit tests, only the branching logic is)

- [ ] **Step 3: Update proxy.ts**

Replace `src/proxy.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// Next.js 16 renamed the "middleware" file convention to "proxy" (the
// `middleware` export/name is deprecated — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Functionally identical to the old middleware API; only the file and
// export names changed.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // request.url reflects whatever protocol/host Next believes it received.
    // Behind a reverse proxy, this depends on X-Forwarded-Proto/Host being set
    // correctly — get that wrong and this redirect could leak an internal
    // http:// URL. Revisit when the production hosting target is chosen (see
    // the same caveat in src/app/api/auth/login/route.ts's getClientIp comment).
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*", "/api/admin/:path*"],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/proxy.test.ts --forceExit`
Expected: `5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: protect admin API routes via proxy, 401 JSON instead of redirect"
```

---

### Task 2: Announcement model

**Files:**
- Create: `src/models/Announcement.ts`
- Create: `src/models/__tests__/Announcement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/models/__tests__/Announcement.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Announcement model", () => {
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

  it("creates an announcement with required fields and defaults", async () => {
    const { Announcement } = require("@/models/Announcement");
    const announcement = await Announcement.create({
      title: "Exam schedule posted",
      body: "The final exam schedule is now available.",
    });
    expect(announcement.title).toBe("Exam schedule posted");
    expect(announcement.imageUrl).toBeNull();
    expect(announcement.createdAt).toBeInstanceOf(Date);
    expect(announcement.updatedAt).toBeInstanceOf(Date);
  });

  it("stores an imageUrl when provided", async () => {
    const { Announcement } = require("@/models/Announcement");
    const announcement = await Announcement.create({
      title: "Sports day",
      body: "Join us for sports day.",
      imageUrl: "/uploads/announcements/abc123.jpg",
    });
    expect(announcement.imageUrl).toBe("/uploads/announcements/abc123.jpg");
  });

  it("rejects a missing title", async () => {
    const { Announcement } = require("@/models/Announcement");
    await expect(
      Announcement.create({ body: "Body text only" }),
    ).rejects.toThrow();
  });

  it("rejects a missing body", async () => {
    const { Announcement } = require("@/models/Announcement");
    await expect(
      Announcement.create({ title: "Title only" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/Announcement.test.ts --forceExit`
Expected: FAIL — `Cannot find module '@/models/Announcement'`

- [ ] **Step 3: Implement Announcement.ts**

Create `src/models/Announcement.ts`:

```ts
import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAnnouncement extends Document {
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ??
  mongoose.model<IAnnouncement>("Announcement", announcementSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/Announcement.test.ts --forceExit`
Expected: `4 passed, 4 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Announcement model"
```

---

### Task 3: Image upload utility

**Files:**
- Create: `src/lib/imageUpload.ts`
- Create: `src/lib/__tests__/imageUpload.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add uploads directory to .gitignore**

Open `.gitignore`, add this section (anywhere after the existing `# env files` section is fine):

```
# user-uploaded content (local filesystem storage for dev; not source)
/public/uploads/
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/imageUpload.test.ts`:

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

  it("saves a valid JPEG and returns its public URL", async () => {
    const file = makeFile(JPEG_BYTES, "photo.jpg", "image/jpeg");
    const url = await validateAndSaveImage(file);
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.jpg$/);
  });

  it("saves a valid PNG and returns its public URL", async () => {
    const file = makeFile(PNG_BYTES, "photo.png", "image/png");
    const url = await validateAndSaveImage(file);
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.png$/);
  });

  it("saves a valid WebP and returns its public URL", async () => {
    const file = makeFile(WEBP_BYTES, "photo.webp", "image/webp");
    const url = await validateAndSaveImage(file);
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.webp$/);
  });

  it("rejects a file whose content isn't a recognized image format, regardless of claimed type", async () => {
    const file = makeFile([0x00, 0x01, 0x02, 0x03], "fake.jpg", "image/jpeg");
    await expect(validateAndSaveImage(file)).rejects.toThrow(ImageValidationError);
  });

  it("rejects a file over 5MB", async () => {
    const bigBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    bigBytes.set(JPEG_BYTES);
    const file = new File([bigBytes], "big.jpg", { type: "image/jpeg" });
    await expect(validateAndSaveImage(file)).rejects.toThrow(ImageValidationError);
  });

  it("deleteImageFile removes an existing file without error", async () => {
    const file = makeFile(JPEG_BYTES, "to-delete.jpg", "image/jpeg");
    const url = await validateAndSaveImage(file);
    const filePath = path.join(process.cwd(), "public", url);

    await deleteImageFile(url);

    await expect(access(filePath)).rejects.toThrow();
  });

  it("deleteImageFile does not throw when the file is already gone", async () => {
    await expect(
      deleteImageFile("/uploads/announcements/does-not-exist.jpg"),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/imageUpload.test.ts --forceExit`
Expected: FAIL — `Cannot find module '@/lib/imageUpload'`

- [ ] **Step 4: Implement imageUpload.ts**

Create `src/lib/imageUpload.ts`:

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

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "announcements");

export class ImageValidationError extends Error {}

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

export async function validateAndSaveImage(file: File): Promise<string> {
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

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/announcements/${filename}`;
}

export async function deleteImageFile(imageUrl: string): Promise<void> {
  const filename = path.basename(imageUrl);
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/imageUpload.test.ts --forceExit`
Expected: `7 passed, 7 total`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add image upload validation and storage utility"
```

---

### Task 4: Create announcement API route (POST)

**Files:**
- Create: `src/app/api/admin/announcements/route.ts`
- Create: `src/app/api/admin/announcements/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/announcements/__tests__/route.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/admin/announcements", () => {
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
    jest.resetModules();
  });

  function makeRequest(formData: FormData) {
    return new NextRequest("http://localhost/api/admin/announcements", {
      method: "POST",
      body: formData,
    });
  }

  it("creates an announcement with title and body", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("title", "Exam schedule posted");
    formData.set("body", "Final exams begin next week.");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();

    const { Announcement } = require("@/models/Announcement");
    const saved = await Announcement.findById(data.id);
    expect(saved.title).toBe("Exam schedule posted");
    expect(saved.imageUrl).toBeNull();
  });

  it("creates an announcement with a valid image", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("title", "Sports day");
    formData.set("body", "Join us for sports day.");
    formData.set(
      "image",
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(201);
    const data = await res.json();

    const { Announcement } = require("@/models/Announcement");
    const saved = await Announcement.findById(data.id);
    expect(saved.imageUrl).toMatch(/^\/uploads\/announcements\//);
    savedPaths.push(saved.imageUrl);
  });

  it("rejects a missing title", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("body", "Body without a title.");

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid image file", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { POST } = require("@/app/api/admin/announcements/route");

    const formData = new FormData();
    formData.set("title", "Bad image test");
    formData.set("body", "This upload should fail.");
    formData.set(
      "image",
      new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }),
    );

    const res = await POST(makeRequest(formData));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/announcements --forceExit`
Expected: FAIL — `Cannot find module '@/app/api/admin/announcements/route'`

- [ ] **Step 3: Implement the create route**

Create `src/app/api/admin/announcements/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { validateAndSaveImage, ImageValidationError } from "@/lib/imageUpload";

const announcementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
});

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = announcementFieldsSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  let imageUrl: string | null = null;
  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await validateAndSaveImage(imageFile);
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  await connectToDatabase();
  const announcement = await Announcement.create({
    title: parsed.data.title,
    body: parsed.data.body,
    imageUrl,
  });

  return NextResponse.json({ id: announcement._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/announcements --forceExit`
Expected: `4 passed, 4 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add create-announcement API route"
```

---

### Task 5: Update announcement API route (PUT)

**Files:**
- Create: `src/app/api/admin/announcements/[id]/route.ts`
- Create: `src/app/api/admin/announcements/[id]/__tests__/route.test.ts`

**Before you begin:** dynamic route params in Next.js 16 are asynchronous (`params: Promise<{ id: string }>`, must `await params`) — this matches the convention already used elsewhere in this codebase (check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` if you want to double check against the installed version before writing this).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/announcements/[id]/__tests__/route.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { unlink, access } from "fs/promises";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("/api/admin/announcements/[id]", () => {
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
    jest.resetModules();
  });

  describe("PUT", () => {
    function makeRequest(id: string, formData: FormData) {
      return new NextRequest(`http://localhost/api/admin/announcements/${id}`, {
        method: "PUT",
        body: formData,
      });
    }

    it("updates title and body", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const existing = await Announcement.create({ title: "Old title", body: "Old body" });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "New title");
      formData.set("body", "New body");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Announcement.findById(existing._id);
      expect(updated.title).toBe("New title");
      expect(updated.body).toBe("New body");
    });

    it("replaces the image and deletes the old file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const oldImageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "old.jpg", { type: "image/jpeg" }),
      );
      const existing = await Announcement.create({
        title: "Has image",
        body: "Body",
        imageUrl: oldImageUrl,
      });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "Has image");
      formData.set("body", "Body");
      formData.set(
        "image",
        new File([new Uint8Array(JPEG_BYTES)], "new.jpg", { type: "image/jpeg" }),
      );

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Announcement.findById(existing._id);
      expect(updated.imageUrl).not.toBe(oldImageUrl);
      savedPaths.push(updated.imageUrl);

      const oldPath = path.join(process.cwd(), "public", oldImageUrl);
      await expect(access(oldPath)).rejects.toThrow();
    });

    it("removes the image when removeImage is set", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const imageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      );
      const existing = await Announcement.create({ title: "T", body: "B", imageUrl });

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "T");
      formData.set("body", "B");
      formData.set("removeImage", "true");

      const res = await PUT(makeRequest(existing._id.toString(), formData), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const updated = await Announcement.findById(existing._id);
      expect(updated.imageUrl).toBeNull();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { PUT } = require("@/app/api/admin/announcements/[id]/route");
      const formData = new FormData();
      formData.set("title", "T");
      formData.set("body", "B");

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await PUT(makeRequest(fakeId, formData), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/announcements --forceExit`
Expected: FAIL (the new file's tests) — `Cannot find module '@/app/api/admin/announcements/[id]/route'`. This substring pattern also re-runs Task 4's already-passing create-route tests, which is fine — they should still pass.

- [ ] **Step 3: Implement the update route**

Create `src/app/api/admin/announcements/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";

const announcementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = announcementFieldsSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Announcement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  const removeImage = formData.get("removeImage") === "true";
  const imageFile = formData.get("image");

  if (imageFile instanceof File && imageFile.size > 0) {
    let newImageUrl: string;
    try {
      newImageUrl = await validateAndSaveImage(imageFile);
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    if (existing.imageUrl) {
      await deleteImageFile(existing.imageUrl);
    }
    existing.imageUrl = newImageUrl;
  } else if (removeImage && existing.imageUrl) {
    await deleteImageFile(existing.imageUrl);
    existing.imageUrl = null;
  }

  existing.title = parsed.data.title;
  existing.body = parsed.data.body;
  await existing.save();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/announcements --forceExit`
Expected: `8 passed, 8 total` (Task 4's 4 create-route tests + this task's 4 PUT tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add update-announcement API route"
```

---

### Task 6: Delete announcement API route (DELETE)

**Files:**
- Modify: `src/app/api/admin/announcements/[id]/route.ts`
- Modify: `src/app/api/admin/announcements/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/app/api/admin/announcements/[id]/__tests__/route.test.ts`, add a new `describe("DELETE", ...)` block as a sibling of the existing `describe("PUT", ...)` block, inside the outer `describe("/api/admin/announcements/[id]", ...)`. Insert it immediately after the closing `});` of the `describe("PUT", ...)` block (before the outer describe's closing `});`):

```ts
  describe("DELETE", () => {
    function makeRequest(id: string) {
      return new NextRequest(`http://localhost/api/admin/announcements/${id}`, {
        method: "DELETE",
      });
    }

    it("deletes an announcement and its image file", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();
      const { Announcement } = require("@/models/Announcement");
      const { validateAndSaveImage } = require("@/lib/imageUpload");

      const imageUrl = await validateAndSaveImage(
        new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      );
      const existing = await Announcement.create({ title: "T", body: "B", imageUrl });

      const { DELETE } = require("@/app/api/admin/announcements/[id]/route");
      const res = await DELETE(makeRequest(existing._id.toString()), {
        params: Promise.resolve({ id: existing._id.toString() }),
      });
      expect(res.status).toBe(200);

      const found = await Announcement.findById(existing._id);
      expect(found).toBeNull();

      const imagePath = path.join(process.cwd(), "public", imageUrl);
      await expect(access(imagePath)).rejects.toThrow();
    });

    it("returns 404 for a non-existent id", async () => {
      const { connectToDatabase } = require("@/lib/db");
      await connectToDatabase();

      const { DELETE } = require("@/app/api/admin/announcements/[id]/route");
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await DELETE(makeRequest(fakeId), {
        params: Promise.resolve({ id: fakeId }),
      });
      expect(res.status).toBe(404);
    });
  });
```

- [ ] **Step 2: Run test to verify the new cases fail**

Run: `npx jest src/app/api/admin/announcements --forceExit`
Expected: the 4 create-route tests and 4 PUT tests still pass, the 2 new DELETE tests FAIL — `DELETE is not a function` (not exported yet)

- [ ] **Step 3: Add the DELETE handler**

In `src/app/api/admin/announcements/[id]/route.ts`, add this function after the existing `PUT` function (keep the existing imports and `PUT` function unchanged):

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await connectToDatabase();
  const existing = await Announcement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  if (existing.imageUrl) {
    await deleteImageFile(existing.imageUrl);
  }

  await Announcement.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/announcements --forceExit`
Expected: `10 passed, 10 total` (4 create + 4 PUT + 2 DELETE)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add delete-announcement API route"
```

---

### Task 7: Admin announcements list page

**Files:**
- Modify: `src/app/admin/dashboard/announcements/page.tsx` (replaces the Task-16-era placeholder)
- Create: `src/app/admin/dashboard/announcements/DeleteAnnouncementButton.tsx`

- [ ] **Step 1: Implement the delete button (client component)**

Create `src/app/admin/dashboard/announcements/DeleteAnnouncementButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAnnouncementButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (loading) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete announcement.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-maroon hover:underline disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
```

- [ ] **Step 2: Replace the placeholder list page**

Replace the full contents of `src/app/admin/dashboard/announcements/page.tsx` (currently just renders `<ComingSoon title="Announcements" />`) with:

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import DeleteAnnouncementButton from "./DeleteAnnouncementButton";

export const dynamic = "force-dynamic";

export default async function AnnouncementsAdminPage() {
  await connectToDatabase();
  const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Announcements</h1>
        <Link
          href="/admin/dashboard/announcements/new"
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          + New
        </Link>
      </div>
      {announcements.length === 0 ? (
        <p className="text-gray-600">No announcements yet.</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-navy">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Image</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => (
              <tr key={a._id.toString()} className="border-b border-gray-100">
                <td className="py-2 pr-4">{a.title}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 pr-4">{a.imageUrl ? "Yes" : "—"}</td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/dashboard/announcements/${a._id.toString()}/edit`}
                    className="mr-3 text-navy hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteAnnouncementButton id={a._id.toString()} title={a.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

`dynamic = "force-dynamic"` is needed because this page reads live database state on every request — without it, Next.js may try to statically cache the page at build time.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, log in, visit `/admin/dashboard/announcements`
Expected: "No announcements yet." message (empty DB), "+ New" button visible (will 404 until Task 10)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin announcements list page"
```

---

### Task 8: Shared announcement form component

**Files:**
- Create: `src/app/admin/dashboard/announcements/AnnouncementForm.tsx`

- [ ] **Step 1: Implement the shared form**

Create `src/app/admin/dashboard/announcements/AnnouncementForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface AnnouncementFormProps {
  mode: "create" | "edit";
  announcementId?: string;
  initialTitle?: string;
  initialBody?: string;
  initialImageUrl?: string | null;
}

export default function AnnouncementForm({
  mode,
  announcementId,
  initialTitle = "",
  initialBody = "",
  initialImageUrl = null,
}: AnnouncementFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    if (removeImage) {
      formData.set("removeImage", "true");
    }

    try {
      const url =
        mode === "create"
          ? "/api/admin/announcements"
          : `/api/admin/announcements/${announcementId}`;
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

      router.push("/admin/dashboard/announcements");
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
        <label htmlFor="body" className="block text-sm font-medium text-navy">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="image" className="block text-sm font-medium text-navy">
          Image {mode === "edit" && "(leave blank to keep current)"}
        </label>
        {mode === "edit" && initialImageUrl && !removeImage && (
          <div className="mt-2 flex items-center gap-3">
            <Image
              src={initialImageUrl}
              alt=""
              width={64}
              height={64}
              className="rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setRemoveImage(true)}
              className="text-sm text-maroon hover:underline"
            >
              Remove image
            </button>
          </div>
        )}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 w-full text-sm"
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
          onClick={() => router.push("/admin/dashboard/announcements")}
          className="rounded border border-gray-300 px-4 py-2 font-medium text-navy transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add shared announcement form component"
```

(No standalone test for this file — it has no pages routing to it yet. It's exercised in Tasks 9 and 10's manual checks.)

---

### Task 9: New announcement page

**Files:**
- Create: `src/app/admin/dashboard/announcements/new/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/admin/dashboard/announcements/new/page.tsx`:

```tsx
import AnnouncementForm from "../AnnouncementForm";

export default function NewAnnouncementPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Announcement</h1>
      <AnnouncementForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, log in, visit `/admin/dashboard/announcements/new`, fill in a title and body (with and without an image across two separate submissions), submit both.
Expected: each submission redirects to `/admin/dashboard/announcements` and the new announcement appears in the table (with a thumbnail indicator for the one with an image).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add new-announcement admin page"
```

---

### Task 10: Edit announcement page

**Files:**
- Create: `src/app/admin/dashboard/announcements/[id]/edit/page.tsx`

**Before you begin:** page props for dynamic segments are also async in this Next.js version (`params: Promise<{ id: string }>`), same as the API route in Task 5.

- [ ] **Step 1: Implement the page**

Create `src/app/admin/dashboard/announcements/[id]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import AnnouncementForm from "../../AnnouncementForm";

export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await connectToDatabase();
  const announcement = await Announcement.findById(id).lean();

  if (!announcement) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Announcement</h1>
      <AnnouncementForm
        mode="edit"
        announcementId={announcement._id.toString()}
        initialTitle={announcement.title}
        initialBody={announcement.body}
        initialImageUrl={announcement.imageUrl}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, log in, from the announcements list click "Edit" on an existing announcement.
Expected: form pre-filled with the existing title/body (and image preview + "Remove image" link if it has one). Change the title, submit — redirects back to the list, shows the updated title. Edit again and click "Remove image" then save — image indicator in the list changes to "—".

- [ ] **Step 3: Test the delete button too, while you're here**

From the list page, click "Delete" on an announcement, confirm the browser confirm dialog, verify it disappears from the list and (if it had an image) the file is gone from `public/uploads/announcements/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add edit-announcement admin page"
```

---

### Task 11: Public announcements page

**Files:**
- Create: `src/app/announcements/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/announcements/page.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  await connectToDatabase();
  const total = await Announcement.countDocuments();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const announcements = await Announcement.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-semibold text-navy">Announcements</h1>
      {announcements.length === 0 ? (
        <p className="text-gray-600">No announcements yet.</p>
      ) : (
        <div className="space-y-8">
          {announcements.map((a) => (
            <article key={a._id.toString()} className="border-b border-gray-200 pb-8">
              {a.imageUrl && (
                <Image
                  src={a.imageUrl}
                  alt=""
                  width={640}
                  height={360}
                  className="mb-4 w-full rounded object-cover"
                />
              )}
              <h2 className="text-xl font-semibold text-navy">{a.title}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(a.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-gray-700">{a.body}</p>
            </article>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="mt-8 flex justify-center gap-4">
          {page > 1 && (
            <Link href={`/announcements?page=${page - 1}`} className="text-navy hover:underline">
              ← Newer
            </Link>
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/announcements?page=${page + 1}`} className="text-navy hover:underline">
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, visit `/announcements` while logged out (should work — this is a public page, no auth needed).
Expected: shows all announcements created in earlier tasks' manual checks, newest first, full content inline, images rendering where present. If you have 10 or fewer announcements, no pagination controls show; if you want to test pagination, temporarily create 11+ via the admin UI and confirm "Older →"/"← Newer" links work and page counts are correct, then delete the extras back down if you don't want to keep them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add public announcements page"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass. Baseline before this module was 31 tests / 11 suites (Foundation & Admin Core). This module adds: proxy (2 new tests in the existing file, now 5 total there — not a new suite), Announcement model (4, new suite), imageUpload (7, new suite), create route (4, new suite), update+delete route (6, new suite) — expect 31 + 2 + 4 + 7 + 4 + 6 = 54 tests total, across 11 + 4 = 15 suites. Treat this as the real expected count, not a guess — if the actual count differs, investigate why before proceeding.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors, no warnings (matches the clean baseline established in Foundation's Task 18).

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run a production build**

Run: `npm run build`
Expected: succeeds, route table includes `/announcements`, `/admin/dashboard/announcements`, `/admin/dashboard/announcements/new`, `/admin/dashboard/announcements/[id]/edit`, `/api/admin/announcements`, `/api/admin/announcements/[id]`.

- [ ] **Step 5: Full manual smoke test**

With local MongoDB running and `npm run dev` started, logged in as admin:
1. Create an announcement with an image — appears in admin list with thumbnail indicator, appears on public `/announcements` page with the image rendered.
2. Create an announcement without an image — appears correctly in both places, no broken image icon.
3. Edit an announcement's title/body — changes reflected in both admin list and public page.
4. Edit an announcement to replace its image — old image file gone from `public/uploads/announcements/`, new one present, public page shows the new image.
5. Edit an announcement to remove its image — image gone from both DB record and disk, list/public page show no image for it.
6. Delete an announcement — gone from admin list and public page, its image file (if any) removed from disk.
7. Log out, then try to directly call `curl -X POST http://localhost:3000/api/admin/announcements` (no cookie) — should get a 401 JSON response, not a redirect or a 500.
8. Visit `/announcements` while logged out — works fine (public page, no auth required).

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip this step if nothing needed fixing.)
