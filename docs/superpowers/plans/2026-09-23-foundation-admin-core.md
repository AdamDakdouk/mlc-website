# Foundation & Admin Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the MLC website's foundation — Next.js + TypeScript + MongoDB project with admin authentication, a security baseline, and a working (mostly placeholder) admin dashboard shell — that every later sub-project (Content Modules, Booking & Scheduling, Public Site) builds on.

**Architecture:** Next.js (App Router) full-stack app, single codebase/deployment. Mongoose connects directly to MongoDB from Next.js API routes and Route Handlers — no separate Express API. JWTs (via `jose`, Edge-and-Node compatible) in an httpOnly cookie gate `/admin/dashboard/*` via Next.js middleware.

**Tech Stack:** TypeScript, Next.js (App Router), MongoDB + Mongoose, `jose` (JWT), `bcryptjs` (password hashing), `zod` (validation), Jest + `mongodb-memory-server` (testing), Tailwind CSS (styling).

---

## Prerequisites

- Node.js 20+ installed
- Local MongoDB running (`mongod` on default port 27017), OR Docker available to run `docker run -d -p 27017:27017 mongo`
- This plan assumes it's run from `C:\dev\mlc-website` (already git-initialized, contains `media/` and `docs/`)

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: entire Next.js scaffold (`package.json`, `tsconfig.json`, `src/app/`, etc.) via `create-next-app`
- Modify: `tailwind.config.ts` (add MLC theme colors)

- [ ] **Step 1: Run create-next-app in the project root**

Run:
```bash
cd /c/dev/mlc-website
npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm
```
If prompted about the directory not being empty (it contains `media/` and `docs/`), confirm/continue — `create-next-app` only refuses when conflicting files like `package.json` already exist, which they don't here.

- [ ] **Step 2: Verify the scaffold**

Run: `ls src/app`
Expected: `favicon.ico  globals.css  layout.tsx  page.tsx` (or similar default Next.js files)

- [ ] **Step 3: Add MLC theme colors to Tailwind**

Check which Tailwind version was scaffolded:

Run: `ls tailwind.config.ts 2>/dev/null || echo "no config file"`

**If `tailwind.config.ts` exists (Tailwind v3):** open it and add a `colors` key inside `theme.extend`:

```ts
  theme: {
    extend: {
      colors: {
        navy: "#1B3A4B",
        maroon: "#8B2E2E",
        cream: "#F7F5F2",
      },
    },
  },
```

**If no config file exists (Tailwind v4, CSS-based theming):** open `src/app/globals.css`. It will start with `@import "tailwindcss";`. Add a `@theme` block right after that import:

```css
@import "tailwindcss";

@theme {
  --color-navy: #1B3A4B;
  --color-maroon: #8B2E2E;
  --color-cream: #F7F5F2;
}
```

Either way, this makes `bg-navy`, `text-navy`, `bg-maroon`, `text-maroon`, `bg-cream` etc. available as Tailwind utility classes, used throughout later tasks.

- [ ] **Step 4: Copy the logo into the project**

Run:
```bash
mkdir -p public/images
cp media/logo/logo.jpg public/images/logo.jpg
```

- [ ] **Step 5: Commit the scaffold**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Testing infrastructure (Jest)

**Files:**
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install test dependencies**

Run:
```bash
npm install --save-dev jest @types/jest mongodb-memory-server tsx
```

- [ ] **Step 2: Create Jest config**

Create `jest.config.ts`:

```ts
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
};

export default createJestConfig(config);
```

- [ ] **Step 3: Create Jest setup file**

Create `jest.setup.ts`:

```ts
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret-please-override-in-real-env-xyz";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@test.local";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "test-password-123";
```

- [ ] **Step 4: Add test scripts to package.json**

In `package.json`, inside `"scripts"`, add:

```json
    "test": "jest",
    "test:watch": "jest --watch",
    "seed": "tsx scripts/seedAdmin.ts"
```

- [ ] **Step 5: Write a smoke test**

Create `src/lib/__tests__/smoke.test.ts`:

```ts
describe("test infrastructure", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `npm test`
Expected: `1 passed, 1 total`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add Jest test infrastructure"
```

---

### Task 3: Environment validation

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/__tests__/env.test.ts`
- Create: `.env.example`
- Create: `.env.local` (gitignored — local placeholder values)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/env.test.ts`:

```ts
describe("env", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("parses valid environment variables", () => {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/mlc-dev";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "supersecret123";

    const { env } = require("@/lib/env");
    expect(env.MONGODB_URI).toBe("mongodb://127.0.0.1:27017/mlc-dev");
    expect(env.JWT_SECRET).toBe("a".repeat(32));
  });

  it("throws when a required variable is missing", () => {
    delete process.env.MONGODB_URI;
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "supersecret123";

    expect(() => require("@/lib/env")).toThrow();
  });

  it("throws when JWT_SECRET is too short", () => {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/mlc-dev";
    process.env.JWT_SECRET = "too-short";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "supersecret123";

    expect(() => require("@/lib/env")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/env.test.ts`
Expected: FAIL — `Cannot find module '@/lib/env'`

- [ ] **Step 3: Install zod**

Run: `npm install zod`

- [ ] **Step 4: Implement env.ts**

Create `src/lib/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/env.test.ts`
Expected: `3 passed, 3 total`

- [ ] **Step 6: Create .env.example**

Create `.env.example`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/mlc-dev
JWT_SECRET=replace-with-a-random-32-plus-character-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password

# Mailtrap (dev email sandbox) — sub-project 3
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=

# Google Calendar service account — sub-project 3
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=
```

- [ ] **Step 7: Create .env.local with placeholder values**

Create `.env.local` (already gitignored by `create-next-app`'s default `.gitignore` — verify with `git check-ignore .env.local`, should print the filename):

```
MONGODB_URI=mongodb://127.0.0.1:27017/mlc-dev
JWT_SECRET=dev-only-secret-change-me-to-something-random-32chars
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=devpassword123
```

Tell the user: fill in real `SMTP_*` and `GOOGLE_*` values in `.env.local` once ready — not required for this sub-project to run.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add validated environment configuration"
```

---

### Task 4: Password hashing utility

**Files:**
- Create: `src/lib/password.ts`
- Create: `src/lib/__tests__/password.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/password.test.ts`:

```ts
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes a password to a different string", async () => {
    const hash = await hashPassword("mySecretPassword123");
    expect(hash).not.toBe("mySecretPassword123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("mySecretPassword123");
    const result = await verifyPassword("mySecretPassword123", hash);
    expect(result).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("mySecretPassword123");
    const result = await verifyPassword("wrongPassword", hash);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/password'`

- [ ] **Step 3: Install bcryptjs**

Run: `npm install bcryptjs && npm install --save-dev @types/bcryptjs`

- [ ] **Step 4: Implement password.ts**

Create `src/lib/password.ts`:

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/password.test.ts`
Expected: `3 passed, 3 total`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add password hashing utility"
```

---

### Task 5: JWT helpers

**Files:**
- Create: `src/lib/jwt.ts`
- Create: `src/lib/__tests__/jwt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/jwt.test.ts`:

```ts
import { signToken, verifyToken } from "@/lib/jwt";

describe("jwt", () => {
  it("signs a payload and verifies it back", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    expect(typeof token).toBe("string");

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("admin@example.com");
    expect(payload?.role).toBe("admin");
  });

  it("returns null for a malformed token", async () => {
    const payload = await verifyToken("not-a-real-token");
    expect(payload).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    process.env.JWT_SECRET = "b".repeat(32);
    jest.resetModules();
    const { signToken: signWithOtherSecret } = require("@/lib/jwt");
    const token = await signWithOtherSecret({ sub: "x@example.com", role: "admin" });

    process.env.JWT_SECRET = "a".repeat(32);
    jest.resetModules();
    const { verifyToken: verifyWithOriginalSecret } = require("@/lib/jwt");
    const payload = await verifyWithOriginalSecret(token);
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/jwt.test.ts`
Expected: FAIL — `Cannot find module '@/lib/jwt'`

- [ ] **Step 3: Install jose**

Run: `npm install jose`

- [ ] **Step 4: Implement jwt.ts**

Create `src/lib/jwt.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const secretKey = new TextEncoder().encode(env.JWT_SECRET);
const ALG = "HS256";
const EXPIRY = "2h";

export interface TokenPayload {
  sub: string;
  role: "admin";
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.sub !== "string" || payload.role !== "admin") {
      return null;
    }
    return { sub: payload.sub, role: "admin" };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/jwt.test.ts`
Expected: `3 passed, 3 total`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add JWT sign/verify helpers using jose"
```

---

### Task 6: Rate limiter utility

**Files:**
- Create: `src/lib/rateLimit.ts`
- Create: `src/lib/__tests__/rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/rateLimit.test.ts`:

```ts
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimit("1.2.3.4");
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
    }
    const result = checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
    expect(result.allowed).toBe(false);
  });

  it("tracks separate keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", { max: 5, windowMs: 900_000 });
    }
    const result = checkRateLimit("5.6.7.8", { max: 5, windowMs: 900_000 });
    expect(result.allowed).toBe(true);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", { max: 5, windowMs: 10 });
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit("1.2.3.4", { max: 5, windowMs: 10 });
        expect(result.allowed).toBe(true);
        resolve(undefined);
      }, 20);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/rateLimit.test.ts`
Expected: FAIL — `Cannot find module '@/lib/rateLimit'`

- [ ] **Step 3: Implement rateLimit.ts**

Create `src/lib/rateLimit.ts`:

```ts
interface RateLimitOptions {
  max: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.max - 1 };
  }

  if (existing.count >= options.max) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: options.max - existing.count };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/rateLimit.test.ts`
Expected: `4 passed, 4 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add in-memory rate limiter"
```

**Note:** This in-memory limiter resets on server restart and doesn't share state across multiple server instances. Fine for a single-instance Phase-1 deployment; flag for revisit (e.g. Redis-backed) if the site is ever deployed behind multiple instances/load balancer.

---

### Task 7: MongoDB connection singleton

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/__tests__/db.test.ts`

- [ ] **Step 1: Install mongoose**

Run: `npm install mongoose`

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/db.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("db connection", () => {
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

  it("connects to MongoDB and returns a ready connection", async () => {
    const { connectToDatabase } = require("@/lib/db");
    const conn = await connectToDatabase();
    expect(conn.connection.readyState).toBe(1);
  });

  it("reuses the cached connection on subsequent calls", async () => {
    const { connectToDatabase } = require("@/lib/db");
    const first = await connectToDatabase();
    const second = await connectToDatabase();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/db.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db'` (first run also downloads the MongoDB Memory Server binary — needs internet, takes ~30s-1min once, cached after)

- [ ] **Step 4: Implement db.ts**

Create `src/lib/db.ts`:

```ts
import mongoose, { type Mongoose } from "mongoose";
import { env } from "@/lib/env";

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cache;

export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/db.test.ts`
Expected: `2 passed, 2 total`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add MongoDB connection singleton"
```

---

### Task 8: User model

**Files:**
- Create: `src/models/User.ts`
- Create: `src/models/__tests__/User.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/models/__tests__/User.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("User model", () => {
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

  it("creates a user with required fields", async () => {
    const { User } = require("@/models/User");
    const user = await User.create({
      email: "admin@example.com",
      passwordHash: "hashed-value",
      role: "admin",
    });
    expect(user.email).toBe("admin@example.com");
    expect(user.role).toBe("admin");
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a duplicate email", async () => {
    const { User } = require("@/models/User");
    await User.create({
      email: "admin@example.com",
      passwordHash: "hashed-value",
      role: "admin",
    });

    await expect(
      User.create({
        email: "admin@example.com",
        passwordHash: "another-hash",
        role: "admin",
      }),
    ).rejects.toThrow();
  });

  it("rejects a missing email", async () => {
    const { User } = require("@/models/User");
    await expect(
      User.create({ passwordHash: "hashed-value", role: "admin" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/User.test.ts`
Expected: FAIL — `Cannot find module '@/models/User'`

- [ ] **Step 3: Implement User.ts**

Create `src/models/User.ts`:

```ts
import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: "admin";
  createdAt: Date;
  lastLoginAt: Date | null;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin"],
    default: "admin",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
});

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/User.test.ts`
Expected: `3 passed, 3 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add User model"
```

---

### Task 9: Seed script for admin user

**Files:**
- Create: `scripts/seedAdmin.ts`

- [ ] **Step 1: Implement the seed script**

Create `scripts/seedAdmin.ts`:

```ts
import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";
import { hashPassword } from "../src/lib/password";
import { env } from "../src/lib/env";

async function seedAdmin() {
  await connectToDatabase();

  const existing = await User.findOne({ email: env.ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin user ${env.ADMIN_EMAIL} already exists. Skipping.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await User.create({
    email: env.ADMIN_EMAIL,
    passwordHash,
    role: "admin",
  });

  console.log(`Admin user ${env.ADMIN_EMAIL} created.`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin user:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed script against local MongoDB**

Ensure local MongoDB is running first (`mongod`, or `docker run -d -p 27017:27017 mongo`), then:

Run: `npm run seed`
Expected: `Admin user admin@example.com created.` (using whatever `ADMIN_EMAIL` is set in `.env.local`)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add admin user seed script"
```

---

### Task 10: Login API route

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/login/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/login/__tests__/route.test.ts`:

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

describe("POST /api/auth/login", () => {
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
    await mongoose.connection.dropDatabase();
    jest.resetModules();
  });

  function makeRequest(body: unknown, ip = "10.0.0.1") {
    return new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
  }

  it("logs in with valid credentials and sets a cookie", async () => {
    const { hashPassword } = require("@/lib/password");
    const { User } = require("@/models/User");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    await User.create({
      email: "admin@example.com",
      passwordHash: await hashPassword("correct-password"),
      role: "admin",
    });

    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "admin@example.com", password: "correct-password" }, "10.0.0.2"),
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get("token")?.value).toBeTruthy();
  });

  it("rejects an incorrect password", async () => {
    const { hashPassword } = require("@/lib/password");
    const { User } = require("@/models/User");
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();
    await User.create({
      email: "admin@example.com",
      passwordHash: await hashPassword("correct-password"),
      role: "admin",
    });

    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "admin@example.com", password: "wrong-password" }, "10.0.0.3"),
    );

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "nobody@example.com", password: "whatever123" }, "10.0.0.4"),
    );

    expect(res.status).toBe(401);
  });

  it("rejects a malformed request body", async () => {
    const { POST } = require("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "not-an-email" }, "10.0.0.5"));

    expect(res.status).toBe(400);
  });

  it("rate-limits after 5 failed attempts from the same IP", async () => {
    const { connectToDatabase } = require("@/lib/db");
    await connectToDatabase();

    const { POST } = require("@/app/api/auth/login/route");
    const ip = "10.0.0.6";

    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ email: "nobody@example.com", password: "whatever123" }, ip));
    }
    const res = await POST(
      makeRequest({ email: "nobody@example.com", password: "whatever123" }, ip),
    );

    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/auth/login`
Expected: FAIL — `Cannot find module '@/app/api/auth/login/route'`

- [ ] **Step 3: Implement the login route**

Create `src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`login:${ip}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = await signToken({ sub: user.email, role: "admin" });

  const response = NextResponse.json({ success: true });
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/auth/login`
Expected: `5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add login API route with rate limiting"
```

---

### Task 11: Logout API route

**Files:**
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/logout/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/logout/__tests__/route.test.ts`:

```ts
import { NextRequest } from "next/server";

describe("POST /api/auth/logout", () => {
  it("clears the token cookie", async () => {
    const { POST } = require("@/app/api/auth/logout/route");
    const res = await POST(new NextRequest("http://localhost/api/auth/logout", { method: "POST" }));

    expect(res.status).toBe(200);
    const cookie = res.cookies.get("token");
    expect(cookie?.value).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/auth/logout`
Expected: FAIL — `Cannot find module '@/app/api/auth/logout/route'`

- [ ] **Step 3: Implement the logout route**

Create `src/app/api/auth/logout/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/auth/logout`
Expected: `1 passed, 1 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add logout API route"
```

---

### Task 12: Middleware route protection

**Files:**
- Create: `src/middleware.ts`
- Create: `src/__tests__/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/middleware.test.ts`:

```ts
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";
import { middleware } from "@/middleware";

describe("middleware", () => {
  it("redirects to /admin/login when no token cookie is present", async () => {
    const request = new NextRequest("http://localhost/admin/dashboard");
    const res = await middleware(request);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("redirects to /admin/login when the token is invalid", async () => {
    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: { cookie: "token=garbage-value" },
    });
    const res = await middleware(request);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("allows the request through when the token is valid", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: { cookie: `token=${token}` },
    });
    const res = await middleware(request);

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/middleware.test.ts`
Expected: FAIL — `Cannot find module '@/middleware'`

- [ ] **Step 3: Implement middleware.ts**

Create `src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/middleware.test.ts`
Expected: `3 passed, 3 total`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add middleware to protect admin dashboard routes"
```

---

### Task 13: Security headers

**Files:**
- Modify: `next.config.ts` (or `next.config.js` / `next.config.mjs` — whichever `create-next-app` generated in Task 1; check with `ls next.config.*`)

- [ ] **Step 1: Add security headers**

Open the generated Next.js config file. Replace its contents with (adjust the export syntax to match the file's existing module format — `.ts`/`.mjs` use `export default`, `.js` uses `module.exports`):

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

Note: `script-src 'unsafe-inline'` is a temporary allowance — Next.js's dev mode and some hydration scripts need it. Revisit with a nonce-based CSP when this goes to production (flag for the Public Site & Marketing Polish sub-project).

- [ ] **Step 2: Verify the dev server starts cleanly**

Run: `npm run dev` (then stop it with Ctrl+C after confirming it starts without errors)
Expected: `Ready in ...` with no config errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add security headers"
```

---

### Task 14: Admin login page UI

**Files:**
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Implement the login page**

Create `src/app/admin/login/page.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <div className="mb-6 flex justify-center">
          <Image src="/images/logo.jpg" alt="MLC logo" width={80} height={80} className="rounded-full" />
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-navy">
          Admin Login
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-navy focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-maroon">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-navy px-4 py-2 font-medium text-white transition hover:bg-navy/90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, visit `http://localhost:3000/admin/login`
Expected: Login form renders with MLC logo, navy/maroon theme colors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add admin login page"
```

---

### Task 15: Admin dashboard layout and overview page

**Files:**
- Create: `src/app/admin/dashboard/layout.tsx`
- Create: `src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Implement the dashboard layout**

Create `src/app/admin/dashboard/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/dashboard/announcements", label: "Announcements" },
  { href: "/admin/dashboard/teachers", label: "Teachers" },
  { href: "/admin/dashboard/calendar", label: "Academic Calendar" },
  { href: "/admin/dashboard/careers", label: "Careers" },
  { href: "/admin/dashboard/bookings", label: "Bookings" },
  { href: "/admin/dashboard/achievements", label: "Achievements" },
  { href: "/admin/dashboard/meeting-requests", label: "Meeting Requests" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="w-64 flex-shrink-0 bg-navy text-white">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <Image src="/images/logo.jpg" alt="MLC logo" width={40} height={40} className="rounded-full" />
          <span className="font-semibold">MLC Admin</span>
        </div>
        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-gray-200 bg-white p-4">
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement the logout button (client component)**

Create `src/app/admin/dashboard/LogoutButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded border border-maroon px-3 py-1.5 text-sm text-maroon transition hover:bg-maroon hover:text-white"
    >
      Log out
    </button>
  );
}
```

- [ ] **Step 3: Implement the overview page**

Create `src/app/admin/dashboard/page.tsx`:

```tsx
export default function DashboardOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Welcome back</h1>
      <p className="mt-2 text-gray-600">
        This is the MLC admin dashboard. Use the sidebar to manage site content.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Manual check**

Run: `npm run dev`, log in at `http://localhost:3000/admin/login` with the seeded admin credentials
Expected: Redirects to `/admin/dashboard`, sidebar with all module links visible, logout button works and redirects back to login

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add admin dashboard layout and overview page"
```

---

### Task 16: Placeholder pages for future modules

**Files:**
- Create: `src/app/admin/dashboard/announcements/page.tsx`
- Create: `src/app/admin/dashboard/teachers/page.tsx`
- Create: `src/app/admin/dashboard/calendar/page.tsx`
- Create: `src/app/admin/dashboard/careers/page.tsx`
- Create: `src/app/admin/dashboard/bookings/page.tsx`
- Create: `src/app/admin/dashboard/achievements/page.tsx`
- Create: `src/app/admin/dashboard/meeting-requests/page.tsx`

- [ ] **Step 1: Create a shared placeholder component**

Create `src/components/ComingSoon.tsx`:

```tsx
export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-gray-600">Coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 2: Create each placeholder page**

Create `src/app/admin/dashboard/announcements/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function AnnouncementsPage() {
  return <ComingSoon title="Announcements" />;
}
```

Create `src/app/admin/dashboard/teachers/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function TeachersPage() {
  return <ComingSoon title="Teachers" />;
}
```

Create `src/app/admin/dashboard/calendar/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function CalendarPage() {
  return <ComingSoon title="Academic Calendar" />;
}
```

Create `src/app/admin/dashboard/careers/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function CareersPage() {
  return <ComingSoon title="Careers" />;
}
```

Create `src/app/admin/dashboard/bookings/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function BookingsPage() {
  return <ComingSoon title="Bookings" />;
}
```

Create `src/app/admin/dashboard/achievements/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function AchievementsPage() {
  return <ComingSoon title="Achievements" />;
}
```

Create `src/app/admin/dashboard/meeting-requests/page.tsx`:
```tsx
import ComingSoon from "@/components/ComingSoon";
export default function MeetingRequestsPage() {
  return <ComingSoon title="Meeting Requests" />;
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`, click through every sidebar link
Expected: Each page loads, shows its title + "Coming soon.", no 404s

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add placeholder pages for future admin modules"
```

---

### Task 17: README

**Files:**
- Create: `README.md` (or modify, if `create-next-app` generated one)

- [ ] **Step 1: Write setup instructions**

Create/replace `README.md`:

```markdown
# MLC Website

Website for Modernistic Learning Community (MLC), Bchamoun, Lebanon.

## Stack

TypeScript, Next.js (App Router), MongoDB + Mongoose, Tailwind CSS.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values (a local dev config with placeholder secrets is enough to run the app; see comments in `.env.example` for what each var is for).
3. Start local MongoDB: `mongod`, or `docker run -d -p 27017:27017 mongo`.
4. Seed the admin user: `npm run seed`
5. Start the dev server: `npm run dev`
6. Visit `http://localhost:3000/admin/login` and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local`.

## Testing

`npm test` runs the full Jest suite (uses an in-memory MongoDB for DB-touching tests — no local MongoDB required for tests, only for running the app itself).

## Project structure

See `docs/superpowers/specs/2026-09-23-foundation-admin-core-design.md` for the architecture this was built from.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add README with setup instructions"
```

---

### Task 18: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (env, password, jwt, rateLimit, db, User model, login route, logout route, middleware — 21 tests total across all tasks)

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run a type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Full manual smoke test**

With local MongoDB running and the dev server started (`npm run dev`):
1. Visit `/admin/dashboard` directly while logged out → should redirect to `/admin/login`
2. Log in with wrong password → should show an error, stay on login page
3. Log in with correct credentials (seeded via `npm run seed`) → should redirect to `/admin/dashboard`, sidebar visible
4. Click through all 7 placeholder module links → each loads without error
5. Click "Log out" → should redirect to `/admin/login`; visiting `/admin/dashboard` again should redirect back to login

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

(Skip this step if nothing needed fixing.)
