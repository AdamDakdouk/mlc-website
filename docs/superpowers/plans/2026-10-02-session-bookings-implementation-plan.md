# Session Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin posts bookable "Session" calendar events (teacher, date/time, duration, capacity, price). Public applies via a Careers-style form (name/email/phone/address + payment-proof upload for a manual Whish payment). Admin verifies payment, which emails the applicant a confirmation.

**Architecture:** "Session" is a new `CalendarEvent` category with extra conditional fields. `SessionApplication` is a new model tracking Pending→Verified/Rejected. Capacity is enforced with an atomic `$inc`/`$expr` conditional update (no check-then-write race). `nodemailer` sends the confirmation email via the already-scaffolded Mailtrap SMTP env vars.

**Tech Stack:** Next.js 16 App Router, TypeScript, Mongoose, Zod, `nodemailer` (new dependency), private filesystem storage for payment proofs.

**Spec:** `docs/superpowers/specs/2026-10-02-session-bookings-design.md`

---

### Task 1: Add nodemailer dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install nodemailer && npm install --save-dev @types/nodemailer`

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add nodemailer dependency"
```

---

### Task 2: Mailer

**Files:**
- Create: `src/lib/mailer.ts`

- [ ] **Step 1: Write the file**

```ts
import nodemailer from "nodemailer";
import { SITE_ADDRESS } from "@/lib/siteContact";

// Lazily created so tests that mock this module never need real SMTP env
// vars, and so a missing env var only breaks the code path that actually
// sends mail, not every import of this file.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export interface SessionConfirmationEmailParams {
  to: string;
  recipientName: string;
  sessionTitle: string;
  teacherName: string;
  sessionDateTime: Date;
  durationMinutes: number;
  price: number;
}

export async function sendSessionConfirmationEmail(
  params: SessionConfirmationEmailParams,
): Promise<void> {
  await getTransporter().sendMail({
    from: '"Modernistic Learning Community" <no-reply@mlc.edu.lb>',
    to: params.to,
    subject: `You're confirmed: ${params.sessionTitle}`,
    text: [
      `Hi ${params.recipientName},`,
      "",
      `Your payment has been verified and your spot in "${params.sessionTitle}" is confirmed.`,
      "",
      `Teacher: ${params.teacherName}`,
      `Date & time: ${params.sessionDateTime.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "full", timeStyle: "short" })}`,
      `Duration: ${params.durationMinutes} minutes`,
      `Price paid: $${params.price}`,
      `Location: ${SITE_ADDRESS}`,
      "",
      "See you there!",
      "Modernistic Learning Community",
    ].join("\n"),
  });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (No test file for this task — it's a thin wrapper exercised indirectly by Task 13's route tests via `jest.mock`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/mailer.ts
git commit -m "feat: add session confirmation mailer"
```

---

### Task 3: Session category + Whish contact constant

**Files:**
- Modify: `src/lib/calendarCategories.ts`
- Modify: `src/lib/siteContact.ts`

- [ ] **Step 1: Extend calendarCategories.ts**

Change:
```ts
export const CATEGORIES = ["Academic", "Holiday", "Event"] as const;
```
to:
```ts
export const CATEGORIES = ["Academic", "Holiday", "Event", "Session"] as const;
```

Change:
```ts
export const CATEGORY_BG_CLASS: Record<Category, string> = {
  Academic: "bg-navy",
  Holiday: "bg-maroon",
  Event: "bg-gold",
};

export const CATEGORY_TEXT_CLASS: Record<Category, string> = {
  Academic: "text-white",
  Holiday: "text-white",
  Event: "text-navy",
};
```
to:
```ts
export const CATEGORY_BG_CLASS: Record<Category, string> = {
  Academic: "bg-navy",
  Holiday: "bg-maroon",
  Event: "bg-gold",
  Session: "bg-navy",
};

export const CATEGORY_TEXT_CLASS: Record<Category, string> = {
  Academic: "text-white",
  Holiday: "text-white",
  Event: "text-navy",
  Session: "text-white",
};
```

- [ ] **Step 2: Extend siteContact.ts**

Add this line to `src/lib/siteContact.ts`, after the existing `SITE_EMAIL` export:
```ts
export const SITE_WHISH_CONTACT = "+961 3 000 000"; // placeholder — update once a real Whish number/link is available
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendarCategories.ts src/lib/siteContact.ts
git commit -m "feat: add Session calendar category and Whish contact constant"
```

---

### Task 4: SessionApplication status constant

**Files:**
- Create: `src/lib/sessionApplicationStatuses.ts`

- [ ] **Step 1: Write the file**

```ts
export const SESSION_APPLICATION_STATUSES = ["Pending", "Verified", "Rejected"] as const;

export type SessionApplicationStatus = (typeof SESSION_APPLICATION_STATUSES)[number];
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sessionApplicationStatuses.ts
git commit -m "feat: add SessionApplicationStatus shared constant"
```

---

### Task 5: Extend CalendarEvent model with Session fields

**Files:**
- Modify: `src/models/CalendarEvent.ts`
- Modify: `src/models/__tests__/CalendarEvent.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/models/__tests__/CalendarEvent.test.ts`, right after the `"creates a valid multi-day event"` test:

```ts
  it("defaults applicantCount to 0", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });

    expect(event.applicantCount).toBe(0);
  });

  it("stores Session-only fields", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const mongoose = require("mongoose");
    const teacherId = new mongoose.Types.ObjectId();

    const event = await CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
      teacherId,
      sessionDateTime: new Date("2026-10-05T15:00:00.000Z"),
      durationMinutes: 90,
      capacity: 10,
      price: 20,
    });

    expect(event.teacherId.toString()).toBe(teacherId.toString());
    expect(event.sessionDateTime.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(event.durationMinutes).toBe(90);
    expect(event.capacity).toBe(10);
    expect(event.price).toBe(20);
    expect(event.applicantCount).toBe(0);
  });

  it("allows a non-Session event with no session fields set", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");

    const event = await CalendarEvent.create({
      title: "Winter Break",
      category: "Holiday",
      startDate: new Date("2026-12-20"),
      endDate: new Date("2027-01-05"),
    });

    expect(event.teacherId).toBeUndefined();
    expect(event.sessionDateTime).toBeUndefined();
    expect(event.durationMinutes).toBeUndefined();
    expect(event.capacity).toBeUndefined();
    expect(event.price).toBeUndefined();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/models/__tests__/CalendarEvent.test.ts`
Expected: the 2 new tests FAIL (`event.teacherId` etc. don't exist on the schema yet — the "stores Session-only fields" test fails because those fields aren't persisted, and the "allows a non-Session event" test currently passes vacuously, but re-run after Step 3 to confirm it stays green).

- [ ] **Step 3: Extend the model**

Replace the full contents of `src/models/CalendarEvent.ts` with:

```ts
import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { CATEGORIES, type Category } from "@/lib/calendarCategories";

export interface ICalendarEvent extends Document {
  title: string;
  category: Category;
  startDate: Date;
  endDate: Date;
  description: string;
  teacherId?: Types.ObjectId;
  sessionDateTime?: Date;
  durationMinutes?: number;
  capacity?: number;
  price?: number;
  applicantCount: number;
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
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: false,
    },
    sessionDateTime: {
      type: Date,
      required: false,
    },
    durationMinutes: {
      type: Number,
      required: false,
      min: 1,
      max: 480,
    },
    capacity: {
      type: Number,
      required: false,
      min: 1,
      max: 500,
    },
    price: {
      type: Number,
      required: false,
      min: 0,
      max: 100000,
    },
    applicantCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

export const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ??
  mongoose.model<ICalendarEvent>("CalendarEvent", calendarEventSchema);
```

Session-field requiredness is enforced at the API layer (Task 9/10's zod `.superRefine`), not at the Mongoose schema layer — same approach this codebase already uses for every other category-conditional field (e.g. `MeetingRequest`'s status-conditional `confirmedDateTime` handling is application-layer, not schema-layer).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/models/__tests__/CalendarEvent.test.ts`
Expected: PASS, 8/8 tests (6 original + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/models/CalendarEvent.ts src/models/__tests__/CalendarEvent.test.ts
git commit -m "feat: add Session fields to CalendarEvent model"
```

---

### Task 6: SessionApplication model

**Files:**
- Create: `src/models/SessionApplication.ts`
- Create: `src/models/__tests__/SessionApplication.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("SessionApplication model", () => {
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

  it("creates a valid application, defaulting status to Pending", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");
    const sessionId = new mongoose.Types.ObjectId();

    const application = await SessionApplication.create({
      sessionId,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+961 1 234567",
      address: "123 Main St, Bchamoun",
      paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
    });

    expect(application.status).toBe("Pending");
    expect(application.sessionId.toString()).toBe(sessionId.toString());
    expect(application.submittedAt).toBeInstanceOf(Date);
  });

  it("rejects a missing name", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing email", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing phone", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing address", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing sessionId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing paymentProofFilename", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
      }),
    ).rejects.toThrow();
  });

  it("rejects a status outside the fixed enum", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { SessionApplication } = require("@/models/SessionApplication");

    await expect(
      SessionApplication.create({
        sessionId: new mongoose.Types.ObjectId(),
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "123",
        address: "123 Main St",
        paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
        status: "Maybe",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/models/__tests__/SessionApplication.test.ts`
Expected: FAIL — `Cannot find module '@/models/SessionApplication'`.

- [ ] **Step 3: Write the model**

```ts
import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  SESSION_APPLICATION_STATUSES,
  type SessionApplicationStatus,
} from "@/lib/sessionApplicationStatuses";

export type { SessionApplicationStatus };

export interface ISessionApplication extends Document {
  sessionId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentProofFilename: string;
  status: SessionApplicationStatus;
  submittedAt: Date;
}

const sessionApplicationSchema = new Schema<ISessionApplication>({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: "CalendarEvent",
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
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  paymentProofFilename: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: [...SESSION_APPLICATION_STATUSES],
    default: "Pending",
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

export const SessionApplication: Model<ISessionApplication> =
  mongoose.models.SessionApplication ??
  mongoose.model<ISessionApplication>("SessionApplication", sessionApplicationSchema);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/models/__tests__/SessionApplication.test.ts`
Expected: PASS, 8/8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/models/SessionApplication.ts src/models/__tests__/SessionApplication.test.ts
git commit -m "feat: add SessionApplication model"
```

---

### Task 7: Private payment-proof upload utility

**Files:**
- Create: `src/lib/paymentProofUpload.ts`
- Create: `src/lib/__tests__/paymentProofUpload.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFile as fsReadFile } from "fs/promises";
import path from "path";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const NOT_IMAGE_BYTES = Buffer.from("just some text, not an image");

const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private");

describe("paymentProofUpload", () => {
  const createdFilenames: string[] = [];

  afterEach(async () => {
    const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
    for (const filename of createdFilenames.splice(0)) {
      await deletePaymentProofFile(filename);
    }
  });

  describe("validateAndSavePaymentProof", () => {
    it("saves a valid JPEG and returns a UUID-based filename", async () => {
      const { validateAndSavePaymentProof } = require("@/lib/paymentProofUpload");
      const file = new File([JPEG_BYTES], "proof.jpg", { type: "image/jpeg" });

      const filename = await validateAndSavePaymentProof(file);
      createdFilenames.push(filename);

      expect(filename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
      const saved = await fsReadFile(path.join(PRIVATE_ROOT, "payment-proofs", filename));
      expect(saved.equals(JPEG_BYTES)).toBe(true);
    });

    it("rejects a file that isn't actually an image, regardless of claimed type", async () => {
      const { validateAndSavePaymentProof, PaymentProofValidationError } = require("@/lib/paymentProofUpload");
      const file = new File([NOT_IMAGE_BYTES], "proof.jpg", { type: "image/jpeg" });

      await expect(validateAndSavePaymentProof(file)).rejects.toThrow(PaymentProofValidationError);
    });

    it("rejects a file over 5MB", async () => {
      const { validateAndSavePaymentProof, PaymentProofValidationError } = require("@/lib/paymentProofUpload");
      const bigBytes = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
      const file = new File([bigBytes], "proof.jpg", { type: "image/jpeg" });

      await expect(validateAndSavePaymentProof(file)).rejects.toThrow(PaymentProofValidationError);
    });
  });

  describe("readPaymentProofFile", () => {
    it("reads back a saved proof", async () => {
      const { validateAndSavePaymentProof, readPaymentProofFile } = require("@/lib/paymentProofUpload");
      const file = new File([JPEG_BYTES], "proof.jpg", { type: "image/jpeg" });
      const filename = await validateAndSavePaymentProof(file);
      createdFilenames.push(filename);

      const buffer = await readPaymentProofFile(filename);
      expect(buffer.equals(JPEG_BYTES)).toBe(true);
    });

    it("rejects a filename that doesn't match the expected UUID.ext shape", async () => {
      const { readPaymentProofFile, PaymentProofValidationError } = require("@/lib/paymentProofUpload");

      await expect(readPaymentProofFile("../../etc/passwd")).rejects.toThrow(PaymentProofValidationError);
      await expect(readPaymentProofFile("not-a-uuid.jpg")).rejects.toThrow(PaymentProofValidationError);
    });
  });

  describe("deletePaymentProofFile", () => {
    it("deletes a saved proof", async () => {
      const { validateAndSavePaymentProof, deletePaymentProofFile, readPaymentProofFile } = require("@/lib/paymentProofUpload");
      const file = new File([JPEG_BYTES], "proof.jpg", { type: "image/jpeg" });
      const filename = await validateAndSavePaymentProof(file);
      createdFilenames.push(filename);

      await deletePaymentProofFile(filename);

      await expect(readPaymentProofFile(filename)).rejects.toThrow();
    });

    it("does not throw when deleting a non-existent file", async () => {
      const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
      await expect(
        deletePaymentProofFile("22222222-2222-2222-2222-222222222222.jpg"),
      ).resolves.not.toThrow();
    });

    it("silently no-ops for a malformed filename rather than deleting arbitrary paths", async () => {
      const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
      await expect(deletePaymentProofFile("../../etc/passwd")).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/__tests__/paymentProofUpload.test.ts`
Expected: FAIL — `Cannot find module '@/lib/paymentProofUpload'`.

- [ ] **Step 3: Write the utility**

```ts
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Deliberately outside `public/` — same reasoning as src/lib/resumeUpload.ts:
// a payment screenshot is at least as sensitive as a resume and must only
// ever be reachable through the authenticated admin download route.
const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private", "payment-proofs");

const FILENAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export class PaymentProofValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProofValidationError";
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

export async function validateAndSavePaymentProof(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new PaymentProofValidationError("Payment proof exceeds 5MB limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    throw new PaymentProofValidationError("Payment proof must be a JPEG, PNG, or WebP image");
  }

  const ext = ALLOWED_TYPES[detectedType];
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(PRIVATE_ROOT, { recursive: true });
  await writeFile(path.join(PRIVATE_ROOT, filename), buffer);

  return filename;
}

export async function readPaymentProofFile(filename: string): Promise<Buffer> {
  if (!FILENAME_RE.test(filename)) {
    throw new PaymentProofValidationError("Invalid payment proof filename");
  }
  return readFile(path.join(PRIVATE_ROOT, filename));
}

export async function deletePaymentProofFile(filename: string): Promise<void> {
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

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/lib/__tests__/paymentProofUpload.test.ts`
Expected: PASS, 9/9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paymentProofUpload.ts src/lib/__tests__/paymentProofUpload.test.ts
git commit -m "feat: add private payment-proof upload utility"
```

---

### Task 8: Extend admin calendar POST route for Session fields

**Files:**
- Modify: `src/app/api/admin/calendar/route.ts`
- Modify: `src/app/api/admin/calendar/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/app/api/admin/calendar/__tests__/route.test.ts`, right before the final closing `});`:

```ts
  async function createTeacher() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    return Teacher.create({ name: "Mr. Smith", email: "mr.smith@example.com", subjects: ["Math"] });
  }

  it("creates a Session event with all session fields", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await CalendarEvent.findById(data.id);
    expect(saved.teacherId.toString()).toBe(teacher._id.toString());
    expect(saved.sessionDateTime.toISOString()).toContain("2026-10-05T15:00");
    expect(saved.durationMinutes).toBe(90);
    expect(saved.capacity).toBe(10);
    expect(saved.price).toBe(20);
    expect(saved.applicantCount).toBe(0);
    expect(saved.startDate.toISOString()).toContain("2026-10-05");
    expect(saved.endDate.toISOString()).toContain("2026-10-05");
  });

  it("rejects a Session event missing teacherId", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing sessionDateTime", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing durationMinutes", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing capacity", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event missing price", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event with a non-existent teacherId", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const mongoose = require("mongoose");
    const missingTeacherId = new mongoose.Types.ObjectId().toString();
    const { POST } = require("@/app/api/admin/calendar/route");

    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: missingTeacherId,
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session event with an invalid sessionDateTime", async () => {
    const teacher = await createTeacher();
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-02-30T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("does not require session fields for a non-Session category", async () => {
    const { POST } = require("@/app/api/admin/calendar/route");
    const res = await POST(
      makeRequest({ title: "Open House", category: "Event", startDate: "2026-10-05" }),
    );
    expect(res.status).toBe(201);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/app/api/admin/calendar/__tests__/route.test.ts`
Expected: the 9 new tests FAIL (the 4 "missing X" tests and the "does not require" test currently pass vacuously since the route ignores unknown fields — re-check them after Step 3; the "creates a Session event," "non-existent teacherId," and "invalid sessionDateTime" tests fail for real: session fields aren't persisted/validated yet).

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/admin/calendar/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { CATEGORIES } from "@/lib/calendarCategories";
import { isRealCalendarDate } from "@/lib/calendarDate";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventFieldsSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    category: z.enum(CATEGORIES),
    startDate: z.string().regex(DATE_RE, "Invalid start date"),
    endDate: z.string().regex(DATE_RE, "Invalid end date").optional(),
    description: z.string().max(1000, "Description is too long").optional(),
    teacherId: z.string().min(1).optional(),
    sessionDateTime: z.string().regex(DATETIME_RE, "Invalid date/time").optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    price: z.number().min(0).max(100000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category !== "Session") return;
    if (!data.teacherId) {
      ctx.addIssue({ code: "custom", path: ["teacherId"], message: "Teacher is required" });
    }
    if (!data.sessionDateTime) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionDateTime"],
        message: "Date & time is required",
      });
    }
    if (data.durationMinutes === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Duration is required",
      });
    }
    if (data.capacity === undefined) {
      ctx.addIssue({ code: "custom", path: ["capacity"], message: "Capacity is required" });
    }
    if (data.price === undefined) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required" });
    }
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

  if (!isRealCalendarDate(parsed.data.startDate)) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  if (parsed.data.endDate && !isRealCalendarDate(parsed.data.endDate)) {
    return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
  }

  await connectToDatabase();

  let startDate = new Date(parsed.data.startDate);
  let endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;

  let teacherId: string | undefined;
  let sessionDateTime: Date | undefined;

  if (parsed.data.category === "Session") {
    if (!isRealDateTime(parsed.data.sessionDateTime!)) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
    }
    const teacher = await Teacher.findById(parsed.data.teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 400 });
    }
    teacherId = parsed.data.teacherId;
    sessionDateTime = new Date(`${parsed.data.sessionDateTime}:00.000Z`);
    // For grid placement, a Session's date range is just the day it falls
    // on — the calendar grid, monthUtils.ts, and CalendarGrid.tsx need no
    // changes at all, since a Session is a single-day event as far as the
    // grid is concerned.
    startDate = new Date(sessionDateTime.toISOString().slice(0, 10));
    endDate = startDate;
  }

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  const event = await CalendarEvent.create({
    title: parsed.data.title,
    category: parsed.data.category,
    startDate,
    endDate,
    description: parsed.data.description ?? "",
    ...(parsed.data.category === "Session"
      ? {
          teacherId,
          sessionDateTime,
          durationMinutes: parsed.data.durationMinutes,
          capacity: parsed.data.capacity,
          price: parsed.data.price,
        }
      : {}),
  });

  return NextResponse.json({ id: event._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/app/api/admin/calendar/__tests__/route.test.ts`
Expected: PASS, 18/18 tests (9 original + 9 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/calendar/route.ts src/app/api/admin/calendar/__tests__/route.test.ts
git commit -m "feat: accept Session fields in the admin calendar create route"
```

---

### Task 9: Extend admin calendar PUT route for Session fields

**Files:**
- Modify: `src/app/api/admin/calendar/[id]/route.ts`
- Modify: `src/app/api/admin/calendar/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/app/api/admin/calendar/[id]/__tests__/route.test.ts`, right after the `"rejects an update with an invalid calendar date"` test:

```ts
  async function createTeacher() {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    return Teacher.create({ name: "Mr. Smith", email: "mr.smith@example.com", subjects: ["Math"] });
  }

  it("updates a Session event's session fields", async () => {
    const event = await createEvent();
    const teacher = await createTeacher();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: teacher._id.toString(),
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updated = await CalendarEvent.findById(event._id);
    expect(updated.category).toBe("Session");
    expect(updated.teacherId.toString()).toBe(teacher._id.toString());
    expect(updated.durationMinutes).toBe(90);
    expect(updated.capacity).toBe(10);
    expect(updated.price).toBe(20);
  });

  it("rejects a Session update missing teacherId", async () => {
    const event = await createEvent();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Session update with a non-existent teacherId", async () => {
    const event = await createEvent();
    const mongoose = require("mongoose");
    const missingTeacherId = new mongoose.Types.ObjectId().toString();
    const { PUT } = require("@/app/api/admin/calendar/[id]/route");

    const res = await PUT(
      makeRequest("PUT", event._id.toString(), {
        title: "Math Session",
        category: "Session",
        startDate: "2026-10-05",
        teacherId: missingTeacherId,
        sessionDateTime: "2026-10-05T15:00",
        durationMinutes: 90,
        capacity: 10,
        price: 20,
      }),
      { params: Promise.resolve({ id: event._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("clears session fields when a Session event's category is switched away from Session", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const teacher = await createTeacher();
    const sessionEvent = await CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
      teacherId: teacher._id,
      sessionDateTime: new Date("2026-10-05T15:00:00.000Z"),
      durationMinutes: 90,
      capacity: 10,
      price: 20,
    });

    const { PUT } = require("@/app/api/admin/calendar/[id]/route");
    const res = await PUT(
      makeRequest("PUT", sessionEvent._id.toString(), {
        title: "Open House",
        category: "Event",
        startDate: "2026-10-05",
      }),
      { params: Promise.resolve({ id: sessionEvent._id.toString() }) },
    );
    expect(res.status).toBe(200);

    const updated = await CalendarEvent.findById(sessionEvent._id);
    expect(updated.category).toBe("Event");
    expect(updated.teacherId).toBeUndefined();
    expect(updated.sessionDateTime).toBeUndefined();
    expect(updated.durationMinutes).toBeUndefined();
    expect(updated.capacity).toBeUndefined();
    expect(updated.price).toBeUndefined();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/app/api/admin/calendar/\[id\]/__tests__/route.test.ts`
Expected: the 4 new tests FAIL.

- [ ] **Step 3: Rewrite the PUT handler**

Replace the full contents of `src/app/api/admin/calendar/[id]/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { SessionApplication } from "@/models/SessionApplication";
import { CATEGORIES } from "@/lib/calendarCategories";
import { isRealCalendarDate } from "@/lib/calendarDate";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventFieldsSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    category: z.enum(CATEGORIES),
    startDate: z.string().regex(DATE_RE, "Invalid start date"),
    endDate: z.string().regex(DATE_RE, "Invalid end date").optional(),
    description: z.string().max(1000, "Description is too long").optional(),
    teacherId: z.string().min(1).optional(),
    sessionDateTime: z.string().regex(DATETIME_RE, "Invalid date/time").optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    price: z.number().min(0).max(100000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category !== "Session") return;
    if (!data.teacherId) {
      ctx.addIssue({ code: "custom", path: ["teacherId"], message: "Teacher is required" });
    }
    if (!data.sessionDateTime) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionDateTime"],
        message: "Date & time is required",
      });
    }
    if (data.durationMinutes === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Duration is required",
      });
    }
    if (data.capacity === undefined) {
      ctx.addIssue({ code: "custom", path: ["capacity"], message: "Capacity is required" });
    }
    if (data.price === undefined) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required" });
    }
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

  if (
    !isRealCalendarDate(parsed.data.startDate) ||
    (parsed.data.endDate && !isRealCalendarDate(parsed.data.endDate))
  ) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await CalendarEvent.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let startDate = new Date(parsed.data.startDate);
  let endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;

  if (parsed.data.category === "Session") {
    if (!isRealDateTime(parsed.data.sessionDateTime!)) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
    }
    const teacher = await Teacher.findById(parsed.data.teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 400 });
    }
    const sessionDateTime = new Date(`${parsed.data.sessionDateTime}:00.000Z`);
    startDate = new Date(sessionDateTime.toISOString().slice(0, 10));
    endDate = startDate;

    existing.teacherId = new mongoose.Types.ObjectId(parsed.data.teacherId);
    existing.sessionDateTime = sessionDateTime;
    existing.durationMinutes = parsed.data.durationMinutes;
    existing.capacity = parsed.data.capacity;
    existing.price = parsed.data.price;
  } else {
    // Switching away from Session clears the now-meaningless session
    // fields rather than leaving stale data hanging off the document.
    existing.teacherId = undefined;
    existing.sessionDateTime = undefined;
    existing.durationMinutes = undefined;
    existing.capacity = undefined;
    existing.price = undefined;
  }

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
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

  const hasApplications = await SessionApplication.exists({ sessionId: id });
  if (hasApplications) {
    return NextResponse.json(
      { error: "Cannot delete a session with existing applications" },
      { status: 409 },
    );
  }

  await CalendarEvent.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
```

Note: this rewrite also folds in Task 10's DELETE guard (`SessionApplication.exists`) — Task 10 below only adds the tests for it, since editing the same file twice in two separate tasks would just churn the same few lines.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/app/api/admin/calendar/\[id\]/__tests__/route.test.ts`
Expected: PASS, 11/11 tests (7 original + 4 new). The DELETE tests still pass unchanged since none of them involve a `SessionApplication`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/calendar/[id]/route.ts" "src/app/api/admin/calendar/[id]/__tests__/route.test.ts"
git commit -m "feat: accept Session fields and add deletion guard to admin calendar update route"
```

---

### Task 10: Test the calendar-deletion guard against SessionApplication

**Files:**
- Modify: `src/app/api/admin/calendar/[id]/__tests__/route.test.ts`

The guard itself was already implemented in Task 9's `DELETE` handler rewrite (`SessionApplication.exists({ sessionId: id })` → 409). This task only adds the test that proves it.

- [ ] **Step 1: Write the failing test**

Add this test to `src/app/api/admin/calendar/[id]/__tests__/route.test.ts`, right after the `"deletes an event"` test:

```ts
  it("returns 409 and does not delete when the session has existing applications", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const { SessionApplication } = require("@/models/SessionApplication");
    const { Teacher } = require("@/models/Teacher");

    const teacher = await Teacher.create({
      name: "Mr. Smith",
      email: "mr.smith@example.com",
      subjects: ["Math"],
    });
    const sessionEvent = await CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
      teacherId: teacher._id,
      sessionDateTime: new Date("2026-10-05T15:00:00.000Z"),
      durationMinutes: 90,
      capacity: 10,
      price: 20,
    });
    await SessionApplication.create({
      sessionId: sessionEvent._id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "123",
      address: "123 Main St",
      paymentProofFilename: "11111111-1111-1111-1111-111111111111.jpg",
    });

    const { DELETE } = require("@/app/api/admin/calendar/[id]/route");
    const res = await DELETE(makeRequest("DELETE", sessionEvent._id.toString()), {
      params: Promise.resolve({ id: sessionEvent._id.toString() }),
    });
    expect(res.status).toBe(409);

    const found = await CalendarEvent.findById(sessionEvent._id);
    expect(found).not.toBeNull();
  });
```

- [ ] **Step 2: Run to verify pass**

Run: `npx jest src/app/api/admin/calendar/\[id\]/__tests__/route.test.ts`
Expected: PASS, 12/12 tests (the guard was already implemented in Task 9, so this should pass immediately — if it doesn't, Task 9's `DELETE` rewrite has a bug, fix it there, not here).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/calendar/[id]/__tests__/route.test.ts"
git commit -m "test: verify the calendar-deletion guard against SessionApplication"
```

---

### Task 11: Public apply route

**Files:**
- Create: `src/app/api/calendar/[id]/apply/route.ts`
- Create: `src/app/api/calendar/[id]/apply/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("POST /api/calendar/[id]/apply", () => {
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

  function makeFormData(overrides: Record<string, string> = {}, includeProof = true) {
    const formData = new FormData();
    formData.set("name", overrides.name ?? "Jane Doe");
    formData.set("email", overrides.email ?? "jane@example.com");
    formData.set("phone", overrides.phone ?? "+961 1 234567");
    formData.set("address", overrides.address ?? "123 Main St, Bchamoun");
    if (includeProof) {
      formData.set(
        "paymentProof",
        new File([new Uint8Array(JPEG_BYTES)], "proof.jpg", { type: "image/jpeg" }),
      );
    }
    return formData;
  }

  function makeRequest(id: string, formData: FormData) {
    return new NextRequest(`http://localhost/api/calendar/${id}/apply`, {
      method: "POST",
      body: formData,
    });
  }

  async function createSession(overrides: Partial<{ sessionDateTime: Date; capacity: number; applicantCount: number }> = {}) {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { Teacher } = require("@/models/Teacher");
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const teacher = await Teacher.create({
      name: "Mr. Smith",
      email: "mr.smith@example.com",
      subjects: ["Math"],
    });
    const sessionDateTime = overrides.sessionDateTime ?? new Date("2099-10-05T15:00:00.000Z");
    return CalendarEvent.create({
      title: "Math Session",
      category: "Session",
      startDate: new Date(sessionDateTime.toISOString().slice(0, 10)),
      endDate: new Date(sessionDateTime.toISOString().slice(0, 10)),
      teacherId: teacher._id,
      sessionDateTime,
      durationMinutes: 90,
      capacity: overrides.capacity ?? 10,
      applicantCount: overrides.applicantCount ?? 0,
      price: 20,
    });
  }

  it("creates an application and increments applicantCount", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(session._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();

    const { SessionApplication } = require("@/models/SessionApplication");
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const saved = await SessionApplication.findById(data.id);
    expect(saved.name).toBe("Jane Doe");
    expect(saved.address).toBe("123 Main St, Bchamoun");
    expect(saved.status).toBe("Pending");
    expect(saved.sessionId.toString()).toBe(session._id.toString());

    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(1);
  });

  it("rejects a missing name", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(
      makeRequest(session._id.toString(), makeFormData({ name: "" })),
      { params: Promise.resolve({ id: session._id.toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing payment proof", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(
      makeRequest(session._id.toString(), makeFormData({}, false)),
      { params: Promise.resolve({ id: session._id.toString() }) },
    );
    expect(res.status).toBe(400);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(0);
  });

  it("rejects an invalid payment proof file, rolling back the reserved spot", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");
    const formData = makeFormData({}, false);
    formData.set("paymentProof", new File([new Uint8Array([0, 1, 2, 3])], "fake.jpg", { type: "image/jpeg" }));

    const res = await POST(makeRequest(session._id.toString(), formData), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(400);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(0);
  });

  it("returns 404 for a non-existent session id", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const missingId = new mongoose.Types.ObjectId().toString();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(missingId, makeFormData()), {
      params: Promise.resolve({ id: missingId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-Session category event", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    const { CalendarEvent } = require("@/models/CalendarEvent");
    const event = await CalendarEvent.create({
      title: "Open House",
      category: "Event",
      startDate: new Date("2026-10-05"),
      endDate: new Date("2026-10-05"),
    });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(event._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: event._id.toString() }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the session's date/time has already passed", async () => {
    const session = await createSession({ sessionDateTime: new Date("2020-01-01T10:00:00.000Z") });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(session._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 when the session is full", async () => {
    const session = await createSession({ capacity: 1, applicantCount: 1 });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const res = await POST(makeRequest(session._id.toString(), makeFormData()), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(409);
  });

  it("allows exactly one of two concurrent applies for the last spot to succeed", async () => {
    const session = await createSession({ capacity: 5, applicantCount: 4 });
    const { POST } = require("@/app/api/calendar/[id]/apply/route");

    const [resA, resB] = await Promise.all([
      POST(makeRequest(session._id.toString(), makeFormData({ email: "a@example.com" })), {
        params: Promise.resolve({ id: session._id.toString() }),
      }),
      POST(makeRequest(session._id.toString(), makeFormData({ email: "b@example.com" })), {
        params: Promise.resolve({ id: session._id.toString() }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const { CalendarEvent } = require("@/models/CalendarEvent");
    const updatedSession = await CalendarEvent.findById(session._id);
    expect(updatedSession.applicantCount).toBe(5);
  });

  it("rejects a request over the body size limit", async () => {
    const session = await createSession();
    const { POST } = require("@/app/api/calendar/[id]/apply/route");
    const request = new NextRequest(`http://localhost/api/calendar/${session._id.toString()}/apply`, {
      method: "POST",
      headers: { "content-length": String(6 * 1024 * 1024 + 1) },
      body: makeFormData(),
    });

    const res = await POST(request, { params: Promise.resolve({ id: session._id.toString() }) });
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/app/api/calendar/\[id\]/apply`
Expected: FAIL — `Cannot find module '@/app/api/calendar/[id]/apply/route'`.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { SessionApplication } from "@/models/SessionApplication";
import {
  validateAndSavePaymentProof,
  deletePaymentProofFile,
  PaymentProofValidationError,
} from "@/lib/paymentProofUpload";

const applicationFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  address: z.string().min(1, "Address is required").max(200, "Address is too long"),
});

// The cap covers a payment-proof image (up to 5MB, enforced again inside
// validateAndSavePaymentProof) plus form-field overhead — same reasoning as
// src/app/api/careers/[id]/apply/route.ts's MAX_REQUEST_SIZE, this is the
// app's third unauthenticated public write endpoint and this check is a
// sanity guard, not a real ceiling: a request with no Content-Length header
// skips it entirely. Real enforcement needs a reverse-proxy/hosting-level
// body-size limit, deferred until a hosting target is chosen.
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
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  const proofFile = formData.get("paymentProof");
  if (!(proofFile instanceof File) || proofFile.size === 0) {
    return NextResponse.json({ error: "A payment proof image is required" }, { status: 400 });
  }

  await connectToDatabase();
  const session = await CalendarEvent.findById(id);
  if (!session || session.category !== "Session") {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.sessionDateTime!.getTime() <= Date.now()) {
    return NextResponse.json({ error: "This session's applications are closed" }, { status: 409 });
  }

  // Atomic capacity reservation: MongoDB evaluates the filter (including
  // $expr) and applies the $inc as a single atomic per-document operation,
  // so two requests racing for the last spot can't both succeed — one of
  // them simply won't match this filter and reservedSession comes back
  // null. This is the one place in this feature where a plain
  // check-then-write race would produce a real bug (overselling seats),
  // not a cosmetic one, so it gets this treatment instead of the
  // accepted-tradeoff treatment used elsewhere in this codebase (e.g. the
  // Teacher reorder endpoint's cosmetic order-tie race).
  const reservedSession = await CalendarEvent.findOneAndUpdate(
    { _id: id, category: "Session", $expr: { $lt: ["$applicantCount", "$capacity"] } },
    { $inc: { applicantCount: 1 } },
  );
  if (!reservedSession) {
    return NextResponse.json({ error: "This session is full" }, { status: 409 });
  }

  let proofFilename: string;
  try {
    proofFilename = await validateAndSavePaymentProof(proofFile);
  } catch (err) {
    await CalendarEvent.updateOne({ _id: id }, { $inc: { applicantCount: -1 } });
    if (err instanceof PaymentProofValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const application = await SessionApplication.create({
      sessionId: id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      paymentProofFilename: proofFilename,
    });
    return NextResponse.json({ id: application._id.toString() }, { status: 201 });
  } catch (err) {
    await CalendarEvent.updateOne({ _id: id }, { $inc: { applicantCount: -1 } });
    await deletePaymentProofFile(proofFilename);
    throw err;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/app/api/calendar/\[id\]/apply`
Expected: PASS, 9/9 tests. Pay particular attention to the "allows exactly one of two concurrent applies" test — if it's flaky or both succeed, the `$expr` atomicity has a bug; do not proceed to the next task until it passes reliably (run it 3 times in a row).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/calendar/[id]/apply" "src/app/api/calendar"
git commit -m "feat: add public session-application endpoint with atomic capacity reservation"
```

---

### Task 12: Admin applications verify/reject route

**Files:**
- Create: `src/app/api/admin/calendar/applications/[id]/route.ts`
- Create: `src/app/api/admin/calendar/applications/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/app/api/admin/calendar/applications`
Expected: FAIL — `Cannot find module '@/app/api/admin/calendar/applications/[id]/route'`.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { SessionApplication } from "@/models/SessionApplication";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { sendSessionConfirmationEmail } from "@/lib/mailer";
import { type SessionApplicationStatus } from "@/lib/sessionApplicationStatuses";

// A SessionApplication is created as "Pending" by the public apply route
// and only ever transitions away from it here, once — never back to
// Pending, and never re-transitioned once Verified/Rejected (see the
// existing.status !== "Pending" guard below). Typed against the shared
// status union so a typo here is caught by the compiler.
const UPDATABLE_STATUSES = [
  "Verified",
  "Rejected",
] as const satisfies readonly SessionApplicationStatus[];

const updateFieldsSchema = z.object({
  status: z.enum(UPDATABLE_STATUSES),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
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

  await connectToDatabase();
  const existing = await SessionApplication.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (existing.status !== "Pending") {
    return NextResponse.json(
      { error: "This application has already been reviewed" },
      { status: 409 },
    );
  }

  if (parsed.data.status === "Rejected") {
    await CalendarEvent.updateOne(
      { _id: existing.sessionId },
      { $inc: { applicantCount: -1 } },
    );
  }

  if (parsed.data.status === "Verified") {
    const session = await CalendarEvent.findById(existing.sessionId);
    const teacher = session?.teacherId ? await Teacher.findById(session.teacherId) : null;
    if (session) {
      try {
        await sendSessionConfirmationEmail({
          to: existing.email,
          recipientName: existing.name,
          sessionTitle: session.title,
          teacherName: teacher?.name ?? "TBD",
          sessionDateTime: session.sessionDateTime!,
          durationMinutes: session.durationMinutes!,
          price: session.price!,
        });
      } catch (err) {
        // Best-effort: email delivery is deferred/sandboxed infrastructure
        // (Mailtrap in dev, no production provider chosen yet) across this
        // whole project — a send failure must never block the actual
        // verification, only get logged.
        console.error("Failed to send session confirmation email:", err);
      }
    }
  }

  existing.status = parsed.data.status;
  await existing.save();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/app/api/admin/calendar/applications`
Expected: PASS, 7/7 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/calendar/applications/[id]/route.ts" "src/app/api/admin/calendar/applications/[id]/__tests__/route.test.ts"
git commit -m "feat: add admin session-application verify/reject endpoint"
```

---

### Task 13: Admin applications delete route

**Files:**
- Modify: `src/app/api/admin/calendar/applications/[id]/route.ts`
- Modify: `src/app/api/admin/calendar/applications/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `src/app/api/admin/calendar/applications/[id]/__tests__/route.test.ts`, right after the closing `});` of the `describe("PUT", ...)` block (still inside the outer `describe`):

```ts
  describe("DELETE", () => {
    it("deletes an application and its proof file, without touching applicantCount", async () => {
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
      expect(updatedSession.applicantCount).toBe(1);
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/app/api/admin/calendar/applications`
Expected: the 3 new tests FAIL (no `DELETE` export yet).

- [ ] **Step 3: Add the DELETE handler**

Add this to `src/app/api/admin/calendar/applications/[id]/route.ts`, after the `PUT` function, and add `deletePaymentProofFile` to the existing `@/lib/paymentProofUpload` import:

```ts
import { deletePaymentProofFile } from "@/lib/paymentProofUpload";
```

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await SessionApplication.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  await SessionApplication.deleteOne({ _id: id });
  await deletePaymentProofFile(existing.paymentProofFilename);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/app/api/admin/calendar/applications`
Expected: PASS, 10/10 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/calendar/applications/[id]/route.ts" "src/app/api/admin/calendar/applications/[id]/__tests__/route.test.ts"
git commit -m "feat: add admin session-application delete endpoint"
```

---

### Task 14: Admin payment-proof download route

**Files:**
- Create: `src/app/api/admin/calendar/applications/[id]/payment-proof/route.ts`
- Create: `src/app/api/admin/calendar/applications/[id]/payment-proof/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/app/api/admin/calendar/applications/\[id\]/payment-proof`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import path from "path";
import { connectToDatabase } from "@/lib/db";
import { SessionApplication } from "@/models/SessionApplication";
import { readPaymentProofFile } from "@/lib/paymentProofUpload";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const application = await SessionApplication.findById(id).lean();
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readPaymentProofFile(application.paymentProofFilename);
  } catch {
    return NextResponse.json({ error: "Payment proof file not found" }, { status: 404 });
  }

  const ext = path.extname(application.paymentProofFilename);
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      // Unlike the Careers resume route (which forces a download for a
      // PDF), this is an image — previewing it inline in the browser is
      // more useful for an admin quickly checking a payment screenshot.
      "Content-Disposition": "inline",
    },
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/app/api/admin/calendar/applications/\[id\]/payment-proof`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: all suites pass — this is a good checkpoint to confirm nothing in Tasks 1–14 broke any pre-existing test before moving on to UI work.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/admin/calendar/applications/[id]/payment-proof"
git commit -m "feat: add admin payment-proof download route"
```

---

### Task 15: Carry Session fields through to the public calendar grid

**Files:**
- Modify: `src/app/(public)/calendar/monthUtils.ts`
- Modify: `src/app/(public)/calendar/page.tsx`

No new tests — `monthUtils.test.ts` covers pure date-grid logic that isn't changing; the new fields just ride along on the existing `CalendarEventLike`/`GridEvent` shape. UI is verified manually in the final task.

- [ ] **Step 1: Extend the event shape**

In `src/app/(public)/calendar/monthUtils.ts`, change:
```ts
export interface CalendarEventLike {
  id: string;
  title: string;
  category: string;
  startDate: string; // YYYY-MM-DD, UTC
  endDate: string; // YYYY-MM-DD, UTC
  description: string;
}
```
to:
```ts
export interface CalendarEventLike {
  id: string;
  title: string;
  category: string;
  startDate: string; // YYYY-MM-DD, UTC
  endDate: string; // YYYY-MM-DD, UTC
  description: string;
  teacherName?: string;
  sessionDateTime?: string; // ISO
  durationMinutes?: number;
  price?: number;
  capacity?: number;
  applicantCount?: number;
}
```

`buildMonthGrid`'s spread (`{ ...e, isStart: ... }`) already carries any extra fields through — no other change needed in this file.

- [ ] **Step 2: Resolve teacher names and pass Session fields through**

In `src/app/(public)/calendar/page.tsx`, add this import:
```ts
import { Teacher } from "@/models/Teacher";
```

Change:
```ts
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
```
to:
```ts
  await connectToDatabase();
  // Fetch anything that could overlap the visible 42-day grid, not just
  // events strictly inside the calendar month — the grid shows trailing
  // days from the previous month and leading days from the next.
  const rangeStart = new Date(Date.UTC(previous.year, previous.month - 1, 1));
  const rangeEnd = new Date(Date.UTC(next.year, next.month, 0));
  const [events, teachers] = await Promise.all([
    CalendarEvent.find({
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    })
      .sort({ startDate: 1 })
      .lean(),
    Teacher.find().select("name").lean(),
  ]);
  const teacherNameById = new Map(teachers.map((t) => [t._id.toString(), t.name]));

  const eventsForGrid = events.map((e) => ({
    id: e._id.toString(),
    title: e.title,
    category: e.category,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
    description: e.description,
    ...(e.category === "Session"
      ? {
          teacherName: e.teacherId ? (teacherNameById.get(e.teacherId.toString()) ?? "TBD") : "TBD",
          sessionDateTime: e.sessionDateTime!.toISOString(),
          durationMinutes: e.durationMinutes,
          price: e.price,
          capacity: e.capacity,
          applicantCount: e.applicantCount,
        }
      : {}),
  }));
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest src/app/\(public\)/calendar`
Expected: `monthUtils.test.ts` still passes unchanged (15/15).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/calendar/monthUtils.ts" "src/app/(public)/calendar/page.tsx"
git commit -m "feat: carry Session fields through to the public calendar grid"
```

---

### Task 16: Show Session details and an Apply link in the calendar detail panel

**Files:**
- Modify: `src/app/(public)/calendar/CalendarGrid.tsx`

- [ ] **Step 1: Add the Session detail block**

In `src/app/(public)/calendar/CalendarGrid.tsx`, add this import:
```ts
import Link from "next/link";
```

Change the detail panel's closing section:
```tsx
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
```
to:
```tsx
      {selected && (
        <div className="mt-4 rounded border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-navy">{selected.title}</h3>
              <p className="text-sm text-gray-600">
                {selected.category === "Session" && selected.sessionDateTime
                  ? new Date(selected.sessionDateTime).toLocaleString(undefined, {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : selected.startDate === selected.endDate
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
          {selected.category === "Session" && (
            <SessionDetails event={selected} />
          )}
        </div>
      )}
```

- [ ] **Step 2: Add the SessionDetails sub-component**

Add this component at the bottom of the same file, after the default-exported `CalendarGrid` function:

```tsx
function SessionDetails({ event }: { event: GridEvent }) {
  const capacity = event.capacity ?? 0;
  const applicantCount = event.applicantCount ?? 0;
  const spotsRemaining = capacity - applicantCount;
  const isFull = spotsRemaining <= 0;
  const hasPassed = event.sessionDateTime ? new Date(event.sessionDateTime).getTime() <= Date.now() : false;

  return (
    <dl className="mt-3 space-y-1 text-sm text-gray-700">
      <div>
        <dt className="inline font-medium text-navy">Teacher: </dt>
        <dd className="inline">{event.teacherName}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-navy">Duration: </dt>
        <dd className="inline">{event.durationMinutes} minutes</dd>
      </div>
      <div>
        <dt className="inline font-medium text-navy">Price: </dt>
        <dd className="inline">${event.price}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-navy">Spots remaining: </dt>
        <dd className="inline">{Math.max(0, spotsRemaining)}</dd>
      </div>
      <div className="pt-2">
        {hasPassed ? (
          <span className="text-maroon">Applications closed</span>
        ) : isFull ? (
          <span className="text-maroon">Session full</span>
        ) : (
          <Link
            href={`/calendar/${event.id}/apply`}
            className="inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90"
          >
            Apply
          </Link>
        )}
      </div>
    </dl>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/calendar/CalendarGrid.tsx"
git commit -m "feat: show Session details and an Apply link on the public calendar"
```

---

### Task 17: Public apply page

**Files:**
- Create: `src/app/(public)/calendar/[id]/apply/page.tsx`
- Create: `src/app/(public)/calendar/[id]/apply/SessionApplyForm.tsx`

- [ ] **Step 1: Write the form component**

```tsx
"use client";

import { useState, type FormEvent } from "react";

export default function SessionApplyForm({ sessionId }: { sessionId: string }) {
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
      const res = await fetch(`/api/calendar/${sessionId}/apply`, {
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
    return (
      <p className="text-navy">
        Application received — you&apos;ll get a confirmation email once your payment is verified.
      </p>
    );
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
        <label htmlFor="address" className="block text-sm font-medium text-navy">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="paymentProof" className="block text-sm font-medium text-navy">
          Payment proof (screenshot)
        </label>
        <input
          id="paymentProof"
          name="paymentProof"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="mt-1 w-full text-sm"
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

- [ ] **Step 2: Write the page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { SITE_WHISH_CONTACT } from "@/lib/siteContact";
import SessionApplyForm from "./SessionApplyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for a Session — MLC",
  description: "Apply for a session at Modernistic Learning Community.",
};

export default async function SessionApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const session = await CalendarEvent.findById(id).lean();

  if (!session || session.category !== "Session") {
    notFound();
  }

  const teacher = session.teacherId
    ? await Teacher.findById(session.teacherId).select("name").lean()
    : null;

  const spotsRemaining = (session.capacity ?? 0) - (session.applicantCount ?? 0);
  const hasPassed = session.sessionDateTime ? session.sessionDateTime.getTime() <= Date.now() : false;
  const isFull = spotsRemaining <= 0;

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-navy">{session.title}</h1>
      <dl className="mb-8 space-y-1 text-sm text-gray-700">
        <div>
          <dt className="inline font-medium text-navy">Teacher: </dt>
          <dd className="inline">{teacher?.name ?? "TBD"}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-navy">Date &amp; time: </dt>
          <dd className="inline">
            {session.sessionDateTime!.toLocaleString(undefined, {
              timeZone: "UTC",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium text-navy">Duration: </dt>
          <dd className="inline">{session.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt className="inline font-medium text-navy">Price: </dt>
          <dd className="inline">${session.price}</dd>
        </div>
      </dl>

      {hasPassed ? (
        <p className="text-maroon">Applications for this session are closed.</p>
      ) : isFull ? (
        <p className="text-maroon">This session is full.</p>
      ) : (
        <>
          <div className="mb-6 rounded border border-gray-200 bg-cream p-4 text-sm text-gray-700">
            <p className="font-medium text-navy">Payment instructions</p>
            <p className="mt-1">
              Send <strong>${session.price}</strong> via Whish to{" "}
              <strong>{SITE_WHISH_CONTACT}</strong>, then upload a screenshot of the payment below.
            </p>
          </div>
          <SessionApplyForm sessionId={id} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/calendar/[id]"
git commit -m "feat: add public session apply page"
```

---

### Task 18: Conditional Session fields in the admin calendar form

**Files:**
- Modify: `src/app/admin/dashboard/calendar/CalendarEventForm.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/calendarCategories";

interface TeacherOption {
  id: string;
  name: string;
}

interface CalendarEventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  teachers: TeacherOption[];
  initialTitle?: string;
  initialCategory?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDescription?: string;
  initialTeacherId?: string;
  initialSessionDateTime?: string;
  initialDurationMinutes?: number;
  initialCapacity?: number;
  initialPrice?: number;
}

export default function CalendarEventForm({
  mode,
  eventId,
  teachers,
  initialTitle = "",
  initialCategory = CATEGORIES[0],
  initialStartDate = "",
  initialEndDate = "",
  initialDescription = "",
  initialTeacherId = "",
  initialSessionDateTime = "",
  initialDurationMinutes,
  initialCapacity,
  initialPrice,
}: CalendarEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [description, setDescription] = useState(initialDescription);
  const [teacherId, setTeacherId] = useState(initialTeacherId || teachers[0]?.id || "");
  const [sessionDateTime, setSessionDateTime] = useState(initialSessionDateTime);
  const [durationMinutes, setDurationMinutes] = useState(
    initialDurationMinutes?.toString() ?? "",
  );
  const [capacity, setCapacity] = useState(initialCapacity?.toString() ?? "");
  const [price, setPrice] = useState(initialPrice?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSession = category === "Session";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      title,
      category,
      description,
    };

    if (isSession) {
      body.startDate = sessionDateTime ? sessionDateTime.slice(0, 10) : "";
      body.teacherId = teacherId;
      body.sessionDateTime = sessionDateTime;
      body.durationMinutes = durationMinutes ? Number(durationMinutes) : undefined;
      body.capacity = capacity ? Number(capacity) : undefined;
      body.price = price ? Number(price) : undefined;
    } else {
      body.startDate = startDate;
      body.endDate = endDate || undefined;
    }

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

      {isSession ? (
        <>
          <div>
            <label htmlFor="teacherId" className="block text-sm font-medium text-navy">
              Teacher
            </label>
            <select
              id="teacherId"
              required
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
            >
              {teachers.length === 0 && <option value="">No teachers available</option>}
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sessionDateTime" className="block text-sm font-medium text-navy">
              Date &amp; time
            </label>
            <input
              id="sessionDateTime"
              type="datetime-local"
              required
              value={sessionDateTime}
              onChange={(e) => setSessionDateTime(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="durationMinutes" className="block text-sm font-medium text-navy">
                Duration (minutes)
              </label>
              <input
                id="durationMinutes"
                type="number"
                min={1}
                max={480}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="capacity" className="block text-sm font-medium text-navy">
                Capacity
              </label>
              <input
                id="capacity"
                type="number"
                min={1}
                max={500}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="price" className="block text-sm font-medium text-navy">
                Price (USD)
              </label>
              <input
                id="price"
                type="number"
                min={0}
                max={100000}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
              />
            </div>
          </div>
        </>
      ) : (
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
      )}

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

Note on `body.startDate` in the `isSession` branch: the PUT/POST routes (Tasks 8–9) already re-derive `startDate`/`endDate` from `sessionDateTime` server-side and ignore the client-sent `startDate` for Session events in practice — sending `sessionDateTime.slice(0, 10)` here just satisfies the zod schema's `startDate` requirement (still present on the wire shape) with a value that's already correct, not a value the server actually trusts. This mirrors the schema staying literally required for both categories rather than being made conditional, keeping the zod schema's shape simpler.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (the two page files that render this component won't compile yet since they don't pass the now-required `teachers` prop — that's expected, fixed in Task 19 next; if you want a clean intermediate `tsc` pass, do Tasks 18 and 19 as one combined commit instead of stopping here).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/calendar/CalendarEventForm.tsx
git commit -m "feat: add conditional Session fields to the admin calendar form"
```

---

### Task 19: Wire teacher list and Session fields into the calendar new/edit pages

**Files:**
- Modify: `src/app/admin/dashboard/calendar/new/page.tsx`
- Modify: `src/app/admin/dashboard/calendar/[id]/edit/page.tsx`

- [ ] **Step 1: Replace the new-event page**

Replace the full contents of `src/app/admin/dashboard/calendar/new/page.tsx` with:

```tsx
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import CalendarEventForm from "../CalendarEventForm";

export const dynamic = "force-dynamic";

export default async function NewCalendarEventPage() {
  await connectToDatabase();
  const teachers = await Teacher.find().select("name").sort({ order: 1 }).lean();
  const teacherOptions = teachers.map((t) => ({ id: t._id.toString(), name: t.name }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Calendar Event</h1>
      <CalendarEventForm mode="create" teachers={teacherOptions} />
    </div>
  );
}
```

- [ ] **Step 2: Replace the edit-event page**

Replace the full contents of `src/app/admin/dashboard/calendar/[id]/edit/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
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
  const [event, teachers] = await Promise.all([
    CalendarEvent.findById(id).lean(),
    Teacher.find().select("name").sort({ order: 1 }).lean(),
  ]);

  if (!event) {
    notFound();
  }

  const teacherOptions = teachers.map((t) => ({ id: t._id.toString(), name: t.name }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Calendar Event</h1>
      <CalendarEventForm
        mode="edit"
        eventId={event._id.toString()}
        teachers={teacherOptions}
        initialTitle={event.title}
        initialCategory={event.category}
        initialStartDate={event.startDate.toISOString().slice(0, 10)}
        initialEndDate={event.endDate.toISOString().slice(0, 10)}
        initialDescription={event.description}
        initialTeacherId={event.teacherId?.toString() ?? ""}
        initialSessionDateTime={event.sessionDateTime?.toISOString().slice(0, 16) ?? ""}
        initialDurationMinutes={event.durationMinutes}
        initialCapacity={event.capacity}
        initialPrice={event.price}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all suites pass — full-suite checkpoint before the remaining admin list/applications UI tasks.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/dashboard/calendar/new/page.tsx "src/app/admin/dashboard/calendar/[id]/edit/page.tsx"
git commit -m "feat: pass teacher list and Session fields into the admin calendar form pages"
```

---

### Task 20: Applications count link on the admin calendar list

**Files:**
- Modify: `src/app/admin/dashboard/calendar/page.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { SessionApplication } from "@/models/SessionApplication";
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

  const rows = await Promise.all(
    events.map(async (e) => ({
      id: e._id.toString(),
      title: e.title,
      category: e.category,
      startDate: e.startDate,
      endDate: e.endDate,
      applicationCount:
        e.category === "Session"
          ? await SessionApplication.countDocuments({ sessionId: e._id })
          : null,
    })),
  );

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
      {rows.length === 0 ? (
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
                  <td className="py-2 pr-4 text-gray-600">{r.category}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {formatDateRange(r.startDate, r.endDate)}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {r.applicationCount === null ? (
                      "—"
                    ) : (
                      <Link
                        href={`/admin/dashboard/calendar/${r.id}/applications`}
                        className="text-navy hover:underline"
                      >
                        {r.applicationCount}
                      </Link>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/dashboard/calendar/${r.id}/edit`}
                      aria-label={`Edit "${r.title}"`}
                      className="mr-3 text-navy hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteEntityButton
                      id={r.id}
                      label={r.title}
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

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/calendar/page.tsx
git commit -m "feat: show an applications count link for Session rows in the admin calendar list"
```

---

### Task 21: Admin per-session applications page

**Files:**
- Create: `src/app/admin/dashboard/calendar/[id]/applications/page.tsx`
- Create: `src/app/admin/dashboard/calendar/[id]/applications/SessionApplicationActions.tsx`

- [ ] **Step 1: Write the actions component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionApplicationStatus } from "@/lib/sessionApplicationStatuses";

interface SessionApplicationActionsProps {
  applicationId: string;
  status: SessionApplicationStatus;
  applicantLabel: string;
}

export default function SessionApplicationActions({
  applicationId,
  status,
  applicantLabel,
}: SessionApplicationActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "Verified" | "Rejected") {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/calendar/applications/${applicationId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    const confirmMessage =
      status === "Pending"
        ? `Delete this application from "${applicantLabel}"? This cannot be undone and will NOT free up their reserved spot — reject it first if you want to release the spot.`
        : `Delete this application from "${applicantLabel}"? This cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/calendar/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  if (status !== "Pending") {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">{status}</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-maroon hover:underline disabled:opacity-50"
        >
          Delete
        </button>
        {error && (
          <span role="alert" className="text-xs text-maroon">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => updateStatus("Verified")}
          disabled={loading}
          className="rounded bg-navy px-3 py-1 text-xs font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
        >
          Verify
        </button>
        <button
          type="button"
          onClick={() => updateStatus("Rejected")}
          disabled={loading}
          className="rounded border border-maroon px-3 py-1 text-xs font-medium text-maroon transition hover:bg-maroon/10 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-maroon hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-maroon">
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { SessionApplication } from "@/models/SessionApplication";
import SessionApplicationActions from "./SessionApplicationActions";
import type { SessionApplicationStatus } from "@/lib/sessionApplicationStatuses";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<SessionApplicationStatus, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Verified: "bg-navy/10 text-navy",
  Rejected: "bg-maroon/10 text-maroon",
};

export default async function SessionApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const session = await CalendarEvent.findById(id).lean();
  if (!session || session.category !== "Session") {
    notFound();
  }

  const applications = await SessionApplication.find({ sessionId: id })
    .sort({ submittedAt: -1 })
    .lean();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-navy">Applications</h1>
      <p className="mb-6 text-gray-600">
        {session.title} — {session.applicantCount}/{session.capacity} spots reserved
      </p>
      {applications.length === 0 ? (
        <p className="text-gray-600">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((a) => (
            <div key={a._id.toString()} className="rounded border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-navy">{a.name}</p>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {a.email} · {a.phone}
                  </p>
                  <p className="text-sm text-gray-600">{a.address}</p>
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(a.submittedAt).toLocaleString(undefined, { timeZone: "UTC" })}
                  </p>
                  <a
                    href={`/api/admin/calendar/applications/${a._id.toString()}/payment-proof`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View payment proof for "${a.name}"`}
                    className="mt-1 inline-block text-sm text-navy hover:underline"
                  >
                    View payment proof
                  </a>
                </div>
                <SessionApplicationActions
                  applicationId={a._id.toString()}
                  status={a.status}
                  applicantLabel={a.name}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all suites pass — final regression checkpoint before manual verification.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/dashboard/calendar/[id]/applications"
git commit -m "feat: add admin per-session applications page"
```

---

### Task 22: Manual browser verification

No new files — this is a verification pass across everything built in Tasks 1–21.

Note on email: without real `SMTP_USER`/`SMTP_PASS` Mailtrap credentials in `.env.local`, `sendSessionConfirmationEmail` will fail — by design (Task 12) this is caught and logged, not surfaced as an error, so Verify will still succeed and show "Verified" in the UI even if no email actually sends. Check the terminal running `next dev` for a logged `Failed to send session confirmation email:` line to confirm the code path ran; that's sufficient verification if no real Mailtrap credentials are configured. If credentials *are* configured, check the Mailtrap inbox for the actual email.

- [ ] **Step 1: Create a Session**

As admin, create a new calendar event with category "Session": pick a teacher, a near-future date/time, a duration, a capacity of 2, and a price. Confirm it saves and appears correctly in `/admin/dashboard/calendar`'s list with "0" applications (a clickable link).

- [ ] **Step 2: Public calendar view**

Visit `/calendar`, navigate to the session's month, click it. Confirm the detail panel shows teacher/duration/price/spots-remaining and an "Apply" button.

- [ ] **Step 3: Apply as a student**

Click Apply, fill the form (name/email/phone/address), upload a real JPEG/PNG as the payment proof, submit. Confirm the success message, and confirm the calendar detail panel now shows one fewer spot remaining.

- [ ] **Step 4: Fill capacity and confirm "full" state**

Apply a second time (capacity 2) — confirm it succeeds and the session now shows "Session full" instead of an Apply button on the calendar and on `/calendar/[id]/apply` directly.

- [ ] **Step 5: Admin reviews applications**

In `/admin/dashboard/calendar`, click the "2" applications link for the session. Confirm both applications show with Pending status, contact details, and a working "View payment proof" link that opens the uploaded image inline.

- [ ] **Step 6: Verify one, reject the other**

Click Verify on the first application — confirm it flips to "Verified" (with only a Delete action remaining) and check the dev server's terminal output for either a successful Mailtrap send or the logged failure line (see the note above). Click Reject on the second — confirm it flips to "Rejected", and re-check the calendar detail panel / session list: applicant count should have dropped back by one (capacity now shows one spot free again).

- [ ] **Step 7: Confirm a rejected applicant can reapply**

Re-visit `/calendar/[id]/apply` for the same session — confirm Apply is available again (one spot freed by the rejection) and a fresh application can be submitted.

- [ ] **Step 8: Confirm the calendar-deletion guard**

Attempt to delete the Session event from `/admin/dashboard/calendar` while it still has applications — confirm it's blocked with the "Cannot delete a session with existing applications" error (surfaced via `DeleteEntityButton`'s existing generic error-display path, no UI change needed).

- [ ] **Step 9: Confirm non-Session categories are unaffected**

Create/edit a plain "Event" or "Holiday" category entry — confirm the form shows the original Start/End Date fields (not the Session fields), saves correctly, and renders on the calendar exactly as before.

